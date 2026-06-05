
DROP FUNCTION IF EXISTS public.get_metrics_financeiras_unificadas(uuid, date, date);

CREATE OR REPLACE FUNCTION public.get_metrics_financeiras_unificadas(
    p_oficina_id UUID,
    p_data_inicio DATE,
    p_data_fim DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    -- Verifica se o usuário autenticado tem vínculo com a oficina informada através da tabela profiles
    SELECT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = v_user_id 
        AND (oficina_id = p_oficina_id OR role IN ('admin', 'master'))
    ) INTO v_has_access;

    -- Se auth.uid() for nulo (chamada interna/admin/service_role), permitimos
    IF v_user_id IS NULL THEN
        v_has_access := TRUE;
    END IF;

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
        COUNT(*) FILTER (WHERE estoque_id IS NULL AND categoria = 'peca'),
        COUNT(*) FILTER (WHERE (custo_unitario IS NULL OR custo_unitario = 0) AND categoria = 'peca'),
        COALESCE(SUM(valor_bruto) FILTER (WHERE (custo_unitario IS NULL OR custo_unitario = 0) AND categoria = 'peca'), 0)
    INTO v_valor_pecas_bruto, v_valor_servicos_bruto, v_valor_nao_classificado_bruto, v_custo_pecas,
         v_total_itens_livres, v_total_itens_livres_sem_custo, v_valor_itens_livres_sem_custo
    FROM itens_classificados;

    -- 4. FINANCEIRO (Caixa)
    SELECT 
        COALESCE(SUM(valor) FILTER (WHERE tipo = 'entrada'), 0),
        COALESCE(SUM(valor) FILTER (WHERE tipo = 'saida'), 0)
    INTO v_recebimentos, v_saidas_caixa
    FROM movimentacoes_financeiras
    WHERE oficina_id = p_oficina_id
      AND DATE(data_movimentacao) >= p_data_inicio
      AND DATE(data_movimentacao) <= p_data_fim;

    -- 5. CÁLCULOS FINAIS
    v_faturamento_bruto := v_valor_pecas_bruto + v_valor_servicos_bruto + v_valor_nao_classificado_bruto + v_vendas_balcao_total;
    v_faturamento_liquido := v_faturamento_bruto - v_total_descontos;
    
    -- Rateio do desconto proporcional entre categorias
    IF v_faturamento_bruto > 0 THEN
        v_valor_pecas_liquido := v_valor_pecas_bruto - (v_total_descontos * (v_valor_pecas_bruto / v_faturamento_bruto));
        v_valor_servicos_liquido := v_valor_servicos_bruto - (v_total_descontos * (v_valor_servicos_bruto / v_faturamento_bruto));
        v_valor_nao_classificado_liquido := v_valor_nao_classificado_bruto - (v_total_descontos * (v_valor_nao_classificado_bruto / v_faturamento_bruto));
    ELSE
        v_valor_pecas_liquido := 0;
        v_valor_servicos_liquido := 0;
        v_valor_nao_classificado_liquido := 0;
    END IF;

    v_lucro_operacional := v_faturamento_liquido - v_custo_pecas - v_vendas_balcao_custo;
    v_lucro_caixa := v_recebimentos - v_saidas_caixa;
    v_saldo_a_receber := v_faturamento_liquido - v_recebimentos;
    
    -- 6. AUDITORIA DE FECHAMENTO
    v_diferenca_centavos := ABS(v_faturamento_liquido - (v_valor_pecas_liquido + v_valor_servicos_liquido + v_valor_nao_classificado_liquido + (v_vendas_balcao_total * (1 - (CASE WHEN v_faturamento_bruto > 0 THEN v_total_descontos/v_faturamento_bruto ELSE 0 END)))));

    RETURN json_build_object(
        'faturamento', json_build_object(
            'bruto', ROUND(v_faturamento_bruto, 2),
            'descontos', ROUND(v_total_descontos, 2),
            'liquido', ROUND(v_faturamento_liquido, 2)
        ),
        'categorias', json_build_object(
            'pecas', json_build_object('bruto', ROUND(v_valor_pecas_bruto, 2), 'liquido', ROUND(v_valor_pecas_liquido, 2), 'custo', ROUND(v_custo_pecas, 2)),
            'servicos', json_build_object('bruto', ROUND(v_valor_servicos_bruto, 2), 'liquido', ROUND(v_valor_servicos_liquido, 2)),
            'nao_classificado', json_build_object('bruto', ROUND(v_valor_nao_classificado_bruto, 2), 'liquido', ROUND(v_valor_nao_classificado_liquido, 2))
        ),
        'operacional', json_build_object(
            'lucro_operacional', ROUND(v_lucro_operacional, 2),
            'margem_operacional', CASE WHEN v_faturamento_liquido > 0 THEN ROUND((v_lucro_operacional / v_faturamento_liquido) * 100, 2) ELSE 0 END
        ),
        'caixa', json_build_object(
            'entradas', ROUND(v_recebimentos, 2),
            'saidas', ROUND(v_saidas_caixa, 2),
            'lucro_caixa', ROUND(v_lucro_caixa, 2)
        ),
        'vendas_balcao', json_build_object(
            'total', ROUND(v_vendas_balcao_total, 2),
            'custo', ROUND(v_vendas_balcao_custo, 2)
        ),
        'saldo_a_receber', ROUND(v_saldo_a_receber, 2),
        'auditoria', json_build_object(
            'total_itens_livres', v_total_itens_livres,
            'total_itens_livres_sem_custo', v_total_itens_livres_sem_custo,
            'valor_itens_livres_sem_custo', ROUND(v_valor_itens_livres_sem_custo, 2),
            'vendas_balcao_sem_custo', v_vendas_balcao_sem_custo,
            'diferenca_fechamento_centavos', ROUND(v_diferenca_centavos, 2)
        )
    );
END;
$$;
