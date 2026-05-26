CREATE OR REPLACE FUNCTION public.recalcular_totais_os(p_os_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_produtos NUMERIC := 0;
  v_total_mao_obra_itens NUMERIC := 0;
  v_mao_obra_global NUMERIC := 0;
  v_valor_servico_atual NUMERIC := 0;
  v_total_receita NUMERIC := 0;
  v_total_custo NUMERIC := 0;
BEGIN
  SELECT
    COALESCE(os.valor_mao_obra, 0),
    COALESCE(os.valor_servico, 0)
  INTO v_mao_obra_global, v_valor_servico_atual
  FROM public.ordens_servico os
  WHERE os.id = p_os_id;

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

  v_total_receita := v_total_produtos + GREATEST(v_mao_obra_global, v_total_mao_obra_itens);

  IF v_total_receita <= 0 AND v_valor_servico_atual > 0 THEN
    v_total_receita := v_valor_servico_atual;
  END IF;

  UPDATE public.ordens_servico
  SET valor_servico = v_total_receita,
      custo_servico = v_total_custo
  WHERE id = p_os_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.criar_os_completa(
  p_oficina_id uuid,
  p_cliente_id uuid,
  p_veiculo_id uuid,
  p_tipo_servico text,
  p_descricao text DEFAULT NULL::text,
  p_km_no_servico integer DEFAULT NULL::integer,
  p_responsavel_id uuid DEFAULT NULL::uuid,
  p_data_servico date DEFAULT CURRENT_DATE,
  p_hora_agendamento time without time zone DEFAULT NULL::time without time zone,
  p_status text DEFAULT 'em_andamento'::text,
  p_valor_mao_de_obra numeric DEFAULT 0,
  p_custo_servico numeric DEFAULT 0,
  p_tem_garantia boolean DEFAULT false,
  p_dias_garantia integer DEFAULT 0,
  p_forma_pagamento text DEFAULT NULL::text,
  p_forma_pagamento_id uuid DEFAULT NULL::uuid,
  p_numero_parcelas integer DEFAULT NULL::integer,
  p_observacoes text DEFAULT NULL::text,
  p_itens jsonb DEFAULT '[]'::jsonb,
  p_checklist_combustivel text DEFAULT NULL::text,
  p_checklist_riscos boolean DEFAULT false,
  p_checklist_estepe boolean DEFAULT false,
  p_checklist_som boolean DEFAULT false,
  p_checklist_luzes boolean DEFAULT false,
  p_fotos_entrada text[] DEFAULT '{}'::text[],
  p_assinatura_cliente_url text DEFAULT NULL::text,
  p_checklist_voltagem_bateria text DEFAULT NULL::text,
  p_checklist_carga_bateria text DEFAULT NULL::text,
  p_checklist_alternador_ok boolean DEFAULT false,
  p_checklist_motor_partida_ok boolean DEFAULT false,
  p_checklist_fusiveis_ok boolean DEFAULT false,
  p_codigo_obd text DEFAULT NULL::text,
  p_codigos_obd_lista text[] DEFAULT '{}'::text[],
  p_hipotese_diagnostico text DEFAULT NULL::text,
  p_modulos_testados text[] DEFAULT '{}'::text[],
  p_tempo_diagnostico_minutos integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_os_id UUID;
  v_numero INTEGER;
  v_item JSONB;
  v_total_produtos NUMERIC := 0;
  v_total_mao_obra_itens NUMERIC := 0;
  v_valor_total NUMERIC;
  v_custo_itens NUMERIC := 0;
  v_custo_total NUMERIC := 0;
  v_insert_status TEXT;
  v_final_status TEXT;
BEGIN
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
        RAISE EXCEPTION 'Item inválido: % (qty=%, total=%)', v_item->>'nome_item', v_qty, v_item_total;
      END IF;

      INSERT INTO public.itens_os (
        ordem_servico_id, nome_item, quantidade,
        valor_unitario, valor_mao_obra, custo_unitario,
        estoque_id
      ) VALUES (
        v_os_id, v_item->>'nome_item', v_qty,
        v_unit_price, v_labor, v_cost,
        v_estoque_id
      );

      v_total_produtos := v_total_produtos + (v_qty * v_unit_price);
      v_total_mao_obra_itens := v_total_mao_obra_itens + v_labor;
      v_custo_itens := v_custo_itens + (v_cost * v_qty);
    END;
  END LOOP;

  v_valor_total := v_total_produtos + GREATEST(COALESCE(p_valor_mao_de_obra, 0), v_total_mao_obra_itens);
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
      p_fotos_saida := '{}'::text[]
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
$function$;

CREATE OR REPLACE FUNCTION public.upsert_financeiro_os(
  p_oficina_id uuid,
  p_ordem_servico_id uuid,
  p_tipo_servico text,
  p_valor_mao_de_obra numeric,
  p_forma_pagamento_id uuid DEFAULT NULL::uuid,
  p_origem text DEFAULT NULL::text,
  p_numero_parcelas integer DEFAULT 1
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_produtos numeric := 0;
  v_total_mao_obra_itens numeric := 0;
  v_mao_obra_global numeric := 0;
  v_mao_obra_base numeric := 0;
  v_valor_total numeric := 0;
  v_existing_id uuid;
  v_parcela_valor numeric;
  v_data_base date;
  v_i integer;
  v_num_parcelas integer;
  v_responsavel_id uuid;
  v_comissao_pct numeric;
  v_comissao_valor numeric;
  v_responsavel_nome text;
  v_os_numero integer;
  v_lock_key bigint;
BEGIN
  v_lock_key := ('x' || left(replace(p_ordem_servico_id::text, '-', ''), 15))::bit(64)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT id INTO v_existing_id
  FROM public.financeiro
  WHERE ordem_servico_id = p_ordem_servico_id
    AND tipo = 'entrada'
    AND origem NOT ILIKE 'Comissão%'
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN json_build_object('success', true, 'action', 'exists', 'id', v_existing_id);
  END IF;

  IF COALESCE(p_valor_mao_de_obra, 0) < 0 THEN
    RETURN json_build_object('success', false, 'error', 'Valor de mão de obra não pode ser negativo');
  END IF;

  SELECT
    COALESCE(os.valor_servico, 0),
    COALESCE(os.valor_mao_obra, 0),
    os.responsavel_id,
    os.numero
  INTO v_valor_total, v_mao_obra_global, v_responsavel_id, v_os_numero
  FROM public.ordens_servico os
  WHERE os.id = p_ordem_servico_id;

  SELECT
    COALESCE(SUM(COALESCE(ios.quantidade, 1) * COALESCE(ios.valor_unitario, 0)), 0),
    COALESCE(SUM(COALESCE(ios.valor_mao_obra, 0)), 0)
  INTO v_total_produtos, v_total_mao_obra_itens
  FROM public.itens_os ios
  WHERE ios.ordem_servico_id = p_ordem_servico_id;

  v_mao_obra_base := GREATEST(COALESCE(p_valor_mao_de_obra, 0), v_mao_obra_global, v_total_mao_obra_itens);

  IF v_valor_total <= 0 THEN
    v_valor_total := v_total_produtos + v_mao_obra_base;
  END IF;

  IF v_valor_total <= 0 THEN
    RETURN json_build_object('success', true, 'action', 'skipped', 'reason', 'zero_value');
  END IF;

  v_num_parcelas := GREATEST(COALESCE(p_numero_parcelas, 1), 1);
  IF v_num_parcelas > 24 THEN
    v_num_parcelas := 24;
  END IF;

  v_parcela_valor := ROUND(v_valor_total / v_num_parcelas, 2);
  v_data_base := CURRENT_DATE;

  IF v_num_parcelas = 1 THEN
    INSERT INTO public.financeiro (
      oficina_id, ordem_servico_id, tipo, origem, valor, data, descricao, status, forma_pagamento_id
    ) VALUES (
      p_oficina_id, p_ordem_servico_id, 'entrada',
      COALESCE(p_origem, 'Serviço ' || p_tipo_servico),
      v_valor_total, CURRENT_DATE,
      p_tipo_servico || ' - OS Finalizada' ||
        CASE WHEN v_total_produtos > 0
          THEN ' (inclui R$' || TRIM(TO_CHAR(v_total_produtos, 'FM999999990.00')) || ' em produtos/peças)'
          ELSE ''
        END,
      'pago', p_forma_pagamento_id
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_existing_id;
  ELSE
    FOR v_i IN 1..v_num_parcelas LOOP
      IF v_i = v_num_parcelas THEN
        v_parcela_valor := v_valor_total - (ROUND(v_valor_total / v_num_parcelas, 2) * (v_num_parcelas - 1));
      END IF;

      INSERT INTO public.financeiro (
        oficina_id, ordem_servico_id, tipo, origem, valor, data, descricao, status, forma_pagamento_id
      ) VALUES (
        p_oficina_id, p_ordem_servico_id, 'entrada',
        COALESCE(p_origem, 'Serviço ' || p_tipo_servico),
        v_parcela_valor,
        v_data_base + (v_i - 1) * INTERVAL '1 month',
        'Parcela ' || v_i || '/' || v_num_parcelas || ' — ' || p_tipo_servico,
        CASE WHEN v_i = 1 THEN 'pago' ELSE 'a_receber' END,
        p_forma_pagamento_id
      );
    END LOOP;
  END IF;

  IF v_responsavel_id IS NOT NULL THEN
    SELECT cf.percentual INTO v_comissao_pct
    FROM public.comissoes_funcionarios cf
    WHERE cf.oficina_id = p_oficina_id
      AND cf.user_id = v_responsavel_id
      AND cf.ativo = true;

    IF v_comissao_pct IS NOT NULL AND v_comissao_pct > 0 THEN
      v_comissao_valor := ROUND(v_mao_obra_base * v_comissao_pct / 100, 2);

      IF v_comissao_valor > 0 THEN
        SELECT COALESCE(p.nome, 'Funcionário') INTO v_responsavel_nome
        FROM public.profiles p
        WHERE p.user_id = v_responsavel_id;

        INSERT INTO public.financeiro (
          oficina_id, ordem_servico_id, tipo, origem, valor, data, descricao, status
        ) VALUES (
          p_oficina_id, p_ordem_servico_id, 'saida',
          'Comissão',
          v_comissao_valor, CURRENT_DATE,
          'Comissão ' || v_responsavel_nome || ' (' || TRIM(TO_CHAR(v_comissao_pct, 'FM990')) || '%) — OS #' || COALESCE(v_os_numero::text, ''),
          'a_pagar'
        );
      END IF;
    END IF;
  END IF;

  RETURN json_build_object('success', true, 'action', 'created', 'valor', v_valor_total, 'parcelas', v_num_parcelas);

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.finalizar_os_atomica(
  p_os_id uuid,
  p_forma_pagamento text DEFAULT NULL::text,
  p_forma_pagamento_id uuid DEFAULT NULL::uuid,
  p_numero_parcelas integer DEFAULT 1,
  p_itens_novos jsonb DEFAULT '[]'::jsonb,
  p_observacoes_conclusao text DEFAULT NULL::text,
  p_fotos_saida text[] DEFAULT '{}'::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_os ordens_servico%ROWTYPE;
  v_valor_total NUMERIC := 0;
  v_total_produtos NUMERIC := 0;
  v_total_mao_obra_itens NUMERIC := 0;
  v_mao_de_obra_global NUMERIC := 0;
  v_mao_de_obra_base NUMERIC := 0;
  v_custo_itens NUMERIC := 0;
  v_custo_total NUMERIC := 0;
  v_item JSONB;
  v_financeiro_result JSON;
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

  IF v_os.status = 'cancelado' THEN
    RAISE EXCEPTION 'OS cancelada não pode ser finalizada';
  END IF;

  IF v_os.status <> 'em_andamento' THEN
    UPDATE public.ordens_servico
    SET status = 'em_andamento'
    WHERE id = p_os_id;
  END IF;

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
  v_mao_de_obra_base := GREATEST(v_mao_de_obra_global, v_total_mao_obra_itens);
  v_valor_total := v_total_produtos + v_mao_de_obra_base;
  v_custo_total := GREATEST(COALESCE(v_os.custo_servico, 0), v_custo_itens);

  IF v_valor_total <= 0 AND COALESCE(v_os.valor_servico, 0) > 0 THEN
    v_valor_total := v_os.valor_servico;
    v_mao_de_obra_base := GREATEST(v_mao_de_obra_base, v_os.valor_servico);
  END IF;

  UPDATE public.ordens_servico SET
    status = 'finalizado',
    forma_pagamento = COALESCE(p_forma_pagamento, v_os.forma_pagamento),
    data_conclusao = CURRENT_DATE,
    valor_servico = v_valor_total,
    custo_servico = v_custo_total,
    observacoes_conclusao = COALESCE(p_observacoes_conclusao, v_os.observacoes_conclusao),
    fotos_saida = CASE WHEN array_length(p_fotos_saida, 1) > 0 THEN p_fotos_saida ELSE v_os.fotos_saida END
  WHERE id = p_os_id;

  IF v_valor_total > 0 THEN
    v_financeiro_result := public.upsert_financeiro_os(
      v_os.oficina_id,
      p_os_id,
      v_os.tipo_servico,
      v_mao_de_obra_base,
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
$function$;