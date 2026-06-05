CREATE OR REPLACE FUNCTION public.get_metrics_financeiras_unificadas(
    p_oficina_id UUID,
    p_data_inicio DATE,
    p_data_fim DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_faturamento_bruto NUMERIC := 0;
    v_total_descontos NUMERIC := 0;
    v_faturamento_liquido NUMERIC := 0;
    v_recebimentos NUMERIC := 0;
    v_saidas_caixa NUMERIC := 0;
    v_lucro_caixa NUMERIC := 0;
    
    -- Brutos
    v_valor_pecas_bruto NUMERIC := 0;
    v_valor_servicos_bruto NUMERIC := 0;
    v_valor_nao_classificado_bruto NUMERIC := 0;
    
    -- Líquidos (Pós-rateio)
    v_valor_pecas_liquido NUMERIC := 0;
    v_valor_servicos_liquido NUMERIC := 0;
    v_valor_nao_classificado_liquido NUMERIC := 0;
    
    v_custo_pecas NUMERIC := 0;
    v_lucro_operacional NUMERIC := 0;
    v_vendas_balcao_total NUMERIC := 0;
    v_vendas_balcao_custo NUMERIC := 0;
    v_saldo_a_receber NUMERIC := 0;
    v_total_itens_livres INTEGER := 0;
    v_total_itens_livres_sem_custo INTEGER := 0;
    v_alerta_itens_sem_custo BOOLEAN := FALSE;
    
    v_rateio_pecas NUMERIC := 0;
    v_rateio_servicos NUMERIC := 0;
    v_rateio_nao_classificado NUMERIC := 0;
BEGIN
    -- 1. FATURAMENTO VENDAS BALCÃO (Considerado Peças por padrão)
    WITH vendas_periodo AS (
        SELECT id, valor_total
        FROM vendas_balcao
        WHERE oficina_id = p_oficina_id
          AND DATE(created_at) >= p_data_inicio
          AND DATE(created_at) <= p_data_fim
    ),
    custos_vendas AS (
        SELECT SUM(COALESCE(ivb.quantidade, 1) * COALESCE(ivb.custo_unitario, 0)) as custo_total
        FROM itens_venda_balcao ivb
        WHERE ivb.venda_id IN (SELECT id FROM vendas_periodo)
    )
    SELECT 
        COALESCE(SUM(valor_total), 0),
        COALESCE((SELECT custo_total FROM custos_vendas), 0)
    INTO v_vendas_balcao_total, v_vendas_balcao_custo
    FROM vendas_periodo;

    -- 2. FATURAMENTO OS (Competência)
    -- Descontos e totais globais
    SELECT 
        COALESCE(SUM(os.desconto), 0)
    INTO v_total_descontos
    FROM ordens_servico os
    WHERE os.oficina_id = p_oficina_id
      AND os.status = 'finalizado'
      AND COALESCE(os.data_conclusao, os.data_servico) >= p_data_inicio
      AND COALESCE(os.data_conclusao, os.data_servico) <= p_data_fim;

    -- 3. CLASSIFICAÇÃO DETALHADA DOS ITENS DE OS
    WITH itens_classificados AS (
        SELECT 
            ios.id,
            -- REGRA DE CLASSIFICAÇÃO PEÇA
            CASE 
                WHEN ios.estoque_id IS NOT NULL OR ios.tipo IN ('produto', 'peca', 'peça') THEN 'peca'
                -- REGRA DE CLASSIFICAÇÃO SERVIÇO
                WHEN ios.estoque_id IS NULL AND (ios.tipo IN ('servico', 'serviço', 'mao_obra', 'mão_obra', 'mao de obra', 'mão de obra') OR ios.valor_mao_obra > 0) THEN 'servico'
                ELSE 'nao_classificado'
            END as categoria,
            -- REGRA DE VALOR BRUTO
            CASE 
                -- Peça prioriza valor_total ou unitario
                WHEN ios.estoque_id IS NOT NULL OR ios.tipo IN ('produto', 'peca', 'peça') THEN
                    COALESCE(NULLIF(ios.valor_total, 0), COALESCE(ios.quantidade, 1) * COALESCE(ios.valor_unitario, 0))
                -- Serviço prioriza valor_total ou valor_mao_obra ou unitario
                ELSE
                    COALESCE(NULLIF(ios.valor_total, 0), 
                        COALESCE(NULLIF(ios.valor_mao_obra, 0), 
                            COALESCE(ios.quantidade, 1) * COALESCE(ios.valor_unitario, 0)
                        )
                    )
            END as valor_bruto,
            COALESCE(ios.quantidade, 1) * COALESCE(ios.custo_unitario, 0) as custo_total,
            ios.estoque_id,
            ios.custo_unitario
        FROM itens_os ios
        JOIN ordens_servico os ON os.id = ios.ordem_servico_id
        WHERE os.oficina_id = p_oficina_id
          AND os.status = 'finalizado'
          AND COALESCE(os.data_conclusao, os.data_servico) >= p_data_inicio
          AND COALESCE(os.data_conclusao, os.data_servico) <= p_data_fim
    )
    SELECT 
        COALESCE(SUM(valor_bruto) FILTER (WHERE categoria = 'peca'), 0),
        COALESCE(SUM(valor_bruto) FILTER (WHERE categoria = 'servico'), 0),
        COALESCE(SUM(valor_bruto) FILTER (WHERE categoria = 'nao_classificado'), 0),
        COALESCE(SUM(custo_total), 0),
        COUNT(*) FILTER (WHERE estoque_id IS NULL),
        COUNT(*) FILTER (WHERE estoque_id IS NULL AND (custo_unitario IS NULL OR custo_unitario = 0))
    INTO 
        v_valor_pecas_bruto, v_valor_servicos_bruto, v_valor_nao_classificado_bruto, 
        v_custo_pecas, v_total_itens_livres, v_total_itens_livres_sem_custo
    FROM itens_classificados;

    -- Somar Vendas Balcão (Peças)
    v_valor_pecas_bruto := v_valor_pecas_bruto + v_vendas_balcao_total;
    v_custo_pecas := v_custo_pecas + v_vendas_balcao_custo;

    v_faturamento_bruto := v_valor_pecas_bruto + v_valor_servicos_bruto + v_valor_nao_classificado_bruto;
    v_faturamento_liquido := v_faturamento_bruto - v_total_descontos;

    -- 4. RATEIO DE DESCONTO
    IF v_faturamento_bruto > 0 THEN
        v_rateio_pecas := (v_valor_pecas_bruto / v_faturamento_bruto) * v_total_descontos;
        v_rateio_servicos := (v_valor_servicos_bruto / v_faturamento_bruto) * v_total_descontos;
        v_rateio_nao_classificado := (v_valor_nao_classificado_bruto / v_faturamento_bruto) * v_total_descontos;
    END IF;

    v_valor_pecas_liquido := v_valor_pecas_bruto - v_rateio_pecas;
    v_valor_servicos_liquido := v_valor_servicos_bruto - v_rateio_servicos;
    v_valor_nao_classificado_liquido := v_valor_nao_classificado_bruto - v_rateio_nao_classificado;

    -- 5. CAIXA (Fluxo de Caixa Real)
    SELECT 
        COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END), 0)
    INTO v_recebimentos, v_saidas_caixa
    FROM financeiro
    WHERE oficina_id = p_oficina_id
      AND data >= p_data_inicio
      AND data <= p_data_fim;

    v_lucro_caixa := v_recebimentos - v_saidas_caixa;
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
        'categorias', jsonb_build_object(
            'pecas', jsonb_build_object('bruto', v_valor_pecas_bruto, 'liquido', v_valor_pecas_liquido),
            'servicos', jsonb_build_object('bruto', v_valor_servicos_bruto, 'liquido', v_valor_servicos_liquido),
            'nao_classificado', jsonb_build_object('bruto', v_valor_nao_classificado_bruto, 'liquido', v_valor_nao_classificado_liquido)
        ),
        'caixa', jsonb_build_object(
            'recebimentos', v_recebimentos,
            'saidas', v_saidas_caixa,
            'lucro_caixa', v_lucro_caixa
        ),
        'operacional', jsonb_build_object(
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