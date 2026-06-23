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
            os.numero,
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
            v.numero,
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
            -- Competência
            COALESCE((SELECT SUM(liq) FROM registros_os WHERE data_ref BETWEEN m.mes_inicio AND m.mes_fim), 0) + 
            COALESCE((SELECT SUM(liq) FROM registros_vendas WHERE data_ref BETWEEN m.mes_inicio AND m.mes_fim), 0) as faturamento_liq,
            
            COALESCE((SELECT SUM(recebido_vinculado) FROM registros_os WHERE data_ref BETWEEN m.mes_inicio AND m.mes_fim), 0) + 
            COALESCE((SELECT SUM(recebido_vinculado) FROM registros_vendas WHERE data_ref BETWEEN m.mes_inicio AND m.mes_fim), 0) as recebido_vinc,
            
            -- Custos & Resultado
            COALESCE((SELECT SUM(cmv) FROM registros_os WHERE data_ref BETWEEN m.mes_inicio AND m.mes_fim), 0) + 
            COALESCE((SELECT SUM(cmv) FROM registros_vendas WHERE data_ref BETWEEN m.mes_inicio AND m.mes_fim), 0) as cmv_tot,
            
            -- Caixa
            COALESCE((SELECT SUM(valor) FROM registros_caixa WHERE tipo = 'entrada' AND data_ref BETWEEN m.mes_inicio AND m.mes_fim), 0) as entradas_caixa,
            COALESCE((SELECT SUM(valor) FROM registros_caixa WHERE tipo = 'saida' AND data_ref BETWEEN m.mes_inicio AND m.mes_fim), 0) as saidas_caixa,
            
            -- Contadores
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
                'inicio', mes_inicio,
                'fim', mes_fim,
                'competencia', jsonb_build_object(
                    'faturamento_liquido', faturamento_liq,
                    'recebido_vinculado_competencia', recebido_vinc,
                    'saldo_a_receber_competencia', faturamento_liq - recebido_vinc
                ),
                'custos', jsonb_build_object(
                    'cmv_total', cmv_tot
                ),
                'resultado', jsonb_build_object(
                    'lucro_operacional', faturamento_liq - cmv_tot
                ),
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
        ), '[]'::jsonb),
        'auditoria', jsonb_build_object('avisos', ARRAY['V2 Série Histórica - Reconciliação Competência vs Caixa'])
    ) INTO v_resultado;

    RETURN v_resultado;
END;
$$;
