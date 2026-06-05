-- 1. Corrigir recalcular_totais_os para salvar o valor BRUTO e não tentar atualizar coluna gerada 'lucro'
CREATE OR REPLACE FUNCTION public.recalcular_totais_os(p_os_id uuid)
RETURNS void AS $$
DECLARE
  v_total_produtos NUMERIC := 0;
  v_total_mao_obra_itens NUMERIC := 0;
  v_mao_obra_global NUMERIC := 0;
  v_desconto NUMERIC := 0;
  v_valor_servico_atual NUMERIC := 0;
  v_status TEXT;
  v_total_receita_bruta NUMERIC := 0;
  v_total_custo NUMERIC := 0;
  v_financeiro_total_pago NUMERIC := 0;
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

  -- ALINHAMENTO MATEMÁTICO: valor_servico é o BRUTO (Peças + M.O. Global + M.O. Itens)
  v_total_receita_bruta := (v_total_produtos + v_mao_obra_global + v_total_mao_obra_itens);

  -- Safety net: se a OS está finalizada e o valor bruto calculado deu zero, mas há financeiro, mantém o valor atual
  IF v_total_receita_bruta <= 0 AND v_status = 'finalizado' THEN
    SELECT COALESCE(SUM(valor), 0) INTO v_financeiro_total_pago
    FROM public.financeiro
    WHERE ordem_servico_id = p_os_id
      AND tipo = 'entrada'
      AND origem NOT ILIKE 'Comissão%';

    IF v_financeiro_total_pago > 0 THEN
      -- Se já foi pago, o bruto deve ser pelo menos o valor pago + desconto
      v_total_receita_bruta := v_financeiro_total_pago + v_desconto;
    ELSIF v_valor_servico_atual > 0 THEN
      v_total_receita_bruta := v_valor_servico_atual;
    END IF;
  END IF;

  UPDATE public.ordens_servico
  SET valor_servico = v_total_receita_bruta,
      custo_servico = v_total_custo
  WHERE id = p_os_id
    AND (
      valor_servico IS DISTINCT FROM v_total_receita_bruta
      OR custo_servico IS DISTINCT FROM v_total_custo
    );
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 2. Corrigir finalizar_os_atomica para salvar valor BRUTO e remover update manual de lucro
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
  v_valor_bruto NUMERIC := 0;
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

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens_novos)
  LOOP
    DECLARE
      v_qty NUMERIC := COALESCE((v_item->>'quantidade')::NUMERIC, 1);
      v_unit_price NUMERIC := COALESCE((v_item->>'valor_unitario')::NUMERIC, 0);
      v_labor NUMERIC := COALESCE((v_item->>'valor_mao_obra')::NUMERIC, 0);
      v_cost NUMERIC := COALESCE((v_item->>'custo_unitario')::NUMERIC, 0);
    BEGIN
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
  v_desconto := COALESCE(v_os.desconto, 0);
  v_mao_de_obra_consolidada := v_mao_de_obra_global + v_total_mao_obra_itens;
  
  -- VALOR BRUTO para o campo valor_servico
  v_valor_bruto := (v_total_produtos + v_mao_de_obra_consolidada);
  v_custo_total := GREATEST(COALESCE(v_os.custo_servico, 0), v_custo_itens);

  UPDATE public.ordens_servico SET
    status = 'finalizado',
    forma_pagamento = COALESCE(p_forma_pagamento, v_os.forma_pagamento),
    data_conclusao = CURRENT_DATE,
    valor_servico = v_valor_bruto,
    custo_servico = v_custo_total,
    observacoes_conclusao = COALESCE(p_observacoes_conclusao, v_os.observacoes_conclusao),
    fotos_saida = CASE WHEN array_length(p_fotos_saida, 1) > 0 THEN p_fotos_saida ELSE v_os.fotos_saida END
  WHERE id = p_os_id;

  IF (v_valor_bruto - v_desconto) > 0 THEN
    v_financeiro_result := public.upsert_financeiro_os(
      v_os.oficina_id,
      p_os_id,
      v_os.tipo_servico,
      v_mao_de_obra_consolidada,
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
    'valor_bruto', v_valor_bruto,
    'valor_liquido', v_valor_bruto - v_desconto,
    'status', 'finalizado'
  );
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 3. Corrigir upsert_financeiro_os para considerar DESCONTO no lançamento financeiro
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
  v_total_produtos_bruto numeric := 0;
  v_total_mao_obra_itens_bruto numeric := 0;
  v_mao_obra_global numeric := 0;
  v_mao_obra_os_bruta numeric := 0;
  v_valor_bruto_os numeric := 0;
  v_desconto_os numeric := 0;
  v_valor_sinal numeric := 0;
  v_valor_liquido_os numeric := 0;
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
  v_ratio_mao_obra numeric := 0;
  v_ratio_pecas numeric := 0;
  v_calculo_mao_obra_final numeric := 0;
  v_calculo_pecas_final numeric := 0;
  v_total_servicos_catalogo_bruto numeric := 0;
BEGIN
  v_lock_key := ('x' || left(replace(p_ordem_servico_id::text, '-', ''), 15))::bit(64)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

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

  SELECT
    COALESCE(os.valor_servico, 0),
    COALESCE(os.valor_mao_obra, 0),
    COALESCE(os.desconto, 0),
    os.responsavel_id,
    os.numero,
    COALESCE(os.valor_sinal, 0)
  INTO v_valor_bruto_os, v_mao_obra_global, v_desconto_os, v_responsavel_id, v_os_numero, v_valor_sinal
  FROM public.ordens_servico os
  WHERE os.id = p_ordem_servico_id;

  SELECT
    COALESCE(SUM(CASE WHEN ios.tipo = 'produto' OR ios.estoque_id IS NOT NULL THEN (COALESCE(ios.quantidade, 1) * COALESCE(ios.valor_unitario, 0)) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN ios.tipo = 'servico' AND ios.estoque_id IS NULL THEN (COALESCE(ios.quantidade, 1) * COALESCE(ios.valor_unitario, 0)) ELSE 0 END), 0),
    COALESCE(SUM(COALESCE(ios.valor_mao_obra, 0)), 0)
  INTO v_total_produtos_bruto, v_total_servicos_catalogo_bruto, v_total_mao_obra_itens_bruto
  FROM public.itens_os ios
  WHERE ios.ordem_servico_id = p_ordem_servico_id;

  v_mao_obra_os_bruta := GREATEST(COALESCE(p_valor_mao_de_obra, 0), v_mao_obra_global, v_total_mao_obra_itens_bruto) + v_total_servicos_catalogo_bruto;

  IF v_valor_bruto_os <= 0 THEN
    v_valor_bruto_os := v_total_produtos_bruto + v_mao_obra_os_bruta;
  END IF;

  v_valor_liquido_os := GREATEST(v_valor_bruto_os - v_desconto_os, 0);
  v_valor_restante := GREATEST(v_valor_liquido_os - v_valor_sinal, 0);

  IF v_valor_restante <= 0 AND v_valor_sinal < v_valor_liquido_os THEN
     RETURN json_build_object('success', true, 'action', 'skipped', 'reason', 'fully_paid_by_signal');
  END IF;

  IF v_valor_restante <= 0 THEN
    RETURN json_build_object('success', true, 'action', 'skipped', 'reason', 'zero_value');
  END IF;

  -- Proporção baseada no BRUTO para dividir o LÍQUIDO
  IF v_valor_bruto_os > 0 THEN
    v_ratio_mao_obra := v_mao_obra_os_bruta / v_valor_bruto_os;
    v_ratio_pecas := v_total_produtos_bruto / v_valor_bruto_os;
  ELSE
    v_ratio_mao_obra := 1;
    v_ratio_pecas := 0;
  END IF;

  v_calculo_mao_obra_final := v_valor_restante * v_ratio_mao_obra;
  v_calculo_pecas_final := v_valor_restante * v_ratio_pecas;

  v_num_parcelas := GREATEST(COALESCE(p_numero_parcelas, 1), 1);
  v_data_base := CURRENT_DATE;

  IF v_num_parcelas = 1 THEN
    INSERT INTO public.financeiro (
      oficina_id, ordem_servico_id, tipo, origem, valor, data, descricao, status, forma_pagamento_id,
      valor_mao_obra, valor_pecas
    ) VALUES (
      p_oficina_id, p_ordem_servico_id, 'entrada',
      COALESCE(p_origem, 'Serviço ' || p_tipo_servico),
      v_valor_restante, CURRENT_DATE,
      p_tipo_servico || ' - OS Finalizada' ||
        CASE WHEN v_valor_sinal > 0
          THEN ' (já recebido R$' || TRIM(TO_CHAR(v_valor_sinal, 'FM999999990.00')) || ' em sinal)'
          WHEN v_desconto_os > 0
          THEN ' (líquido após desconto de R$' || TRIM(TO_CHAR(v_desconto_os, 'FM999999990.00')) || ')'
          ELSE ''
        END,
      'pago', p_forma_pagamento_id,
      v_calculo_mao_obra_final, v_calculo_pecas_final
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_existing_id;
  ELSE
    v_parcela_valor := ROUND(v_valor_restante / v_num_parcelas, 2);
    FOR v_i IN 1..v_num_parcelas LOOP
      IF v_i = v_num_parcelas THEN
        v_parcela_valor := v_valor_restante - (ROUND(v_valor_restante / v_num_parcelas, 2) * (v_num_parcelas - 1));
      END IF;

      INSERT INTO public.financeiro (
        oficina_id, ordem_servico_id, tipo, origem, valor, data, descricao, status, forma_pagamento_id,
        valor_mao_obra, valor_pecas
      ) VALUES (
        p_oficina_id, p_ordem_servico_id, 'entrada',
        COALESCE(p_origem, 'Serviço ' || p_tipo_servico),
        v_parcela_valor,
        v_data_base + (v_i - 1) * INTERVAL '1 month',
        'Parcela ' || v_i || '/' || v_num_parcelas || ' — ' || p_tipo_servico,
        CASE WHEN v_i = 1 THEN 'pago' ELSE 'a_receber' END,
        p_forma_pagamento_id,
        (v_calculo_mao_obra_final / v_num_parcelas), (v_calculo_pecas_final / v_num_parcelas)
      );
    END LOOP;
  END IF;

  -- Comissão baseada na M.O. Bruta (esforço real)
  IF v_responsavel_id IS NOT NULL THEN
    SELECT cf.percentual INTO v_comissao_pct
    FROM public.comissoes_funcionarios cf
    WHERE cf.oficina_id = p_oficina_id
      AND cf.user_id = v_responsavel_id
      AND cf.ativo = true;

    IF v_comissao_pct IS NOT NULL AND v_comissao_pct > 0 THEN
      -- Mão de obra base = Global + Itens (sem serviços de catálogo aqui para ser justo com o técnico)
      v_comissao_valor := ROUND((v_mao_obra_global + v_total_mao_obra_itens_bruto) * v_comissao_pct / 100, 2);

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
    'valor_liquido_os', v_valor_liquido_os,
    'valor_bruto_os', v_valor_bruto_os
  );
END;
$function$;
