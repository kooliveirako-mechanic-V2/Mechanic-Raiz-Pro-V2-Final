-- 1. Garantir que não existam duplicatas antes de criar
DROP FUNCTION IF EXISTS public.upsert_financeiro_os(uuid, uuid, text, numeric, uuid, text, integer);
DROP FUNCTION IF EXISTS public.upsert_financeiro_os(uuid, uuid, text, numeric, uuid, text, integer, numeric);

-- 2. Recriar versão oficial
CREATE OR REPLACE FUNCTION public.upsert_financeiro_os(
    p_oficina_id uuid,
    p_ordem_servico_id uuid,
    p_tipo_servico text,
    p_mao_obra_valor numeric,
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
  v_total_pecas_bruto numeric := 0;
  v_mao_obra_total_bruta numeric := 0;
  v_valor_bruto_os numeric := 0;
  v_desconto_os numeric := 0;
  v_valor_sinal numeric := 0;
  v_valor_liquido_os numeric := 0;
  v_valor_restante numeric := 0;
  v_existing_id uuid;
  v_os_numero integer;
  v_status_financeiro text := 'pago';
BEGIN
  IF p_forma_pagamento_id IS NULL THEN
    v_status_financeiro := 'a_receber';
  END IF;

  SELECT id INTO v_existing_id FROM public.financeiro 
  WHERE ordem_servico_id = p_ordem_servico_id AND tipo = 'entrada' AND categoria NOT IN ('comissao', 'sinal') LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN json_build_object('success', true, 'action', 'exists', 'id', v_existing_id);
  END IF;

  SELECT 
    COALESCE(os.valor_servico, 0), 
    COALESCE(os.desconto, 0),
    os.numero,
    COALESCE(os.valor_sinal, 0)
  INTO v_valor_bruto_os, v_desconto_os, v_os_numero, v_valor_sinal
  FROM public.ordens_servico os WHERE os.id = p_ordem_servico_id;

  SELECT 
    COALESCE(SUM(CASE WHEN ios.tipo = 'produto' OR ios.estoque_id IS NOT NULL THEN (COALESCE(ios.quantidade, 1) * COALESCE(ios.valor_unitario, 0)) ELSE 0 END), 0),
    COALESCE(SUM(COALESCE(ios.valor_mao_obra, 0)), 0)
  INTO v_total_pecas_bruto, v_mao_obra_total_bruta
  FROM public.itens_os ios WHERE ios.ordem_servico_id = p_ordem_servico_id;

  v_mao_obra_total_bruta := v_mao_obra_total_bruta + COALESCE(p_mao_obra_valor, 0);
  
  IF v_valor_bruto_os <= 0 THEN
    v_valor_bruto_os := v_total_pecas_bruto + v_mao_obra_total_bruta;
  END IF;

  v_valor_liquido_os := GREATEST(v_valor_bruto_os - v_desconto_os, 0);
  v_valor_restante := GREATEST(v_valor_liquido_os - v_valor_sinal, 0);

  IF v_valor_restante <= 0 THEN
    RETURN json_build_object('success', true, 'action', 'skipped', 'message', 'OS sem valor restante para financeiro');
  END IF;

  INSERT INTO public.financeiro (
    oficina_id, ordem_servico_id, tipo, categoria, valor, status,
    descricao, data_vencimento, data_pagamento, forma_pagamento_id
  ) VALUES (
    p_oficina_id, p_ordem_servico_id, 'entrada', 'servico', v_valor_restante, 
    v_status_financeiro::public.status_pagamento,
    'OS #' || v_os_numero || ' - ' || p_tipo_servico,
    CURRENT_DATE,
    CASE WHEN v_status_financeiro = 'pago' THEN now() ELSE NULL END,
    p_forma_pagamento_id
  ) RETURNING id INTO v_existing_id;

  RETURN json_build_object('success', true, 'action', 'created', 'id', v_existing_id);
END;
$function$;
