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
  -- 1. Validação de acesso: Dono, Equipe ou Service Role
  SELECT EXISTS(
    SELECT 1 FROM oficinas WHERE id = p_oficina_id AND user_id = v_user_id
  ) OR EXISTS(
    SELECT 1 FROM user_roles WHERE oficina_id = p_oficina_id AND user_id = v_user_id AND active = true
  ) OR (current_setting('role') = 'service_role')
  INTO v_tem_acesso;

  -- 2. Retorno Seguro se não tiver acesso
  IF NOT v_tem_acesso THEN
    RETURN jsonb_build_object(
      'faturamento', jsonb_build_object('liquido', 0, 'bruto', 0, 'descontos', 0),
      'operacional', jsonb_build_object('lucro_operacional', 0, 'custo_pecas', 0),
      'caixa', jsonb_build_object('entradas_oficina_periodo', 0, 'saidas_oficina_periodo', 0),
      'categorias', jsonb_build_object(
        'pecas', jsonb_build_object('liquido', 0, 'bruto', 0),
        'servicos', jsonb_build_object('liquido', 0, 'bruto', 0)
      ),
      'auditoria', jsonb_build_object('total_itens_livres_sem_custo', 0, 'alerta_lucro_inflado', false),
      'acesso_negado', true
    );
  END IF;

  -- 3. Cálculo real (Fonte: Financeiro)
  SELECT
    COALESCE(SUM(CASE WHEN tipo='entrada' THEN valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tipo='saida' THEN valor ELSE 0 END), 0)
  INTO v_faturamento, v_despesas
  FROM financeiro
  WHERE oficina_id = p_oficina_id
  AND data BETWEEN p_data_inicio AND p_data_fim
  AND status = 'pago';

  -- 4. Retorno Completo compatível com frontend Fase 2
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
        'saidas_oficina_periodo', v_despesas,
        'recebido_vinculado_competencia', v_faturamento,
        'lucro_caixa_oficina_periodo', v_faturamento - v_despesas,
        'saldo_a_receber_competencia', 0
    ),
    'categorias', jsonb_build_object(
        'pecas', jsonb_build_object('liquido', 0, 'bruto', 0),
        'servicos', jsonb_build_object('liquido', 0, 'bruto', 0),
        'nao_classificado', jsonb_build_object('liquido', 0, 'bruto', 0)
    ),
    'auditoria', jsonb_build_object(
        'total_itens_livres', 0,
        'total_itens_livres_sem_custo', 0,
        'valor_itens_livres_sem_custo', 0,
        'vendas_balcao_sem_custo', 0,
        'os_com_divergencia', 0,
        'pagamentos_parciais', 0,
        'alerta_lucro_inflado', false
    ),
    'acesso_negado', false
  );
END;
$$;