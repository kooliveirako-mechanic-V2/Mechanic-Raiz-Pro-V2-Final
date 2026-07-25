CREATE OR REPLACE FUNCTION public.criar_os_completa(p_oficina_id uuid, p_cliente_id uuid, p_veiculo_id uuid, p_tipo_servico text, p_descricao text DEFAULT NULL::text, p_km_no_servico integer DEFAULT NULL::integer, p_responsavel_id uuid DEFAULT NULL::uuid, p_data_servico date DEFAULT CURRENT_DATE, p_hora_agendamento time without time zone DEFAULT NULL::time without time zone, p_status text DEFAULT 'em_andamento'::text, p_valor_mao_de_obra numeric DEFAULT 0, p_custo_servico numeric DEFAULT 0, p_tem_garantia boolean DEFAULT false, p_dias_garantia integer DEFAULT 0, p_forma_pagamento text DEFAULT NULL::text, p_forma_pagamento_id uuid DEFAULT NULL::uuid, p_numero_parcelas integer DEFAULT NULL::integer, p_observacoes text DEFAULT NULL::text, p_itens jsonb DEFAULT '[]'::jsonb, p_checklist_combustivel text DEFAULT NULL::text, p_checklist_riscos boolean DEFAULT false, p_checklist_estepe boolean DEFAULT false, p_checklist_som boolean DEFAULT false, p_checklist_luzes boolean DEFAULT false, p_fotos_entrada text[] DEFAULT '{}'::text[], p_assinatura_cliente_url text DEFAULT NULL::text, p_checklist_voltagem_bateria text DEFAULT NULL::text, p_checklist_carga_bateria text DEFAULT NULL::text, p_checklist_alternador_ok boolean DEFAULT false, p_checklist_motor_partida_ok boolean DEFAULT false, p_checklist_fusiveis_ok boolean DEFAULT false, p_codigo_obd text DEFAULT NULL::text, p_codigos_obd_lista text[] DEFAULT '{}'::text[], p_hipotese_diagnostico text DEFAULT NULL::text, p_modulos_testados text[] DEFAULT '{}'::text[], p_tempo_diagnostico_minutos integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_os_id uuid;
  v_numero integer;
  v_item jsonb;
  v_total_valor_unitario numeric := 0;
  v_total_mao_obra_itens numeric := 0;
  v_valor_total numeric;
  v_custo_itens numeric := 0;
  v_custo_total numeric := 0;
  v_insert_status text;
  v_final_status text;
BEGIN
  -- >>> GUARDA DE AUTORIZAÇÃO >>>
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_oficina_access(auth.uid(), p_oficina_id) THEN
    RAISE EXCEPTION 'Sem permissão para esta oficina' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clientes
                 WHERE id = p_cliente_id AND oficina_id = p_oficina_id) THEN
    RAISE EXCEPTION 'Cliente não pertence à oficina' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.veiculos
                 WHERE id = p_veiculo_id AND oficina_id = p_oficina_id
                   AND cliente_id = p_cliente_id) THEN
    RAISE EXCEPTION 'Veículo não pertence ao cliente/oficina' USING ERRCODE = '42501';
  END IF;
  -- <<< FIM DO GUARDA <<<

  PERFORM public.rate_limit_os_insert(p_oficina_id);

  v_final_status := p_status;
  IF p_status = 'finalizado' THEN
    v_insert_status := 'em_andamento';
  ELSE
    v_insert_status := COALESCE(p_status, 'em_andamento');
  END IF;

  INSERT INTO public.ordens_servico (
    oficina_id, cliente_id, veiculo_id,
    tipo_servico, descricao, km_no_servico,
    responsavel_id, data_servico, hora_agendamento,
    status, valor_servico, custo_servico, valor_mao_obra,
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
    v_insert_status, 0, 0, COALESCE(p_valor_mao_de_obra, 0),
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

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    DECLARE
      v_qty numeric;
      v_unit_price numeric;
      v_labor numeric;
      v_cost numeric;
      v_item_total numeric;
      v_estoque_id uuid;
      v_tipo_item text;
    BEGIN
      v_qty := COALESCE((v_item->>'quantidade')::numeric, 1);
      v_unit_price := COALESCE((v_item->>'valor_unitario')::numeric, 0);
      v_labor := COALESCE((v_item->>'valor_mao_obra')::numeric, 0);
      v_cost := COALESCE((v_item->>'custo_unitario')::numeric, 0);
      v_item_total := (v_qty * v_unit_price) + v_labor;
      v_estoque_id := NULLIF(v_item->>'estoque_id', '')::uuid;
      v_tipo_item := CASE
        WHEN v_item->>'tipo' IN ('servico', 'produto') THEN v_item->>'tipo'
        WHEN v_estoque_id IS NOT NULL THEN 'produto'
        ELSE 'servico'
      END;

      IF v_qty <= 0 OR NOT (v_item_total IS NOT NULL AND v_item_total >= 0) THEN
        RAISE EXCEPTION 'Item inválido: % (qty=%, total=%)', v_item->>'nome_item', v_qty, v_item_total;
      END IF;

      INSERT INTO public.itens_os (
        ordem_servico_id, nome_item, tipo, quantidade,
        valor_unitario, valor_mao_obra, custo_unitario,
        estoque_id
      ) VALUES (
        v_os_id, v_item->>'nome_item', v_tipo_item, v_qty,
        v_unit_price, v_labor, v_cost,
        v_estoque_id
      );

      v_total_valor_unitario := v_total_valor_unitario + (v_qty * v_unit_price);
      v_total_mao_obra_itens := v_total_mao_obra_itens + v_labor;
      v_custo_itens := v_custo_itens + (v_cost * v_qty);
    END;
  END LOOP;

  v_valor_total := v_total_valor_unitario + GREATEST(COALESCE(p_valor_mao_de_obra, 0), v_total_mao_obra_itens);
  v_custo_total := GREATEST(COALESCE(p_custo_servico, 0), v_custo_itens);

  UPDATE public.ordens_servico SET
    valor_servico = v_valor_total,
    custo_servico = v_custo_total
  WHERE id = v_os_id;

  IF v_final_status = 'finalizado' THEN
    PERFORM public.finalizar_os_atomica(
      p_os_id := v_os_id,
      p_forma_pagamento := p_forma_pagamento,
      p_forma_pagamento_id := p_forma_pagamento_id,
      p_numero_parcelas := COALESCE(p_numero_parcelas, 1),
      p_itens_novos := '[]'::jsonb,
      p_observacoes_conclusao := NULL,
      p_fotos_saida := '{}'::text[],
      p_valor_mao_obra := COALESCE(p_valor_mao_de_obra, 0)
    );
  END IF;

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
$function$
