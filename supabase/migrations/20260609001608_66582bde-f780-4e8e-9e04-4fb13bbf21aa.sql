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
                    status::text, -- CONVERSÃO PARA TEXT PARA EVITAR ERRO DE UNION COM ENUM
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
                    categoria::text as categoria,
                    descricao,
                    valor as valor_bruto,
                    0 as desconto,
                    valor as valor_liquido,
                    status::text, -- CONVERSÃO PARA TEXT PARA EVITAR ERRO DE UNION COM ENUM
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
