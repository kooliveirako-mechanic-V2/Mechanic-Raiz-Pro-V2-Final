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
            COALESCE((SELECT SUM(f.valor) FROM financeiro f WHERE f.ordem_servico_id = os.id AND f.status::text = 'pago' AND f.tipo = 'entrada'), 0) as valor_pago_calc,
            (os.numero >= 1396 OR os.descricao ILIKE '%TESTE%') as is_teste,
            CASE 
                WHEN os.numero >= 1396 THEN 'Número de OS de teste'
                WHEN os.descricao ILIKE '%TESTE%' THEN 'Descrição contém TESTE'
                ELSE 'Não marcado'
            END as criterio_teste
        FROM ordens_servico os
        WHERE os.oficina_id = p_oficina_id
          AND os.status = 'finalizado'
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
            COALESCE((SELECT SUM(f.valor) FROM financeiro f WHERE f.venda_balcao_id = v.id AND f.status::text = 'pago' AND f.tipo = 'entrada'), 0) as valor_pago_calc,
            (v.observacao ILIKE '%TESTE%' OR v.numero = 36) as is_teste,
            CASE 
                WHEN v.numero = 36 THEN 'Número de venda de teste'
                WHEN v.observacao ILIKE '%TESTE%' THEN 'Observação contém TESTE'
                ELSE 'Não marcado'
            END as criterio_teste
        FROM vendas_balcao v
        WHERE v.oficina_id = p_oficina_id
          AND v.status IN ('concluida', 'finalizada')
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
    )
    SELECT jsonb_build_object(
        'periodo', jsonb_build_object('inicio', p_data_inicio, 'fim', p_data_fim),
        'oficina', jsonb_build_object('id', p_oficina_id, 'nome', v_oficina_nome),
        'competencia', jsonb_build_object(
            'faturamento_bruto', COALESCE((SELECT SUM(valor_servico + valor_itens) FROM registros_os), 0) + COALESCE((SELECT SUM(valor_bruto) FROM registros_vendas), 0),
            'descontos', COALESCE((SELECT SUM(desconto) FROM registros_os), 0),
            'faturamento_liquido', COALESCE((SELECT SUM(valor_servico + valor_itens - desconto) FROM registros_os), 0) + COALESCE((SELECT SUM(valor_bruto) FROM registros_vendas), 0),
            'os_liquido', COALESCE((SELECT SUM(valor_servico + valor_itens - desconto) FROM registros_os), 0),
            'vendas_balcao_liquido', COALESCE((SELECT SUM(valor_bruto) FROM registros_vendas), 0),
            'saldo_a_receber', (COALESCE((SELECT SUM(valor_servico + valor_itens - desconto) FROM registros_os), 0) + COALESCE((SELECT SUM(valor_bruto) FROM registros_vendas), 0)) - (SELECT entradas FROM caixa_sum)
        ),
        'custos', jsonb_build_object(
            'cmv_os', COALESCE((SELECT SUM(cmv_calc) FROM registros_os), 0),
            'cmv_vendas_balcao', COALESCE((SELECT SUM(cmv_calc) FROM registros_vendas), 0),
            'cmv_total', COALESCE((SELECT SUM(cmv_calc) FROM registros_os), 0) + COALESCE((SELECT SUM(cmv_calc) FROM registros_vendas), 0)
        ),
        'resultado', jsonb_build_object(
            'lucro_operacional', (COALESCE((SELECT SUM(valor_servico + valor_itens - desconto) FROM registros_os), 0) + COALESCE((SELECT SUM(valor_bruto) FROM registros_vendas), 0)) - (COALESCE((SELECT SUM(cmv_calc) FROM registros_os), 0) + COALESCE((SELECT SUM(cmv_calc) FROM registros_vendas), 0)),
            'despesas_fixas', 0,
            'resultado_gerencial', (COALESCE((SELECT SUM(valor_servico + valor_itens - desconto) FROM registros_os), 0) + COALESCE((SELECT SUM(valor_bruto) FROM registros_vendas), 0)) - (COALESCE((SELECT SUM(cmv_calc) FROM registros_os), 0) + COALESCE((SELECT SUM(cmv_calc) FROM registros_vendas), 0))
        ),
        'caixa', jsonb_build_object(
            'entradas_pagas', (SELECT entradas FROM caixa_sum),
            'saidas_pagas', (SELECT saídas FROM caixa_sum),
            'saldo_caixa', (SELECT entradas - saídas FROM caixa_sum)
        ),
        'contadores', jsonb_build_object(
            'servicos_finalizados', (SELECT COUNT(*) FROM registros_os),
            'vendas_balcao', (SELECT COUNT(*) FROM registros_vendas),
            'clientes', (SELECT COUNT(DISTINCT cliente_id) FROM ordens_servico WHERE oficina_id = p_oficina_id AND status = 'finalizado')
        ),
        'auditoria', jsonb_build_object(
            'registros_os', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'id', id,
                'numero', numero,
                'status', status,
                'valor_servico', valor_servico,
                'valor_itens', valor_itens,
                'desconto', desconto,
                'valor_liquido', valor_servico + valor_itens - desconto,
                'cmv', cmv_calc,
                'lucro', (valor_servico + valor_itens - desconto) - cmv_calc,
                'pago', (valor_pago_calc >= (valor_servico + valor_itens - desconto)),
                'valor_pago', valor_pago_calc,
                'saldo_a_receber', (valor_servico + valor_itens - desconto) - valor_pago_calc,
                'data_competencia_usada', data_conclusao,
                'campo_data_usado', 'data_conclusao',
                'incluido_no_faturamento', true,
                'incluido_no_caixa', (valor_pago_calc > 0),
                'is_teste', is_teste,
                'criterio_teste', criterio_teste
            ) ORDER BY numero) FROM registros_os), '[]'::jsonb),
            'registros_vendas', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'id', id,
                'numero', numero,
                'status', status,
                'valor_bruto', valor_bruto,
                'desconto', 0,
                'valor_liquido', valor_bruto,
                'cmv', cmv_calc,
                'lucro', valor_bruto - cmv_calc,
                'pago', (valor_pago_calc >= valor_bruto),
                'valor_pago', valor_pago_calc,
                'saldo_a_receber', valor_bruto - valor_pago_calc,
                'data_competencia_usada', created_at,
                'campo_data_usado', 'created_at',
                'incluido_no_faturamento', true,
                'incluido_no_caixa', (valor_pago_calc > 0),
                'is_teste', is_teste,
                'criterio_teste', criterio_teste
            ) ORDER BY numero) FROM registros_vendas), '[]'::jsonb),
            'registros_financeiro', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'id', id,
                'tipo', tipo,
                'status', status_txt,
                'valor', valor,
                'origem', origem,
                'ordem_servico_id', ordem_servico_id,
                'venda_balcao_id', venda_balcao_id,
                'data_pagamento', data_referencia,
                'incluido_no_caixa', (status_txt = 'pago'),
                'motivo', descricao
            )) FROM registros_financeiro_raw WHERE status_txt = 'pago'), '[]'::jsonb),
            'registros_com_data_invalida', '[]'::jsonb,
            'registros_cancelados', '[]'::jsonb,
            'avisos', ARRAY['V2 em auditoria rigorosa - Portão 0 Final']
        )
    ) INTO v_resultado;

    RETURN v_resultado;
END;
$$;
