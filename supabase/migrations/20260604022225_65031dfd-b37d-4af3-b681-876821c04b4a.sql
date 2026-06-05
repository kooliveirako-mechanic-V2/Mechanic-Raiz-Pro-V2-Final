-- 1. Update recalcular_totais_os to handle SUM of labor and DISCOUNTS
CREATE OR REPLACE FUNCTION public.recalcular_totais_os(p_os_id uuid)
RETURNS void AS $$
DECLARE
  v_total_produtos NUMERIC := 0;
  v_total_mao_obra_itens NUMERIC := 0;
  v_mao_obra_global NUMERIC := 0;
  v_desconto NUMERIC := 0;
  v_valor_servico_atual NUMERIC := 0;
  v_status TEXT;
  v_total_receita NUMERIC := 0;
  v_total_custo NUMERIC := 0;
  v_financeiro_total NUMERIC := 0;
BEGIN
  SELECT
    COALESCE(os.valor_mao_obra, 0),
    COALESCE(os.valor_servico, 0),
    COALESCE(os.desconto, 0),
    os.status
  INTO v_mao_obra_global, v_valor_servico_atual, v_desconto, v_status
  FROM public.ordens_servico os
  WHERE os.id = p_os_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT
    COALESCE(SUM(COALESCE(ios.quantidade, 1) * COALESCE(ios.valor_unitario, 0)), 0),
    COALESCE(SUM(COALESCE(ios.valor_mao_obra, 0)), 0),
    COALESCE(SUM(
      COALESCE(ios.quantidade, 1) * COALESCE(NULLIF(ios.custo_unitario, 0), e.custo_unitario, 0)
    ), 0)
  INTO v_total_produtos, v_total_mao_obra_itens, v_total_custo
  FROM public.itens_os ios
  LEFT JOIN public.estoque e ON e.id = ios.estoque_id
  WHERE ios.ordem_servico_id = p_os_id;

  -- ALINHAMENTO MATEMÁTICO: Soma de todos os componentes de receita - Desconto
  v_total_receita := (v_total_produtos + v_mao_obra_global + v_total_mao_obra_itens) - v_desconto;

  -- Safety net: não apaga receita histórica de OS finalizada que já teve financeiro lançado.
  IF v_total_receita <= 0 AND v_status = 'finalizado' THEN
    SELECT COALESCE(SUM(valor), 0) INTO v_financeiro_total
    FROM public.financeiro
    WHERE ordem_servico_id = p_os_id
      AND tipo = 'entrada'
      AND origem NOT ILIKE 'Comissão%';

    IF v_financeiro_total > 0 THEN
      v_total_receita := v_financeiro_total;
    ELSIF v_valor_servico_atual > 0 THEN
      v_total_receita := v_valor_servico_atual;
    END IF;
  END IF;

  UPDATE public.ordens_servico
  SET valor_servico = v_total_receita,
      custo_servico = v_total_custo,
      lucro = v_total_receita - v_total_custo
  WHERE id = p_os_id
    AND (
      valor_servico IS DISTINCT FROM v_total_receita
      OR custo_servico IS DISTINCT FROM v_total_custo
    );
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 2. Update finalizar_os_atomica to handle SUM and DISCOUNTS
CREATE OR REPLACE FUNCTION public.finalizar_os_atomica(
  p_os_id uuid,
  p_forma_pagamento text DEFAULT NULL,
  p_forma_pagamento_id uuid DEFAULT NULL,
  p_numero_parcelas integer DEFAULT 1,
  p_fotos_saida text[] DEFAULT NULL,
  p_observacoes_conclusao text DEFAULT NULL,
  p_itens_novos jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb AS $$
DECLARE
  v_os ordens_servico%ROWTYPE;
  v_valor_total NUMERIC := 0;
  v_total_produtos NUMERIC := 0;
  v_total_mao_obra_itens NUMERIC := 0;
  v_mao_de_obra_global NUMERIC := 0;
  v_mao_de_obra_consolidada NUMERIC := 0;
  v_custo_itens NUMERIC := 0;
  v_custo_total NUMERIC := 0;
  v_item JSONB;
  v_financeiro_result JSON;
  v_desconto NUMERIC := 0;
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

  -- Insert pending items if any
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
        valor_unitario, valor_mao_obra, custo_unitario,
        estoque_id
      ) VALUES (
        p_os_id, v_item->>'nome_item', v_qty,
        v_unit_price, v_labor, v_cost,
        NULLIF(v_item->>'estoque_id', '')::UUID
      );
    END;
  END LOOP;

  -- Recalculate based on ALL items
  SELECT
    COALESCE(SUM(COALESCE(ios.quantidade, 1) * COALESCE(ios.valor_unitario, 0)), 0),
    COALESCE(SUM(COALESCE(ios.valor_mao_obra, 0)), 0),
    COALESCE(SUM(
      COALESCE(ios.quantidade, 1) * COALESCE(NULLIF(ios.custo_unitario, 0), e.custo_unitario, 0)
    ), 0)
  INTO v_total_produtos, v_total_mao_obra_itens, v_custo_itens
  FROM public.itens_os ios
  LEFT JOIN public.estoque e ON e.id = ios.estoque_id
  WHERE ios.ordem_servico_id = p_os_id;

  v_mao_de_obra_global := COALESCE(v_os.valor_mao_obra, 0);
  v_desconto := COALESCE(v_os.desconto, 0);
  
  -- ALINHAMENTO MATEMÁTICO: Soma e desconto
  v_mao_de_obra_consolidada := v_mao_de_obra_global + v_total_mao_obra_itens;
  v_valor_total := (v_total_produtos + v_mao_de_obra_consolidada) - v_desconto;
  v_custo_total := GREATEST(COALESCE(v_os.custo_servico, 0), v_custo_itens);

  UPDATE public.ordens_servico SET
    status = 'finalizado',
    forma_pagamento = COALESCE(p_forma_pagamento, v_os.forma_pagamento),
    data_conclusao = CURRENT_DATE,
    valor_servico = v_valor_total,
    custo_servico = v_custo_total,
    lucro = v_valor_total - v_custo_total,
    observacoes_conclusao = COALESCE(p_observacoes_conclusao, v_os.observacoes_conclusao),
    fotos_saida = CASE WHEN array_length(p_fotos_saida, 1) > 0 THEN p_fotos_saida ELSE v_os.fotos_saida END
  WHERE id = p_os_id;

  IF v_valor_total > 0 THEN
    -- In the financeiro table, we must split the net total proportionally for reports
    -- but for the RPC upsert_financeiro_os we pass the consolidated labor that reflects 
    -- the true labor share of the OS.
    v_financeiro_result := public.upsert_financeiro_os(
      v_os.oficina_id,
      p_os_id,
      v_os.tipo_servico,
      v_mao_de_obra_consolidada, -- Pass the gross labor, upsert will apply ratios on the net total
      p_forma_pagamento_id,
      'Serviço ' || v_os.tipo_servico,
      p_numero_parcelas
    );

    IF COALESCE((v_financeiro_result->>'success')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'Falha ao registrar financeiro da OS: %', COALESCE(v_financeiro_result->>'error', 'erro desconhecido');
    END IF;
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
$$ LANGUAGE plpgsql SET search_path = public;

-- 3. Update registrar_sinal_os to handle SUM and DISCOUNTS
CREATE OR REPLACE FUNCTION public.registrar_sinal_os(
  p_os_id uuid,
  p_valor numeric,
  p_forma_pagamento_id uuid DEFAULT NULL,
  p_forma_pagamento_nome text DEFAULT NULL,
  p_data_pagamento date DEFAULT NULL,
  p_observacao text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_os RECORD;
  v_total_produtos numeric;
  v_total_mao_obra_itens numeric;
  v_master_total numeric;
  v_sinal_atual numeric;
  v_novo_sinal numeric;
  v_cliente_nome text;
  v_veiculo_label text;
  v_forma_nome text;
  v_descricao text;
  v_data date;
  v_financeiro_id uuid;
  v_sinal_id uuid;
  v_desconto numeric := 0;
BEGIN
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor do sinal deve ser maior que zero';
  END IF;

  v_data := COALESCE(p_data_pagamento, CURRENT_DATE);

  SELECT * INTO v_os FROM public.ordens_servico WHERE id = p_os_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de serviço não encontrada';
  END IF;

  v_desconto := COALESCE(v_os.desconto, 0);

  SELECT
    COALESCE(SUM(COALESCE(quantidade,1) * COALESCE(valor_unitario,0)), 0),
    COALESCE(SUM(COALESCE(valor_mao_obra,0)), 0)
  INTO v_total_produtos, v_total_mao_obra_itens
  FROM public.itens_os WHERE ordem_servico_id = p_os_id;

  -- ALINHAMENTO MATEMÁTICO: Soma e Desconto
  v_master_total := (v_total_produtos + COALESCE(v_os.valor_mao_obra, 0) + v_total_mao_obra_itens) - v_desconto;

  v_sinal_atual := COALESCE(v_os.valor_sinal, 0);
  v_novo_sinal := v_sinal_atual + p_valor;

  -- Permit a tiny margin for rounding but essentially don't exceed net total
  IF v_master_total > 0 AND v_novo_sinal > v_master_total + 0.05 THEN
    RAISE EXCEPTION 'Sinal (R$ %) ultrapassa o total líquido da OS (R$ %)', v_novo_sinal, v_master_total;
  END IF;

  UPDATE public.ordens_servico
    SET valor_sinal = v_novo_sinal, updated_at = now()
    WHERE id = p_os_id;

  -- (Rest of logic for financeiro insertion remains unchanged as it uses p_valor directly)
  SELECT c.nome INTO v_cliente_nome FROM public.clientes c WHERE c.id = v_os.cliente_id;
  SELECT (COALESCE(v.modelo, '') || CASE WHEN v.placa IS NOT NULL THEN ' • ' || v.placa ELSE '' END) INTO v_veiculo_label FROM public.veiculos v WHERE v.id = v_os.veiculo_id;
  
  v_forma_nome := COALESCE(p_forma_pagamento_nome, 'Dinheiro');

  v_descricao := 'Sinal OS #' || COALESCE(v_os.numero::text, '?') || ' — ' || v_cliente_nome || ' — ' || v_veiculo_label;

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

  INSERT INTO public.os_sinais (
    ordem_servico_id, oficina_id, valor, forma_pagamento, forma_pagamento_id,
    data_pagamento, observacao, financeiro_id, created_by
  ) VALUES (
    p_os_id, v_os.oficina_id, p_valor, v_forma_nome, p_forma_pagamento_id,
    v_data, p_observacao, v_financeiro_id, auth.uid()
  ) RETURNING id INTO v_sinal_id;

  RETURN jsonb_build_object('success', true, 'sinal_id', v_sinal_id, 'valor_sinal_total', v_novo_sinal, 'master_total', v_master_total);
END;
$$ LANGUAGE plpgsql SET search_path = public;
