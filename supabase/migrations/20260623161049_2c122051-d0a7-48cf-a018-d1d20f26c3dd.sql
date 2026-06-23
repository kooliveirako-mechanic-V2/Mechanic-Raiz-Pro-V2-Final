CREATE OR REPLACE FUNCTION public.get_pre_fiscal_unificado(p_oficina_id uuid, p_inicio date, p_fim date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_metrics JSONB;
    v_result JSONB;
BEGIN
    v_metrics := get_metrics_financeiras_unificadas(p_oficina_id, p_inicio, p_fim);
    IF v_metrics->>'error' IS NOT NULL THEN
        RETURN v_metrics;
    END IF;

    v_result := jsonb_build_object(
        'periodo', jsonb_build_object('inicio', p_inicio, 'fim', p_fim),
        'oficina', (SELECT jsonb_build_object('id', id, 'nome', nome) FROM oficinas WHERE id = p_oficina_id),
        'competencia', jsonb_build_object(
            'faturamentoBruto', (v_metrics->'faturamento'->>'bruto')::NUMERIC,
            'descontos', (v_metrics->'faturamento'->>'descontos')::NUMERIC,
            'faturamentoLiquido', (v_metrics->'faturamento'->>'liquido')::NUMERIC,
            'osFinalizadas', (SELECT COUNT(*) FROM ordens_servico WHERE oficina_id = p_oficina_id AND status = 'finalizado' AND COALESCE(data_conclusao, data_servico)::date BETWEEN p_inicio AND p_fim),
            'vendasBalcaoConcluidas', (SELECT COUNT(*) FROM vendas_balcao WHERE oficina_id = p_oficina_id AND status = 'concluida' AND created_at::date BETWEEN p_inicio AND p_fim),
            'pecasBruto', (v_metrics->'categorias'->'pecas'->>'bruto')::NUMERIC,
            'servicosBruto', (v_metrics->'categorias'->'servicos'->>'bruto')::NUMERIC,
            'vendaBalcaoBruto', (v_metrics->'faturamento'->>'venda_balcao_bruto')::NUMERIC,
            'saldoAReceber', (v_metrics->'caixa'->>'saldo_a_receber_competencia')::NUMERIC
        ),
        'custos', jsonb_build_object(
            'cmvOs', (v_metrics->'operacional'->>'custo_pecas')::NUMERIC,
            'cmvBalcao', (v_metrics->'operacional'->>'custo_balcao')::NUMERIC,
            'cmvTotal', (v_metrics->'operacional'->>'custo_total')::NUMERIC
        ),
        'perdas', jsonb_build_object(
            'total', (v_metrics->'operacional'->>'total_perdas')::NUMERIC,
            'retrabalho', (v_metrics->'operacional'->>'perdas_retrabalho')::NUMERIC,
            'garantia', (v_metrics->'operacional'->>'perdas_garantia')::NUMERIC,
            'sinistro', (v_metrics->'operacional'->>'perdas_sinistro')::NUMERIC,
            'prejuizo', (v_metrics->'operacional'->>'perdas_prejuizo')::NUMERIC
        ),
        'caixa', jsonb_build_object(
            'entradasPagas', (v_metrics->'caixa'->>'entradas_oficina_periodo')::NUMERIC,
            'saidasPagas', (v_metrics->'caixa'->>'saidas_oficina_periodo')::NUMERIC,
            'lucroCaixa', (v_metrics->'caixa'->>'lucro_caixa_oficina_periodo')::NUMERIC
        ),
        'despesas', jsonb_build_object(
            'fixas', (v_metrics->'operacional'->>'despesas_fixas')::NUMERIC,
            'variaveis', (v_metrics->'operacional'->>'despesas_variaveis')::NUMERIC,
            'comprasEstoque', (v_metrics->'operacional'->>'compras_estoque')::NUMERIC
        ),
        'resultado', jsonb_build_object(
            'lucroOperacional', (v_metrics->'operacional'->>'lucro_operacional')::NUMERIC,
            'resultadoLiquidoGerencial', (v_metrics->'operacional'->>'resultado_gerencial')::NUMERIC
        ),
        'alertas', jsonb_build_object(
            'itensSemCusto', (v_metrics->'auditoria'->>'total_itens_livres_sem_custo')::NUMERIC,
            'vendasSemCusto', (v_metrics->'auditoria'->>'vendas_balcao_sem_custo')::NUMERIC,
            'historicoComRessalva', (v_metrics->'auditoria'->>'alerta_lucro_inflado')::BOOLEAN,
            'categoriasNaoClassificadas', (SELECT COALESCE(jsonb_agg(DISTINCT categoria), '[]'::jsonb) FROM financeiro WHERE oficina_id = p_oficina_id AND (categoria IS NULL OR categoria = '') AND data BETWEEN p_inicio AND p_fim)
        ),
        'analitico', (
            SELECT COALESCE(jsonb_agg(row), '[]'::jsonb)
            FROM (
                SELECT
                    os.id::text,
                    COALESCE(os.data_conclusao, os.data_servico)::text as data_competencia,
                    NULL::text as data_pagamento,
                    'entrada'::text as tipo,
                    'OS'::text as origem,
                    'Serviços/Peças'::text as categoria,
                    'OS #' || os.numero::text || ' - ' || COALESCE(c.nome, 'Cliente não identificado') as descricao,
                    os.valor_servico as valor_bruto,
                    COALESCE(os.desconto, 0) as desconto,
                    (os.valor_servico - COALESCE(os.desconto, 0)) as valor_liquido,
                    os.status::text as status,
                    'OS'::text as classificacao,
                    os.numero::text as numero_documento
                FROM ordens_servico os
                LEFT JOIN clientes c ON c.id = os.cliente_id
                WHERE os.oficina_id = p_oficina_id AND os.status = 'finalizado'
                AND COALESCE(os.data_conclusao, os.data_servico)::date BETWEEN p_inicio AND p_fim

                UNION ALL

                SELECT
                    v.id::text,
                    v.created_at::text as data_competencia,
                    NULL::text as data_pagamento,
                    'entrada'::text as tipo,
                    'Venda Balcão'::text as origem,
                    'Peças'::text as categoria,
                    'Venda Balcão #' || substring(v.id::text from 1 for 8) || ' - ' || COALESCE(cli.nome, 'Consumidor') as descricao,
                    v.valor_total as valor_bruto,
                    0 as desconto,
                    v.valor_total as valor_liquido,
                    v.status::text as status,
                    'Venda'::text as classificacao,
                    substring(v.id::text from 1 for 8) as numero_documento
                FROM vendas_balcao v
                LEFT JOIN clientes cli ON cli.id = v.cliente_id
                WHERE v.oficina_id = p_oficina_id AND v.status = 'concluida'
                AND v.created_at::date BETWEEN p_inicio AND p_fim

                UNION ALL

                SELECT
                    f.id::text,
                    f.data::text as data_competencia,
                    f.data_pagamento::text as data_pagamento,
                    f.tipo::text as tipo,
                    'Financeiro'::text as origem,
                    COALESCE(f.categoria, 'Não classificado') as categoria,
                    f.descricao,
                    f.valor as valor_bruto,
                    0 as desconto,
                    f.valor as valor_liquido,
                    f.status::text as status,
                    CASE WHEN f.tipo = 'saida' THEN 'Despesa' ELSE 'Receita Direta' END as classificacao,
                    f.id::text as numero_documento
                FROM financeiro f
                WHERE f.oficina_id = p_oficina_id
                AND f.data BETWEEN p_inicio AND p_fim
            ) row
        )
    );

    RETURN v_result;
END;
$function$;