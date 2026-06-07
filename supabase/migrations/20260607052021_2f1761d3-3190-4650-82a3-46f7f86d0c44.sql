-- 1. VINCULAR USUÁRIO À OFICINA CORRETA (ID: dc11cb4b-d68b-4ad9-b464-0b642a4b620f)
-- O ID do usuário ko.oliveira2016@gmail.com é '82879702-5e29-4d83-86a4-08a9f061a6a4'
UPDATE oficinas 
SET user_id = '82879702-5e29-4d83-86a4-08a9f061a6a4'
WHERE id = 'dc11cb4b-d68b-4ad9-b464-0b642a4b620f';

-- 2. SIMPLIFICAR VALIDAÇÃO NA RPC
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
  v_faturamento NUMERIC := 0;
  v_despesas NUMERIC := 0;
BEGIN
  -- Validação direta e robusta para chamadas web
  SELECT EXISTS(
    SELECT 1 FROM oficinas WHERE id = p_oficina_id AND user_id = v_user_id
  ) OR EXISTS(
    SELECT 1 FROM user_roles WHERE oficina_id = p_oficina_id AND user_id = v_user_id AND active = true
  ) OR (current_setting('role') = 'service_role')
  INTO v_tem_acesso;

  -- Se não tem acesso, retornar zeros seguros
  IF NOT v_tem_acesso THEN
    RETURN jsonb_build_object(
      'faturamento', jsonb_build_object('liquido', 0, 'bruto', 0, 'descontos', 0),
      'operacional', jsonb_build_object('lucro_operacional', 0, 'custo_pecas', 0),
      'caixa', jsonb_build_object('entradas_oficina_periodo', 0, 'saidas_oficina_periodo', 0),
      'acesso_negado', true
    );
  END IF;

  -- Cálculos Reais (Financeiro como Fonte da Verdade)
  SELECT
    COALESCE(SUM(CASE WHEN tipo='entrada' THEN valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tipo='saida' THEN valor ELSE 0 END), 0)
  INTO v_faturamento, v_despesas
  FROM financeiro
  WHERE oficina_id = p_oficina_id
  AND data BETWEEN p_data_inicio AND p_data_fim
  AND status = 'pago';

  RETURN jsonb_build_object(
    'periodo', jsonb_build_object('inicio', p_data_inicio, 'fim', p_data_fim),
    'faturamento', jsonb_build_object(
      'liquido', v_faturamento,
      'bruto', v_faturamento,
      'descontos', 0
    ),
    'operacional', jsonb_build_object(
      'lucro_operacional', v_faturamento - v_despesas,
      'custo_pecas', v_despesas
    ),
    'caixa', jsonb_build_object(
      'entradas_oficina_periodo', v_faturamento,
      'saidas_oficina_periodo', v_despesas
    ),
    'acesso_negado', false
  );
END;
$$;