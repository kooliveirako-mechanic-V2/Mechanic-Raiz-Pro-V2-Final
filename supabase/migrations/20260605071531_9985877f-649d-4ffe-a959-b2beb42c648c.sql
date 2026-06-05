CREATE OR REPLACE FUNCTION public.get_metrics_financeiras_unificadas(
    p_oficina_id UUID,
    p_data_inicio DATE,
    p_data_fim DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_faturamento_bruto NUMERIC := 0;
    v_total_descontos NUMERIC := 0;
    v_faturamento_liquido NUMERIC := 0;
    v_recebimentos NUMERIC := 0;
    v_saidas_caixa NUMERIC := 0;
    v_lucro_caixa NUMERIC := 0;
    v_valor_pecas NUMERIC := 0;
    v_valor_servicos NUMERIC := 0;
    v_custo_pecas NUMERIC := 0;
    v_custos_diretos NUMERIC := 0;
    v_lucro_operacional NUMERIC := 0;
    v_vendas_balcao_total NUMERIC := 0;
    v_vendas_balcao_custo NUMERIC := 0;
    v_os_total NUMERIC := 0;
    v_os_custo NUMERIC := 0;
    v_saldo_a_receber NUMERIC := 0;
    v_total_itens_livres INTEGER := 0;
    v_total_itens_livres_sem_custo INTEGER := 0;
    v_alerta_itens_sem_custo BOOLEAN := FALSE;
BEGIN
    -- 1. FATURAMENTO OS (Competência: Data de Conclusão ou Data de Serviço)
    -- Consideramos apenas OS finalizadas
    SELECT 
        COALESCE(SUM(os.valor_servico), 0), -- Valor Bruto
        COALESCE(SUM(os.desconto), 0),
        COALESCE(SUM(os.custo_servico), 0)
    INTO v_os_total, v_total_descontos, v_os_custo
    FROM ordens_servico os
    WHERE os.oficina_id = p_oficina_id
      AND os.status = 'finalizado'
      AND COALESCE(os.data_conclusao, os.data_servico) >= p_data_inicio
      AND COALESCE(os.data_conclusao, os.data_servico) <= p_data_fim;

    -- 2. FATURAMENTO VENDAS BALCÃO
    SELECT 
        COALESCE(SUM(vb.valor_total), 0),
        COALESCE(SUM(vb.custo_total), 0)
    INTO v_vendas_balcao_total, v_vendas_balcao_custo
    FROM vendas_balcao vb
    WHERE vb.oficina_id = p_oficina_id
      AND vb.data >= p_data_inicio
      AND vb.data <= p_data_fim;

    -- 3. CÁLCULOS TOTAIS DE FATURAMENTO
    v_faturamento_bruto := v_os_total + v_vendas_balcao_total;
    v_faturamento_liquido := v_faturamento_bruto - v_total_descontos;

    -- 4. RECEBIMENTOS E SAÍDAS (Caixa Real)
    SELECT 
        COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END), 0)
    INTO v_recebimentos, v_saidas_caixa
    FROM financeiro
    WHERE oficina_id = p_oficina_id
      AND data >= p_data_inicio
      AND data <= p_data_fim;

    v_lucro_caixa := v_recebimentos - v_saidas_caixa;

    -- 5. DETALHAMENTO DE PEÇAS E SERVIÇOS (Baseado nos Itens de OS Finalizadas)
    SELECT 
        COALESCE(SUM(CASE WHEN ios.tipo = 'produto' OR ios.estoque_id IS NOT NULL THEN (COALESCE(ios.quantidade, 1) * COALESCE(ios.valor_unitario, 0)) ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN ios.tipo = 'servico' AND ios.estoque_id IS NULL THEN (COALESCE(ios.quantidade, 1) * COALESCE(ios.valor_unitario, 0)) ELSE 0 END), 0) + 
        COALESCE((SELECT SUM(os_sub.valor_mao_obra) FROM ordens_servico os_sub WHERE os_sub.id = ios.ordem_servico_id), 0),
        COALESCE(SUM(COALESCE(ios.quantidade, 1) * COALESCE(ios.custo_unitario, 0)), 0),
        COUNT(ios.id) FILTER (WHERE ios.estoque_id IS NULL),
        COUNT(ios.id) FILTER (WHERE ios.estoque_id IS NULL AND (ios.custo_unitario IS NULL OR ios.custo_unitario = 0))
    INTO v_valor_pecas, v_valor_servicos, v_custo_pecas, v_total_itens_livres, v_total_itens_livres_sem_custo
    FROM itens_os ios
    JOIN ordens_servico os ON os.id = ios.ordem_servico_id
    WHERE os.oficina_id = p_oficina_id
      AND os.status = 'finalizado'
      AND COALESCE(os.data_conclusao, os.data_servico) >= p_data_inicio
      AND COALESCE(os.data_conclusao, os.data_servico) <= p_data_fim;

    -- Adicionar peças da venda de balcão ao valor total de peças
    v_valor_pecas := v_valor_pecas + v_vendas_balcao_total;
    v_custo_pecas := v_custo_pecas + v_vendas_balcao_custo;

    -- 6. LUCRO OPERACIONAL E SALDO
    v_lucro_operacional := v_faturamento_liquido - v_custo_pecas;
    v_saldo_a_receber := GREATEST(v_faturamento_liquido - v_recebimentos, 0);
    
    IF v_total_itens_livres_sem_custo > 0 THEN
        v_alerta_itens_sem_custo := TRUE;
    END IF;

    RETURN jsonb_build_object(
        'periodo', jsonb_build_object('inicio', p_data_inicio, 'fim', p_data_fim),
        'faturamento', jsonb_build_object(
            'bruto', v_faturamento_bruto,
            'descontos', v_total_descontos,
            'liquido', v_faturamento_liquido
        ),
        'caixa', jsonb_build_object(
            'recebimentos', v_recebimentos,
            'saidas', v_saidas_caixa,
            'lucro_caixa', v_lucro_caixa
        ),
        'operacional', jsonb_build_object(
            'valor_pecas', v_valor_pecas,
            'valor_servicos', v_valor_servicos,
            'custo_pecas', v_custo_pecas,
            'lucro_operacional', v_lucro_operacional,
            'saldo_a_receber', v_saldo_a_receber
        ),
        'auditoria', jsonb_build_object(
            'total_itens_livres', v_total_itens_livres,
            'total_itens_livres_sem_custo', v_total_itens_livres_sem_custo,
            'alerta_itens_sem_custo', v_alerta_itens_sem_custo,
            'vendas_balcao_incluidas', v_vendas_balcao_total > 0
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_metrics_financeiras_unificadas TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_metrics_financeiras_unificadas TO service_role;
