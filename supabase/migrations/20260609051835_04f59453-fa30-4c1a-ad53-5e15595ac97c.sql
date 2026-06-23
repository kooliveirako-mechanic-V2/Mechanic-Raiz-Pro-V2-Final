CREATE OR REPLACE FUNCTION public.get_financeiro_v2(
    p_oficina_id UUID,
    p_data_inicio DATE,
    p_data_fim DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_resultado JSONB;
    v_oficina_nome TEXT;
BEGIN
    -- Obter nome da oficina
    SELECT nome INTO v_oficina_nome FROM oficinas WHERE id = p_oficina_id;

    WITH os_base AS (
        -- Primeiro calcular o CMV por OS individualmente para poder somar depois
        SELECT 
            id,
            valor_servico,
            COALESCE(desconto, 0) as desconto,
            (SELECT COALESCE(SUM(COALESCE(preco_venda, 0) * quantidade), 0) FROM itens_os WHERE os_id = ordens_servico.id) as valor_pecas_total,
            (SELECT COALESCE(SUM(COALESCE(preco_custo, 0) * quantidade), 0) FROM itens_os WHERE os_id = ordens_servico.id) as cmv_os_calc
        FROM ordens_servico
        WHERE oficina_id = p_oficina_id
          AND status = 'finalizado'
          -- Como data_competencia não existe na tabela, usamos data_conclusao conforme diagnóstico
          AND data_conclusao::DATE BETWEEN p_data_inicio AND p_data_fim
    ),
    os_data AS (
        SELECT 
            COALESCE(SUM(valor_servico + valor_pecas_total), 0) as faturamento_bruto,
            COALESCE(SUM(desconto), 0) as descontos,
            COALESCE(SUM(valor_servico + valor_pecas_total - desconto), 0) as faturamento_liquido,
            COUNT(*) as total_os,
            COALESCE(SUM(cmv_os_calc), 0) as cmv_os
        FROM os_base
    ),
    vendas_data AS (
        SELECT 
            COALESCE(SUM(valor_total), 0) as faturamento_bruto,
            -- Tabela vendas_balcao não tem coluna 'desconto' direta no select anterior, assume-se embutido no valor_total ou 0
            0 as descontos,
            COALESCE(SUM(valor_total), 0) as faturamento_liquido,
            COUNT(*) as total_vendas,
            COALESCE(SUM((SELECT SUM(COALESCE(valor_custo, 0) * quantidade) FROM itens_venda_balcao WHERE venda_id = vendas_balcao.id)), 0) as cmv_vendas
        FROM vendas_balcao
        WHERE oficina_id = p_oficina_id
          AND status IN ('concluida', 'finalizada')
          AND created_at::DATE BETWEEN p_data_inicio AND p_data_fim -- Vendas não têm data_conclusao, usamos created_at (marcado como pendência de campo melhor)
    ),
    caixa_data AS (
        SELECT 
            COALESCE(SUM(CASE WHEN tipo = 'receita' THEN COALESCE(valor_pago, valor) ELSE 0 END), 0) as entradas,
            COALESCE(SUM(CASE WHEN tipo = 'despesa' THEN COALESCE(valor_pago, valor) ELSE 0 END), 0) as saídas
        FROM financeiro
        WHERE oficina_id = p_oficina_id
          AND status = 'pago'
          AND COALESCE(data_pagamento, data)::DATE BETWEEN p_data_inicio AND p_data_fim
    ),
    despesas_fixas_data AS (
        SELECT COALESCE(SUM(valor), 0) as total
        FROM financeiro
        WHERE oficina_id = p_oficina_id
          AND tipo = 'despesa'
          AND status = 'pago'
          AND ordem_servico_id IS NULL 
          AND venda_balcao_id IS NULL
          AND COALESCE(data_pagamento, data)::DATE BETWEEN p_data_inicio AND p_data_fim
    ),
    auditoria_anomalias AS (
        SELECT 
            'OS sem data_conclusao' as aviso,
            numero::text as ref
        FROM ordens_servico 
        WHERE oficina_id = p_oficina_id AND status = 'finalizado' AND data_conclusao IS NULL
        UNION ALL
        SELECT 
            'Venda sem data_venda (usando created_at)' as aviso,
            numero::text as ref
        FROM vendas_balcao 
        WHERE oficina_id = p_oficina_id AND status IN ('concluida', 'finalizada')
    )
    SELECT jsonb_build_object(
        'periodo', jsonb_build_object('inicio', p_data_inicio, 'fim', p_data_fim),
        'oficina', jsonb_build_object('id', p_oficina_id, 'nome', v_oficina_nome),
        'competencia', jsonb_build_object(
            'faturamento_bruto', (SELECT faturamento_bruto FROM os_data) + (SELECT faturamento_bruto FROM vendas_data),
            'descontos', (SELECT descontos FROM os_data) + (SELECT descontos FROM vendas_data),
            'faturamento_liquido', (SELECT faturamento_liquido FROM os_data) + (SELECT faturamento_liquido FROM vendas_data),
            'os_liquido', (SELECT faturamento_liquido FROM os_data),
            'vendas_balcao_liquido', (SELECT faturamento_liquido FROM vendas_data),
            'saldo_a_receber', 0 
        ),
        'custos', jsonb_build_object(
            'cmv_os', (SELECT cmv_os FROM os_data),
            'cmv_vendas_balcao', (SELECT cmv_vendas FROM vendas_data),
            'cmv_total', (SELECT cmv_os FROM os_data) + (SELECT cmv_vendas FROM vendas_data)
        ),
        'resultado', jsonb_build_object(
            'lucro_operacional', ((SELECT faturamento_liquido FROM os_data) + (SELECT faturamento_liquido FROM vendas_data)) - ((SELECT cmv_os FROM os_data) + (SELECT cmv_vendas FROM vendas_data)),
            'despesas_fixas', (SELECT total FROM despesas_fixas_data),
            'resultado_gerencial', (((SELECT faturamento_liquido FROM os_data) + (SELECT faturamento_liquido FROM vendas_data)) - ((SELECT cmv_os FROM os_data) + (SELECT cmv_vendas FROM vendas_data))) - (SELECT total FROM despesas_fixas_data)
        ),
        'caixa', jsonb_build_object(
            'entradas_pagas', (SELECT entradas FROM caixa_data),
            'saidas_pagas', (SELECT saídas FROM caixa_data),
            'saldo_caixa', (SELECT entradas - saídas FROM caixa_data)
        ),
        'contadores', jsonb_build_object(
            'servicos_finalizados', (SELECT total_os FROM os_data),
            'vendas_balcao', (SELECT total_vendas FROM vendas_data),
            'clientes', (SELECT COUNT(DISTINCT cliente_id) FROM ordens_servico WHERE oficina_id = p_oficina_id AND status = 'finalizado')
        ),
        'auditoria', jsonb_build_object(
            'avisos', COALESCE((SELECT jsonb_agg(aviso) FROM (SELECT DISTINCT aviso FROM auditoria_anomalias LIMIT 10) s), '[]'::jsonb)
        )
    ) INTO v_resultado;

    RETURN v_resultado;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_financeiro_v2(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_financeiro_v2(UUID, DATE, DATE) TO service_role;
