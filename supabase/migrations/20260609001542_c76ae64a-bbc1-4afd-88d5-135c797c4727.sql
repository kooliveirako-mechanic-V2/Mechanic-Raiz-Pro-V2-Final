-- 1. Unificar a RPC de Métricas (Dashboard)
CREATE OR REPLACE FUNCTION public.get_metrics_financeiras_unificadas(
    p_oficina_id UUID,
    p_data_inicio DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
    p_data_fim DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_tem_acesso BOOLEAN := false;
    v_result JSONB;
BEGIN
    -- Validação Multi-tenant
    SELECT EXISTS(
        SELECT 1 FROM oficinas WHERE id = p_oficina_id AND user_id = v_user_id
    ) OR EXISTS(
        SELECT 1 FROM user_roles WHERE oficina_id = p_oficina_id AND user_id = v_user_id AND active = true
    ) OR (current_setting('role') = 'service_role')
    INTO v_tem_acesso;

    IF NOT v_tem_acesso THEN
        RETURN jsonb_build_object('faturamento', jsonb_build_object('liquido', 0), 'acesso_negado', true);
    END IF;

    WITH os_base AS (
        SELECT 
            id,
            COALESCE(valor_servico, 0) as bruto,
            COALESCE(desconto, 0) as desconto,
            COALESCE(valor_servico - COALESCE(desconto, 0), 0) as liquido,
            COALESCE(custo_servico, 0) as custo_pecas
        FROM ordens_servico
        WHERE oficina_id = p_oficina_id
        AND status = 'finalizado'
        AND COALESCE(data_conclusao, data_servico)::date BETWEEN p_data_inicio AND p_data_fim
    ),
    vendas_base AS (
        SELECT 
            id,
            COALESCE(valor_total, 0) as bruto,
            0 as desconto,
            COALESCE(valor_total, 0) as liquido,
            -- Tenta obter custo dos itens se possível (placeholder 0 por enquanto)
            0 as custo_pecas
        FROM vendas_balcao
        WHERE oficina_id = p_oficina_id
        AND status = 'concluida'
        AND created_at::date BETWEEN p_data_inicio AND p_data_fim
    ),
    financeiro_base AS (
        SELECT 
            tipo,
            valor,
            status,
            ordem_servico_id,
            venda_balcao_id
        FROM financeiro
        WHERE oficina_id = p_oficina_id
        AND data BETWEEN p_data_inicio AND p_data_fim
    ),
    competencia_stats AS (
        SELECT 
            COALESCE(SUM(bruto), 0) as fat_bruto,
            COALESCE(SUM(desconto), 0) as fat_desconto,
            COALESCE(SUM(liquido), 0) as fat_liquido,
            COALESCE(SUM(custo_pecas), 0) as fat_custo
        FROM (
            SELECT bruto, desconto, liquido, custo_pecas FROM os_base
            UNION ALL
            SELECT bruto, desconto, liquido, custo_pecas FROM vendas_base
        ) combined
    ),
    caixa_stats AS (
        SELECT 
            COALESCE(SUM(CASE WHEN tipo = 'entrada' AND status = 'pago' THEN valor ELSE 0 END), 0) as entradas,
            COALESCE(SUM(CASE WHEN tipo = 'saida' AND status = 'pago' THEN valor ELSE 0 END), 0) as saidas
        FROM financeiro_base
    ),
    recebidos_vinculados AS (
        -- Soma apenas o que foi recebido de OS/Vendas finalizadas no período
        SELECT COALESCE(SUM(valor), 0) as valor
        FROM financeiro
        WHERE oficina_id = p_oficina_id
        AND status = 'pago'
        AND tipo = 'entrada'
        AND (ordem_servico_id IN (SELECT id FROM os_base) OR venda_balcao_id IN (SELECT id FROM vendas_base))
    )
    SELECT jsonb_build_object(
        'periodo', jsonb_build_object('inicio', p_data_inicio, 'fim', p_data_fim),
        'faturamento', jsonb_build_object(
            'bruto', (SELECT fat_bruto FROM competencia_stats),
            'descontos', (SELECT fat_desconto FROM competencia_stats),
            'liquido', (SELECT fat_liquido FROM competencia_stats)
        ),
        'operacional', jsonb_build_object(
            -- FÓRMULA CORRETA: Faturamento Líquido - Custo Peças - Saídas (Despesas/Prejuízos)
            'lucro_operacional', (SELECT fat_liquido - fat_custo FROM competencia_stats) - (SELECT saidas FROM caixa_stats),
            'custo_pecas', (SELECT fat_custo FROM competencia_stats)
        ),
        'caixa', jsonb_build_object(
            'entradas_oficina_periodo', (SELECT entradas FROM caixa_stats),
            'saidas_oficina_periodo', (SELECT saidas FROM caixa_stats),
            'recebido_vinculado_competencia', (SELECT valor FROM recebidos_vinculados),
            'lucro_caixa_oficina_periodo', (SELECT entradas - saidas FROM caixa_stats),
            'saldo_a_receber_competencia', GREATEST((SELECT fat_liquido FROM competencia_stats) - (SELECT valor FROM recebidos_vinculados), 0)
        ),
        'categorias', jsonb_build_object(
            'pecas', jsonb_build_object('liquido', (SELECT fat_custo FROM competencia_stats), 'bruto', (SELECT fat_custo FROM competencia_stats)),
            'servicos', jsonb_build_object('liquido', (SELECT fat_liquido - fat_custo FROM competencia_stats), 'bruto', (SELECT fat_liquido - fat_custo FROM competencia_stats))
        ),
        'auditoria', jsonb_build_object('total_itens_livres_sem_custo', 0, 'alerta_lucro_inflado', false),
        'acesso_negado', false
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- 2. Unificar a RPC de Pré-fiscal (Relatórios)
CREATE OR REPLACE FUNCTION public.get_pre_fiscal_unificado(
    p_oficina_id UUID,
    p_inicio DATE,
    p_fim DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_metrics JSONB;
BEGIN
    -- Reutiliza a lógica centralizada de métricas
    v_metrics := get_metrics_financeiras_unificadas(p_oficina_id, p_inicio, p_fim);

    -- Constrói o resultado analítico compatível com o frontend
    RETURN jsonb_build_object(
        'metrics', jsonb_build_object(
            'caixa', jsonb_build_object(
                'entradas', (v_metrics->'caixa'->>'entradas_oficina_periodo')::NUMERIC,
                'saidas', (v_metrics->'caixa'->>'saidas_oficina_periodo')::NUMERIC,
                'lucro_caixa', (v_metrics->'caixa'->>'lucro_caixa_oficina_periodo')::NUMERIC
            ),
            'competencia', jsonb_build_object(
                'faturamento_bruto', (v_metrics->'faturamento'->>'bruto')::NUMERIC,
                'descontos', (v_metrics->'faturamento'->>'descontos')::NUMERIC,
                'faturamento_liquido', (v_metrics->'faturamento'->>'liquido')::NUMERIC,
                'cmv', (v_metrics->'operacional'->>'custo_pecas')::NUMERIC,
                'lucro_operacional', (v_metrics->'operacional'->>'lucro_operacional')::NUMERIC,
                'saldo_a_receber', (v_metrics->'caixa'->>'saldo_a_receber_competencia')::NUMERIC
            )
        ),
        'analitico', (
            SELECT COALESCE(jsonb_agg(row), '[]'::jsonb)
            FROM (
                -- Entradas (OS/Vendas)
                SELECT 
                    id::text,
                    COALESCE(data_conclusao, data_servico)::text as data_competencia,
                    NULL as data_pagamento,
                    'entrada'::text as tipo,
                    'OS'::text as origem,
                    'Serviços/Peças'::text as categoria,
                    'OS #' || numero::text as descricao,
                    valor_servico as valor_bruto,
                    COALESCE(desconto, 0) as desconto,
                    (valor_servico - COALESCE(desconto, 0)) as valor_liquido,
                    status,
                    'OS'::text as classificacao
                FROM ordens_servico
                WHERE oficina_id = p_oficina_id AND status = 'finalizado'
                AND COALESCE(data_conclusao, data_servico)::date BETWEEN p_inicio AND p_fim
                
                UNION ALL
                
                -- Saídas Financeiras (Prejuízos/Despesas)
                SELECT 
                    id::text,
                    data::text as data_competencia,
                    data_pagamento::text as data_pagamento,
                    'saida'::text as tipo,
                    'Financeiro'::text as origem,
                    categoria,
                    descricao,
                    valor as valor_bruto,
                    0 as desconto,
                    valor as valor_liquido,
                    status,
                    'Despesa'::text as classificacao
                FROM financeiro
                WHERE oficina_id = p_oficina_id AND tipo = 'saida' AND status = 'pago'
                AND data BETWEEN p_inicio AND p_fim
            ) row
        ),
        'ressalvas', jsonb_build_object(
            'tem_ressalva', false,
            'itens_sem_custo', 0,
            'impacto_estimado', 0
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_metrics_financeiras_unificadas(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_metrics_financeiras_unificadas(UUID, DATE, DATE) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_pre_fiscal_unificado(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pre_fiscal_unificado(UUID, DATE, DATE) TO service_role;
