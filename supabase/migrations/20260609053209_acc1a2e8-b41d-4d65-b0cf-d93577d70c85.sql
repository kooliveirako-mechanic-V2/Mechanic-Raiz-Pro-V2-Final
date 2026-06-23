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
            status,
            COALESCE(valor_servico, 0) as valor_servico,
            COALESCE((SELECT SUM(COALESCE(valor_total, 0)) FROM itens_os WHERE ordem_servico_id = ordens_servico.id), 0) as valor_itens,
            COALESCE(desconto, 0) as desconto,
            COALESCE((SELECT SUM(COALESCE(custo_unitario, 0) * quantidade) FROM itens_os WHERE ordem_servico_id = ordens_servico.id), 0) as cmv_calc,
            data_conclusao,
            -- CRITÉRIO OBJETIVO DE TESTE
            (numero >= 1396 OR descricao ILIKE '%TESTE%' OR observacoes_conclusao ILIKE '%TESTE%') as is_teste,
            CASE 
                WHEN numero >= 1396 THEN 'Número de OS de teste'
                WHEN descricao ILIKE '%TESTE%' THEN 'Descrição contém TESTE'
                ELSE 'Não marcado'
            END as criterio_teste
        FROM ordens_servico
        WHERE oficina_id = p_oficina_id
          AND status = 'finalizado'
          AND data_conclusao::DATE BETWEEN p_data_inicio AND p_data_fim
    ),
    registros_vendas AS (
        SELECT 
            id,
            numero,
            status,
            COALESCE(valor_total, 0) as valor_bruto,
            0 as desconto, -- Vendas balcão não possuem campo desconto direto
            COALESCE((SELECT SUM(COALESCE(custo_unitario, 0) * quantidade) FROM itens_venda_balcao WHERE venda_id = vendas_balcao.id), 0) as cmv_calc,
            created_at,
            -- CRITÉRIO OBJETIVO DE TESTE
            (observacao ILIKE '%TESTE%' OR numero = 36) as is_teste,
            CASE 
                WHEN numero = 36 THEN 'Número de venda de teste'
                WHEN observacao ILIKE '%TESTE%' THEN 'Observação contém TESTE'
                ELSE 'Não marcado'
            END as criterio_teste
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
    caixa_sum AS (
        SELECT 
            COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END), 0) as entradas,
            COALESCE(SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END), 0) as saídas
        FROM registros_financeiro
        WHERE status_txt = 'pago'
    ),
    os_totals AS (
        SELECT 
            SUM(valor_servico + valor_itens) as bruto,
            SUM(desconto) as desc_total,
            SUM(valor_servico + valor_itens - desconto) as liq,
            SUM(cmv_calc) as cmv,
            COUNT(*) as qtd
        FROM registros_os
    ),
    venda_totals AS (
        SELECT 
            SUM(valor_bruto) as bruto,
            0 as desc_total,
            SUM(valor_bruto) as liq,
            SUM(cmv_calc) as cmv,
            COUNT(*) as qtd
        FROM registros_vendas
    )
    SELECT jsonb_build_object(
        'periodo', jsonb_build_object('inicio', p_data_inicio, 'fim', p_data_fim),
        'oficina', jsonb_build_object('id', p_oficina_id, 'nome', v_oficina_nome),
        'competencia', jsonb_build_object(
            'faturamento_bruto', COALESCE((SELECT bruto FROM os_totals), 0) + COALESCE((SELECT bruto FROM venda_totals), 0),
            'descontos', COALESCE((SELECT desc_total FROM os_totals), 0) + COALESCE((SELECT desc_total FROM venda_totals), 0),
            'faturamento_liquido', COALESCE((SELECT liq FROM os_totals), 0) + COALESCE((SELECT liq FROM venda_totals), 0),
            'os_liquido', COALESCE((SELECT liq FROM os_totals), 0),
            'vendas_balcao_liquido', COALESCE((SELECT liq FROM venda_totals), 0),
            'saldo_a_receber', (COALESCE((SELECT liq FROM os_totals), 0) + COALESCE((SELECT liq FROM venda_totals), 0)) - (SELECT entradas FROM caixa_sum)
        ),
        'custos', jsonb_build_object(
            'cmv_total', COALESCE((SELECT cmv FROM os_totals), 0) + COALESCE((SELECT cmv FROM venda_totals), 0)
        ),
        'resultado', jsonb_build_object(
            'lucro_operacional', (COALESCE((SELECT liq FROM os_totals), 0) + COALESCE((SELECT liq FROM venda_totals), 0)) - (COALESCE((SELECT cmv FROM os_totals), 0) + COALESCE((SELECT cmv FROM venda_totals), 0)),
            'despesas_fixas', 0,
            'resultado_gerencial', (COALESCE((SELECT liq FROM os_totals), 0) + COALESCE((SELECT liq FROM venda_totals), 0)) - (COALESCE((SELECT cmv FROM os_totals), 0) + COALESCE((SELECT cmv FROM venda_totals), 0))
        ),
        'caixa', jsonb_build_object(
            'entradas_pagas', (SELECT entradas FROM caixa_sum),
            'saidas_pagas', (SELECT saídas FROM caixa_sum),
            'saldo_caixa', (SELECT entradas - saídas FROM caixa_sum)
        ),
        'contadores', jsonb_build_object(
            'servicos_finalizados', COALESCE((SELECT qtd FROM os_totals), 0),
            'vendas_balcao', COALESCE((SELECT qtd FROM venda_totals), 0),
            'clientes', (SELECT COUNT(DISTINCT cliente_id) FROM ordens_servico WHERE oficina_id = p_oficina_id AND status = 'finalizado')
        ),
        'auditoria', jsonb_build_object(
            'registros_os', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'id', id,
                'numero', numero,
                'status', status,
                'valor_bruto', valor_servico + valor_itens,
                'desconto', desconto,
                'valor_liquido', valor_servico + valor_itens - desconto,
                'cmv', cmv_calc,
                'lucro', (valor_servico + valor_itens - desconto) - cmv_calc,
                'data_competencia_usada', data_conclusao,
                'campo_data_usado', 'data_conclusao',
                'is_teste', is_teste,
                'criterio_teste', criterio_teste,
                'incluido_no_faturamento', true
            )) FROM registros_os), '[]'::jsonb),
            'registros_vendas', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'id', id,
                'numero', numero,
                'status', status,
                'valor_bruto', valor_bruto,
                'desconto', 0,
                'valor_liquido', valor_bruto,
                'cmv', cmv_calc,
                'lucro', valor_bruto - cmv_calc,
                'data_competencia_usada', created_at,
                'campo_data_usado', 'created_at',
                'is_teste', is_teste,
                'criterio_teste', criterio_teste,
                'incluido_no_faturamento', true
            )) FROM registros_vendas), '[]'::jsonb),
            'registros_financeiro', COALESCE((SELECT jsonb_agg(jsonb_build_object('desc', descricao, 'valor', valor, 'status', status_txt)) FROM registros_financeiro WHERE status_txt = 'pago'), '[]'::jsonb),
            'avisos', ARRAY['V2 em auditoria rigorosa - Portão 0']
        )
    ) INTO v_resultado;

    RETURN v_resultado;
END;
$$;
