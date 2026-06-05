
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
    -- Variáveis de Ambiente e Segurança
    v_user_id UUID := auth.uid();
    v_has_access BOOLEAN := FALSE;
    
    -- Variáveis de Competência (Faturamento)
    v_faturamento_os_liquido NUMERIC := 0;
    v_faturamento_vendas_balcao NUMERIC := 0;
    v_faturamento_liquido_total NUMERIC := 0;
    v_custo_total_competencia NUMERIC := 0;
    v_lucro_operacional NUMERIC := 0;
    v_recebido_vinculado_competencia NUMERIC := 0;
    v_saldo_a_receber_competencia NUMERIC := 0;
    
    -- Variáveis de Caixa (Financeiro Real do Período)
    v_entradas_globais NUMERIC := 0;
    v_saidas_globais NUMERIC := 0;
    v_lucro_caixa_global NUMERIC := 0;
BEGIN
    -- 0. VALIDAÇÃO MULTI-TENANT
    SELECT EXISTS (SELECT 1 FROM profiles WHERE id = v_user_id) INTO v_has_access;
    IF v_user_id IS NULL THEN v_has_access := TRUE; END IF;
    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Acesso negado: Segurança Multi-tenant.';
    END IF;

    -- 1. CAIXA GLOBAL DO PERÍODO
    SELECT 
        COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END), 0)
    INTO v_entradas_globais, v_saidas_globais
    FROM financeiro
    WHERE oficina_id = p_oficina_id
      AND data >= p_data_inicio
      AND data <= p_data_fim;
    
    v_lucro_caixa_global := ROUND(v_entradas_globais - v_saidas_globais, 2);

    -- 2. COMPETÊNCIA - FATURAMENTO OS
    SELECT COALESCE(SUM(ROUND(valor_servico - COALESCE(desconto, 0), 2)), 0)
    INTO v_faturamento_os_liquido
    FROM ordens_servico
    WHERE oficina_id = p_oficina_id 
      AND status = 'finalizado'
      AND COALESCE(data_conclusao, data_servico) >= p_data_inicio
      AND COALESCE(data_conclusao, data_servico) <= p_data_fim;

    -- 3. COMPETÊNCIA - FATURAMENTO VENDAS BALCÃO
    SELECT COALESCE(SUM(valor_total), 0) INTO v_faturamento_vendas_balcao
    FROM vendas_balcao
    WHERE oficina_id = p_oficina_id
      AND DATE(created_at) >= p_data_inicio
      AND DATE(created_at) <= p_data_fim;

    v_faturamento_liquido_total := ROUND(v_faturamento_os_liquido + v_faturamento_vendas_balcao, 2);

    -- 4. RECEBIMENTOS VINCULADOS À COMPETÊNCIA
    -- Vinculados via ordem_servico_id
    WITH os_ids AS (
        SELECT id FROM ordens_servico
        WHERE oficina_id = p_oficina_id AND status = 'finalizado'
          AND COALESCE(data_conclusao, data_servico) >= p_data_inicio
          AND COALESCE(data_conclusao, data_servico) <= p_data_fim
    )
    SELECT COALESCE(SUM(valor), 0) INTO v_recebido_vinculado_competencia
    FROM financeiro
    WHERE tipo = 'entrada'
      AND ordem_servico_id IN (SELECT id FROM os_ids);
      
    -- Somar também recebimentos de vendas balcão identificados por 'Venda Balcão' no campo origem
    v_recebido_vinculado_competencia := v_recebido_vinculado_competencia + (
        SELECT COALESCE(SUM(valor), 0)
        FROM financeiro
        WHERE oficina_id = p_oficina_id
          AND tipo = 'entrada'
          AND origem = 'Venda Balcão'
          AND data >= p_data_inicio
          AND data <= p_data_fim
    );

    v_saldo_a_receber_competencia := ROUND(v_faturamento_liquido_total - v_recebido_vinculado_competencia, 2);

    -- 5. CUSTO E LUCRO OPERACIONAL
    WITH custos_os AS (
        SELECT SUM(ROUND(quantidade * custo_unitario, 2)) as total
        FROM itens_os ios JOIN ordens_servico os ON os.id = ios.ordem_servico_id
        WHERE os.oficina_id = p_oficina_id AND os.status = 'finalizado'
          AND COALESCE(os.data_conclusao, os.data_servico) >= p_data_inicio
          AND COALESCE(os.data_conclusao, os.data_servico) <= p_data_fim
    ),
    custos_vendas AS (
        SELECT SUM(ROUND(quantidade * custo_unitario, 2)) as total
        FROM itens_venda_balcao ivb JOIN vendas_balcao vb ON vb.id = ivb.venda_id
        WHERE vb.oficina_id = p_oficina_id
          AND DATE(vb.created_at) >= p_data_inicio AND DATE(vb.created_at) <= p_data_fim
    )
    SELECT COALESCE((SELECT total FROM custos_os), 0) + COALESCE((SELECT total FROM custos_vendas), 0)
    INTO v_custo_total_competencia;

    v_lucro_operacional := ROUND(v_faturamento_liquido_total - v_custo_total_competencia, 2);

    RETURN jsonb_build_object(
        'competencia', jsonb_build_object(
            'faturamento_liquido', v_faturamento_liquido_total,
            'lucro_operacional', v_lucro_operacional,
            'recebido_vinculado', v_recebido_vinculado_competencia,
            'saldo_a_receber', v_saldo_a_receber_competencia
        ),
        'caixa', jsonb_build_object(
            'entradas_globais_periodo', v_entradas_globais,
            'saidas_globais_periodo', v_saidas_globais,
            'lucro_caixa_global_periodo', v_lucro_caixa_global,
            'recebimentos_vinculados_competencia', v_recebido_vinculado_competencia
        )
    );
END;
$$;
