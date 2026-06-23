CREATE OR REPLACE FUNCTION public.get_financeiro_series_unificadas(
  p_oficina_id uuid,
  p_data_inicio date,
  p_data_fim date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
    v_result JSONB;
BEGIN
    v_user_id := auth.uid();

    IF NOT public.has_oficina_access(v_user_id, p_oficina_id)
       AND NOT EXISTS (
         SELECT 1
         FROM public.user_roles ur
         WHERE ur.user_id = v_user_id
           AND ur.role IN ('master'::app_role, 'super_admin'::app_role, 'platform_admin'::app_role)
           AND COALESCE(ur.active, true) = true
       ) THEN
        RAISE EXCEPTION 'Acesso negado: multi-tenant violation';
    END IF;

    WITH meses AS (
        SELECT generate_series(
            date_trunc('month', p_data_inicio),
            date_trunc('month', p_data_fim),
            '1 month'::interval
        )::date as mes_referencia
    ),
    dados_competencia AS (
        SELECT 
            date_trunc('month', data_servico)::date as mes,
            SUM(COALESCE(valor_servico, 0) - COALESCE(desconto, 0)) as faturamento_liquido,
            SUM(COALESCE(valor_mao_obra, 0)) as servicos_liquido,
            SUM(COALESCE(valor_servico, 0) - COALESCE(valor_mao_obra, 0) - COALESCE(desconto, 0)) as pecas_liquido,
            SUM(COALESCE(lucro, 0)) as lucro_operacional
        FROM public.ordens_servico
        WHERE oficina_id = p_oficina_id 
          AND status = 'finalizado'
          AND data_servico BETWEEN p_data_inicio AND p_data_fim
        GROUP BY 1
    ),
    dados_caixa AS (
        SELECT 
            date_trunc('month', data_pagamento)::date as mes,
            SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END) as entradas,
            SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END) as saidas
        FROM public.financeiro
        WHERE oficina_id = p_oficina_id
          AND data_pagamento BETWEEN p_data_inicio AND p_data_fim
        GROUP BY 1
    )
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'mes', to_char(m.mes_referencia, 'yyyy-mm-dd'),
            'label', to_char(m.mes_referencia, 'Mon'),
            'faturamento_liquido', COALESCE(dc.faturamento_liquido, 0),
            'pecas_liquido', COALESCE(dc.pecas_liquido, 0),
            'servicos_liquido', COALESCE(dc.servicos_liquido, 0),
            'lucro_operacional', COALESCE(dc.lucro_operacional, 0),
            'entradas_caixa', COALESCE(dx.entradas, 0),
            'saidas_caixa', COALESCE(dx.saidas, 0),
            'lucro_caixa', COALESCE(dx.entradas, 0) - COALESCE(dx.saidas, 0)
        )
        ORDER BY m.mes_referencia ASC
    ), '[]'::jsonb) INTO v_result
    FROM meses m
    LEFT JOIN dados_competencia dc ON dc.mes = m.mes_referencia
    LEFT JOIN dados_caixa dx ON dx.mes = m.mes_referencia;

    RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_financeiro_rankings_unificados(
  p_oficina_id uuid,
  p_data_inicio date,
  p_data_fim date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
    v_result JSONB;
BEGIN
    v_user_id := auth.uid();

    IF NOT public.has_oficina_access(v_user_id, p_oficina_id)
       AND NOT EXISTS (
         SELECT 1
         FROM public.user_roles ur
         WHERE ur.user_id = v_user_id
           AND ur.role IN ('master'::app_role, 'super_admin'::app_role, 'platform_admin'::app_role)
           AND COALESCE(ur.active, true) = true
       ) THEN
        RAISE EXCEPTION 'Acesso negado: multi-tenant violation';
    END IF;

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
        'clientes', COALESCE((SELECT jsonb_agg(rc) FROM ranking_clientes rc), '[]'::jsonb),
        'servicos', COALESCE((SELECT jsonb_agg(rs) FROM ranking_servicos rs), '[]'::jsonb),
        'margens_os', COALESCE((SELECT jsonb_agg(mo) FROM margens_os_final mo), '[]'::jsonb),
        'geral', COALESCE((SELECT to_jsonb(mg) FROM metricas_gerais mg), '{}'::jsonb)
    ) INTO v_result;

    RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_financeiro_series_unificadas(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_financeiro_series_unificadas(uuid, date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_financeiro_rankings_unificados(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_financeiro_rankings_unificados(uuid, date, date) TO service_role;