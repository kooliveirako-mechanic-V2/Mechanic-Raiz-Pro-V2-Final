
-- =============================================
-- FIX 1: Server-side recalc triggers for OS
-- =============================================

CREATE OR REPLACE FUNCTION public.recalcular_totais_os(p_os_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_receita NUMERIC := 0;
  v_total_custo NUMERIC := 0;
BEGIN
  SELECT 
    COALESCE(SUM(COALESCE(valor_total, (quantidade * COALESCE(valor_unitario, 0)) + COALESCE(valor_mao_obra, 0))), 0),
    COALESCE(SUM(
      CASE WHEN estoque_id IS NOT NULL THEN
        quantidade * COALESCE((SELECT custo_unitario FROM estoque WHERE id = itens_os.estoque_id), 0)
      ELSE 0 END
    ), 0)
  INTO v_total_receita, v_total_custo
  FROM itens_os
  WHERE ordem_servico_id = p_os_id;

  UPDATE ordens_servico
  SET valor_servico = v_total_receita,
      custo_servico = v_total_custo,
      lucro = v_total_receita - v_total_custo
  WHERE id = p_os_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_recalcular_totais_os()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM recalcular_totais_os(COALESCE(NEW.ordem_servico_id, OLD.ordem_servico_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS tg_recalcular_totais_os ON public.itens_os;

CREATE TRIGGER tg_recalcular_totais_os
AFTER INSERT OR UPDATE OR DELETE
ON public.itens_os
FOR EACH ROW
EXECUTE FUNCTION public.trg_recalcular_totais_os();

-- =============================================
-- FIX 1b: Server-side recalc triggers for Orcamento
-- =============================================

CREATE OR REPLACE FUNCTION public.recalcular_totais_orcamento(p_orcamento_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valor_total NUMERIC := 0;
  v_custo_total NUMERIC := 0;
BEGIN
  SELECT 
    COALESCE(SUM(COALESCE(valor_total, (quantidade * COALESCE(valor_unitario, 0)) + COALESCE(valor_mao_obra, 0))), 0),
    COALESCE(SUM(COALESCE(custo_unitario, 0) * quantidade), 0)
  INTO v_valor_total, v_custo_total
  FROM itens_orcamento
  WHERE orcamento_id = p_orcamento_id;

  UPDATE orcamentos
  SET valor_total = v_valor_total,
      custo_total = v_custo_total
  WHERE id = p_orcamento_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_recalcular_totais_orcamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM recalcular_totais_orcamento(COALESCE(NEW.orcamento_id, OLD.orcamento_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS tg_recalcular_totais_orcamento ON public.itens_orcamento;

CREATE TRIGGER tg_recalcular_totais_orcamento
AFTER INSERT OR UPDATE OR DELETE
ON public.itens_orcamento
FOR EACH ROW
EXECUTE FUNCTION public.trg_recalcular_totais_orcamento();

-- =============================================
-- FIX 2: Atomic delete item from OS
-- =============================================

CREATE OR REPLACE FUNCTION public.deletar_item_os_atomic(
  p_item_id UUID,
  p_oficina_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_os_id UUID;
  v_estoque_id UUID;
  v_quantidade INTEGER;
  v_os_status TEXT;
  v_nome_item TEXT;
  v_estoque_qtd_atual INTEGER;
BEGIN
  -- Lock the item row
  SELECT io.ordem_servico_id, io.estoque_id, io.quantidade, io.nome_item, os.status
  INTO v_os_id, v_estoque_id, v_quantidade, v_nome_item, v_os_status
  FROM itens_os io
  JOIN ordens_servico os ON os.id = io.ordem_servico_id
  WHERE io.id = p_item_id
  FOR UPDATE OF io;

  IF v_os_id IS NULL THEN
    RAISE EXCEPTION 'Item não encontrado';
  END IF;

  -- Verify ownership
  IF NOT EXISTS (SELECT 1 FROM ordens_servico WHERE id = v_os_id AND oficina_id = p_oficina_id) THEN
    RAISE EXCEPTION 'Sem permissão para esta OS';
  END IF;

  -- If OS is finalized AND item has stock link, restore stock
  IF v_os_status = 'finalizado' AND v_estoque_id IS NOT NULL AND v_quantidade > 0 THEN
    SELECT quantidade INTO v_estoque_qtd_atual
    FROM estoque
    WHERE id = v_estoque_id
    FOR UPDATE;

    IF v_estoque_qtd_atual IS NOT NULL THEN
      UPDATE estoque
      SET quantidade = quantidade + v_quantidade
      WHERE id = v_estoque_id;

      INSERT INTO estoque_movimentacoes (
        estoque_id, oficina_id, tipo, quantidade,
        quantidade_anterior, quantidade_nova,
        motivo, referencia_tipo, referencia_id
      ) VALUES (
        v_estoque_id, p_oficina_id, 'entrada', v_quantidade,
        v_estoque_qtd_atual, v_estoque_qtd_atual + v_quantidade,
        'Devolvido ao estoque (item removido de OS finalizada)',
        'itens_os', p_item_id
      );
    END IF;
  END IF;

  -- Delete the item (trigger tg_recalcular_totais_os will auto-recalc)
  DELETE FROM itens_os WHERE id = p_item_id;

  RETURN jsonb_build_object(
    'success', true,
    'nome_item', v_nome_item,
    'estoque_restaurado', (v_os_status = 'finalizado' AND v_estoque_id IS NOT NULL)
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Erro ao deletar item: %. Nenhum dado foi alterado.', SQLERRM;
END;
$$;

-- =============================================
-- FIX 3: Unique index on parcelas to prevent duplicates
-- =============================================

CREATE UNIQUE INDEX IF NOT EXISTS ux_parcelas_os_numero
ON public.parcelas_pagamento (ordem_servico_id, numero_parcela)
WHERE ordem_servico_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_parcelas_orcamento_numero
ON public.parcelas_pagamento (orcamento_id, numero_parcela)
WHERE orcamento_id IS NOT NULL;

-- =============================================
-- FIX 4: Atomic idempotent parcelas generation
-- =============================================

CREATE OR REPLACE FUNCTION public.gerar_parcelas_atomic(
  p_oficina_id UUID,
  p_ordem_servico_id UUID DEFAULT NULL,
  p_orcamento_id UUID DEFAULT NULL,
  p_valor_total NUMERIC DEFAULT 0,
  p_numero_parcelas INTEGER DEFAULT 1,
  p_data_primeira_parcela DATE DEFAULT CURRENT_DATE,
  p_intervalo_dias INTEGER DEFAULT 30,
  p_forma_pagamento_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valor_parcela NUMERIC;
  v_valor_ultima NUMERIC;
  v_soma NUMERIC := 0;
  i INTEGER;
BEGIN
  IF p_numero_parcelas < 1 OR p_numero_parcelas > 24 THEN
    RAISE EXCEPTION 'Número de parcelas deve ser entre 1 e 24';
  END IF;

  IF p_valor_total <= 0 THEN
    RAISE EXCEPTION 'Valor total deve ser maior que zero';
  END IF;

  -- Remove existing pending/atrasado parcelas for this reference
  IF p_ordem_servico_id IS NOT NULL THEN
    DELETE FROM parcelas_pagamento
    WHERE ordem_servico_id = p_ordem_servico_id
    AND status IN ('pendente');
  END IF;

  IF p_orcamento_id IS NOT NULL THEN
    DELETE FROM parcelas_pagamento
    WHERE orcamento_id = p_orcamento_id
    AND status IN ('pendente');
  END IF;

  v_valor_parcela := ROUND(p_valor_total / p_numero_parcelas, 2);

  FOR i IN 1..p_numero_parcelas LOOP
    IF i = p_numero_parcelas THEN
      v_valor_ultima := ROUND(p_valor_total - v_soma, 2);
    ELSE
      v_valor_ultima := v_valor_parcela;
    END IF;

    INSERT INTO parcelas_pagamento (
      oficina_id, ordem_servico_id, orcamento_id,
      numero_parcela, total_parcelas, valor,
      data_vencimento, forma_pagamento_id, status
    ) VALUES (
      p_oficina_id, p_ordem_servico_id, p_orcamento_id,
      i, p_numero_parcelas, v_valor_ultima,
      p_data_primeira_parcela + ((i - 1) * p_intervalo_dias),
      p_forma_pagamento_id, 'pendente'
    );

    v_soma := v_soma + v_valor_ultima;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'parcelas_geradas', p_numero_parcelas,
    'valor_total', v_soma
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Erro ao gerar parcelas: %. Nenhum dado foi salvo.', SQLERRM;
END;
$$;
