-- 1. Melhorar recalcular_totais_os para maior precisão de lucro
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

  -- Soma de produtos, mão de obra por item e custo
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

  -- VALOR BRUTO = Produtos + M.O. Global + M.O. nos itens
  v_total_receita_bruta := (v_total_produtos + v_mao_obra_global + v_total_mao_obra_itens);

  -- Safety net para OS finalizada
  IF v_total_receita_bruta <= 0 AND v_status = 'finalizado' THEN
    SELECT COALESCE(SUM(valor), 0) INTO v_financeiro_total_pago
    FROM public.financeiro
    WHERE ordem_servico_id = p_os_id
      AND tipo = 'entrada'
      AND origem NOT ILIKE 'Comissão%'
      AND categoria != 'sinal';

    IF v_financeiro_total_pago > 0 THEN
      v_total_receita_bruta := v_financeiro_total_pago + v_desconto;
    ELSIF v_valor_servico_atual > 0 THEN
      v_total_receita_bruta := v_valor_servico_atual;
    END IF;
  END IF;

  UPDATE public.ordens_servico
  SET valor_servico = v_total_receita_bruta,
      custo_servico = v_total_custo,
      lucro = GREATEST(v_total_receita_bruta - v_desconto - v_total_custo, 0)
  WHERE id = p_os_id
    AND (
      valor_servico IS DISTINCT FROM v_total_receita_bruta
      OR custo_servico IS DISTINCT FROM v_total_custo
      OR lucro IS DISTINCT FROM GREATEST(v_total_receita_bruta - v_desconto - v_total_custo, 0)
    );
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 2. Corrigir upsert_financeiro_os para lançar valores segregados
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
  v_total_pecas_bruto numeric := 0;
  v_total_mao_obra_itens_bruto numeric := 0;
  v_mao_obra_global numeric := 0;
  v_mao_obra_total_bruta numeric := 0;
  v_valor_bruto_os numeric := 0;
  v_desconto_os numeric := 0;
  v_valor_sinal numeric := 0;
  v_valor_liquido_os numeric := 0;
  v_valor_restante numeric := 0;
  v_existing_id uuid;
  v_lock_key bigint;
  v_ratio_mao_obra numeric := 0;
  v_ratio_pecas numeric := 0;
  v_os_numero integer;
  v_responsavel_id uuid;
BEGIN
  v_lock_key := ('x' || left(replace(p_ordem_servico_id::text, '-', ''), 15))::bit(64)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Se já existe entrada financeira não-sinal, sai
  SELECT id INTO v_existing_id FROM public.financeiro
  WHERE ordem_servico_id = p_ordem_servico_id AND tipo = 'entrada' AND categoria NOT IN ('comissao', 'sinal') LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN json_build_object('success', true, 'action', 'exists', 'id', v_existing_id);
  END IF;

  SELECT
    COALESCE(os.valor_servico, 0),
    COALESCE(os.valor_mao_obra, 0),
    COALESCE(os.desconto, 0),
    os.numero,
    os.responsavel_id,
    COALESCE(os.valor_sinal, 0)
  INTO v_valor_bruto_os, v_mao_obra_global, v_desconto_os, v_os_numero, v_responsavel_id, v_valor_sinal
  FROM public.ordens_servico os WHERE os.id = p_ordem_servico_id;

  -- Calcular o que é peça e o que é mão de obra real
  SELECT
    COALESCE(SUM(CASE WHEN ios.tipo = 'produto' OR ios.estoque_id IS NOT NULL THEN (COALESCE(ios.quantidade, 1) * COALESCE(ios.valor_unitario, 0)) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN ios.tipo = 'servico' AND ios.estoque_id IS NULL THEN (COALESCE(ios.quantidade, 1) * COALESCE(ios.valor_unitario, 0)) ELSE 0 END), 0),
    COALESCE(SUM(COALESCE(ios.valor_mao_obra, 0)), 0)
  INTO v_total_pecas_bruto, v_mao_obra_total_bruta, v_total_mao_obra_itens_bruto
  FROM public.itens_os ios WHERE ios.ordem_servico_id = p_ordem_servico_id;

  -- Mão de obra total = Global + Itens (serviços) + MO embutida em peças
  v_mao_obra_total_bruta := v_mao_obra_total_bruta + v_mao_obra_global + v_total_mao_obra_itens_bruto;
  
  -- Se o bruto da OS ainda estiver 0 (legado), reconstrói
  IF v_valor_bruto_os <= 0 THEN
    v_valor_bruto_os := v_total_pecas_bruto + v_mao_obra_total_bruta;
  END IF;

  v_valor_liquido_os := GREATEST(v_valor_bruto_os - v_desconto_os, 0);
  v_valor_restante := GREATEST(v_valor_liquido_os - v_valor_sinal, 0);

  IF v_valor_restante <= 0 THEN
    RETURN json_build_object('success', true, 'action', 'skipped', 'reason', 'paid_or_zero');
  END IF;

  -- Calcular proporção para dividir o líquido restante
  IF v_valor_bruto_os > 0 THEN
    v_ratio_mao_obra := v_mao_obra_total_bruta / v_valor_bruto_os;
    v_ratio_pecas := v_total_pecas_bruto / v_valor_bruto_os;
  ELSE
    v_ratio_mao_obra := 1; v_ratio_pecas := 0;
  END IF;

  -- Lançamento financeiro com valores segregados
  INSERT INTO public.financeiro (
    oficina_id, ordem_servico_id, tipo, origem, valor, data, descricao, status, forma_pagamento_id,
    valor_mao_obra, valor_pecas, categoria
  ) VALUES (
    p_oficina_id, p_ordem_servico_id, 'entrada',
    COALESCE(p_origem, 'Serviço ' || p_tipo_servico),
    v_valor_restante, CURRENT_DATE,
    'OS #' || v_os_numero || ' finalizada' || CASE WHEN v_desconto_os > 0 THEN ' (desconto R$' || v_desconto_os || ' aplicado)' ELSE '' END,
    'pago', p_forma_pagamento_id,
    v_valor_restante * v_ratio_mao_obra, v_valor_restante * v_ratio_pecas, 'operacional'
  ) RETURNING id INTO v_existing_id;

  RETURN json_build_object('success', true, 'id', v_existing_id);
END;
$function$;