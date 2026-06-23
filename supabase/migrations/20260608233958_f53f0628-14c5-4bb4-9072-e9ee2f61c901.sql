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
  -- 1. Validação de acesso
  SELECT EXISTS(
    SELECT 1 FROM oficinas WHERE id = p_oficina_id AND user_id = v_user_id
  ) OR EXISTS(
    SELECT 1 FROM user_roles WHERE oficina_id = p_oficina_id AND user_id = v_user_id AND active = true
  ) OR (current_setting('role') = 'service_role')
  INTO v_tem_acesso;

  IF NOT v_tem_acesso THEN
    RETURN jsonb_build_object('faturamento', jsonb_build_object('liquido', 0), 'acesso_negado', true);
  END IF;

  -- 2. FATURAMENTO (COMPETÊNCIA): OS Finalizadas + Vendas Balcão Concluídas
  -- Faturamento de OS
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

  -- Soma Vendas Balcão
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

  -- 3. CAIXA: Lançamentos financeiros efetivamente PAGOS
  SELECT
    COALESCE(SUM(CASE WHEN tipo='entrada' THEN valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tipo='saida' THEN valor ELSE 0 END), 0)
  INTO v_entradas_caixa, v_saidas_caixa
  FROM financeiro
  WHERE oficina_id = p_oficina_id
  AND data BETWEEN p_data_inicio AND p_data_fim
  AND status = 'pago';

  -- 4. Retorno Estruturado
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
        'recebido_vinculado_competencia', v_entradas_caixa, -- Simplificado para o Dashboard fix
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