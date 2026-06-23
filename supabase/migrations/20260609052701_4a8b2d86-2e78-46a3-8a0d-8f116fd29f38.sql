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
            id,
            numero,
            'OS' as tipo,
            status,
            valor_servico,
            (SELECT COALESCE(SUM(COALESCE(valor_total, 0)), 0) FROM itens_os WHERE ordem_servico_id = ordens_servico.id) as valor_itens,
            COALESCE(desconto, 0) as desconto,
            (SELECT COALESCE(SUM(COALESCE(custo_unitario, 0) * quantidade), 0) FROM itens_os WHERE ordem_servico_id = ordens_servico.id) as cmv,
            data_conclusao as data_referencia,
            (numero >= 1396) as is_teste
        FROM ordens_servico
        WHERE oficina_id = p_oficina_id
          AND status = 'finalizado'
          AND data_conclusao::DATE BETWEEN p_data_inicio AND p_data_fim
    ),
    registros_vendas AS (
        SELECT 
            id,
            numero,
            'Venda' as tipo,
            status,
            valor_total as valor_bruto,
            0 as desconto,
            (SELECT COALESCE(SUM(COALESCE(custo_unitario, 0) * quantidade), 0) FROM itens_venda_balcao WHERE venda_id = vendas_balcao.id) as cmv,
            created_at as data_referencia,
            (numero = 36 OR numero = 22) as is_teste
        FROM vendas_balcao
        WHERE oficina_id = p_oficina_id
          AND status IN ('concluida', 'finalizada')
          AND created_at::DATE BETWEEN p_data_inicio AND p_data_fim
    ),
    registros_financeiro AS (
        SELECT 
            id,
            descricao,
            tipo,
            status::text as status_txt,
            valor,
            COALESCE(data_pagamento, data) as data_referencia
        FROM financeiro
        WHERE oficina_id = p_oficina_id
          AND COALESCE(data_pagamento, data)::DATE BETWEEN p_data_inicio AND p_data_fim
    ),
    os_sum AS (
        SELECT 
            COALESCE(SUM(valor_servico + valor_itens - desconto), 0) as liq,
            COALESCE(SUM(cmv), 0) as cmv_total,
            COUNT(*) as total
        FROM registros_os
    ),
    vendas_sum AS (
        SELECT 
            COALESCE(SUM(valor_bruto), 0) as liq,
            COALESCE(SUM(cmv), 0) as cmv_total,
            COUNT(*) as total
        FROM registros_vendas
    ),
    caixa_sum AS (
        SELECT 
            COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END), 0) as entradas,
            COALESCE(SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END), 0) as saídas
        FROM registros_financeiro
        WHERE status_txt = 'pago'
    )
    SELECT jsonb_build_object(
        'periodo', jsonb_build_object('inicio', p_data_inicio, 'fim', p_data_fim),
        'competencia', jsonb_build_object(
            'faturamento_liquido', (SELECT liq FROM os_sum) + (SELECT liq FROM vendas_sum),
            'os_liquido', (SELECT liq FROM os_sum),
            'vendas_balcao_liquido', (SELECT liq FROM vendas_sum),
            'saldo_a_receber', ((SELECT liq FROM os_sum) + (SELECT liq FROM vendas_sum)) - (SELECT entradas FROM caixa_sum WHERE entradas <= ((SELECT liq FROM os_sum) + (SELECT liq FROM vendas_sum)))
        ),
        'custos', jsonb_build_object(
            'cmv_total', (SELECT cmv_total FROM os_sum) + (SELECT cmv_total FROM vendas_sum)
        ),
        'resultado', jsonb_build_object(
            'lucro_operacional', ((SELECT liq FROM os_sum) + (SELECT liq FROM vendas_sum)) - ((SELECT cmv_total FROM os_sum) + (SELECT cmv_total FROM vendas_sum))
        ),
        'caixa', jsonb_build_object(
            'entradas_pagas', (SELECT entradas FROM caixa_sum),
            'saidas_pagas', (SELECT saídas FROM caixa_sum),
            'saldo_caixa', (SELECT entradas - saídas FROM caixa_sum)
        ),
        'contadores', jsonb_build_object(
            'servicos_finalizados', (SELECT total FROM os_sum),
            'vendas_balcao', (SELECT total FROM vendas_sum)
        ),
        'auditoria', jsonb_build_object(
            'registros_os', COALESCE((SELECT jsonb_agg(jsonb_build_object('numero', numero, 'valor', valor_servico + valor_itens - desconto, 'teste', is_teste)) FROM registros_os), '[]'::jsonb),
            'registros_vendas', COALESCE((SELECT jsonb_agg(jsonb_build_object('numero', numero, 'valor', valor_bruto, 'teste', is_teste)) FROM registros_vendas), '[]'::jsonb),
            'registros_financeiro', COALESCE((SELECT jsonb_agg(jsonb_build_object('desc', descricao, 'valor', valor, 'status', status_txt)) FROM registros_financeiro WHERE status_txt = 'pago'), '[]'::jsonb),
            'avisos', ARRAY['V2 em auditoria rigorosa']
        )
    ) INTO v_resultado;

    RETURN v_resultado;
END;
$$;
