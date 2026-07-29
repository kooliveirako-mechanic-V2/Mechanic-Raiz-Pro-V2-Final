CREATE OR REPLACE FUNCTION public.get_metrics_financeiras_unificadas(p_oficina_id uuid, p_data_inicio date DEFAULT (date_trunc('month'::text, now()))::date, p_data_fim date DEFAULT (date_trunc('month'::text, (now() + '1 mon'::interval)))::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_user_id UUID := auth.uid();
    v_is_admin BOOLEAN := false;
    v_tem_acesso BOOLEAN := false;
    v_result JSONB;
BEGIN
    -- 1. Tenant Validation
    IF current_setting('role') != 'service_role' AND v_user_id IS NOT NULL THEN
        -- Verificar se é admin global
        SELECT public.is_platform_admin(v_user_id) INTO v_is_admin;

        IF NOT v_is_admin THEN
            -- Se não for admin, verifica se é dono ou tem papel na oficina
            SELECT EXISTS(
                SELECT 1 FROM public.oficinas WHERE id = p_oficina_id AND user_id = v_user_id
            ) OR EXISTS(
                SELECT 1 FROM public.user_roles WHERE oficina_id = p_oficina_id AND user_id = v_user_id AND active = true
            ) INTO v_tem_acesso;

            IF NOT v_tem_acesso THEN
                RETURN jsonb_build_object(
                    'error', 'Acesso negado: Você não tem permissão para visualizar os dados desta oficina.',
                    'auditoria', jsonb_build_object('tenant_ok', false, 'user_id', v_user_id, 'oficina_id', p_oficina_id)
                );
            END IF;
        END IF;
    ELSEIF current_setting('role') != 'service_role' AND v_user_id IS NULL THEN
         RETURN jsonb_build_object(
                'error', 'Sessão inválida ou expirada. Por favor, faça login novamente.',
                'auditoria', jsonb_build_object('tenant_ok', false)
            );
    END IF;

    -- 2. Main Metrics Calculation (Restante do código original mantido)
    WITH os_base AS (
        SELECT 
            id,
            COALESCE(valor_servico, 0) as total,
            COALESCE(desconto, 0) as desconto,
            COALESCE(valor_servico, 0) - COALESCE(desconto, 0) as liquido
        FROM public.ordens_servico
        WHERE oficina_id = p_oficina_id
        AND status = 'finalizado'
        AND COALESCE(data_conclusao, data_servico)::date BETWEEN p_data_inicio AND p_data_fim
    ),
    os_items AS (
        SELECT 
            i.ordem_servico_id,
            i.tipo,
            SUM(COALESCE(i.valor_unitario * i.quantidade, 0)) as bruto,
            SUM(COALESCE(i.custo_unitario * i.quantidade, 0)) as custo,
            COUNT(*) FILTER (WHERE i.custo_unitario IS NULL OR i.custo_unitario = 0) as sem_custo
        FROM public.itens_os i
        JOIN os_base o ON o.id = i.ordem_servico_id
        GROUP BY i.ordem_servico_id, i.tipo
    ),
    balcao_base AS (
        SELECT 
            id,
            COALESCE(valor_total, 0) as total
        FROM public.vendas_balcao
        WHERE oficina_id = p_oficina_id
        AND status = 'concluida'
        AND created_at::date BETWEEN p_data_inicio AND p_data_fim
    ),
    balcao_items AS (
        SELECT 
            i.venda_id,
            SUM(COALESCE(i.valor_unitario * i.quantidade, 0)) as bruto,
            SUM(COALESCE(i.custo_unitario * i.quantidade, 0)) as custo,
            COUNT(*) FILTER (WHERE i.custo_unitario IS NULL OR i.custo_unitario = 0) as sem_custo
        FROM public.itens_venda_balcao i
        JOIN balcao_base b ON b.id = i.venda_id
        GROUP BY i.venda_id
    ),
    financeiro_base AS (
        SELECT 
            tipo,
            status,
            categoria,
            origem,
            COALESCE(valor, 0) as valor
        FROM public.financeiro
        WHERE oficina_id = p_oficina_id
        AND data BETWEEN p_data_inicio AND p_data_fim
    ),
    competencia_stats AS (
        SELECT
            (SELECT COALESCE(SUM(total), 0) FROM os_base) + (SELECT COALESCE(SUM(total), 0) FROM balcao_base) as faturamento_bruto,
            (SELECT COALESCE(SUM(desconto), 0) FROM os_base) as descontos,
            (SELECT COALESCE(SUM(liquido), 0) FROM os_base) + (SELECT COALESCE(SUM(total), 0) FROM balcao_base) as faturamento_liquido,
            (SELECT COALESCE(SUM(bruto), 0) FROM os_items WHERE tipo = 'peca') as pecas_bruto,
            (SELECT COALESCE(SUM(bruto), 0) FROM os_items WHERE tipo = 'servico') as servicos_bruto,
            (SELECT COALESCE(SUM(total), 0) FROM balcao_base) as vendas_balcao_bruto
    ),
    custos_stats AS (
        SELECT
            COALESCE(SUM(custo), 0) as cmv_os,
            (SELECT COALESCE(SUM(custo), 0) FROM balcao_items) as cmv_balcao,
            COALESCE(SUM(custo), 0) + (SELECT COALESCE(SUM(custo), 0) FROM balcao_items) as cmv_total
        FROM os_items
    ),
    perdas_stats AS (
        SELECT
            COALESCE(SUM(valor) FILTER (WHERE categoria = 'prejuizo'), 0) as total_perdas,
            COALESCE(SUM(valor) FILTER (WHERE categoria = 'prejuizo' AND origem ILIKE '%retrabalho%'), 0) as retrabalho,
            COALESCE(SUM(valor) FILTER (WHERE categoria = 'prejuizo' AND origem ILIKE '%garantia%'), 0) as garantia
        FROM financeiro_base
    ),
    caixa_stats AS (
        SELECT
            COALESCE(SUM(valor) FILTER (WHERE tipo = 'entrada' AND status = 'pago'), 0) as entradas_pagas,
            COALESCE(SUM(valor) FILTER (WHERE tipo = 'saida' AND status = 'pago'), 0) as saidas_pagas
        FROM financeiro_base
    ),
    despesas_fixas AS (
        SELECT
            COALESCE(SUM(valor), 0) as total
        FROM financeiro_base
        WHERE tipo = 'saida'
        AND status = 'pago'
        AND categoria NOT IN ('prejuizo', 'custo_mercadoria')
        AND (origem IS NULL OR (origem NOT ILIKE '%custo%' AND origem NOT ILIKE '%venda_balcao%'))
    )
    SELECT 
        jsonb_build_object(
            'periodo', jsonb_build_object('inicio', p_data_inicio, 'fim', p_data_fim),
            'oficina', jsonb_build_object('id', p_oficina_id),
            'competencia', jsonb_build_object(
                'faturamento_bruto', cs.faturamento_bruto,
                'descontos', cs.descontos,
                'faturamento_liquido', cs.faturamento_liquido,
                'os_bruto', (SELECT COALESCE(SUM(total), 0) FROM os_base),
                'vendas_balcao_bruto', cs.vendas_balcao_bruto,
                'pecas_bruto', cs.pecas_bruto,
                'servicos_bruto', cs.servicos_bruto,
                'saldo_a_receber', cs.faturamento_liquido - (
                    SELECT COALESCE(SUM(valor), 0) 
                    FROM public.financeiro 
                    WHERE oficina_id = p_oficina_id 
                    AND tipo = 'entrada' 
                    AND status = 'pago'
                    AND (ordem_servico_id IN (SELECT id FROM os_base) OR origem ILIKE '%venda_balcao%')
                )
            ),
            'custos', jsonb_build_object(
                'cmv_os', cst.cmv_os,
                'cmv_venda_balcao', cst.cmv_balcao,
                'cmv_total', cst.cmv_total
            ),
            'perdas_operacionais', jsonb_build_object(
                'prejuizos', ps.total_perdas,
                'retrabalho', ps.retrabalho,
                'garantia', ps.garantia,
                'total', ps.total_perdas
            ),
            'caixa', jsonb_build_object(
                'entradas_pagas', cx.entradas_pagas,
                'saidas_pagas', cx.saidas_pagas,
                'saldo_periodo', cx.entradas_pagas - cx.saidas_pagas,
                'lucro_caixa_oficina_periodo', cx.entradas_pagas - cx.saidas_pagas,
                'recebido_vinculado_competencia', (
                    SELECT COALESCE(SUM(valor), 0) 
                    FROM public.financeiro 
                    WHERE oficina_id = p_oficina_id 
                    AND tipo = 'entrada' 
                    AND status = 'pago'
                    AND (ordem_servico_id IN (SELECT id FROM os_base) OR origem ILIKE '%venda_balcao%')
                ),
                'saidas_oficina_periodo', cx.saidas_pagas
            ),
            'operacional', jsonb_build_object(
                'lucro_bruto', cs.faturamento_liquido - cst.cmv_total,
                'lucro_operacional', cs.faturamento_liquido - cst.cmv_total - df.total - ps.total_perdas,
                'margem_contribuicao', CASE WHEN cs.faturamento_liquido > 0 THEN ((cs.faturamento_liquido - cst.cmv_total) / cs.faturamento_liquido) * 100 ELSE 0 END,
                'despesas_fixas', df.total,
                'custo_pecas', cst.cmv_total
            ),
            'auditoria', jsonb_build_object(
                'tenant_ok', true,
                'is_admin', v_is_admin,
                'total_itens_livres_sem_custo', (SELECT COALESCE(SUM(sem_custo), 0) FROM os_items) + (SELECT COALESCE(SUM(sem_custo), 0) FROM balcao_items),
                'alerta_lucro_inflado', (SELECT EXISTS (SELECT 1 FROM os_items WHERE sem_custo > 0) OR EXISTS (SELECT 1 FROM balcao_items WHERE sem_custo > 0))
            )
        )
    INTO v_result
    FROM competencia_stats cs, custos_stats cst, perdas_stats ps, caixa_stats cx, despesas_fixas df;

    RETURN v_result;
END;
$function$
