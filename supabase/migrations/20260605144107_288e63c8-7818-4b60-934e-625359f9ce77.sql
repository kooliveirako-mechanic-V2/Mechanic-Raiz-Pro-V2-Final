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
    v_has_access BOOLEAN;
    v_user_id UUID := auth.uid();
    v_faturamento_bruto NUMERIC := 0;
    v_descontos NUMERIC := 0;
    v_faturamento_liquido NUMERIC := 0;
    v_custo_pecas NUMERIC := 0;
    v_lucro_operacional NUMERIC := 0;
    v_recebido_vinculado NUMERIC := 0;
    v_entradas_oficina NUMERIC := 0;
    v_saidas_oficina NUMERIC := 0;
    v_lucro_caixa_oficina NUMERIC := 0;
    v_saldo_a_receber NUMERIC := 0;
    v_total_itens_livres INTEGER := 0;
    v_total_itens_livres_sem_custo INTEGER := 0;
    v_valor_itens_livres_sem_custo NUMERIC := 0;
    v_vendas_balcao_sem_custo INTEGER := 0;
    v_os_com_divergencia INTEGER := 0;
    v_pagamentos_parciais INTEGER := 0;
    v_alerta_lucro_inflado BOOLEAN := FALSE;
BEGIN
    -- 1. VALIDAÇÃO DE SEGURANÇA MULTI-TENANT RIGOROSA
    -- Bloqueio total se não houver usuário autenticado
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.';
    END IF;

    -- Verifica se o usuário tem acesso à oficina ou é admin/master
    SELECT EXISTS (
        SELECT 1 
        FROM profiles 
        WHERE id = v_user_id 
        AND (
            oficina_id = p_oficina_id 
            OR role IN ('admin', 'master')
        )
    ) INTO v_has_access;

    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Acesso negado: Usuário não autorizado para esta oficina.';
    END IF;

    -- 2. CÁLCULOS DE COMPETÊNCIA (OS FINALIZADAS NO PERÍODO)
    SELECT 
        COALESCE(SUM(valor_servico), 0),
        COALESCE(SUM(desconto), 0),
        COALESCE(SUM(valor_servico - desconto), 0)
    INTO v_faturamento_bruto, v_descontos, v_faturamento_liquido
    FROM ordens_servico
    WHERE oficina_id = p_oficina_id
    AND status = 'finalizado'
    AND data_conclusao BETWEEN p_data_inicio AND p_data_fim;

    -- Custo de Peças das OS finalizadas
    SELECT COALESCE(SUM(io.quantidade * io.custo_unitario), 0)
    INTO v_custo_pecas
    FROM itens_os io
    JOIN ordens_servico os ON io.ordem_servico_id = os.id
    WHERE os.oficina_id = p_oficina_id
    AND os.status = 'finalizado'
    AND os.data_conclusao BETWEEN p_data_inicio AND p_data_fim
    AND io.tipo = 'produto';

    v_lucro_operacional := v_faturamento_liquido - v_custo_pecas;

    -- 3. CÁLCULOS DE CAIXA (MOVIMENTAÇÕES REAIS DA OFICINA NO PERÍODO)
    -- Entradas globais da oficina no período
    SELECT COALESCE(SUM(valor), 0)
    INTO v_entradas_oficina
    FROM financeiro
    WHERE oficina_id = p_oficina_id
    AND tipo = 'entrada'
    AND data BETWEEN p_data_inicio AND p_data_fim;

    -- Saídas globais da oficina no período
    SELECT COALESCE(SUM(valor), 0)
    INTO v_saidas_oficina
    FROM financeiro
    WHERE oficina_id = p_oficina_id
    AND tipo = 'saida'
    AND data BETWEEN p_data_inicio AND p_data_fim;

    v_lucro_caixa_oficina := v_entradas_oficina - v_saidas_oficina;

    -- Recebimentos VINCULADOS às OS de competência (quanto das OS desse mês já foi pago)
    SELECT COALESCE(SUM(f.valor), 0)
    INTO v_recebido_vinculado
    FROM financeiro f
    JOIN ordens_servico os ON f.ordem_servico_id = os.id
    WHERE os.oficina_id = p_oficina_id
    AND os.status = 'finalizado'
    AND os.data_conclusao BETWEEN p_data_inicio AND p_data_fim
    AND f.tipo = 'entrada';

    v_saldo_a_receber := v_faturamento_liquido - v_recebido_vinculado;

    -- 4. AUDITORIA E ALERTAS
    SELECT COUNT(*), COUNT(*) FILTER (WHERE custo_unitario = 0 OR custo_unitario IS NULL), COALESCE(SUM(quantidade * valor_unitario) FILTER (WHERE custo_unitario = 0 OR custo_unitario IS NULL), 0)
    INTO v_total_itens_livres, v_total_itens_livres_sem_custo, v_valor_itens_livres_sem_custo
    FROM itens_os io
    JOIN ordens_servico os ON io.ordem_servico_id = os.id
    WHERE os.oficina_id = p_oficina_id
    AND os.status = 'finalizado'
    AND os.data_conclusao BETWEEN p_data_inicio AND p_data_fim
    AND io.estoque_id IS NULL;

    IF v_total_itens_livres_sem_custo > 0 THEN
        v_alerta_lucro_inflado := TRUE;
    END IF;

    -- 5. RETORNO DO JSON UNIFICADO
    RETURN jsonb_build_object(
        'periodo', jsonb_build_object(
            'inicio', p_data_inicio,
            'fim', p_data_fim
        ),
        'faturamento', jsonb_build_object(
            'bruto', ROUND(v_faturamento_bruto, 2),
            'descontos', ROUND(v_descontos, 2),
            'liquido', ROUND(v_faturamento_liquido, 2)
        ),
        'categorias', jsonb_build_object(
            'servicos', jsonb_build_object('bruto', 0, 'liquido', 0), -- Placeholder para manter interface
            'pecas', jsonb_build_object('bruto', 0, 'liquido', 0)
        ),
        'caixa', jsonb_build_object(
            'entradas_oficina_periodo', ROUND(v_entradas_oficina, 2),
            'saidas_oficina_periodo', ROUND(v_saidas_oficina, 2),
            'lucro_caixa_oficina_periodo', ROUND(v_lucro_caixa_oficina, 2),
            'recebido_vinculado_competencia', ROUND(v_recebido_vinculado, 2),
            'saldo_a_receber_competencia', ROUND(v_saldo_a_receber, 2)
        ),
        'operacional', jsonb_build_object(
            'custo_pecas', ROUND(v_custo_pecas, 2),
            'lucro_operacional', ROUND(v_lucro_operacional, 2)
        ),
        'auditoria', jsonb_build_object(
            'total_itens_livres', v_total_itens_livres,
            'total_itens_livres_sem_custo', v_total_itens_livres_sem_custo,
            'valor_itens_livres_sem_custo', ROUND(v_valor_itens_livres_sem_custo, 2),
            'alerta_lucro_inflado', v_alerta_lucro_inflado
        )
    );
END;
$$;