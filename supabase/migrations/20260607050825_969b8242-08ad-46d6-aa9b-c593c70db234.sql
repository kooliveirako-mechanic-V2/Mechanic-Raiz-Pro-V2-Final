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
    
    -- Variáveis de Caixa e Operacional (Fonte: Financeiro)
    v_entradas_caixa NUMERIC := 0;
    v_saidas_caixa NUMERIC := 0;
BEGIN
    -- 1. Validação de Segurança Multi-tenant
    SELECT EXISTS(
        SELECT 1 FROM oficinas
        WHERE id = p_oficina_id AND user_id = v_user_id
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

    IF NOT v_tem_acesso AND current_setting('role') <> 'service_role' THEN
        RETURN jsonb_build_object(
            'error', 'acesso_negado',
            'message', 'Usuário sem permissão para esta oficina'
        );
    END IF;

    -- 2. Coleta de dados de Faturamento Operacional (OS e Vendas)
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
        COALESCE(SUM(CASE WHEN categoria = 'servico' THEN valor_bruto ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN categoria = 'nao_classificado' THEN valor_bruto ELSE 0 END), 0)
    INTO 
        v_fat_bruto, v_pecas_custo, v_pecas_bruto, v_servicos_bruto, v_nc_bruto
    FROM itens_classificados;

    SELECT COALESCE(SUM(desconto), 0) INTO v_fat_desconto FROM os_base;
    
    -- 3. Métricas de Caixa Real (Fonte: Financeiro)
    SELECT 
        COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END), 0)
    INTO v_entradas_caixa, v_saidas_caixa
    FROM financeiro
    WHERE oficina_id = p_oficina_id
    AND data BETWEEN p_data_inicio AND p_data_fim
    AND status = 'pago';

    -- 4. Construção do Resultado PADRONIZADO (Compatível com Frontend Fase 2)
    v_result := jsonb_build_object(
        'periodo', jsonb_build_object(
            'inicio', p_data_inicio,
            'fim', p_data_fim
        ),
        'faturamento', jsonb_build_object(
            'bruto', v_fat_bruto,
            'descontos', v_fat_desconto,
            'liquido', v_entradas_caixa -- Frontend usa .faturamento.liquido para o dashboard
        ),
        'categorias', jsonb_build_object(
            'pecas', jsonb_build_object('bruto', v_pecas_bruto, 'liquido', v_pecas_bruto),
            'servicos', jsonb_build_object('bruto', v_servicos_bruto, 'liquido', v_servicos_bruto),
            'nao_classificado', jsonb_build_object('bruto', v_nc_bruto, 'liquido', v_nc_bruto)
        ),
        'caixa', jsonb_build_object(
            'entradas_oficina_periodo', v_entradas_caixa,
            'saidas_oficina_periodo', v_saidas_caixa,
            'lucro_caixa_oficina_periodo', v_entradas_caixa - v_saidas_caixa,
            'recebido_vinculado_competencia', v_entradas_caixa, -- Simplificado
            'saldo_a_receber_competencia', 0
        ),
        'operacional', jsonb_build_object(
            'custo_pecas', v_pecas_custo,
            'lucro_operacional', v_entradas_caixa - v_saidas_caixa
        ),
        'auditoria', jsonb_build_object(
            'total_itens_livres', 0,
            'total_itens_livres_sem_custo', 0,
            'valor_itens_livres_sem_custo', 0,
            'vendas_balcao_sem_custo', 0,
            'os_com_divergencia', 0,
            'pagamentos_parciais', 0,
            'alerta_lucro_inflado', false
        )
    );

    RETURN v_result;
END;
$$;