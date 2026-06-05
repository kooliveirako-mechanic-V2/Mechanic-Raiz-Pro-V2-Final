CREATE OR REPLACE FUNCTION public.get_financeiro_resumo(p_oficina_id uuid, p_meses_historico integer DEFAULT 6)
 RETURNS json
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_inicio_range date;
  v_fim_range date;
  v_inicio_mes_atual date;
  v_fim_mes_atual date;
  v_inicio_mes_anterior date;
  v_fim_mes_anterior date;
  v_result json;
BEGIN
  -- Calcular ranges
  v_fim_range := (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::date;
  v_inicio_range := (date_trunc('month', CURRENT_DATE) - (p_meses_historico - 1) * interval '1 month')::date;
  v_inicio_mes_atual := date_trunc('month', CURRENT_DATE)::date;
  v_fim_mes_atual := v_fim_range;
  v_inicio_mes_anterior := (date_trunc('month', CURRENT_DATE) - interval '1 month')::date;
  v_fim_mes_anterior := (date_trunc('month', CURRENT_DATE) - interval '1 day')::date;

  SELECT json_build_object(
    -- Registros brutos dos últimos 2 meses
    'registros', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'id', f.id,
          'tipo', f.tipo,
          'origem', f.origem,
          'ordem_servico_id', f.ordem_servico_id,
          'valor', f.valor,
          'data', f.data,
          'descricao', f.descricao,
          'created_at', f.created_at,
          'status', f.status,
          'categoria_id', f.categoria_id,
          'forma_pagamento_id', f.forma_pagamento_id,
          'fornecedor_id', f.fornecedor_id,
          'centro_custo_id', f.centro_custo_id,
          'classificacao', f.classificacao,
          'numero_documento', f.numero_documento,
          'data_competencia', f.data_competencia,
          'data_pagamento', f.data_pagamento,
          'recorrente', f.recorrente,
          'recorrencia_tipo', f.recorrencia_tipo,
          'observacoes_contador', f.observacoes_contador,
          'comprovante_url', f.comprovante_url,
          'oficina_id', f.oficina_id,
          'valor_mao_obra', f.valor_mao_obra,
          'valor_pecas', f.valor_pecas
        ) ORDER BY f.data DESC
      ), '[]'::json)
      FROM financeiro f
      WHERE f.oficina_id = p_oficina_id
        AND f.data >= v_inicio_mes_anterior
        AND f.data <= v_fim_mes_atual
    ),
    -- Totais do mês atual (Lucro Real = MO + (Peças - Custo) - Saídas)
    'mes_atual', (
      SELECT json_build_object(
        'entradas', COALESCE(SUM(CASE WHEN f.tipo = 'entrada' THEN f.valor ELSE 0 END), 0),
        'saidas', COALESCE(SUM(CASE WHEN f.tipo = 'saida' THEN f.valor ELSE 0 END), 0),
        'lucro', COALESCE(SUM(CASE WHEN f.tipo = 'entrada' THEN 
          COALESCE(f.valor_mao_obra, 0) + 
          (COALESCE(f.valor_pecas, 0) - COALESCE((
            SELECT SUM(COALESCE(i.custo_unitario, 0) * i.quantidade)
            FROM public.itens_os i 
            WHERE i.ordem_servico_id = f.ordem_servico_id
          ), 0))
          ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN f.tipo = 'saida' THEN f.valor ELSE 0 END), 0)
      )
      FROM financeiro f
      WHERE f.oficina_id = p_oficina_id
        AND f.data >= v_inicio_mes_atual
        AND f.data <= v_fim_mes_atual
    ),
    -- Totais do mês anterior
    'mes_anterior', (
      SELECT json_build_object(
        'entradas', COALESCE(SUM(CASE WHEN f.tipo = 'entrada' THEN f.valor ELSE 0 END), 0),
        'saidas', COALESCE(SUM(CASE WHEN f.tipo = 'saida' THEN f.valor ELSE 0 END), 0),
        'lucro', COALESCE(SUM(CASE WHEN f.tipo = 'entrada' THEN 
          COALESCE(f.valor_mao_obra, 0) + 
          (COALESCE(f.valor_pecas, 0) - COALESCE((
            SELECT SUM(COALESCE(i.custo_unitario, 0) * i.quantidade)
            FROM public.itens_os i 
            WHERE i.ordem_servico_id = f.ordem_servico_id
          ), 0))
          ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN f.tipo = 'saida' THEN f.valor ELSE 0 END), 0)
      )
      FROM financeiro f
      WHERE f.oficina_id = p_oficina_id
        AND f.data >= v_inicio_mes_anterior
        AND f.data <= v_fim_mes_anterior
    ),
    -- Breakdown mensal para gráfico
    'mensal', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'mes', to_char(m.mes_inicio, 'YYYY-MM'),
          'entradas', COALESCE(m.entradas, 0),
          'saidas', COALESCE(m.saidas, 0),
          'lucro', COALESCE(m.lucro_bruto, 0) - COALESCE(m.saidas, 0)
        ) ORDER BY m.mes_inicio
      ), '[]'::json)
      FROM (
        SELECT 
          date_trunc('month', gs)::date as mes_inicio,
          SUM(CASE WHEN f.tipo = 'entrada' THEN f.valor ELSE 0 END) as entradas,
          SUM(CASE WHEN f.tipo = 'saida' THEN f.valor ELSE 0 END) as saidas,
          SUM(CASE WHEN f.tipo = 'entrada' THEN 
            COALESCE(f.valor_mao_obra, 0) + 
            (COALESCE(f.valor_pecas, 0) - COALESCE((
              SELECT SUM(COALESCE(i.custo_unitario, 0) * i.quantidade)
              FROM public.itens_os i 
              WHERE i.ordem_servico_id = f.ordem_servico_id
            ), 0))
            ELSE 0 END) as lucro_bruto
        FROM generate_series(
          v_inicio_range::timestamp,
          v_fim_range::timestamp,
          '1 month'::interval
        ) gs
        LEFT JOIN financeiro f ON f.oficina_id = p_oficina_id
          AND f.data >= date_trunc('month', gs)::date
          AND f.data <= (date_trunc('month', gs) + interval '1 month' - interval '1 day')::date
        GROUP BY date_trunc('month', gs)::date
      ) m
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;