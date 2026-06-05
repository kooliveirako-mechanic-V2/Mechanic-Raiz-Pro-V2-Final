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
    -- Variáveis de Ambiente e Segurança
    v_user_id UUID := auth.uid();
    v_has_access BOOLEAN := FALSE;
    
    -- Variáveis Financeiras
    v_faturamento_bruto NUMERIC := 0;
    v_total_descontos NUMERIC := 0;
    v_faturamento_liquido NUMERIC := 0;
    v_recebimentos NUMERIC := 0;
    v_saidas_caixa NUMERIC := 0;
    v_lucro_caixa NUMERIC := 0;
    v_valor_pecas_bruto NUMERIC := 0;
    v_valor_servicos_bruto NUMERIC := 0;
    v_valor_nao_classificado_bruto NUMERIC := 0;
    v_valor_pecas_liquido NUMERIC := 0;
    v_valor_servicos_liquido NUMERIC := 0;
    v_valor_nao_classificado_liquido NUMERIC := 0;
    v_custo_pecas NUMERIC := 0;
    v_lucro_operacional NUMERIC := 0;
    v_vendas_balcao_total NUMERIC := 0;
    v_vendas_balcao_custo NUMERIC := 0;
    v_saldo_a_receber NUMERIC := 0;
    
    -- Auditoria
    v_total_itens_livres INTEGER := 0;
    v_total_itens_livres_sem_custo INTEGER := 0;
    v_valor_itens_livres_sem_custo NUMERIC := 0;
    v_os_com_divergencia INTEGER := 0;
    v_vendas_balcao_sem_custo INTEGER := 0;
    v_pagamentos_parciais_os INTEGER := 0;
    v_diferenca_centavos NUMERIC := 0;
BEGIN
    -- 0. VALIDAÇÃO MULTI-TENANT (Forense)
    -- Verifica se o usuário autenticado tem vínculo com a oficina informada
    SELECT EXISTS (
        SELECT 1 FROM perfis 
        WHERE id = v_user_id 
        AND (oficina_id = p_oficina_id OR role IN ('admin', 'master'))
    ) INTO v_has_access;

    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Acesso negado: Usuário % não tem permissão para a oficina %', v_user_id, p_oficina_id;
    END IF;

    -- 1. FATURAMENTO VENDAS BALCÃO
    WITH vendas_periodo AS (
        SELECT id, valor_total
        FROM vendas_balcao
        WHERE oficina_id = p_oficina_id
          AND DATE(created_at) >= p_data_inicio
          AND DATE(created_at) <= p_data_fim
    ),
    custos_vendas AS (
        SELECT 
            SUM(ROUND(COALESCE(ivb.quantidade, 1) * COALESCE(ivb.custo_unitario, 0), 2)) as custo_total,
            COUNT(*) FILTER (WHERE ivb.custo_unitario IS NULL OR ivb.custo_unitario = 0) as sem_custo
        FROM itens_venda_balcao ivb
        WHERE ivb.venda_id IN (SELECT id FROM vendas_periodo)
    )
    SELECT 
        COALESCE(SUM(valor_total), 0),
        COALESCE((SELECT custo_total FROM custos_vendas), 0),
        COALESCE((SELECT sem_custo FROM custos_vendas), 0)
    INTO v_vendas_balcao_total, v_vendas_balcao_custo, v_vendas_balcao_sem_custo
    FROM vendas_periodo;

    -- 2. DESCONTOS OS
    SELECT COALESCE(SUM(os.desconto), 0) INTO v_total_descontos
    FROM ordens_servico os
    WHERE os.oficina_id = p_oficina_id AND os.status = 'finalizado'
      AND COALESCE(os.data_conclusao, os.data_servico) >= p_data_inicio
      AND COALESCE(os.data_conclusao, os.data_servico) <= p_data_fim;

    -- 3. ITENS OS (Competência)
    WITH itens_classificados AS (
        SELECT 
            CASE 
                WHEN ios.estoque_id IS NOT NULL OR ios.tipo IN ('produto', 'peca', 'peça') THEN 'peca'
                WHEN ios.estoque_id IS NULL AND (ios.tipo IN ('servico', 'serviço', 'mao_obra', 'mão_obra', 'mao de obra', 'mão de obra') OR ios.valor_mao_obra > 0) THEN 'servico'
                ELSE 'nao_classificado'
            END as categoria,
            CASE 
                WHEN ios.estoque_id IS NOT NULL OR ios.tipo IN ('produto', 'peca', 'peça') THEN
                    COALESCE(NULLIF(ios.valor_total, 0), ROUND(COALESCE(ios.quantidade, 1) * COALESCE(ios.valor_unitario, 0), 2))
                ELSE
                    COALESCE(NULLIF(ios.valor_total, 0), 
                        COALESCE(NULLIF(ios.valor_mao_obra, 0), 
                            ROUND(COALESCE(ios.quantidade, 1) * COALESCE(ios.valor_unitario, 0), 2)
                        )
                    )
            END as valor_bruto,
            ROUND(COALESCE(ios.quantidade, 1) * COALESCE(ios.custo_unitario, 0), 2) as custo_total,
            ios.estoque_id,
            ios.custo_unitario
        FROM itens_os ios
        JOIN ordens_servico os ON os.id = ios.ordem_servico_id
        WHERE os.oficina_id = p_oficina_id AND os.status = 'finalizado'
          AND COALESCE(os.data_conclusao, os.data_servico) >= p_data_inicio
          AND COALESCE(os.data_conclusao, os.data_servico) <= p_data_fim
    )
    SELECT 
        COALESCE(SUM(valor_bruto) FILTER (WHERE categoria = 'peca'), 0),
        COALESCE(SUM(valor_bruto) FILTER (WHERE categoria = 'servico'), 0),
        COALESCE(SUM(valor_bruto) FILTER (WHERE categoria = 'nao_classificado'), 0),
        COALESCE(SUM(custo_total), 0),
        COUNT(*) FILTER (WHERE estoque_id IS NULL),
        COUNT(*) FILTER (WHERE estoque_id IS NULL AND (custo_unitario IS NULL OR custo_unitario = 0)),
        COALESCE(SUM(valor_bruto) FILTER (WHERE estoque_id IS NULL AND (custo_unitario IS NULL OR custo_unitario = 0)), 0)
    INTO 
        v_valor_pecas_bruto, v_valor_servicos_bruto, v_valor_nao_classificado_bruto, 
        v_custo_pecas, v_total_itens_livres, v_total_itens_livres_sem_custo, v_valor_itens_livres_sem_custo
    FROM itens_classificados;

    -- 4. FINANCEIRO (CAIXA)
    SELECT 
        COALESCE(SUM(CASE WHEN f.tipo = 'entrada' THEN f.valor ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN f.tipo = 'saida' THEN f.valor ELSE 0 END), 0)
    INTO v_recebimentos, v_saidas_caixa
    FROM financeiro f
    WHERE f.oficina_id = p_oficina_id AND f.data >= p_data_inicio AND f.data <= p_data_fim;

    -- 5. AUDITORIA: Divergências e Pagamentos Parciais
    SELECT 
        COUNT(*) FILTER (WHERE (os.valor_total - os.desconto) > (SELECT COALESCE(SUM(f.valor), 0) FROM financeiro f WHERE f.ordem_servico_id = os.id AND f.tipo = 'entrada')),
        COUNT(*) FILTER (WHERE (SELECT COALESCE(SUM(f.valor), 0) FROM financeiro f WHERE f.ordem_servico_id = os.id AND f.tipo = 'entrada') > 0 AND (SELECT COALESCE(SUM(f.valor), 0) FROM financeiro f WHERE f.ordem_servico_id = os.id AND f.tipo = 'entrada') < (os.valor_total - os.desconto))
    INTO v_os_com_divergencia, v_pagamentos_parciais_os
    FROM ordens_servico os
    WHERE os.oficina_id = p_oficina_id AND os.status = 'finalizado'
      AND COALESCE(os.data_conclusao, os.data_servico) >= p_data_inicio
      AND COALESCE(os.data_conclusao, os.data_servico) <= p_data_fim;

    -- Cálculos Finais e Fechamento
    v_valor_pecas_bruto := v_valor_pecas_bruto + v_vendas_balcao_total;
    v_custo_pecas := v_custo_pecas + v_vendas_balcao_custo;
    v_faturamento_bruto := v_valor_pecas_bruto + v_valor_servicos_bruto + v_valor_nao_classificado_bruto;
    v_faturamento_liquido := v_faturamento_bruto - v_total_descontos;
    
    IF v_faturamento_bruto > 0 THEN
        v_valor_pecas_liquido := ROUND(v_valor_pecas_bruto - (v_valor_pecas_bruto / v_faturamento_bruto * v_total_descontos), 2);
        v_valor_servicos_liquido := ROUND(v_valor_servicos_bruto - (v_valor_servicos_bruto / v_faturamento_bruto * v_total_descontos), 2);
        v_valor_nao_classificado_liquido := ROUND(v_valor_nao_classificado_bruto - (v_valor_nao_classificado_bruto / v_faturamento_bruto * v_total_descontos), 2);
        v_diferenca_centavos := v_faturamento_liquido - (v_valor_pecas_liquido + v_valor_servicos_liquido + v_valor_nao_classificado_liquido);
        v_valor_pecas_liquido := v_valor_pecas_liquido + v_diferenca_centavos;
    END IF;

    v_lucro_caixa := v_recebimentos - v_saidas_caixa;
    v_lucro_operacional := v_faturamento_liquido - v_custo_pecas;
    v_saldo_a_receber := GREATEST(v_faturamento_liquido - v_recebimentos, 0);

    RETURN jsonb_build_object(
        'periodo', jsonb_build_object('inicio', p_data_inicio, 'fim', p_data_fim),
        'faturamento', jsonb_build_object('bruto', v_faturamento_bruto, 'descontos', v_total_descontos, 'liquido', v_faturamento_liquido),
        'categorias', jsonb_build_object(
            'pecas', jsonb_build_object('bruto', v_valor_pecas_bruto, 'liquido', v_valor_pecas_liquido),
            'servicos', jsonb_build_object('bruto', v_valor_servicos_bruto, 'liquido', v_valor_servicos_liquido),
            'nao_classificado', jsonb_build_object('bruto', v_valor_nao_classificado_bruto, 'liquido', v_valor_nao_classificado_liquido)
        ),
        'caixa', jsonb_build_object('recebimentos', v_recebimentos, 'saidas', v_saidas_caixa, 'lucro_caixa', v_lucro_caixa),
        'operacional', jsonb_build_object('custo_pecas', v_custo_pecas, 'lucro_operacional', v_lucro_operacional, 'saldo_a_receber', v_saldo_a_receber),
        'auditoria', jsonb_build_object(
            'total_itens_livres', v_total_itens_livres,
            'total_itens_livres_sem_custo', v_total_itens_livres_sem_custo,
            'valor_itens_livres_sem_custo', v_valor_itens_livres_sem_custo,
            'vendas_balcao_sem_custo', v_vendas_balcao_sem_custo,
            'os_com_divergencia', v_os_com_divergencia,
            'pagamentos_parciais', v_pagamentos_parciais_os,
            'alerta_lucro_inflado', (v_total_itens_livres_sem_custo > 0 OR v_vendas_balcao_sem_custo > 0)
        )
    );
END;
$$;