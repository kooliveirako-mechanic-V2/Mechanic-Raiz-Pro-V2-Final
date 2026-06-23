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
    v_recebido_competencia NUMERIC := 0;
    v_custo_pecas NUMERIC := 0;
    
    -- Auditoria
    v_os_divergencia INT := 0;
    v_pag_parciais INT := 0;
BEGIN
    -- 1. Validação de Segurança Multi-tenant
    -- Camada 1: é o dono direto da oficina?
    SELECT EXISTS(
        SELECT 1 FROM oficinas
        WHERE id = p_oficina_id AND user_id = v_user_id
    ) INTO v_tem_acesso;

    -- Camada 2: está em user_roles com cargo ativo?
    IF NOT v_tem_acesso THEN
        SELECT EXISTS(
            SELECT 1 FROM user_roles
            WHERE oficina_id = p_oficina_id
            AND user_id = v_user_id
            AND active = true
        ) INTO v_tem_acesso;
    END IF;

    -- Camada 3: tem acesso via has_oficina_access?
    IF NOT v_tem_acesso THEN
        v_tem_acesso := has_oficina_access(v_user_id, p_oficina_id);
    END IF;

    -- Se nenhuma camada aprovou e não for service_role, retornar erro em JSON
    IF NOT v_tem_acesso AND current_setting('role') <> 'service_role' THEN
        RETURN jsonb_build_object(
            'error', 'acesso_negado',
            'message', 'Usuário sem permissão para esta oficina'
        );
    END IF;

    -- 2. Coleta de dados de Faturamento Operacional (OS e Vendas)
    -- Isso serve para a análise de categorias (Peças vs Serviços)
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

    -- Descontos globais das OSs
    SELECT COALESCE(SUM(desconto), 0) INTO v_fat_desconto FROM os_base;
    
    v_fat_liquido := v_fat_bruto - v_fat_desconto;
    v_pecas_liquido := v_pecas_bruto; -- Simplificado: desconto geralmente é na OS toda
    v_servicos_liquido := v_servicos_bruto;
    v_nc_liquido := v_nc_bruto;

    -- 3. Métricas de Caixa Real (Fonte: Financeiro) - A Fonte da Verdade
    -- Faturamento Real = Tudo que entrou (OS, Vendas, Manuais)
    SELECT 
        COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END), 0)
    INTO v_entradas_caixa, v_saidas_caixa
    FROM financeiro
    WHERE oficina_id = p_oficina_id
    AND data BETWEEN p_data_inicio AND p_data_fim
    AND status = 'pago';

    -- 4. Construção do Resultado
    v_result := jsonb_build_object(
        'faturamento', jsonb_build_object(
            'bruto', v_entradas_caixa, -- Usando o caixa real como faturamento do dashboard
            'descontos', v_fat_desconto,
            'liquido', v_entradas_caixa,
            'pecas', v_pecas_bruto,
            'servicos', v_servicos_bruto,
            'outros', v_nc_bruto
        ),
        'custos', jsonb_build_object(
            'total', v_saidas_caixa + v_pecas_custo,
            'pecas', v_pecas_custo,
            'fixos_variaveis', v_saidas_caixa
        ),
        'lucro', jsonb_build_object(
            'operacional', v_entradas_caixa - v_saidas_caixa,
            'margem', CASE WHEN v_entradas_caixa > 0 THEN ((v_entradas_caixa - v_saidas_caixa) / v_entradas_caixa) * 100 ELSE 0 END
        ),
        'periodo', jsonb_build_object(
            'inicio', p_data_inicio,
            'fim', p_data_fim
        )
    );

    RETURN v_result;
END;
$$;