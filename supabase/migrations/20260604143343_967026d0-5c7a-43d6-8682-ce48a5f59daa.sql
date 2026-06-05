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
BEGIN
  -- Calcular ranges
  v_fim_range := (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::date;
  v_inicio_range := (date_trunc('month', CURRENT_DATE) - (p_meses_historico - 1) * interval '1 month')::date;
  v_inicio_mes_atual := date_trunc('month', CURRENT_DATE)::date;
  v_fim_mes_atual := v_fim_range;
  v_inicio_mes_anterior := (date_trunc('month', CURRENT_DATE) - interval '1 month')::date;
  v_fim_mes_anterior := (date_trunc('month', CURRENT_DATE) - interval '1 day')::date;

  RETURN (
    SELECT json_build_object(
      'registros', (
        SELECT COALESCE(json_agg(f.*), '[]'::json)
        FROM (
          SELECT id, tipo, origem, ordem_servico_id, valor, data, descricao, created_at, status, 
                 categoria_id, forma_pagamento_id, fornecedor_id, centro_custo_id, classificacao,
                 numero_documento, data_competencia, data_pagamento, recorrente, recorrencia_tipo,
                 observacoes_contador, comprovante_url, oficina_id, valor_mao_obra, valor_pecas
          FROM financeiro
          WHERE oficina_id = p_oficina_id
            AND data >= v_inicio_mes_anterior
            AND data <= v_fim_mes_atual
          ORDER BY data DESC
        ) f
      ),
      'mes_atual', (
        WITH totais_custo_os AS (
          -- Soma única do custo por OS finalizada no mês
          SELECT SUM(COALESCE(custo_servico, 0)) as total_custo
          FROM ordens_servico
          WHERE oficina_id = p_oficina_id
            AND status = 'finalizado'
            AND data_servico >= v_inicio_mes_atual
            AND data_servico <= v_fim_mes_atual
        )
        SELECT json_build_object(
          'entradas', COALESCE(SUM(CASE WHEN f.tipo = 'entrada' THEN f.valor ELSE 0 END), 0),
          'saidas', COALESCE(SUM(CASE WHEN f.tipo = 'saida' THEN f.valor ELSE 0 END), 0),
          'lucro', COALESCE(SUM(CASE WHEN f.tipo = 'entrada' THEN f.valor ELSE 0 END), 0) - 
                   COALESCE(SUM(CASE WHEN f.tipo = 'saida' THEN f.valor ELSE 0 END), 0) - 
                   COALESCE((SELECT total_custo FROM totais_custo_os), 0)
        )
        FROM financeiro f
        WHERE f.oficina_id = p_oficina_id
          AND f.data >= v_inicio_mes_atual
          AND f.data <= v_fim_mes_atual
      ),
      'mes_anterior', (
        WITH totais_custo_os AS (
          SELECT SUM(COALESCE(custo_servico, 0)) as total_custo
          FROM ordens_servico
          WHERE oficina_id = p_oficina_id
            AND status = 'finalizado'
            AND data_servico >= v_inicio_mes_anterior
            AND data_servico <= v_fim_mes_anterior
        )
        SELECT json_build_object(
          'entradas', COALESCE(SUM(CASE WHEN f.tipo = 'entrada' THEN f.valor ELSE 0 END), 0),
          'saidas', COALESCE(SUM(CASE WHEN f.tipo = 'saida' THEN f.valor ELSE 0 END), 0),
          'lucro', COALESCE(SUM(CASE WHEN f.tipo = 'entrada' THEN f.valor ELSE 0 END), 0) - 
                   COALESCE(SUM(CASE WHEN f.tipo = 'saida' THEN f.valor ELSE 0 END), 0) - 
                   COALESCE((SELECT total_custo FROM totais_custo_os), 0)
        )
        FROM financeiro f
        WHERE f.oficina_id = p_oficina_id
          AND f.data >= v_inicio_mes_anterior
          AND f.data <= v_fim_mes_anterior
      ),
      'mensal', (
        SELECT COALESCE(json_agg(m_data), '[]'::json)
        FROM (
          SELECT 
            to_char(gs, 'YYYY-MM') as mes,
            COALESCE((SELECT SUM(valor) FROM financeiro WHERE oficina_id = p_oficina_id AND tipo = 'entrada' AND date_trunc('month', data) = date_trunc('month', gs)), 0) as entradas,
            COALESCE((SELECT SUM(valor) FROM financeiro WHERE oficina_id = p_oficina_id AND tipo = 'saida' AND date_trunc('month', data) = date_trunc('month', gs)), 0) as saidas,
            COALESCE((SELECT SUM(valor) FROM financeiro WHERE oficina_id = p_oficina_id AND tipo = 'entrada' AND date_trunc('month', data) = date_trunc('month', gs)), 0) -
            COALESCE((SELECT SUM(valor) FROM financeiro WHERE oficina_id = p_oficina_id AND tipo = 'saida' AND date_trunc('month', data) = date_trunc('month', gs)), 0) -
            COALESCE((SELECT SUM(custo_servico) FROM ordens_servico WHERE oficina_id = p_oficina_id AND status = 'finalizado' AND date_trunc('month', data_servico) = date_trunc('month', gs)), 0) as lucro
          FROM generate_series(v_inicio_range, v_fim_range, interval '1 month') gs
          ORDER BY gs
        ) m_data
      )
    )
  );
END;
$function$;