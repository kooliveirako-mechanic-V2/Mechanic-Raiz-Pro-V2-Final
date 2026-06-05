CREATE OR REPLACE FUNCTION public.get_metrics_financeiras_unificadas(
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
    v_user_id UUID := auth.uid();
    v_is_platform_admin BOOLEAN := false;
    v_has_oficina_access BOOLEAN := false;
    v_result JSONB;
BEGIN
    -- 1. Validação de Segurança Multi-tenant robusta
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Não autorizado';
    END IF;

    -- Verifica se é admin de plataforma
    SELECT EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = v_user_id
        AND active = true
        AND role IN ('master', 'super_admin', 'platform_admin')
    ) INTO v_is_platform_admin;

    -- Verifica se tem acesso à oficina específica
    SELECT EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = v_user_id
        AND active = true
        AND oficina_id = p_oficina_id
    ) INTO v_has_oficina_access;

    IF NOT v_is_platform_admin AND NOT v_has_oficina_access THEN
        RAISE EXCEPTION 'Acesso negado à oficina %', p_oficina_id;
    END IF;

    WITH os_filtradas AS (
        SELECT 
            id,
            valor_total,
            desconto,
            valor_pago,
            COALESCE(data_conclusao, data_servico)::date as data_referencia
        FROM ordens_servico
        WHERE oficina_id = p_oficina_id
        AND status = 'finalizado'
        AND COALESCE(data_conclusao, data_servico)::date BETWEEN p_data_inicio AND p_data_fim
    ),
    vendas_balcao_filtradas AS (
        SELECT 
            id,
            valor_total,
            desconto,
            data_venda::date as data_referencia
        FROM vendas_balcao
        WHERE oficina_id = p_oficina_id
        AND status = 'finalizado'
        AND data_venda::date BETWEEN p_data_inicio AND p_data_fim
    ),
    itens_classificados AS (
        -- Itens de OS
        SELECT 
            io.id,
            io.os_id,
            NULL as venda_balcao_id,
            CASE 
                WHEN io.estoque_id IS NOT NULL OR LOWER(io.tipo) IN ('produto', 'peca', 'peça') THEN 'peca'
                WHEN LOWER(io.tipo) IN ('servico', 'serviço', 'mao_obra', 'mão_obra', 'mao de obra', 'mão de obra') OR io.valor_mao_obra > 0 THEN 'servico'
                ELSE 'nao_classificado'
            END as categoria,
            COALESCE(io.valor_total, 
                CASE 
                    WHEN (LOWER(io.tipo) IN ('servico', 'serviço', 'mao_obra', 'mão_obra', 'mao de obra', 'mão de obra') OR io.valor_mao_obra > 0) AND io.valor_mao_obra > 0 THEN io.valor_mao_obra
                    ELSE io.quantidade * io.valor_unitario 
                END, 
            0) as valor_bruto,
            COALESCE(io.quantidade * io.custo_unitario, 0) as custo_total,
            io.estoque_id,
            io.tipo
        FROM itens_os io
        JOIN os_filtradas os ON io.os_id = os.id
        
        UNION ALL
        
        -- Itens de Venda Balcão
        SELECT 
            iv.id,
            NULL as os_id,
            iv.venda_id as venda_balcao_id,
            'peca' as categoria, -- Venda de balcão é inerentemente peça/produto
            COALESCE(iv.valor_total, iv.quantidade * iv.valor_unitario, 0) as valor_bruto,
            COALESCE(iv.quantidade * iv.custo_unitario, 0) as custo_total,
            iv.produto_id as estoque_id,
            'produto' as tipo
        FROM itens_venda_balcao iv
        JOIN vendas_balcao_filtradas v ON iv.venda_id = v.id
    ),
    metricas_categorias AS (
        SELECT 
            categoria,
            SUM(valor_bruto) as bruto,
            SUM(custo_total) as custo
        FROM itens_classificados
        GROUP BY categoria
    ),
    financeiro_oficina AS (
        SELECT 
            SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END) as entradas,
            SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END) as saidas
        FROM movimentacoes_financeiras
        WHERE oficina_id = p_oficina_id
        AND data_movimentacao BETWEEN p_data_inicio AND p_data_fim
    ),
    faturamento_detalhado AS (
        SELECT 
            COALESCE(SUM(os.valor_total), 0) + COALESCE(SUM(v.valor_total), 0) as bruto,
            COALESCE(SUM(os.desconto), 0) + COALESCE(SUM(v.desconto), 0) as descontos,
            (COALESCE(SUM(os.valor_total), 0) + COALESCE(SUM(v.valor_total), 0)) - (COALESCE(SUM(os.desconto), 0) + COALESCE(SUM(v.desconto), 0)) as liquido
        FROM (SELECT 1) dummy
        LEFT JOIN os_filtradas os ON true
        LEFT JOIN vendas_balcao_filtradas v ON true
    )
    SELECT jsonb_build_object(
        'periodo', jsonb_build_object('inicio', p_data_inicio, 'fim', p_data_fim),
        'faturamento', (SELECT jsonb_build_object('bruto', bruto, 'descontos', descontos, 'liquido', liquido) FROM faturamento_detalhado),
        'categorias', jsonb_build_object(
            'pecas', jsonb_build_object(
                'bruto', COALESCE((SELECT bruto FROM metricas_categorias WHERE categoria = 'peca'), 0),
                'custo', COALESCE((SELECT custo FROM metricas_categorias WHERE categoria = 'peca'), 0),
                'liquido', COALESCE((SELECT bruto FROM metricas_categorias WHERE categoria = 'peca'), 0) * 
                           CASE WHEN (SELECT bruto FROM faturamento_detalhado) > 0 
                                THEN (SELECT liquido FROM faturamento_detalhado) / (SELECT bruto FROM faturamento_detalhado) 
                                ELSE 1 END
            ),
            'servicos', jsonb_build_object(
                'bruto', COALESCE((SELECT bruto FROM metricas_categorias WHERE categoria = 'servico'), 0),
                'liquido', COALESCE((SELECT bruto FROM metricas_categorias WHERE categoria = 'servico'), 0) * 
                           CASE WHEN (SELECT bruto FROM faturamento_detalhado) > 0 
                                THEN (SELECT liquido FROM faturamento_detalhado) / (SELECT bruto FROM faturamento_detalhado) 
                                ELSE 1 END
            ),
            'nao_classificado', jsonb_build_object(
                'bruto', COALESCE((SELECT bruto FROM metricas_categorias WHERE categoria = 'nao_classificado'), 0),
                'liquido', COALESCE((SELECT bruto FROM metricas_categorias WHERE categoria = 'nao_classificado'), 0) * 
                           CASE WHEN (SELECT bruto FROM faturamento_detalhado) > 0 
                                THEN (SELECT liquido FROM faturamento_detalhado) / (SELECT bruto FROM faturamento_detalhado) 
                                ELSE 1 END
            )
        ),
        'operacional', jsonb_build_object(
            'lucro_operacional', (SELECT liquido FROM faturamento_detalhado) - COALESCE((SELECT SUM(custo) FROM metricas_categorias), 0),
            'margem_operacional', CASE WHEN (SELECT liquido FROM faturamento_detalhado) > 0 
                                       THEN ((SELECT liquido FROM faturamento_detalhado) - COALESCE((SELECT SUM(custo) FROM metricas_categorias), 0)) / (SELECT liquido FROM faturamento_detalhado) * 100 
                                       ELSE 0 END
        ),
        'caixa', jsonb_build_object(
            'entradas_oficina_periodo', COALESCE((SELECT entradas FROM financeiro_oficina), 0),
            'saidas_oficina_periodo', COALESCE((SELECT saidas FROM financeiro_oficina), 0),
            'lucro_caixa_oficina_periodo', COALESCE((SELECT entradas FROM financeiro_oficina), 0) - COALESCE((SELECT saidas FROM financeiro_oficina), 0),
            'recebido_vinculado_competencia', COALESCE((SELECT SUM(valor_pago) FROM os_filtradas), 0),
            'saldo_a_receber_competencia', (SELECT liquido FROM faturamento_detalhado) - COALESCE((SELECT SUM(valor_pago) FROM os_filtradas), 0)
        ),
        'vendas_balcao', jsonb_build_object(
            'total', COALESCE((SELECT SUM(valor_total) FROM vendas_balcao_filtradas), 0),
            'custo', COALESCE((SELECT SUM(custo_total) FROM itens_classificados WHERE venda_balcao_id IS NOT NULL), 0),
            'lucro', COALESCE((SELECT SUM(valor_total) - SUM(desconto) FROM vendas_balcao_filtradas), 0) - COALESCE((SELECT SUM(custo_total) FROM itens_classificados WHERE venda_balcao_id IS NOT NULL), 0)
        ),
        'auditoria', jsonb_build_object(
            'total_itens_livres', (SELECT COUNT(*) FROM itens_classificados WHERE estoque_id IS NULL),
            'total_itens_livres_peca', (SELECT COUNT(*) FROM itens_classificados WHERE categoria = 'peca' AND estoque_id IS NULL),
            'total_itens_livres_servico', (SELECT COUNT(*) FROM itens_classificados WHERE categoria = 'servico' AND estoque_id IS NULL),
            'total_itens_livres_sem_custo', (SELECT COUNT(*) FROM itens_classificados WHERE categoria = 'peca' AND custo_total = 0),
            'valor_itens_livres_sem_custo', (SELECT SUM(valor_bruto) FROM itens_classificados WHERE categoria = 'peca' AND custo_total = 0),
            'valor_nao_classificado', COALESCE((SELECT bruto FROM metricas_categorias WHERE categoria = 'nao_classificado'), 0),
            'vendas_balcao_sem_custo', (SELECT COUNT(*) FROM itens_classificados WHERE venda_balcao_id IS NOT NULL AND custo_total = 0),
            'alerta_lucro_inflado', EXISTS (SELECT 1 FROM itens_classificados WHERE categoria = 'peca' AND custo_total = 0)
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_metrics_financeiras_unificadas(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_metrics_financeiras_unificadas(UUID, DATE, DATE) TO service_role;
