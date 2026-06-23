CREATE OR REPLACE FUNCTION public.get_financeiro_v2_series(
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
    SELECT nome INTO v_oficina_nome FROM oficinas WHERE id = p_oficina_id;

    WITH meses AS (
        SELECT 
            date_trunc('month', d)::date as mes_inicio,
            (date_trunc('month', d) + interval '1 month' - interval '1 day')::date as mes_fim,
            to_char(d, 'YYYY-MM') as mes_rotulo
        FROM generate_series(
            date_trunc('month', p_data_inicio),
            date_trunc('month', p_data_fim),
            '1 month'::interval
        ) d
    ),
    metricas_mensais AS (
        SELECT 
            m.mes_rotulo,
            m.mes_inicio,
            m.mes_fim,
            -- OS Metrics
            COALESCE((
                SELECT SUM(os.valor_servico + (SELECT COALESCE(SUM(it.valor_total), 0) FROM itens_os it WHERE it.ordem_servico_id = os.id) - COALESCE(os.desconto, 0))
                FROM ordens_servico os
                WHERE os.oficina_id = p_oficina_id AND os.status = 'finalizado'
                  AND os.data_conclusao::DATE BETWEEN m.mes_inicio AND m.mes_fim
            ), 0) as os_liq,
            COALESCE((
                SELECT SUM((SELECT COALESCE(SUM(it.custo_unitario * it.quantidade), 0) FROM itens_os it WHERE it.ordem_servico_id = os.id))
                FROM ordens_servico os
                WHERE os.oficina_id = p_oficina_id AND os.status = 'finalizado'
                  AND os.data_conclusao::DATE BETWEEN m.mes_inicio AND m.mes_fim
            ), 0) as os_cmv,
            COALESCE((
                SELECT COUNT(*)
                FROM ordens_servico os
                WHERE os.oficina_id = p_oficina_id AND os.status = 'finalizado'
                  AND os.data_conclusao::DATE BETWEEN m.mes_inicio AND m.mes_fim
            ), 0) as os_qtd,
            -- Vendas Metrics
            COALESCE((
                SELECT SUM(v.valor_total)
                FROM vendas_balcao v
                WHERE v.oficina_id = p_oficina_id AND v.status IN ('concluida', 'finalizada')
                  AND v.created_at::DATE BETWEEN m.mes_inicio AND m.mes_fim
            ), 0) as vendas_liq,
            COALESCE((
                SELECT SUM((SELECT COALESCE(SUM(it.custo_unitario * it.quantidade), 0) FROM itens_venda_balcao it WHERE it.venda_id = v.id))
                FROM vendas_balcao v
                WHERE v.oficina_id = p_oficina_id AND v.status IN ('concluida', 'finalizada')
                  AND v.created_at::DATE BETWEEN m.mes_inicio AND m.mes_fim
            ), 0) as vendas_cmv,
            COALESCE((
                SELECT COUNT(*)
                FROM vendas_balcao v
                WHERE v.oficina_id = p_oficina_id AND v.status IN ('concluida', 'finalizada')
                  AND v.created_at::DATE BETWEEN m.mes_inicio AND m.mes_fim
            ), 0) as vendas_qtd,
            -- Caixa Metrics
            COALESCE((
                SELECT SUM(f.valor)
                FROM financeiro f
                WHERE f.oficina_id = p_oficina_id AND f.tipo = 'entrada' AND f.status::text = 'pago'
                  AND COALESCE(f.data_pagamento, f.data)::DATE BETWEEN m.mes_inicio AND m.mes_fim
            ), 0) as entradas,
            COALESCE((
                SELECT SUM(f.valor)
                FROM financeiro f
                WHERE f.oficina_id = p_oficina_id AND f.tipo = 'saida' AND f.status::text = 'pago'
                  AND COALESCE(f.data_pagamento, f.data)::DATE BETWEEN m.mes_inicio AND m.mes_fim
            ), 0) as saidas
        FROM meses m
    )
    SELECT jsonb_build_object(
        'periodo', jsonb_build_object('inicio', p_data_inicio, 'fim', p_data_fim),
        'oficina', jsonb_build_object('id', p_oficina_id, 'nome', v_oficina_nome),
        'series', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'mes', mes_rotulo,
                'inicio', mes_inicio,
                'fim', mes_fim,
                'competencia', jsonb_build_object(
                    'faturamento_liquido', os_liq + vendas_liq,
                    'os_liquido', os_liq,
                    'vendas_balcao_liquido', vendas_liq,
                    'saldo_a_receber', (os_liq + vendas_liq) - entradas
                ),
                'custos', jsonb_build_object(
                    'cmv_total', os_cmv + vendas_cmv
                ),
                'resultado', jsonb_build_object(
                    'lucro_operacional', (os_liq + vendas_liq) - (os_cmv + vendas_cmv)
                ),
                'caixa', jsonb_build_object(
                    'entradas_pagas', entradas,
                    'saidas_pagas', saidas,
                    'saldo_caixa', entradas - saidas
                ),
                'contadores', jsonb_build_object(
                    'servicos_finalizados', os_qtd,
                    'vendas_balcao', vendas_qtd
                )
            ) ORDER BY mes_rotulo)
            FROM metricas_mensais
        ), '[]'::jsonb),
        'auditoria', jsonb_build_object('avisos', ARRAY['V2 Série Histórica - Portão 3.5'])
    ) INTO v_resultado;

    RETURN v_resultado;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_financeiro_v2_series(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_financeiro_v2_series(UUID, DATE, DATE) TO service_role;
