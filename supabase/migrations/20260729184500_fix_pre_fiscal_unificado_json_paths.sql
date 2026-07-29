-- Corrige os caminhos JSON de get_pre_fiscal_unificado.
--
-- A função lia chaves que NÃO existem em get_metrics_financeiras_unificadas
-- (sua fonte), então devolvia NULL nos campos base. Efeito em produção: o card
-- "Faturamento do mês" e "Receita" mostravam R$ 0,00 para TODOS os clientes,
-- enquanto Despesa e Lucro (cujos caminhos estavam certos) apareciam corretos.
--
-- Caminhos corrigidos (15):
--   faturamento.bruto                     -> competencia.faturamento_bruto
--   faturamento.descontos                 -> competencia.descontos
--   faturamento.liquido                   -> competencia.faturamento_liquido
--   faturamento.venda_balcao_bruto        -> competencia.vendas_balcao_bruto
--   categorias.pecas.bruto                -> competencia.pecas_bruto
--   categorias.servicos.bruto             -> competencia.servicos_bruto
--   caixa.saldo_a_receber_competencia     -> competencia.saldo_a_receber
--   caixa.entradas_oficina_periodo        -> caixa.entradas_pagas
--   operacional.custo_pecas               -> custos.cmv_os
--   operacional.custo_balcao              -> custos.cmv_venda_balcao
--   operacional.custo_total               -> custos.cmv_total
--   operacional.total_perdas              -> perdas_operacionais.total
--   operacional.perdas_retrabalho         -> perdas_operacionais.retrabalho
--   operacional.perdas_garantia           -> perdas_operacionais.garantia
--   operacional.perdas_prejuizo           -> perdas_operacionais.prejuizos
--
-- Nenhum cálculo foi alterado — apenas o local de leitura. Patch gerado por
-- substituição automática sobre pg_get_functiondef (sem transcrição manual).
--
-- Prova (2026-07-29, aplicado no NOVO kurlgmngmglhvknwxjee):
--   Mecânica Demonstração: faturamento null -> 1546.00 | receita null -> 1546.00
--   MONSTER MOTO:          faturamento null -> 8652.75 | receita null -> 10581.00
--   Consistência: ok_faturamento / ok_cmv / ok_caixa / ok_lucro = true
--
-- PENDENTE (a fonte não emite estes campos; seguem NULL):
--   despesas.variaveis, despesas.comprasEstoque,
--   resultado.resultadoLiquidoGerencial, perdas.sinistro, alertas.vendasSemCusto
--
-- NOTA: aplicado via query direta (db push inutilizável por drift de ~250
-- versões). Este arquivo é registro — reaplicar manualmente em restore/remix.

CREATE OR REPLACE FUNCTION public.get_pre_fiscal_unificado(p_oficina_id uuid, p_inicio date, p_fim date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_metrics JSONB;
    v_result JSONB;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND (auth.uid() IS NULL OR NOT public.has_oficina_access(auth.uid(), p_oficina_id)) THEN
    RAISE EXCEPTION 'Acesso negado à função %', 'get_pre_fiscal_unificado'
      USING ERRCODE = '42501';
  END IF;

    v_metrics := get_metrics_financeiras_unificadas(p_oficina_id, p_inicio, p_fim);
    IF v_metrics->>'error' IS NOT NULL THEN
        RETURN v_metrics;
    END IF;

    v_result := jsonb_build_object(
        'periodo', jsonb_build_object('inicio', p_inicio, 'fim', p_fim),
        'oficina', (SELECT jsonb_build_object('id', id, 'nome', nome) FROM oficinas WHERE id = p_oficina_id),
        'competencia', jsonb_build_object(
            'faturamentoBruto', (v_metrics->'competencia'->>'faturamento_bruto')::NUMERIC,
            'descontos', (v_metrics->'competencia'->>'descontos')::NUMERIC,
            'faturamentoLiquido', (v_metrics->'competencia'->>'faturamento_liquido')::NUMERIC,
            'osFinalizadas', (SELECT COUNT(*) FROM ordens_servico WHERE oficina_id = p_oficina_id AND status = 'finalizado' AND COALESCE(data_conclusao, data_servico)::date BETWEEN p_inicio AND p_fim),
            'vendasBalcaoConcluidas', (SELECT COUNT(*) FROM vendas_balcao WHERE oficina_id = p_oficina_id AND status = 'concluida' AND created_at::date BETWEEN p_inicio AND p_fim),
            'pecasBruto', (v_metrics->'competencia'->>'pecas_bruto')::NUMERIC,
            'servicosBruto', (v_metrics->'competencia'->>'servicos_bruto')::NUMERIC,
            'vendaBalcaoBruto', (v_metrics->'competencia'->>'vendas_balcao_bruto')::NUMERIC,
            'saldoAReceber', (v_metrics->'competencia'->>'saldo_a_receber')::NUMERIC
        ),
        'custos', jsonb_build_object(
            'cmvOs', (v_metrics->'custos'->>'cmv_os')::NUMERIC,
            'cmvBalcao', (v_metrics->'custos'->>'cmv_venda_balcao')::NUMERIC,
            'cmvTotal', (v_metrics->'custos'->>'cmv_total')::NUMERIC
        ),
        'perdas', jsonb_build_object(
            'total', (v_metrics->'perdas_operacionais'->>'total')::NUMERIC,
            'retrabalho', (v_metrics->'perdas_operacionais'->>'retrabalho')::NUMERIC,
            'garantia', (v_metrics->'perdas_operacionais'->>'garantia')::NUMERIC,
            'sinistro', (v_metrics->'operacional'->>'perdas_sinistro')::NUMERIC,
            'prejuizo', (v_metrics->'perdas_operacionais'->>'prejuizos')::NUMERIC
        ),
        'caixa', jsonb_build_object(
            'entradasPagas', (v_metrics->'caixa'->>'entradas_pagas')::NUMERIC,
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
$function$
