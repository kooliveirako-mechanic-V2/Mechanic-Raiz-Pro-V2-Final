CREATE OR REPLACE FUNCTION public.finalizar_os_atomica(
  p_os_id UUID,
  p_forma_pagamento TEXT DEFAULT NULL,
  p_forma_pagamento_id UUID DEFAULT NULL,
  p_numero_parcelas INTEGER DEFAULT 1,
  p_itens_novos JSONB DEFAULT '[]'::jsonb,
  p_observacoes_conclusao TEXT DEFAULT NULL,
  p_fotos_saida TEXT[] DEFAULT '{}'::text[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_os ordens_servico%ROWTYPE;
  v_valor_total NUMERIC;
  v_total_itens NUMERIC;
  v_total_mao_obra NUMERIC;
  v_item JSONB;
  v_mao_de_obra_global NUMERIC;
BEGIN
  SELECT * INTO v_os
  FROM public.ordens_servico
  WHERE id = p_os_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OS não encontrada: %', p_os_id;
  END IF;

  IF v_os.status = 'finalizado' THEN
    RAISE EXCEPTION 'OS já foi finalizada anteriormente';
  END IF;

  -- Insert new items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens_novos)
  LOOP
    DECLARE
      v_qty NUMERIC;
      v_unit_price NUMERIC;
      v_labor NUMERIC;
      v_cost NUMERIC;
    BEGIN
      v_qty := COALESCE((v_item->>'quantidade')::NUMERIC, 1);
      v_unit_price := COALESCE((v_item->>'valor_unitario')::NUMERIC, 0);
      v_labor := COALESCE((v_item->>'valor_mao_obra')::NUMERIC, 0);
      v_cost := COALESCE((v_item->>'custo_unitario')::NUMERIC, 0);

      INSERT INTO public.itens_os (
        ordem_servico_id, nome_item, quantidade,
        valor_unitario, valor_mao_obra,
        estoque_id
      ) VALUES (
        p_os_id, v_item->>'nome_item', v_qty,
        v_unit_price, v_labor,
        NULLIF(v_item->>'estoque_id', '')::UUID
      );
    END;
  END LOOP;

  -- Calculate totals from all items (valor_total includes qty*unit_price + valor_mao_obra per item)
  SELECT 
    COALESCE(SUM(valor_total), 0),
    COALESCE(SUM(COALESCE(valor_mao_obra, 0)), 0)
  INTO v_total_itens, v_total_mao_obra
  FROM public.itens_os
  WHERE ordem_servico_id = p_os_id;

  -- Use valor_mao_obra (global labor) as base, NOT valor_servico (which already includes items)
  v_mao_de_obra_global := COALESCE(v_os.valor_mao_obra, 0);
  v_valor_total := v_mao_de_obra_global + v_total_itens;

  -- Fallback: if no items and no global labor but valor_servico was set manually, preserve it
  IF v_valor_total <= 0 AND COALESCE(v_os.valor_servico, 0) > 0 THEN
    v_valor_total := v_os.valor_servico;
    v_mao_de_obra_global := v_os.valor_servico;
  END IF;

  UPDATE public.ordens_servico SET
    status = 'finalizado',
    forma_pagamento = COALESCE(p_forma_pagamento, v_os.forma_pagamento),
    data_conclusao = CURRENT_DATE,
    valor_servico = v_valor_total,
    custo_servico = COALESCE(v_os.custo_servico, 0),
    observacoes_conclusao = COALESCE(p_observacoes_conclusao, v_os.observacoes_conclusao),
    fotos_saida = CASE WHEN array_length(p_fotos_saida, 1) > 0 THEN p_fotos_saida ELSE v_os.fotos_saida END
  WHERE id = p_os_id;

  IF v_valor_total > 0 THEN
    PERFORM public.upsert_financeiro_os(
      v_os.oficina_id,
      p_os_id,
      v_os.tipo_servico,
      v_mao_de_obra_global,
      p_forma_pagamento_id,
      'Serviço ' || v_os.tipo_servico
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'os_id', p_os_id,
    'valor_total', v_valor_total,
    'status', 'finalizado'
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Erro ao finalizar OS: %. Nenhuma alteração foi salva.', SQLERRM;
END;
$$;