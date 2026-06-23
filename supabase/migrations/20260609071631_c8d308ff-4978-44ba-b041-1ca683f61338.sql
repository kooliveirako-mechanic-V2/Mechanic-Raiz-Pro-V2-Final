CREATE OR REPLACE FUNCTION public.get_financeiro_v2_preview_limpeza(
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
    v_ids_os_teste UUID[] := ARRAY[
        'afc9088f-a05e-48c7-875b-185d373bbd1d', 
        '40dff110-b259-4e3b-b8f5-319acd7934b2', 
        'bc2bf6c9-7856-425f-aaae-00d5fe78c857', 
        'a178eb4b-385d-49e3-a1cc-2e3da1a6cc4d'
    ];
    v_ids_vendas_teste UUID[] := ARRAY[
        '75fbd0e2-b530-4390-9d74-d7ab08b3616f'
    ];
    v_ids_financeiro_teste UUID[] := ARRAY[
        'fdbaa996-b3ea-4ba5-99dc-7603eb35fe57', 
        'f4e359a6-b196-442f-af5d-c359418459d6', 
        'f4a7f8f2-e329-4b4e-8ced-7bc341291f00', 
        '2cd61a66-a8db-48f5-99ed-e1e9478fc0f3', 
        '6d4be852-9d43-458e-a9ce-5af720e8e5d1'
    ];
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
            COALESCE((SELECT SUM(f.valor) FROM financeiro f WHERE f.ordem_servico_id = os.id AND f.status::text = 'pago' AND f.tipo = 'entrada' AND NOT (f.id = ANY(v_ids_financeiro_teste))), 0) as recebido_vinculado
        FROM ordens_servico os
        WHERE os.oficina_id = p_oficina_id AND os.status = 'finalizado'
          AND os.data_conclusao::DATE BETWEEN p_data_inicio AND p_data_fim
          AND NOT (os.id = ANY(v_ids_os_teste))
    ),
    registros_vendas AS (
        SELECT 
            v.id,
            v.numero,
            v.status,
            COALESCE(v.valor_total, 0) as valor_bruto,
            COALESCE((SELECT SUM(COALESCE(it.custo_unitario, 0) * it.quantidade) FROM itens_venda_balcao it WHERE it.venda_id = v.id), 0) as cmv_calc,
            v.created_at,
            COALESCE((SELECT SUM(f.valor) FROM financeiro f WHERE f.venda_balcao_id = v.id AND f.status::text = 'pago' AND f.tipo = 'entrada' AND NOT (f.id = ANY(v_ids_financeiro_teste))), 0) as recebido_vinculado
        FROM vendas_balcao v
        WHERE v.oficina_id = p_oficina_id AND v.status IN ('concluida', 'finalizada')
          AND v.created_at::DATE BETWEEN p_data_inicio AND p_data_fim
          AND NOT (v.id = ANY(v_ids_vendas_teste))
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
          AND NOT (id = ANY(v_ids_financeiro_teste))
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
    ),
    auditoria_ignorados AS (
        -- OS ignoradas
        SELECT 
            'OS' as tipo, 
            os.numero::int, 
            os.id, 
            (os.valor_servico + (SELECT SUM(COALESCE(it.valor_total, 0)) FROM itens_os it WHERE it.ordem_servico_id = os.id) - COALESCE(os.desconto, 0)) as valor_liquido, 
            (SELECT SUM(COALESCE(it.custo_unitario, 0) * it.quantidade) FROM itens_os it WHERE it.ordem_servico_id = os.id) as cmv, 
            ((os.valor_servico + (SELECT SUM(COALESCE(it.valor_total, 0)) FROM itens_os it WHERE it.ordem_servico_id = os.id) - COALESCE(os.desconto, 0)) - (SELECT SUM(COALESCE(it.custo_unitario, 0) * it.quantidade) FROM itens_os it WHERE it.ordem_servico_id = os.id)) as lucro,
            EXISTS(SELECT 1 FROM financeiro f WHERE f.ordem_servico_id = os.id AND f.status::text = 'pago') as pago,
            COALESCE((SELECT SUM(f.valor) FROM financeiro f WHERE f.ordem_servico_id = os.id AND f.status::text = 'pago' AND f.id = ANY(v_ids_financeiro_teste)), 0) as caixa_ignorado,
            ((os.valor_servico + (SELECT SUM(COALESCE(it.valor_total, 0)) FROM itens_os it WHERE it.ordem_servico_id = os.id) - COALESCE(os.desconto, 0)) - COALESCE((SELECT SUM(f.valor) FROM financeiro f WHERE f.ordem_servico_id = os.id AND f.status::text = 'pago' AND f.id = ANY(v_ids_financeiro_teste)), 0)) as saldo_a_receber_ignorado,
            'teste manifesto' as motivo
        FROM ordens_servico os WHERE os.id = ANY(v_ids_os_teste)
        UNION ALL
        -- Vendas ignoradas
        SELECT 
            'Venda' as tipo, 
            v.numero::int, 
            v.id, 
            v.valor_total as valor_liquido, 
            (SELECT SUM(COALESCE(it.custo_unitario, 0) * it.quantidade) FROM itens_venda_balcao it WHERE it.venda_id = v.id) as cmv, 
            (v.valor_total - (SELECT SUM(COALESCE(it.custo_unitario, 0) * it.quantidade) FROM itens_venda_balcao it WHERE it.venda_id = v.id)) as lucro,
            EXISTS(SELECT 1 FROM financeiro f WHERE f.venda_balcao_id = v.id AND f.status::text = 'pago') as pago,
            COALESCE((SELECT SUM(f.valor) FROM financeiro f WHERE f.venda_balcao_id = v.id AND f.status::text = 'pago' AND f.id = ANY(v_ids_financeiro_teste)), 0) as caixa_ignorado,
            (v.valor_total - COALESCE((SELECT SUM(f.valor) FROM financeiro f WHERE f.venda_balcao_id = v.id AND f.status::text = 'pago' AND f.id = ANY(v_ids_financeiro_teste)), 0)) as saldo_a_receber_ignorado,
            'teste manifesto' as motivo
        FROM vendas_balcao v WHERE v.id = ANY(v_ids_vendas_teste)
    )
    SELECT jsonb_build_object(
        'modo', 'preview_limpeza_logica',
        'dados_alterados', false,
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
            'registros_ignorados_por_manifesto', (SELECT jsonb_agg(to_jsonb(t) ORDER BY t.tipo DESC, t.numero) FROM auditoria_ignorados t),
            'avisos', ARRAY['Estoque não ajustado fisicamente. Venda #36 não possui movimentação rastreável. Ajuste físico bloqueado até prova objetiva.']
        )
    ) INTO v_resultado;

    RETURN v_resultado;
END;
$$;