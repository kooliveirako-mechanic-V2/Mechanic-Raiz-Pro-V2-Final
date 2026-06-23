-- 1. Refatorar RPC Principal V2
CREATE OR REPLACE FUNCTION public.get_financeiro_v2(
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
    v_resultado JSONB;
    v_oficina_nome TEXT;
BEGIN
    SELECT nome INTO v_oficina_nome FROM oficinas WHERE id = p_oficina_id;

    WITH registros_os AS (
        SELECT 
            os.id,
            os.numero,
            os.status,
            COALESCE(os.valor_servico, 0) as valor_servico,
            COALESCE((SELECT SUM(COALESCE(it.valor_total, 0)) FROM itens_os it WHERE it.ordem_servico_id = os.id), 0) as valor_itens,
            COALESCE(os.desconto, 0) as desconto,
            COALESCE((SELECT SUM(COALESCE(it.custo_unitario, 0) * it.quantidade) FROM itens_os it WHERE it.ordem_servico_id = os.id), 0) as cmv_calc,
            os.data_conclusao,
            COALESCE((SELECT SUM(f.valor) FROM financeiro f WHERE f.ordem_servico_id = os.id AND f.status::text = 'pago' AND f.tipo = 'entrada'), 0) as recebido_vinculado
        FROM ordens_servico os
        WHERE os.oficina_id = p_oficina_id AND os.status = 'finalizado'
          AND os.data_conclusao::DATE BETWEEN p_data_inicio AND p_data_fim
    ),
    registros_vendas AS (
        SELECT 
            v.id,
            v.numero,
            v.status,
            COALESCE(v.valor_total, 0) as valor_bruto,
            COALESCE((SELECT SUM(COALESCE(it.custo_unitario, 0) * it.quantidade) FROM itens_venda_balcao it WHERE it.venda_id = v.id), 0) as cmv_calc,
            v.created_at,
            COALESCE((SELECT SUM(f.valor) FROM financeiro f WHERE f.venda_balcao_id = v.id AND f.status::text = 'pago' AND f.tipo = 'entrada'), 0) as recebido_vinculado
        FROM vendas_balcao v
        WHERE v.oficina_id = p_oficina_id AND v.status IN ('concluida', 'finalizada')
          AND v.created_at::DATE BETWEEN p_data_inicio AND p_data_fim
    ),
    registros_financeiro_raw AS (
        SELECT 
            id,
            descricao,
            tipo,
            status::text as status_txt,
            valor,
            COALESCE(data_pagamento, data) as data_referencia,
            ordem_servico_id,
            venda_balcao_id,
            origem
        FROM financeiro
        WHERE oficina_id = p_oficina_id
          AND COALESCE(data_pagamento, data)::DATE BETWEEN p_data_inicio AND p_data_fim
    ),
    caixa_sum AS (
        SELECT 
            COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END), 0) as entradas,
            COALESCE(SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END), 0) as saídas
        FROM registros_financeiro_raw
        WHERE status_txt = 'pago'
    ),
    os_totals AS (
        SELECT 
            SUM(valor_servico + valor_itens - desconto) as liq,
            SUM(recebido_vinculado) as vinc,
            SUM(cmv_calc) as cmv,
            COUNT(*) as qtd
        FROM registros_os
    ),
    venda_totals AS (
        SELECT 
            SUM(valor_bruto) as liq,
            SUM(recebido_vinculado) as vinc,
            SUM(cmv_calc) as cmv,
            COUNT(*) as qtd
        FROM registros_vendas
    )
    SELECT jsonb_build_object(
        'periodo', jsonb_build_object('inicio', p_data_inicio, 'fim', p_data_fim),
        'oficina', jsonb_build_object('id', p_oficina_id, 'nome', v_oficina_nome),
        'competencia', jsonb_build_object(
            'faturamento_liquido', COALESCE((SELECT liq FROM os_totals), 0) + COALESCE((SELECT liq FROM venda_totals), 0),
            'recebido_vinculado_competencia', COALESCE((SELECT vinc FROM os_totals), 0) + COALESCE((SELECT vinc FROM venda_totals), 0),
            'saldo_a_receber_competencia', (COALESCE((SELECT liq FROM os_totals), 0) + COALESCE((SELECT liq FROM venda_totals), 0)) - (COALESCE((SELECT vinc FROM os_totals), 0) + COALESCE((SELECT vinc FROM venda_totals), 0))
        ),
        'custos', jsonb_build_object(
            'cmv_total', COALESCE((SELECT cmv FROM os_totals), 0) + COALESCE((SELECT cmv FROM venda_totals), 0)
        ),
        'resultado', jsonb_build_object(
            'lucro_operacional', (COALESCE((SELECT liq FROM os_totals), 0) + COALESCE((SELECT liq FROM venda_totals), 0)) - (COALESCE((SELECT cmv FROM os_totals), 0) + COALESCE((SELECT cmv FROM venda_totals), 0))
        ),
        'caixa', jsonb_build_object(
            'entradas_pagas_no_periodo', (SELECT entradas FROM caixa_sum),
            'saidas_pagas_no_periodo', (SELECT saídas FROM caixa_sum),
            'saldo_caixa_periodo', (SELECT entradas - saídas FROM caixa_sum)
        ),
        'contadores', jsonb_build_object(
            'servicos_finalizados', COALESCE((SELECT qtd FROM os_totals), 0),
            'vendas_balcao', COALESCE((SELECT qtd FROM venda_totals), 0)
        ),
        'auditoria', jsonb_build_object(
            'avisos', ARRAY['V2 Contrato Alinhado']
        )
    ) INTO v_resultado;

    RETURN v_resultado;
END;
$$;

-- 2. Refatorar RPC de Série (Garantir Contrato Idêntico)
CREATE OR REPLACE FUNCTION public.get_financeiro_v2_series(
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
    v_resultado JSONB;
    v_oficina_nome TEXT;
BEGIN
    SELECT nome INTO v_oficina_nome FROM oficinas WHERE id = p_oficina_id;

    WITH meses AS (
        SELECT 
            date_trunc('month', d)::date as mes_inicio,
            (date_trunc('month', d) + interval '1 month' - interval '1 day')::date as mes_fim,
            to_char(d, 'YYYY-MM') as mes_rotulo
        FROM generate_series(
            date_trunc('month', p_data_inicio),
            date_trunc('month', p_data_fim),
            '1 month'::interval
        ) d
    ),
    registros_os AS (
        SELECT 
            os.id,
            os.data_conclusao as data_ref,
            (os.valor_servico + (SELECT COALESCE(SUM(it.valor_total), 0) FROM itens_os it WHERE it.ordem_servico_id = os.id) - COALESCE(os.desconto, 0)) as liq,
            (SELECT COALESCE(SUM(it.custo_unitario * it.quantidade), 0) FROM itens_os it WHERE it.ordem_servico_id = os.id) as cmv,
            COALESCE((SELECT SUM(f.valor) FROM financeiro f WHERE f.ordem_servico_id = os.id AND f.status::text = 'pago' AND f.tipo = 'entrada'), 0) as recebido_vinculado
        FROM ordens_servico os
        WHERE os.oficina_id = p_oficina_id AND os.status = 'finalizado'
          AND os.data_conclusao::DATE BETWEEN p_data_inicio AND p_data_fim
    ),
    registros_vendas AS (
        SELECT 
            v.id,
            v.created_at::date as data_ref,
            v.valor_total as liq,
            (SELECT COALESCE(SUM(it.custo_unitario * it.quantidade), 0) FROM itens_venda_balcao it WHERE it.venda_id = v.id) as cmv,
            COALESCE((SELECT SUM(f.valor) FROM financeiro f WHERE f.venda_balcao_id = v.id AND f.status::text = 'pago' AND f.tipo = 'entrada'), 0) as recebido_vinculado
        FROM vendas_balcao v
        WHERE v.oficina_id = p_oficina_id AND v.status IN ('concluida', 'finalizada')
          AND v.created_at::DATE BETWEEN p_data_inicio AND p_data_fim
    ),
    registros_caixa AS (
        SELECT 
            COALESCE(data_pagamento, data) as data_ref,
            valor,
            tipo
        FROM financeiro
        WHERE oficina_id = p_oficina_id AND status::text = 'pago'
          AND COALESCE(data_pagamento, data)::DATE BETWEEN p_data_inicio AND p_data_fim
    ),
    metricas_mensais AS (
        SELECT 
            m.mes_rotulo,
            m.mes_inicio,
            m.mes_fim,
            COALESCE((SELECT SUM(liq) FROM registros_os WHERE data_ref BETWEEN m.mes_inicio AND m.mes_fim), 0) + 
            COALESCE((SELECT SUM(liq) FROM registros_vendas WHERE data_ref BETWEEN m.mes_inicio AND m.mes_fim), 0) as faturamento_liq,
            COALESCE((SELECT SUM(recebido_vinculado) FROM registros_os WHERE data_ref BETWEEN m.mes_inicio AND m.mes_fim), 0) + 
            COALESCE((SELECT SUM(recebido_vinculado) FROM registros_vendas WHERE data_ref BETWEEN m.mes_inicio AND m.mes_fim), 0) as recebido_vinc,
            COALESCE((SELECT SUM(cmv) FROM registros_os WHERE data_ref BETWEEN m.mes_inicio AND m.mes_fim), 0) + 
            COALESCE((SELECT SUM(cmv) FROM registros_vendas WHERE data_ref BETWEEN m.mes_inicio AND m.mes_fim), 0) as cmv_tot,
            COALESCE((SELECT SUM(valor) FROM registros_caixa WHERE tipo = 'entrada' AND data_ref BETWEEN m.mes_inicio AND m.mes_fim), 0) as entradas_caixa,
            COALESCE((SELECT SUM(valor) FROM registros_caixa WHERE tipo = 'saida' AND data_ref BETWEEN m.mes_inicio AND m.mes_fim), 0) as saidas_caixa,
            COALESCE((SELECT COUNT(*) FROM registros_os WHERE data_ref BETWEEN m.mes_inicio AND m.mes_fim), 0) as os_qtd,
            COALESCE((SELECT COUNT(*) FROM registros_vendas WHERE data_ref BETWEEN m.mes_inicio AND m.mes_fim), 0) as vendas_qtd
        FROM meses m
    )
    SELECT jsonb_build_object(
        'periodo', jsonb_build_object('inicio', p_data_inicio, 'fim', p_data_fim),
        'oficina', jsonb_build_object('id', p_oficina_id, 'nome', v_oficina_nome),
        'series', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'mes', mes_rotulo,
                'competencia', jsonb_build_object(
                    'faturamento_liquido', faturamento_liq,
                    'recebido_vinculado_competencia', recebido_vinc,
                    'saldo_a_receber_competencia', faturamento_liq - recebido_vinc
                ),
                'custos', jsonb_build_object('cmv_total', cmv_tot),
                'resultado', jsonb_build_object('lucro_operacional', faturamento_liq - cmv_tot),
                'caixa', jsonb_build_object(
                    'entradas_pagas_no_periodo', entradas_caixa,
                    'saidas_pagas_no_periodo', saidas_caixa,
                    'saldo_caixa_periodo', entradas_caixa - saidas_caixa
                ),
                'contadores', jsonb_build_object(
                    'servicos_finalizados', os_qtd,
                    'vendas_balcao', vendas_qtd
                )
            ) ORDER BY mes_rotulo)
            FROM metricas_mensais
        ), '[]'::jsonb)
    ) INTO v_resultado;

    RETURN v_resultado;
END;
$$;
