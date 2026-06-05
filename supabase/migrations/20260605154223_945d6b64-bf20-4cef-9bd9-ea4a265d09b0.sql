CREATE OR REPLACE FUNCTION public.get_financeiro_rankings_unificados(
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
    v_user_id UUID;
    v_user_oficina_id UUID;
    v_user_role TEXT;
    v_result JSONB;
BEGIN
    -- 1. Validação Multi-tenant
    v_user_id := auth.uid();
    
    SELECT oficina_id INTO v_user_oficina_id FROM public.profiles WHERE id = v_user_id;
    SELECT role INTO v_user_role FROM public.user_roles WHERE user_id = v_user_id LIMIT 1;

    IF v_user_oficina_id != p_oficina_id AND v_user_role NOT IN ('master', 'super_admin', 'platform_admin') THEN
        RAISE EXCEPTION 'Acesso negado: multi-tenant violation';
    END IF;

    -- 2. Coleta de Rankings
    WITH os_base AS (
        SELECT 
            os.id,
            os.cliente_id,
            os.tipo_servico,
            os.valor_servico,
            os.desconto,
            os.custo_servico,
            os.data_servico,
            os.status,
            c.nome as cliente_nome,
            v.marca || ' ' || v.modelo || ' - ' || COALESCE(v.placa, 'S/P') as veiculo_info
        FROM public.ordens_servico os
        JOIN public.clientes c ON c.id = os.cliente_id
        JOIN public.veiculos v ON v.id = os.veiculo_id
        WHERE os.oficina_id = p_oficina_id
        AND os.status = 'finalizado'
        AND os.data_servico BETWEEN p_data_inicio AND p_data_fim
    ),
    os_itens_custo AS (
        SELECT 
            ordem_servico_id,
            SUM(COALESCE(custo_unitario, 0) * quantidade) as custo_total_itens
        FROM public.itens_os
        GROUP BY ordem_servico_id
    ),
    os_final AS (
        SELECT 
            b.*,
            COALESCE(i.custo_total_itens, b.custo_servico, 0) as custo_real,
            (COALESCE(b.valor_servico, 0) - COALESCE(b.desconto, 0)) as faturamento_liquido
        FROM os_base b
        LEFT JOIN os_itens_custo i ON i.ordem_servico_id = b.id
    ),
    margens_calculadas AS (
        SELECT
            *,
            (faturamento_liquido - custo_real) as lucro,
            CASE WHEN faturamento_liquido > 0 
                 THEN ((faturamento_liquido - custo_real) / faturamento_liquido) * 100 
                 ELSE 0 END as margem_percentual
        FROM os_final
    ),
    ranking_clientes AS (
        SELECT 
            cliente_id as id,
            cliente_nome as nome,
            COUNT(*) as total_os,
            SUM(faturamento_liquido) as faturamento_total,
            SUM(custo_real) as custo_total,
            SUM(lucro) as lucro_total,
            CASE WHEN SUM(faturamento_liquido) > 0 
                 THEN (SUM(lucro) / SUM(faturamento_liquido)) * 100 
                 ELSE 0 END as margem_media
        FROM margens_calculadas
        GROUP BY cliente_id, cliente_nome
        ORDER BY lucro_total DESC
        LIMIT 10
    ),
    ranking_servicos AS (
        SELECT 
            tipo_servico,
            COUNT(*) as total_os,
            SUM(faturamento_liquido) as faturamento_total,
            SUM(custo_real) as custo_total,
            SUM(lucro) as lucro_total,
            CASE WHEN SUM(faturamento_liquido) > 0 
                 THEN (SUM(lucro) / SUM(faturamento_liquido)) * 100 
                 ELSE 0 END as margem_media
        FROM margens_calculadas
        GROUP BY tipo_servico
        ORDER BY lucro_total DESC
        LIMIT 10
    ),
    margens_os_final AS (
        SELECT
            id,
            tipo_servico,
            cliente_nome,
            veiculo_info,
            valor_servico,
            custo_real as custo_servico,
            lucro,
            margem_percentual,
            data_servico,
            status,
            CASE WHEN margem_percentual <= 0 THEN 'critico'
                 WHEN margem_percentual < 15 THEN 'baixo'
                 WHEN margem_percentual < 50 THEN 'saudavel'
                 ELSE 'excelente' END as risco
        FROM margens_calculadas
        ORDER BY margem_percentual ASC
        LIMIT 50
    ),
    metricas_gerais AS (
        SELECT 
            COUNT(*) as total_os_analisadas,
            SUM(faturamento_liquido) as faturamento_geral,
            SUM(custo_real) as custo_geral,
            SUM(lucro) as lucro_geral,
            CASE WHEN SUM(faturamento_liquido) > 0 
                 THEN (SUM(lucro) / SUM(faturamento_liquido)) * 100 
                 ELSE 0 END as margem_media_geral
        FROM margens_calculadas
    )
    SELECT jsonb_build_object(
        'clientes', (SELECT jsonb_agg(rc) FROM ranking_clientes rc),
        'servicos', (SELECT jsonb_agg(rs) FROM ranking_servicos rs),
        'margens_os', (SELECT jsonb_agg(mo) FROM margens_os_final mo),
        'geral', (SELECT row_to_json(mg) FROM metricas_gerais mg)
    ) INTO v_result;

    RETURN v_result;
END;
$$;