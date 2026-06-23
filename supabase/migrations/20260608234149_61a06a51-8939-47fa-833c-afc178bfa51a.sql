-- 1. CORREÇÃO DA RPC DE MÉTRICAS (Separação Competência vs Caixa)
CREATE OR REPLACE FUNCTION get_metrics_financeiras_unificadas(
    p_oficina_id UUID,
    p_data_inicio DATE DEFAULT (DATE_TRUNC('month', CURRENT_DATE))::DATE,
    p_data_fim DATE DEFAULT (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_tem_acesso BOOLEAN := false;
  v_faturamento_liquido NUMERIC := 0;
  v_faturamento_bruto NUMERIC := 0;
  v_descontos NUMERIC := 0;
  v_entradas_caixa NUMERIC := 0;
  v_saidas_caixa NUMERIC := 0;
  v_custo_pecas NUMERIC := 0;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM oficinas WHERE id = p_oficina_id AND user_id = v_user_id
  ) OR EXISTS(
    SELECT 1 FROM user_roles WHERE oficina_id = p_oficina_id AND user_id = v_user_id AND active = true
  ) OR (current_setting('role') = 'service_role')
  INTO v_tem_acesso;

  IF NOT v_tem_acesso THEN
    RETURN jsonb_build_object('faturamento', jsonb_build_object('liquido', 0), 'acesso_negado', true);
  END IF;

  -- FATURAMENTO (COMPETÊNCIA): Todas as OS finalizadas no período
  SELECT 
    COALESCE(SUM(valor_servico), 0),
    COALESCE(SUM(desconto), 0),
    COALESCE(SUM(valor_servico - COALESCE(desconto, 0)), 0),
    COALESCE(SUM(custo_servico), 0)
  INTO v_faturamento_bruto, v_descontos, v_faturamento_liquido, v_custo_pecas
  FROM ordens_servico
  WHERE oficina_id = p_oficina_id
  AND status = 'finalizado'
  AND COALESCE(data_conclusao, data_servico)::date BETWEEN p_data_inicio AND p_data_fim;

  -- SOMA Vendas Balcão
  DECLARE
    v_vendas_bruto NUMERIC := 0;
  BEGIN
    SELECT COALESCE(SUM(valor_total), 0) INTO v_vendas_bruto
    FROM vendas_balcao
    WHERE oficina_id = p_oficina_id
    AND status = 'concluida'
    AND created_at::date BETWEEN p_data_inicio AND p_data_fim;
    
    v_faturamento_bruto := v_faturamento_bruto + v_vendas_bruto;
    v_faturamento_liquido := v_faturamento_liquido + v_vendas_bruto;
  END;

  -- CAIXA: Apenas lançamentos PAGOS
  SELECT
    COALESCE(SUM(CASE WHEN tipo='entrada' THEN valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tipo='saida' THEN valor ELSE 0 END), 0)
  INTO v_entradas_caixa, v_saidas_caixa
  FROM financeiro
  WHERE oficina_id = p_oficina_id
  AND data BETWEEN p_data_inicio AND p_data_fim
  AND status = 'pago';

  RETURN jsonb_build_object(
    'periodo', jsonb_build_object('inicio', p_data_inicio, 'fim', p_data_fim),
    'faturamento', jsonb_build_object(
      'bruto', v_faturamento_bruto,
      'descontos', v_descontos,
      'liquido', v_faturamento_liquido
    ),
    'operacional', jsonb_build_object(
      'lucro_operacional', v_faturamento_liquido - v_custo_pecas,
      'custo_pecas', v_custo_pecas
    ),
    'caixa', jsonb_build_object(
        'entradas_oficina_periodo', v_entradas_caixa, 
        'saidas_oficina_periodo', v_saidas_caixa,
        'recebido_vinculado_competencia', v_entradas_caixa,
        'lucro_caixa_oficina_periodo', v_entradas_caixa - v_saidas_caixa,
        'saldo_a_receber_competencia', GREATEST(v_faturamento_liquido - v_entradas_caixa, 0)
    ),
    'categorias', jsonb_build_object(
        'pecas', jsonb_build_object('liquido', 0, 'bruto', 0),
        'servicos', jsonb_build_object('liquido', 0, 'bruto', 0)
    ),
    'auditoria', jsonb_build_object('total_itens_livres_sem_custo', 0, 'alerta_lucro_inflado', false),
    'acesso_negado', false
  );
END;
$$;

-- 2. CORREÇÃO DA FINALIZAÇÃO DE OS (Removendo trava de parâmetro e permitindo a_receber)
DROP FUNCTION IF EXISTS upsert_financeiro_os(uuid,uuid,text,numeric,uuid,text,integer);

CREATE OR REPLACE FUNCTION upsert_financeiro_os(
  p_oficina_id uuid,
  p_ordem_servico_id uuid,
  p_tipo_servico text,
  p_mao_obra_valor numeric,
  p_forma_pagamento_id uuid DEFAULT NULL,
  p_origem text DEFAULT NULL,
  p_numero_parcelas integer DEFAULT 1
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_pecas_bruto numeric := 0;
  v_mao_obra_total_bruta numeric := 0;
  v_valor_bruto_os numeric := 0;
  v_desconto_os numeric := 0;
  v_valor_sinal numeric := 0;
  v_valor_liquido_os numeric := 0;
  v_valor_restante numeric := 0;
  v_existing_id uuid;
  v_ratio_mao_obra numeric := 0;
  v_ratio_pecas numeric := 0;
  v_os_numero integer;
  v_status_financeiro text := 'pago';
BEGIN
  -- Se não informou forma de pagamento, nasce como a_receber (permite finalizar sem pagar)
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
    RETURN json_build_object('success', true, 'action', 'skipped', 'reason', 'paid_or_zero');
  END IF;

  IF v_valor_bruto_os > 0 THEN
    v_ratio_mao_obra := v_mao_obra_total_bruta / v_valor_bruto_os;
    v_ratio_pecas := v_total_pecas_bruto / v_valor_bruto_os;
  ELSE
    v_ratio_mao_obra := 1; v_ratio_pecas := 0;
  END IF;

  INSERT INTO public.financeiro (
    oficina_id, ordem_servico_id, tipo, origem, valor, data, descricao, status, forma_pagamento_id,
    valor_mao_obra, valor_pecas, categoria
  ) VALUES (
    p_oficina_id, p_ordem_servico_id, 'entrada',
    COALESCE(p_origem, 'Serviço ' || p_tipo_servico),
    v_valor_restante, CURRENT_DATE,
    'OS #' || v_os_numero || ' finalizada',
    v_status_financeiro, p_forma_pagamento_id,
    v_valor_restante * v_ratio_mao_obra, v_valor_restante * v_ratio_pecas, 'operacional'
  ) RETURNING id INTO v_existing_id;

  RETURN json_build_object('success', true, 'id', v_existing_id);
END;
$$;