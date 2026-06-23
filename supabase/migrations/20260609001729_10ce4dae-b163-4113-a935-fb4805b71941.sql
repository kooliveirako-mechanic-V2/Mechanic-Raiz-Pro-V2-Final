CREATE OR REPLACE FUNCTION public.get_metrics_financeiras_unificadas(
    p_oficina_id UUID,
    p_data_inicio DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
    p_data_fim DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_tem_acesso BOOLEAN := false;
    v_result JSONB;
    v_entradas NUMERIC := 0;
    v_saidas NUMERIC := 0;
    v_fat_bruto NUMERIC := 0;
    v_fat_desconto NUMERIC := 0;
    v_fat_liquido NUMERIC := 0;
    v_fat_custo NUMERIC := 0;
    v_recebido_vinculado NUMERIC := 0;
BEGIN
    -- Validação Multi-tenant (permite service_role para testes)
    IF current_setting('role') != 'service_role' THEN
        SELECT EXISTS(
            SELECT 1 FROM oficinas WHERE id = p_oficina_id AND user_id = v_user_id
        ) OR EXISTS(
            SELECT 1 FROM user_roles WHERE oficina_id = p_oficina_id AND user_id = v_user_id AND active = true
        ) INTO v_tem_acesso;

        IF NOT v_tem_acesso THEN
            RETURN jsonb_build_object('faturamento', jsonb_build_object('liquido', 0), 'acesso_negado', true);
        END IF;
    END IF;

    -- FATURAMENTO COMPETÊNCIA (OS)
    SELECT 
        COALESCE(SUM(valor_servico), 0),
        COALESCE(SUM(desconto), 0),
        COALESCE(SUM(valor_servico - COALESCE(desconto, 0)), 0),
        COALESCE(SUM(custo_servico), 0)
    INTO v_fat_bruto, v_fat_desconto, v_fat_liquido, v_fat_custo
    FROM ordens_servico
    WHERE oficina_id = p_oficina_id
    AND status = 'finalizado'
    AND COALESCE(data_conclusao, data_servico)::date >= p_data_inicio 
    AND COALESCE(data_conclusao, data_servico)::date <= p_data_fim;

    -- FATURAMENTO COMPETÊNCIA (BALCÃO)
    DECLARE
        v_vb_bruto NUMERIC := 0;
    BEGIN
        SELECT COALESCE(SUM(valor_total), 0) INTO v_vb_bruto
        FROM vendas_balcao
        WHERE oficina_id = p_oficina_id
        AND status = 'concluida'
        AND created_at::date >= p_data_inicio 
        AND created_at::date <= p_data_fim;
        
        v_fat_bruto := v_fat_bruto + v_vb_bruto;
        v_fat_liquido := v_fat_liquido + v_vb_bruto;
    END;

    -- CAIXA (Lançamentos Pagos)
    SELECT 
        COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END), 0)
    INTO v_entradas, v_saidas
    FROM financeiro
    WHERE oficina_id = p_oficina_id
    AND status = 'pago'
    AND data >= p_data_inicio 
    AND data <= p_data_fim;

    -- RECEBIDO VINCULADO À COMPETÊNCIA DO PERÍODO
    SELECT COALESCE(SUM(f.valor), 0) INTO v_recebido_vinculado
    FROM financeiro f
    WHERE f.oficina_id = p_oficina_id
    AND f.status = 'pago'
    AND f.tipo = 'entrada'
    AND (
        f.ordem_servico_id IN (
            SELECT id FROM ordens_servico 
            WHERE oficina_id = p_oficina_id AND status = 'finalizado' 
            AND COALESCE(data_conclusao, data_servico)::date >= p_data_inicio 
            AND COALESCE(data_conclusao, data_servico)::date <= p_data_fim
        )
        OR
        f.venda_balcao_id IN (
            SELECT id FROM vendas_balcao 
            WHERE oficina_id = p_oficina_id AND status = 'concluida' 
            AND created_at::date >= p_data_inicio 
            AND created_at::date <= p_data_fim
        )
    );

    v_result := jsonb_build_object(
        'periodo', jsonb_build_object('inicio', p_data_inicio, 'fim', p_data_fim),
        'faturamento', jsonb_build_object(
            'bruto', v_fat_bruto,
            'descontos', v_fat_desconto,
            'liquido', v_fat_liquido
        ),
        'operacional', jsonb_build_object(
            'lucro_operacional', v_fat_liquido - v_fat_custo - v_saidas,
            'custo_pecas', v_fat_custo
        ),
        'caixa', jsonb_build_object(
            'entradas_oficina_periodo', v_entradas,
            'saidas_oficina_periodo', v_saidas,
            'recebido_vinculado_competencia', v_recebido_vinculado,
            'lucro_caixa_oficina_periodo', v_entradas - v_saidas,
            'saldo_a_receber_competencia', GREATEST(v_fat_liquido - v_recebido_vinculado, 0)
        ),
        'categorias', jsonb_build_object(
            'pecas', jsonb_build_object('liquido', v_fat_custo, 'bruto', v_fat_custo),
            'servicos', jsonb_build_object('liquido', v_fat_liquido - v_fat_custo, 'bruto', v_fat_liquido - v_fat_custo)
        ),
        'auditoria', jsonb_build_object('total_itens_livres_sem_custo', 0, 'alerta_lucro_inflado', false),
        'acesso_negado', false
    );

    RETURN v_result;
END;
$$;
