-- ============================================================
-- HISTÓRICO DE SINAIS / PAGAMENTOS PARCIAIS DA OS
-- ============================================================

-- 1. Tabela de sinais (1 OS -> N sinais)
CREATE TABLE IF NOT EXISTS public.os_sinais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_servico_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  oficina_id UUID NOT NULL,
  valor NUMERIC NOT NULL CHECK (valor > 0),
  forma_pagamento TEXT,
  forma_pagamento_id UUID,
  data_pagamento DATE NOT NULL DEFAULT CURRENT_DATE,
  observacao TEXT,
  financeiro_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_os_sinais_os ON public.os_sinais(ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_os_sinais_oficina ON public.os_sinais(oficina_id);

ALTER TABLE public.os_sinais ENABLE ROW LEVEL SECURITY;

CREATE POLICY os_sinais_select ON public.os_sinais
  FOR SELECT TO authenticated
  USING (has_oficina_access(auth.uid(), oficina_id));

CREATE POLICY os_sinais_insert ON public.os_sinais
  FOR INSERT TO authenticated
  WITH CHECK (has_oficina_access(auth.uid(), oficina_id));

CREATE POLICY os_sinais_delete ON public.os_sinais
  FOR DELETE TO authenticated
  USING (is_oficina_owner(auth.uid(), oficina_id));

-- 2. RPC enriquecida: registrar sinal com forma + data + descrição rica
DROP FUNCTION IF EXISTS public.registrar_sinal_os(uuid, numeric, uuid);

CREATE OR REPLACE FUNCTION public.registrar_sinal_os(
  p_os_id uuid,
  p_valor numeric,
  p_forma_pagamento_id uuid DEFAULT NULL,
  p_forma_pagamento_nome text DEFAULT NULL,
  p_data_pagamento date DEFAULT NULL,
  p_observacao text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_os ordens_servico%ROWTYPE;
  v_total_produtos NUMERIC := 0;
  v_total_mao_obra_itens NUMERIC := 0;
  v_master_total NUMERIC := 0;
  v_sinal_atual NUMERIC := 0;
  v_novo_sinal NUMERIC := 0;
  v_cliente_nome TEXT;
  v_forma_nome TEXT;
  v_data DATE;
  v_descricao TEXT;
  v_financeiro_id UUID;
  v_sinal_id UUID;
BEGIN
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor do sinal deve ser maior que zero';
  END IF;

  v_data := COALESCE(p_data_pagamento, CURRENT_DATE);

  SELECT * INTO v_os FROM public.ordens_servico WHERE id = p_os_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'OS não encontrada';
  END IF;

  IF v_os.status = 'finalizado' THEN
    RAISE EXCEPTION 'OS já finalizada — registre o pagamento direto no financeiro';
  END IF;

  IF v_os.status = 'cancelado' THEN
    RAISE EXCEPTION 'OS cancelada não aceita sinal';
  END IF;

  IF NOT public.has_oficina_access(auth.uid(), v_os.oficina_id) THEN
    RAISE EXCEPTION 'Sem permissão para esta OS';
  END IF;

  SELECT
    COALESCE(SUM(COALESCE(quantidade,1) * COALESCE(valor_unitario,0)), 0),
    COALESCE(SUM(COALESCE(valor_mao_obra,0)), 0)
  INTO v_total_produtos, v_total_mao_obra_itens
  FROM public.itens_os WHERE ordem_servico_id = p_os_id;

  v_master_total := GREATEST(
    COALESCE(v_os.valor_servico, 0),
    v_total_produtos + GREATEST(COALESCE(v_os.valor_mao_obra,0), v_total_mao_obra_itens)
  );

  v_sinal_atual := COALESCE(v_os.valor_sinal, 0);
  v_novo_sinal := v_sinal_atual + p_valor;

  IF v_master_total > 0 AND v_novo_sinal > v_master_total + 0.01 THEN
    RAISE EXCEPTION 'Sinal (R$ %) ultrapassa o total da OS (R$ %)', v_novo_sinal, v_master_total;
  END IF;

  -- Buscar nome do cliente
  SELECT c.nome INTO v_cliente_nome
  FROM public.clientes c WHERE c.id = v_os.cliente_id;

  -- Resolver nome da forma de pagamento
  v_forma_nome := COALESCE(p_forma_pagamento_nome, '');
  IF (v_forma_nome IS NULL OR v_forma_nome = '') AND p_forma_pagamento_id IS NOT NULL THEN
    SELECT nome INTO v_forma_nome FROM public.formas_pagamento WHERE id = p_forma_pagamento_id;
  END IF;
  IF v_forma_nome IS NULL OR v_forma_nome = '' THEN
    v_forma_nome := 'Dinheiro';
  END IF;

  -- Atualizar valor_sinal acumulado
  UPDATE public.ordens_servico
    SET valor_sinal = v_novo_sinal, updated_at = now()
    WHERE id = p_os_id;

  -- Descrição rica para o financeiro
  v_descricao := 'Sinal OS #' || COALESCE(v_os.numero::text, '?')
    || COALESCE(' — ' || v_cliente_nome, '')
    || ' — ' || v_forma_nome
    || ' — ' || TO_CHAR(v_data, 'DD/MM/YYYY');

  -- Lançar no financeiro
  INSERT INTO public.financeiro (
    oficina_id, ordem_servico_id, tipo, origem, valor, data, data_pagamento,
    descricao, status, forma_pagamento_id
  ) VALUES (
    v_os.oficina_id, p_os_id, 'entrada',
    'Sinal OS #' || COALESCE(v_os.numero::text, ''),
    p_valor, v_data, v_data,
    v_descricao,
    'pago', p_forma_pagamento_id
  ) RETURNING id INTO v_financeiro_id;

  -- Registrar no histórico de sinais
  INSERT INTO public.os_sinais (
    ordem_servico_id, oficina_id, valor, forma_pagamento, forma_pagamento_id,
    data_pagamento, observacao, financeiro_id, created_by
  ) VALUES (
    p_os_id, v_os.oficina_id, p_valor, v_forma_nome, p_forma_pagamento_id,
    v_data, p_observacao, v_financeiro_id, auth.uid()
  ) RETURNING id INTO v_sinal_id;

  RETURN jsonb_build_object(
    'success', true,
    'sinal_id', v_sinal_id,
    'financeiro_id', v_financeiro_id,
    'valor_sinal_total', v_novo_sinal,
    'master_total', v_master_total,
    'restante', GREATEST(v_master_total - v_novo_sinal, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_sinal_os(uuid, numeric, uuid, text, date, text) TO authenticated;

-- 3. Quando excluir um sinal, reverter valor_sinal e remover lançamento financeiro
CREATE OR REPLACE FUNCTION public.on_sinal_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.ordens_servico
    SET valor_sinal = GREATEST(COALESCE(valor_sinal,0) - OLD.valor, 0),
        updated_at = now()
    WHERE id = OLD.ordem_servico_id;

  IF OLD.financeiro_id IS NOT NULL THEN
    DELETE FROM public.financeiro WHERE id = OLD.financeiro_id;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_os_sinais_delete ON public.os_sinais;
CREATE TRIGGER trg_os_sinais_delete
  BEFORE DELETE ON public.os_sinais
  FOR EACH ROW EXECUTE FUNCTION public.on_sinal_delete();