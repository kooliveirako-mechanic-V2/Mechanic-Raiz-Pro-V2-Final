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
    v_is_owner BOOLEAN := false;
    v_result JSONB;
    
    -- Variáveis para fechamento matemático
    v_fat_bruto NUMERIC := 0;
    v_fat_desconto NUMERIC := 0;
    v_fat_liquido NUMERIC := 0;
    
    v_pecas_bruto NUMERIC := 0;
    v_pecas_custo NUMERIC := 0;
    v_pecas_liquido NUMERIC := 0;
    
    v_servicos_bruto NUMERIC := 0;
    v_servicos_liquido NUMERIC := 0;
    
    v_nc_bruto NUMERIC := 0;
    v_nc_liquido NUMERIC := 0;
    
    v_soma_liquido_previa NUMERIC := 0;
    v_residuo NUMERIC := 0;
    
    -- Variáveis de Caixa e Operacional
    v_entradas_caixa NUMERIC := 0;
    v_saidas_caixa NUMERIC := 0;
    v_recebido_competencia NUMERIC := 0;
    v_custo_pecas NUMERIC := 0;
    
    -- Auditoria
    v_itens_livres INT := 0;
    v_itens_livres_sem_custo INT := 0;
    v_valor_sem_custo NUMERIC := 0;
    v_vendas_balcao_sem_custo INT := 0;
    v_os_divergencia INT := 0;
    v_pag_parciais INT := 0;
BEGIN
    -- 1. Validação de Segurança Multi-tenant
    -- Se v_user_id for nulo (chamada via API direta sem token), mas for service_role, permitimos se o contexto permitir.
    -- Para segurança total em chamadas web, v_user_id é essencial.
    
    -- Verifica se é Admin da Plataforma
    SELECT EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = v_user_id
        AND active = true
        AND role IN ('master', 'super_admin', 'platform_admin')
    ) INTO v_is_platform_admin;

    -- Verifica se é o Dono/Criador da Oficina
    SELECT EXISTS (
        SELECT 1 FROM oficinas
        WHERE id = p_oficina_id
        AND user_id = v_user_id
    ) INTO v_is_owner;

    -- Verifica se tem cargo na oficina
    SELECT EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = v_user_id
        AND active = true
        AND oficina_id = p_oficina_id
    ) INTO v_has_oficina_access;

    -- Se não for nada disso e não for service_role (interna), bloqueia
    IF NOT v_is_platform_admin AND NOT v_is_owner AND NOT v_has_oficina_access AND current_setting('role') <> 'service_role' THEN
        RAISE EXCEPTION 'Acesso negado à oficina %', p_oficina_id;
    END IF;

    -- 2. Coleta de dados base (Itens de OS e Vendas Balcão)
    -- CORREÇÃO: Vendas Balcão usam status 'concluida'
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
        AND v.status IN ('finalizado', 'concluida')
        AND v.created_at::date BETWEEN p_data_inicio AND p_data_fim
    ),
    itens_classificados AS (
        SELECT 
            CASE 
                WHEN io.estoque_id IS NOT NULL OR LOWER(io.tipo) IN ('produto', 'peca', 'peça') THEN 'peca'
                WHEN LOWER(io.tipo) IN ('servico', 'serviço', 'mao_obra', 'mão_obra', 'mao de obra', 'mão de obra') OR io.valor_mao_obra > 0 THEN 'servico'
                ELSE 'nao_classificado'
            END as categoria,
            COALESCE(io.valor_total, io.quantidade * io.valor_unitario, 0) as valor_bruto,
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

    -- 3. Cálculo de Descontos Proporcionais (OS) e Faturamento Líquido
    SELECT COALESCE(SUM(desconto), 0) INTO v_fat_desconto FROM os_base;
    v_fat_liquido := v_fat_bruto - v_fat_desconto;
    
    -- Rateio de descontos para categorias (Simplificado: proporcional ao peso no bruto)
    IF v_fat_bruto > 0 THEN
        v_pecas_liquido := v_pecas_bruto - (v_fat_desconto * (v_pecas_bruto / v_fat_bruto));
        v_servicos_liquido := v_servicos_bruto - (v_fat_desconto * (v_servicos_bruto / v_fat_bruto));
        v_nc_liquido := v_nc_bruto - (v_fat_desconto * (v_nc_bruto / v_fat_bruto));
    ELSE
        v_pecas_liquido := 0;
        v_servicos_liquido := 0;
        v_nc_liquido := 0;
    END IF;

    -- 4. Métricas de Caixa (Movimentações Financeiras Reais)
    SELECT 
        COALESCE(SUM(CASE WHEN tipo = 'receita' THEN valor_pago ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN tipo = 'despesa' THEN valor_pago ELSE 0 END), 0)
    INTO v_entradas_caixa, v_saidas_caixa
    FROM movimentacoes_financeiras
    WHERE oficina_id = p_oficina_id
    AND status = 'pago'
    AND data_pagamento::date BETWEEN p_data_inicio AND p_data_fim;

    -- 5. Recebido da Competência (Pagamentos vinculados a OS/Vendas do período)
    SELECT COALESCE(SUM(valor_pago), 0)
    INTO v_recebido_competencia
    FROM movimentacoes_financeiras
    WHERE oficina_id = p_oficina_id
    AND status = 'pago'
    AND (ordem_servico_id IN (SELECT id FROM os_base) OR venda_balcao_id IN (SELECT id FROM vendas_balcao_filtradas));

    -- 6. Auditoria e Alertas
    SELECT COUNT(*), COUNT(*) FILTER (WHERE custo_unitario = 0 OR custo_unitario IS NULL), COALESCE(SUM(valor_total) FILTER (WHERE custo_unitario = 0 OR custo_unitario IS NULL), 0)
    INTO v_itens_livres, v_itens_livres_sem_custo, v_valor_sem_custo
    FROM itens_os
    WHERE ordem_servico_id IN (SELECT id FROM os_base) AND (estoque_id IS NULL);

    -- 7. Montagem do Resultado JSON
    v_result := jsonb_build_object(
        'periodo', jsonb_build_object('inicio', p_data_inicio, 'fim', p_data_fim),
        'faturamento', jsonb_build_object(
            'bruto', ROUND(v_fat_bruto, 2),
            'descontos', ROUND(v_fat_desconto, 2),
            'liquido', ROUND(v_fat_liquido, 2)
        ),
        'categorias', jsonb_build_object(
            'pecas', jsonb_build_object('bruto', ROUND(v_pecas_bruto, 2), 'liquido', ROUND(v_pecas_liquido, 2)),
            'servicos', jsonb_build_object('bruto', ROUND(v_servicos_bruto, 2), 'liquido', ROUND(v_servicos_liquido, 2)),
            'nao_classificado', jsonb_build_object('bruto', ROUND(v_nc_bruto, 2), 'liquido', ROUND(v_nc_liquido, 2))
        ),
        'caixa', jsonb_build_object(
            'entradas_oficina_periodo', ROUND(v_entradas_caixa, 2),
            'saidas_oficina_periodo', ROUND(v_saidas_caixa, 2),
            'lucro_caixa_oficina_periodo', ROUND(v_entradas_caixa - v_saidas_caixa, 2),
            'recebido_vinculado_competencia', ROUND(v_recebido_competencia, 2),
            'saldo_a_receber_competencia', ROUND(v_fat_liquido - v_recebido_competencia, 2)
        ),
        'operacional', jsonb_build_object(
            'custo_pecas', ROUND(v_pecas_custo, 2),
            'lucro_operacional', ROUND(v_fat_liquido - v_pecas_custo, 2)
        ),
        'auditoria', jsonb_build_object(
            'total_itens_livres', v_itens_livres,
            'total_itens_livres_sem_custo', v_itens_livres_sem_custo,
            'valor_itens_livres_sem_custo', ROUND(v_valor_sem_custo, 2),
            'alerta_lucro_inflado', (v_itens_livres_sem_custo > 0)
        )
    );

    RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_metrics_financeiras_unificadas(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_metrics_financeiras_unificadas(uuid, date, date) TO service_role;
