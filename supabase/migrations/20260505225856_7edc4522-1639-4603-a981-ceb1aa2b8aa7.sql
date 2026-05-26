-- 1. Coluna de sinal na OS
ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS valor_sinal NUMERIC NOT NULL DEFAULT 0;

-- 2. RPC para registrar sinal (entrada parcial antes da finalização)
CREATE OR REPLACE FUNCTION public.registrar_sinal_os(
  p_os_id uuid,
  p_valor numeric,
  p_forma_pagamento_id uuid DEFAULT NULL
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
BEGIN
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor do sinal deve ser maior que zero';
  END IF;

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

  -- Validar acesso à oficina
  IF NOT public.has_oficina_access(auth.uid(), v_os.oficina_id) THEN
    RAISE EXCEPTION 'Sem permissão para esta OS';
  END IF;

  -- Calcular Master Total (para validar limite do sinal)
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

  -- Atualizar valor_sinal acumulado
  UPDATE public.ordens_servico
    SET valor_sinal = v_novo_sinal, updated_at = now()
    WHERE id = p_os_id;

  -- Lançar no financeiro como entrada já paga
  INSERT INTO public.financeiro (
    oficina_id, ordem_servico_id, tipo, origem, valor, data, descricao, status, forma_pagamento_id
  ) VALUES (
    v_os.oficina_id, p_os_id, 'entrada',
    'Sinal OS #' || COALESCE(v_os.numero::text, ''),
    p_valor, CURRENT_DATE,
    'Sinal/entrada parcial recebido antes da finalização',
    'pago', p_forma_pagamento_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'valor_sinal_total', v_novo_sinal,
    'master_total', v_master_total,
    'restante', GREATEST(v_master_total - v_novo_sinal, 0)
  );
END;
$$;

-- 3. Ajustar upsert_financeiro_os: ignorar Sinal% na verificação E descontar sinal do valor lançado
CREATE OR REPLACE FUNCTION public.upsert_financeiro_os(
  p_oficina_id uuid, p_ordem_servico_id uuid, p_tipo_servico text,
  p_valor_mao_de_obra numeric, p_forma_pagamento_id uuid DEFAULT NULL::uuid,
  p_origem text DEFAULT NULL::text, p_numero_parcelas integer DEFAULT 1
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
  v_valor_sinal numeric := 0;
  v_valor_restante numeric := 0;
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

  -- Verifica se já tem lançamento "principal" (excluindo Sinal e Comissão)
  SELECT id INTO v_existing_id
  FROM public.financeiro
  WHERE ordem_servico_id = p_ordem_servico_id
    AND tipo = 'entrada'
    AND origem NOT ILIKE 'Comissão%'
    AND origem NOT ILIKE 'Sinal%'
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
    os.numero,
    COALESCE(os.valor_sinal, 0)
  INTO v_valor_total, v_mao_obra_global, v_responsavel_id, v_os_numero, v_valor_sinal
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

  -- Descontar sinal já recebido
  v_valor_restante := GREATEST(v_valor_total - v_valor_sinal, 0);

  IF v_valor_restante <= 0 THEN
    -- Sinal cobriu tudo: não lança nada extra
    RETURN json_build_object('success', true, 'action', 'skipped', 'reason', 'fully_paid_by_signal');
  END IF;

  v_num_parcelas := GREATEST(COALESCE(p_numero_parcelas, 1), 1);
  IF v_num_parcelas > 24 THEN
    v_num_parcelas := 24;
  END IF;

  v_parcela_valor := ROUND(v_valor_restante / v_num_parcelas, 2);
  v_data_base := CURRENT_DATE;

  IF v_num_parcelas = 1 THEN
    INSERT INTO public.financeiro (
      oficina_id, ordem_servico_id, tipo, origem, valor, data, descricao, status, forma_pagamento_id
    ) VALUES (
      p_oficina_id, p_ordem_servico_id, 'entrada',
      COALESCE(p_origem, 'Serviço ' || p_tipo_servico),
      v_valor_restante, CURRENT_DATE,
      p_tipo_servico || ' - OS Finalizada' ||
        CASE WHEN v_valor_sinal > 0
          THEN ' (já recebido R$' || TRIM(TO_CHAR(v_valor_sinal, 'FM999999990.00')) || ' em sinal)'
          WHEN v_total_produtos > 0
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
        v_parcela_valor := v_valor_restante - (ROUND(v_valor_restante / v_num_parcelas, 2) * (v_num_parcelas - 1));
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

  -- Comissão sobre mão de obra (não muda)
  IF v_responsavel_id IS NOT NULL THEN
    SELECT cf.percentual INTO v_comissao_pct
    FROM public.comissoes_funcionarios cf
    WHERE cf.oficina_id = p_oficina_id
      AND cf.user_id = v_responsavel_id
      AND cf.ativo = true;

    IF v_comissao_pct IS NOT NULL AND v_comissao_pct > 0 THEN
      v_comissao_valor := ROUND(v_mao_obra_base * v_comissao_pct / 100, 2);

      IF v_comissao_valor > 0 THEN
        SELECT nome INTO v_responsavel_nome FROM public.profiles WHERE user_id = v_responsavel_id LIMIT 1;

        INSERT INTO public.financeiro (
          oficina_id, ordem_servico_id, tipo, origem, valor, data, descricao, status
        ) VALUES (
          p_oficina_id, p_ordem_servico_id, 'saida',
          'Comissão ' || COALESCE(v_responsavel_nome, 'funcionário'),
          v_comissao_valor, CURRENT_DATE,
          'Comissão ' || v_comissao_pct || '% sobre mão de obra OS #' || COALESCE(v_os_numero::text, ''),
          'pago'
        );
      END IF;
    END IF;
  END IF;

  RETURN json_build_object(
    'success', true,
    'action', 'created',
    'valor_lancado', v_valor_restante,
    'sinal_descontado', v_valor_sinal
  );
END;
$function$;