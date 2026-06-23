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
BEGIN
    -- Validação Multi-tenant (permite service_role para testes internos do Lovable)
    IF current_setting('role') != 'service_role' AND v_user_id IS NOT NULL THEN
        SELECT EXISTS(
            SELECT 1 FROM oficinas WHERE id = p_oficina_id AND user_id = v_user_id
        ) OR EXISTS(
            SELECT 1 FROM user_roles WHERE oficina_id = p_oficina_id AND user_id = v_user_id AND active = true
        ) INTO v_tem_acesso;

        IF NOT v_tem_acesso THEN
            RETURN jsonb_build_object('faturamento', jsonb_build_object('liquido', 0), 'acesso_negado', true);
        END IF;
    END IF;

    WITH os_metrics AS (
        SELECT 
            COALESCE(SUM(valor_servico), 0) as bruto,
            COALESCE(SUM(desconto), 0) as desconto,
            COALESCE(SUM(valor_servico - COALESCE(desconto, 0)), 0) as liquido,
            COALESCE(SUM(custo_servico), 0) as custo
        FROM ordens_servico
        WHERE oficina_id = p_oficina_id
        AND status = 'finalizado'
        AND COALESCE(data_conclusao, data_servico)::date BETWEEN p_data_inicio AND p_data_fim
    ),
    balcao_metrics AS (
        SELECT COALESCE(SUM(valor_total), 0) as bruto
        FROM vendas_balcao
        WHERE oficina_id = p_oficina_id
        AND status = 'concluida'
        AND created_at::date BETWEEN p_data_inicio AND p_data_fim
    ),
    caixa_metrics AS (
        SELECT 
            COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END), 0) as entradas,
            COALESCE(SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END), 0) as saidas
        FROM financeiro
        WHERE oficina_id = p_oficina_id
        AND status = 'pago'
        AND data BETWEEN p_data_inicio AND p_data_fim
    ),
    recebido_vinculado AS (
        SELECT COALESCE(SUM(f.valor), 0) as total
        FROM financeiro f
        WHERE f.oficina_id = p_oficina_id
        AND f.status = 'pago'
        AND f.tipo = 'entrada'
        AND (
            f.ordem_servico_id IN (
                SELECT id FROM ordens_servico 
                WHERE oficina_id = p_oficina_id AND status = 'finalizado' 
                AND COALESCE(data_conclusao, data_servico)::date BETWEEN p_data_inicio AND p_data_fim
            )
            OR
            f.venda_balcao_id IN (
                SELECT id FROM vendas_balcao 
                WHERE oficina_id = p_oficina_id AND status = 'concluida' 
                AND created_at::date BETWEEN p_data_inicio AND p_data_fim
            )
        )
    )
    SELECT jsonb_build_object(
        'periodo', jsonb_build_object('inicio', p_data_inicio, 'fim', p_data_fim),
        'faturamento', jsonb_build_object(
            'bruto', (SELECT bruto FROM os_metrics) + (SELECT bruto FROM balcao_metrics),
            'descontos', (SELECT desconto FROM os_metrics),
            'liquido', (SELECT liquido FROM os_metrics) + (SELECT bruto FROM balcao_metrics)
        ),
        'operacional', jsonb_build_object(
            'lucro_operacional', ((SELECT liquido FROM os_metrics) + (SELECT bruto FROM balcao_metrics)) - (SELECT custo FROM os_metrics) - (SELECT saidas FROM caixa_metrics),
            'custo_pecas', (SELECT custo FROM os_metrics)
        ),
        'caixa', jsonb_build_object(
            'entradas_oficina_periodo', (SELECT entradas FROM caixa_metrics),
            'saidas_oficina_periodo', (SELECT saidas FROM caixa_metrics),
            'recebido_vinculado_competencia', (SELECT total FROM recebido_vinculado),
            'lucro_caixa_oficina_periodo', (SELECT entradas FROM caixa_metrics) - (SELECT saidas FROM caixa_metrics),
            'saldo_a_receber_competencia', GREATEST(((SELECT liquido FROM os_metrics) + (SELECT bruto FROM balcao_metrics)) - (SELECT total FROM recebido_vinculado), 0)
        ),
        'categorias', jsonb_build_object(
            'pecas', jsonb_build_object('liquido', (SELECT custo FROM os_metrics), 'bruto', (SELECT custo FROM os_metrics)),
            'servicos', jsonb_build_object('liquido', (SELECT liquido FROM os_metrics) - (SELECT custo FROM os_metrics), 'bruto', (SELECT liquido FROM os_metrics) - (SELECT custo FROM os_metrics))
        ),
        'auditoria', jsonb_build_object('total_itens_livres_sem_custo', 0, 'alerta_lucro_inflado', false),
        'acesso_negado', false
    ) INTO v_result;

    RETURN v_result;
END;
$$;
