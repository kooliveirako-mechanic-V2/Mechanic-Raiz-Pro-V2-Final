-- 1. CORREÇÃO DA RPC (Problema 1)
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
  v_lucro NUMERIC := 0;
  
  -- Variáveis auxiliares para categorias (mantendo compatibilidade com a estrutura anterior)
  v_pecas_bruto NUMERIC := 0;
  v_pecas_custo NUMERIC := 0;
  v_servicos_bruto NUMERIC := 0;
  v_nc_bruto NUMERIC := 0;
  v_fat_desconto NUMERIC := 0;
BEGIN
  -- Validar acesso em 3 camadas sem RAISE EXCEPTION
  SELECT EXISTS(
    SELECT 1 FROM oficinas WHERE id = p_oficina_id AND user_id = v_user_id
  ) INTO v_tem_acesso;

  IF NOT v_tem_acesso THEN
    SELECT EXISTS(
      SELECT 1 FROM user_roles
      WHERE oficina_id = p_oficina_id
      AND user_id = v_user_id
      AND active = true
    ) INTO v_tem_acesso;
  END IF;

  IF NOT v_tem_acesso THEN
    v_tem_acesso := has_oficina_access(v_user_id, p_oficina_id);
  END IF;

  -- Se não tem acesso e não é service_role, retornar zeros seguros
  IF NOT v_tem_acesso AND current_setting('role') <> 'service_role' THEN
    RETURN jsonb_build_object(
      'faturamento', jsonb_build_object('liquido', 0, 'bruto', 0, 'descontos', 0),
      'operacional', jsonb_build_object('lucro_operacional', 0, 'custo_pecas', 0),
      'caixa', jsonb_build_object('entradas_oficina_periodo', 0, 'saidas_oficina_periodo', 0),
      'categorias', jsonb_build_object(
          'pecas', jsonb_build_object('bruto', 0, 'liquido', 0),
          'servicos', jsonb_build_object('bruto', 0, 'liquido', 0),
          'nao_classificado', jsonb_build_object('bruto', 0, 'liquido', 0)
      ),
      'auditoria', jsonb_build_object('total_itens_livres_sem_custo', 0, 'alerta_lucro_inflado', false),
      'acesso_negado', true
    );
  END IF;

  -- 2. Cálculos Reais (Financeiro como Fonte da Verdade para o Dashboard)
  SELECT
    COALESCE(SUM(CASE WHEN tipo='entrada' THEN valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tipo='saida' THEN valor ELSE 0 END), 0)
  INTO v_faturamento, v_despesas
  FROM financeiro
  WHERE oficina_id = p_oficina_id
  AND data BETWEEN p_data_inicio AND p_data_fim
  AND status = 'pago';

  -- 3. Detalhamento por categorias (para gráficos e análise)
  WITH os_base AS (
      SELECT os.id, os.desconto
      FROM ordens_servico os
      WHERE os.oficina_id = p_oficina_id AND os.status = 'finalizado'
      AND COALESCE(os.data_conclusao, os.data_servico)::date BETWEEN p_data_inicio AND p_data_fim
  ),
  itens_classificados AS (
      SELECT 
          CASE 
              WHEN io.estoque_id IS NOT NULL OR LOWER(io.tipo) IN ('produto', 'peca', 'peça') THEN 'peca'
              WHEN LOWER(io.tipo) IN ('servico', 'serviço', 'mao_obra', 'mão_obra') OR io.valor_mao_obra > 0 THEN 'servico'
              ELSE 'nao_classificado'
          END as categoria,
          COALESCE(io.valor_total, io.quantidade * io.valor_unitario, 0) as valor_bruto,
          COALESCE(io.quantidade * io.custo_unitario, 0) as custo_total
      FROM itens_os io
      JOIN os_base os ON io.ordem_servico_id = os.id
  )
  SELECT 
      COALESCE(SUM(custo_total), 0),
      COALESCE(SUM(CASE WHEN categoria = 'peca' THEN valor_bruto ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN categoria = 'servico' THEN valor_bruto ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN categoria = 'nao_classificado' THEN valor_bruto ELSE 0 END), 0)
  INTO v_pecas_custo, v_pecas_bruto, v_servicos_bruto, v_nc_bruto
  FROM itens_classificados;

  SELECT COALESCE(SUM(desconto), 0) INTO v_fat_desconto FROM os_base;
  v_lucro := v_faturamento - v_despesas;

  -- 4. Retorno JSON
  RETURN jsonb_build_object(
    'periodo', jsonb_build_object('inicio', p_data_inicio, 'fim', p_data_fim),
    'faturamento', jsonb_build_object(
      'liquido', v_faturamento,
      'bruto', v_faturamento + v_fat_desconto,
      'descontos', v_fat_desconto,
      'pecas', v_pecas_bruto,
      'servicos', v_servicos_bruto,
      'outros', v_nc_bruto
    ),
    'operacional', jsonb_build_object(
      'lucro_operacional', v_lucro,
      'custo_pecas', v_pecas_custo,
      'despesas_fixas_variaveis', v_despesas
    ),
    'caixa', jsonb_build_object(
      'entradas_oficina_periodo', v_faturamento,
      'saidas_oficina_periodo', v_despesas,
      'lucro_caixa_oficina_periodo', v_lucro,
      'recebido_vinculado_competencia', v_faturamento,
      'saldo_a_receber_competencia', 0
    ),
    'categorias', jsonb_build_object(
        'pecas', jsonb_build_object('bruto', v_pecas_bruto, 'liquido', v_pecas_bruto),
        'servicos', jsonb_build_object('bruto', v_servicos_bruto, 'liquido', v_servicos_bruto),
        'nao_classificado', jsonb_build_object('bruto', v_nc_bruto, 'liquido', v_nc_bruto)
    ),
    'auditoria', jsonb_build_object(
        'total_itens_livres_sem_custo', 0,
        'alerta_lucro_inflado', false
    ),
    'acesso_negado', false
  );
END;
$$;

-- 2. RESOLUÇÃO DE DUPLICIDADE (Problema 2)
-- Garantir que o usuário ko.oliveira2016@gmail.com (ID: 82879702-5e29-4d83-86a4-08a9f061a6a4) 
-- esteja vinculado à oficina correta (ID: dc11cb4b-d68b-4ad9-b464-0b642a4b620f)
UPDATE oficinas 
SET user_id = '82879702-5e29-4d83-86a4-08a9f061a6a4'
WHERE id = 'dc11cb4b-d68b-4ad9-b464-0b642a4b620f';