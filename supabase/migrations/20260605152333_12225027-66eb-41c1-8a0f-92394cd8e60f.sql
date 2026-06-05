CREATE OR REPLACE FUNCTION public.get_metrics_financeiras_unificadas(p_oficina_id uuid, p_data_inicio date, p_data_fim date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID := auth.uid();
    v_is_platform_admin BOOLEAN := false;
    v_has_oficina_access BOOLEAN := false;
    v_result JSONB;
    
    -- Variáveis para fechamento matemático
    v_fat_bruto NUMERIC;
    v_fat_desconto NUMERIC;
    v_fat_liquido NUMERIC;
    
    v_pecas_bruto NUMERIC;
    v_pecas_custo NUMERIC;
    v_pecas_liquido NUMERIC;
    
    v_servicos_bruto NUMERIC;
    v_servicos_liquido NUMERIC;
    
    v_nc_bruto NUMERIC;
    v_nc_liquido NUMERIC;
    
    v_soma_liquido_previa NUMERIC;
    v_residuo NUMERIC;
BEGIN
    -- 1. Validação de Segurança Multi-tenant
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Não autorizado';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = v_user_id
        AND active = true
        AND role IN ('master', 'super_admin', 'platform_admin')
    ) INTO v_is_platform_admin;

    SELECT EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = v_user_id
        AND active = true
        AND oficina_id = p_oficina_id
    ) INTO v_has_oficina_access;

    IF NOT v_is_platform_admin AND NOT v_has_oficina_access THEN
        RAISE EXCEPTION 'Acesso negado à oficina %', p_oficina_id;
    END IF;

    -- 2. Coleta de dados base
    WITH os_base AS (
        SELECT 
            os.id,
            os.desconto,
            COALESCE((SELECT SUM(valor_total) FROM itens_os WHERE ordem_servico_id = os.id), 0) as valor_total_bruto
        FROM ordens_servico os
        WHERE os.oficina_id = p_oficina_id
        AND os.status = 'finalizado'
        AND COALESCE(os.data_conclusao, os.data_servico)::date BETWEEN p_data_inicio AND p_data_fim
    ),
    vendas_balcao_filtradas AS (
        SELECT 
            v.id,
            v.valor_total as valor_total_bruto
        FROM vendas_balcao v
        WHERE v.oficina_id = p_oficina_id
        AND v.status = 'finalizado'
        AND v.created_at::date BETWEEN p_data_inicio AND p_data_fim
    ),
    itens_classificados AS (
        SELECT 
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
            COALESCE(io.quantidade * io.custo_unitario, 0) as custo_total
        FROM itens_os io
        JOIN os_base os ON io.ordem_servico_id = os.id
        
        UNION ALL
        
        SELECT 
            'peca' as categoria,
            COALESCE(iv.valor_total, iv.quantidade * iv.valor_unitario, 0) as valor_bruto,
            COALESCE(iv.quantidade * iv.custo_unitario, 0) as custo_total
        FROM itens_venda_balcao iv
        JOIN vendas_balcao_filtradas v ON iv.venda_id = v.id
    )
    SELECT 
        COALESCE(SUM(valor_bruto), 0),
        COALESCE(SUM(custo_total), 0),
        COALESCE(SUM(CASE WHEN categoria = 'peca' THEN valor_bruto ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN categoria = 'peca' THEN custo_total ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN categoria = 'servico' THEN valor_bruto ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN categoria = 'nao_classificado' THEN valor_bruto ELSE 0 END), 0)
    INTO 
        v_fat_bruto, v_pecas_custo, v_pecas_bruto, v_pecas_custo, v_servicos_bruto, v_nc_bruto
    FROM itens_classificados;

    -- Faturamento consolidado
    SELECT 
        COALESCE(SUM(desconto), 0) INTO v_fat_desconto
    FROM ordens_servico
    WHERE oficina_id = p_oficina_id
    AND status = 'finalizado'
    AND COALESCE(data_conclusao, data_servico)::date BETWEEN p_data_inicio AND p_data_fim;

    v_fat_liquido := v_fat_bruto - v_fat_desconto;

    -- 3. Cálculo de Líquidos com Rateio Proporcional e Arredondamento
    IF v_fat_bruto > 0 THEN
        v_pecas_liquido := ROUND((v_pecas_bruto / v_fat_bruto) * v_fat_liquido, 2);
        v_servicos_liquido := ROUND((v_servicos_bruto / v_fat_bruto) * v_fat_liquido, 2);
        v_nc_liquido := ROUND((v_nc_bruto / v_fat_bruto) * v_fat_liquido, 2);
    ELSE
        v_pecas_liquido := 0;
        v_servicos_liquido := 0;
        v_nc_liquido := 0;
    END IF;

    -- 4. Ajuste de Centavo Residual (Fechamento Matemático)
    v_soma_liquido_previa := v_pecas_liquido + v_servicos_liquido + v_nc_liquido;
    v_residuo := v_fat_liquido - v_soma_liquido_previa;

    IF v_residuo <> 0 THEN
        -- Aplica o resíduo na maior categoria para minimizar impacto percentual
        IF v_pecas_bruto >= v_servicos_bruto AND v_pecas_bruto >= v_nc_bruto THEN
            v_pecas_liquido := v_pecas_liquido + v_residuo;
        ELSIF v_servicos_bruto >= v_pecas_bruto AND v_servicos_bruto >= v_nc_bruto THEN
            v_servicos_liquido := v_servicos_liquido + v_residuo;
        ELSE
            v_nc_liquido := v_nc_liquido + v_residuo;
        END IF;
    END IF;

    -- 5. Montagem do Resultado JSONB
    SELECT jsonb_build_object(
        'periodo', jsonb_build_object('inicio', p_data_inicio, 'fim', p_data_fim),
        'faturamento', jsonb_build_object(
            'bruto', v_fat_bruto,
            'descontos', v_fat_desconto,
            'liquido', v_fat_liquido
        ),
        'categorias', jsonb_build_object(
            'pecas', jsonb_build_object(
                'bruto', v_pecas_bruto,
                'custo', v_pecas_custo,
                'liquido', v_pecas_liquido
            ),
            'servicos', jsonb_build_object(
                'bruto', v_servicos_bruto,
                'liquido', v_servicos_liquido
            ),
            'nao_classificado', jsonb_build_object(
                'bruto', v_nc_bruto,
                'liquido', v_nc_liquido
            )
        ),
        'caixa', (
            SELECT jsonb_build_object(
                'entradas', COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END), 0),
                'saidas', COALESCE(SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END), 0),
                'lucro_caixa', COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END), 0)
            )
            FROM financeiro
            WHERE oficina_id = p_oficina_id
            AND status = 'pago'
            AND COALESCE(data_pagamento, created_at)::date BETWEEN p_data_inicio AND p_data_fim
        ),
        'operacional', jsonb_build_object(
            'lucro_operacional', v_fat_liquido - v_pecas_custo,
            'margem_operacional', CASE WHEN v_fat_liquido > 0 THEN ((v_fat_liquido - v_pecas_custo) / v_fat_liquido) * 100 ELSE 0 END
        ),
        'vendas_balcao', (
            SELECT jsonb_build_object(
                'total_bruto', COALESCE(SUM(valor_total), 0),
                'quantidade', COUNT(*)
            )
            FROM vendas_balcao
            WHERE oficina_id = p_oficina_id
            AND status = 'finalizado'
            AND created_at::date BETWEEN p_data_inicio AND p_data_fim
        ),
        'auditoria_fechamento', jsonb_build_object(
            'soma_categorias_liquido', v_pecas_liquido + v_servicos_liquido + v_nc_liquido,
            'diferenca_fechamento', v_fat_liquido - (v_pecas_liquido + v_servicos_liquido + v_nc_liquido),
            'status_fechamento', CASE WHEN v_fat_liquido = (v_pecas_liquido + v_servicos_liquido + v_nc_liquido) THEN 'OK' ELSE 'ERRO' END
        )
    ) INTO v_result;

    RETURN v_result;
END;
$function$