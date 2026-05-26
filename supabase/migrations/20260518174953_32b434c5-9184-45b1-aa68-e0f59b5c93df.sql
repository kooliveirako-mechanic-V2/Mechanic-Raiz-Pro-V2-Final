-- ─── TABELAS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendas_balcao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  oficina_id UUID NOT NULL REFERENCES public.oficinas(id) ON DELETE CASCADE,
  numero SERIAL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  forma_pagamento TEXT,
  forma_pagamento_id UUID REFERENCES public.formas_pagamento(id) ON DELETE SET NULL,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  observacao TEXT,
  status TEXT NOT NULL DEFAULT 'concluida' CHECK (status IN ('concluida', 'cancelada')),
  financeiro_id UUID REFERENCES public.financeiro(id) ON DELETE SET NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendas_balcao_oficina ON public.vendas_balcao(oficina_id);
CREATE INDEX IF NOT EXISTS idx_vendas_balcao_created ON public.vendas_balcao(created_at DESC);

CREATE TABLE IF NOT EXISTS public.itens_venda_balcao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venda_id UUID NOT NULL REFERENCES public.vendas_balcao(id) ON DELETE CASCADE,
  estoque_id UUID REFERENCES public.estoque(id) ON DELETE SET NULL,
  nome_item TEXT NOT NULL,
  quantidade NUMERIC NOT NULL DEFAULT 1,
  valor_unitario NUMERIC NOT NULL DEFAULT 0,
  custo_unitario NUMERIC DEFAULT 0,
  valor_total NUMERIC GENERATED ALWAYS AS (quantidade * valor_unitario) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_itens_venda_balcao_venda ON public.itens_venda_balcao(venda_id);

-- ─── RLS ─────────────────────────────────────────────────────────
ALTER TABLE public.vendas_balcao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_venda_balcao ENABLE ROW LEVEL SECURITY;

CREATE POLICY vendas_balcao_select ON public.vendas_balcao
  FOR SELECT TO authenticated
  USING (has_oficina_access(auth.uid(), oficina_id));

CREATE POLICY vendas_balcao_insert ON public.vendas_balcao
  FOR INSERT TO authenticated
  WITH CHECK (has_oficina_access(auth.uid(), oficina_id));

CREATE POLICY vendas_balcao_update ON public.vendas_balcao
  FOR UPDATE TO authenticated
  USING (has_oficina_access(auth.uid(), oficina_id));

CREATE POLICY vendas_balcao_delete ON public.vendas_balcao
  FOR DELETE TO authenticated
  USING (is_oficina_owner(auth.uid(), oficina_id));

CREATE POLICY itens_venda_balcao_select ON public.itens_venda_balcao
  FOR SELECT TO authenticated
  USING (venda_id IN (
    SELECT id FROM public.vendas_balcao
    WHERE has_oficina_access(auth.uid(), oficina_id)
  ));

CREATE POLICY itens_venda_balcao_insert ON public.itens_venda_balcao
  FOR INSERT TO authenticated
  WITH CHECK (venda_id IN (
    SELECT id FROM public.vendas_balcao
    WHERE has_oficina_access(auth.uid(), oficina_id)
  ));

CREATE POLICY itens_venda_balcao_delete ON public.itens_venda_balcao
  FOR DELETE TO authenticated
  USING (venda_id IN (
    SELECT id FROM public.vendas_balcao
    WHERE has_oficina_access(auth.uid(), oficina_id)
  ));

-- ─── RPC ATÔMICA ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.criar_venda_balcao(
  p_oficina_id UUID,
  p_itens JSONB,
  p_forma_pagamento TEXT DEFAULT 'Dinheiro',
  p_forma_pagamento_id UUID DEFAULT NULL,
  p_cliente_id UUID DEFAULT NULL,
  p_observacao TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venda_id UUID;
  v_numero INTEGER;
  v_item JSONB;
  v_total NUMERIC := 0;
  v_qty NUMERIC;
  v_price NUMERIC;
  v_custo NUMERIC;
  v_estoque_id UUID;
  v_estoque_atual NUMERIC;
  v_estoque_nome TEXT;
  v_financeiro_id UUID;
  v_cliente_nome TEXT;
  v_user_id UUID := auth.uid();
BEGIN
  -- Validação de acesso
  IF NOT has_oficina_access(v_user_id, p_oficina_id) THEN
    RAISE EXCEPTION 'Sem permissão para criar venda nesta oficina';
  END IF;

  -- Validação de itens
  IF p_itens IS NULL OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'Adicione pelo menos 1 item para vender';
  END IF;

  -- Cabeçalho
  INSERT INTO vendas_balcao (
    oficina_id, cliente_id, forma_pagamento,
    forma_pagamento_id, observacao, valor_total, created_by
  ) VALUES (
    p_oficina_id, p_cliente_id, p_forma_pagamento,
    p_forma_pagamento_id, p_observacao, 0, v_user_id
  ) RETURNING id, numero INTO v_venda_id, v_numero;

  -- Itens + estoque + movimentações
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_qty   := COALESCE((v_item->>'quantidade')::NUMERIC, 1);
    v_price := COALESCE((v_item->>'valor_unitario')::NUMERIC, 0);
    v_custo := COALESCE((v_item->>'custo_unitario')::NUMERIC, 0);
    v_estoque_id := NULLIF(v_item->>'estoque_id', '')::UUID;

    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Quantidade inválida para: %', v_item->>'nome_item';
    END IF;
    IF v_price <= 0 THEN
      RAISE EXCEPTION 'Valor inválido para: %', v_item->>'nome_item';
    END IF;

    IF v_estoque_id IS NOT NULL THEN
      SELECT quantidade, nome INTO v_estoque_atual, v_estoque_nome
      FROM estoque WHERE id = v_estoque_id AND oficina_id = p_oficina_id
      FOR UPDATE;

      IF v_estoque_atual IS NULL THEN
        RAISE EXCEPTION 'Item de estoque não encontrado: %', v_item->>'nome_item';
      END IF;

      IF v_estoque_atual < v_qty THEN
        RAISE EXCEPTION 'Estoque insuficiente — só há % unidades de %', v_estoque_atual, v_estoque_nome;
      END IF;

      UPDATE estoque
      SET quantidade = quantidade - v_qty,
          ultima_saida = now()
      WHERE id = v_estoque_id;

      INSERT INTO estoque_movimentacoes (
        estoque_id, oficina_id, tipo, quantidade,
        quantidade_anterior, quantidade_nova,
        motivo, referencia_tipo, referencia_id,
        custo_unitario, user_id
      ) VALUES (
        v_estoque_id, p_oficina_id, 'saida', v_qty,
        v_estoque_atual, v_estoque_atual - v_qty,
        'Venda Balcão #' || v_numero, 'venda_balcao', v_venda_id,
        v_custo, v_user_id
      );
    END IF;

    INSERT INTO itens_venda_balcao (
      venda_id, estoque_id, nome_item,
      quantidade, valor_unitario, custo_unitario
    ) VALUES (
      v_venda_id, v_estoque_id, v_item->>'nome_item',
      v_qty, v_price, v_custo
    );

    v_total := v_total + (v_qty * v_price);
  END LOOP;

  -- Atualizar total
  UPDATE vendas_balcao SET valor_total = v_total WHERE id = v_venda_id;

  -- Nome cliente (opcional)
  IF p_cliente_id IS NOT NULL THEN
    SELECT nome INTO v_cliente_nome FROM clientes
    WHERE id = p_cliente_id AND oficina_id = p_oficina_id;
  END IF;

  -- Lança no financeiro
  INSERT INTO financeiro (
    oficina_id, tipo, origem, valor,
    data, data_pagamento, descricao,
    status, forma_pagamento_id, categoria
  ) VALUES (
    p_oficina_id, 'entrada', 'Venda Balcão',
    v_total, CURRENT_DATE, CURRENT_DATE,
    'Venda Balcão #' || v_numero ||
      COALESCE(' — ' || v_cliente_nome, '') ||
      ' — ' || p_forma_pagamento,
    'pago', p_forma_pagamento_id, 'venda_balcao'
  ) RETURNING id INTO v_financeiro_id;

  UPDATE vendas_balcao
  SET financeiro_id = v_financeiro_id
  WHERE id = v_venda_id;

  RETURN jsonb_build_object(
    'success', true,
    'venda_id', v_venda_id,
    'numero', v_numero,
    'valor_total', v_total,
    'itens', jsonb_array_length(p_itens)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.criar_venda_balcao(UUID, JSONB, TEXT, UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_venda_balcao(UUID, JSONB, TEXT, UUID, UUID, TEXT) TO authenticated;