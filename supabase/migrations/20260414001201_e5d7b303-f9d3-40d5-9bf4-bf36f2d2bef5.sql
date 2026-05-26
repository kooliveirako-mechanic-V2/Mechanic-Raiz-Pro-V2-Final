
CREATE OR REPLACE FUNCTION public.criar_os_completa(
  p_oficina_id UUID,
  p_cliente_id UUID,
  p_veiculo_id UUID,
  p_tipo_servico TEXT,
  p_descricao TEXT DEFAULT NULL,
  p_km_no_servico INTEGER DEFAULT NULL,
  p_responsavel_id UUID DEFAULT NULL,
  p_data_servico DATE DEFAULT CURRENT_DATE,
  p_hora_agendamento TIME DEFAULT NULL,
  p_status TEXT DEFAULT 'em_andamento',
  p_valor_mao_de_obra NUMERIC DEFAULT 0,
  p_custo_servico NUMERIC DEFAULT 0,
  p_tem_garantia BOOLEAN DEFAULT false,
  p_dias_garantia INTEGER DEFAULT 0,
  p_forma_pagamento TEXT DEFAULT NULL,
  p_forma_pagamento_id UUID DEFAULT NULL,
  p_numero_parcelas INTEGER DEFAULT NULL,
  p_observacoes TEXT DEFAULT NULL,
  p_itens JSONB DEFAULT '[]'::JSONB,
  p_checklist_combustivel TEXT DEFAULT NULL,
  p_checklist_riscos BOOLEAN DEFAULT false,
  p_checklist_estepe BOOLEAN DEFAULT false,
  p_checklist_som BOOLEAN DEFAULT false,
  p_checklist_luzes BOOLEAN DEFAULT false,
  p_fotos_entrada TEXT[] DEFAULT '{}'::TEXT[],
  p_assinatura_cliente_url TEXT DEFAULT NULL,
  p_checklist_voltagem_bateria TEXT DEFAULT NULL,
  p_checklist_carga_bateria TEXT DEFAULT NULL,
  p_checklist_alternador_ok BOOLEAN DEFAULT false,
  p_checklist_motor_partida_ok BOOLEAN DEFAULT false,
  p_checklist_fusiveis_ok BOOLEAN DEFAULT false,
  p_codigo_obd TEXT DEFAULT NULL,
  p_codigos_obd_lista TEXT[] DEFAULT '{}'::TEXT[],
  p_hipotese_diagnostico TEXT DEFAULT NULL,
  p_modulos_testados TEXT[] DEFAULT '{}'::TEXT[],
  p_tempo_diagnostico_minutos INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_os_id UUID;
  v_numero INTEGER;
  v_item JSONB;
  v_total_itens NUMERIC := 0;
  v_total_mao_obra_itens NUMERIC := 0;
  v_valor_total NUMERIC;
  v_custo_total NUMERIC := 0;
  v_insert_status TEXT;
  v_final_status TEXT;
BEGIN
  PERFORM rate_limit_os_insert(p_oficina_id);

  v_final_status := p_status;
  
  -- FIX: When finalizing, insert as 'em_andamento' (not 'pendente')
  -- because the state machine trigger blocks pendente → finalizado
  -- but allows em_andamento → finalizado
  IF p_status = 'finalizado' THEN
    v_insert_status := 'em_andamento';
  ELSE
    v_insert_status := p_status;
  END IF;

  -- STEP 1: Create OS header
  INSERT INTO public.ordens_servico (
    oficina_id, cliente_id, veiculo_id,
    tipo_servico, descricao, km_no_servico,
    responsavel_id, data_servico, hora_agendamento,
    status, valor_servico, custo_servico,
    tem_garantia, dias_garantia, forma_pagamento,
    observacoes,
    checklist_combustivel, checklist_riscos, checklist_estepe,
    checklist_som, checklist_luzes, fotos_entrada,
    assinatura_cliente_url,
    checklist_voltagem_bateria, checklist_carga_bateria,
    checklist_alternador_ok, checklist_motor_partida_ok,
    checklist_fusiveis_ok, codigo_obd, codigos_obd_lista,
    hipotese_diagnostico, modulos_testados, tempo_diagnostico_minutos
  ) VALUES (
    p_oficina_id, p_cliente_id, p_veiculo_id,
    p_tipo_servico, p_descricao, p_km_no_servico,
    p_responsavel_id, p_data_servico, p_hora_agendamento,
    v_insert_status, 0, 0,
    p_tem_garantia, p_dias_garantia, p_forma_pagamento,
    p_observacoes,
    p_checklist_combustivel, p_checklist_riscos, p_checklist_estepe,
    p_checklist_som, p_checklist_luzes, p_fotos_entrada,
    p_assinatura_cliente_url,
    p_checklist_voltagem_bateria, p_checklist_carga_bateria,
    p_checklist_alternador_ok, p_checklist_motor_partida_ok,
    p_checklist_fusiveis_ok, p_codigo_obd, p_codigos_obd_lista,
    p_hipotese_diagnostico, p_modulos_testados, p_tempo_diagnostico_minutos
  )
  RETURNING id, numero INTO v_os_id, v_numero;

  -- STEP 2: Insert items WITHOUT valor_total (it's GENERATED ALWAYS)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    DECLARE
      v_qty NUMERIC;
      v_unit_price NUMERIC;
      v_labor NUMERIC;
      v_cost NUMERIC;
      v_item_total NUMERIC;
      v_estoque_id UUID;
    BEGIN
      v_qty := COALESCE((v_item->>'quantidade')::NUMERIC, 1);
      v_unit_price := COALESCE((v_item->>'valor_unitario')::NUMERIC, 0);
      v_labor := COALESCE((v_item->>'valor_mao_obra')::NUMERIC, 0);
      v_cost := COALESCE((v_item->>'custo_unitario')::NUMERIC, 0);
      v_item_total := (v_qty * v_unit_price) + v_labor;
      v_estoque_id := NULLIF(v_item->>'estoque_id', '')::UUID;

      IF v_qty <= 0 OR NOT (v_item_total IS NOT NULL AND v_item_total >= 0) THEN
        RAISE EXCEPTION 'Item inválido: % (qty=%, total=%)', 
          v_item->>'nome_item', v_qty, v_item_total;
      END IF;

      INSERT INTO public.itens_os (
        ordem_servico_id, nome_item, quantidade,
        valor_unitario, valor_mao_obra,
        estoque_id
      ) VALUES (
        v_os_id, v_item->>'nome_item', v_qty,
        v_unit_price, v_labor,
        v_estoque_id
      );

      v_total_itens := v_total_itens + (v_qty * v_unit_price);
      v_total_mao_obra_itens := v_total_mao_obra_itens + v_labor;
      v_custo_total := v_custo_total + (v_cost * v_qty);
    END;
  END LOOP;

  -- STEP 3: Calculate and update final totals
  v_valor_total := COALESCE(p_valor_mao_de_obra, 0) + v_total_itens + v_total_mao_obra_itens;
  v_custo_total := COALESCE(p_custo_servico, 0) + v_custo_total;

  UPDATE public.ordens_servico SET
    valor_servico = v_valor_total,
    custo_servico = v_custo_total
  WHERE id = v_os_id;

  -- STEP 4: If finalizing, transition em_andamento → finalizado (allowed by trigger)
  IF v_final_status = 'finalizado' THEN
    UPDATE public.ordens_servico SET
      status = 'finalizado',
      data_conclusao = CURRENT_DATE
    WHERE id = v_os_id;

    IF v_valor_total > 0 THEN
      PERFORM public.upsert_financeiro_os(
        p_oficina_id,
        v_os_id,
        p_tipo_servico,
        COALESCE(p_valor_mao_de_obra, 0) + v_total_mao_obra_itens,
        p_forma_pagamento_id,
        'Serviço OS'
      );
    END IF;
  END IF;

  -- STEP 5: Sync vehicle KM
  IF p_km_no_servico IS NOT NULL AND p_km_no_servico > 0 THEN
    UPDATE public.veiculos
    SET km_atual = p_km_no_servico
    WHERE id = p_veiculo_id AND (km_atual IS NULL OR km_atual < p_km_no_servico);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'os_id', v_os_id,
    'numero', v_numero,
    'valor_total', v_valor_total,
    'custo_total', v_custo_total,
    'total_itens_inseridos', jsonb_array_length(p_itens),
    'status', v_final_status
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Erro ao criar OS: %. Nenhum dado foi salvo.', SQLERRM;
END;
$$;
