CREATE OR REPLACE FUNCTION public.get_pre_fiscal_unificado(p_oficina_id uuid, p_inicio date, p_fim date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_metrics JSONB;
  v_analitico JSONB;
  v_ressalvas JSONB;
BEGIN
  -- 1. Obter métricas oficiais do período (Fonte Única)
  WITH os_data AS (
    SELECT 
      os.id,
      COALESCE(os.valor_mao_obra, 0) as mao_obra,
      COALESCE(os.desconto, 0) as desconto_os,
      COALESCE((SELECT SUM(COALESCE(i.valor_total, 0)) FROM itens_os i WHERE i.ordem_servico_id = os.id), 0) as total_itens,
      COALESCE((SELECT SUM(COALESCE(i.valor_total, 0)) FROM itens_os i WHERE i.ordem_servico_id = os.id AND i.tipo = 'peca'), 0) as total_pecas,
      COALESCE((SELECT SUM(COALESCE(i.valor_total, 0)) FROM itens_os i WHERE i.ordem_servico_id = os.id AND i.tipo = 'servico'), 0) as total_servicos,
      COALESCE((SELECT SUM(COALESCE(i.custo_unitario * i.quantidade, 0)) FROM itens_os i WHERE i.ordem_servico_id = os.id AND i.tipo = 'peca'), 0) as total_cmv
    FROM ordens_servico os
    WHERE os.oficina_id = p_oficina_id
      AND os.status = 'finalizado'
      AND os.data_conclusao::date >= p_inicio
      AND os.data_conclusao::date <= p_fim
  ),
  vb_data AS (
    SELECT 
      SUM(COALESCE(valor_total, 0)) as bruto, -- Venda balcão na estrutura atual não tem coluna 'desconto' aparente
      0 as descontos,
      SUM(COALESCE(valor_total, 0)) as liquido,
      -- Venda balcão não tem 'custo_total' na tabela principal, precisaria somar itens se existissem
      0 as cmv 
    FROM vendas_balcao
    WHERE oficina_id = p_oficina_id
      AND status = 'concluida'
      AND created_at::date >= p_inicio
      AND created_at::date <= p_fim
  ),
  caixa_metrics AS (
    SELECT 
      COALESCE(SUM(valor) FILTER (WHERE tipo = 'entrada' AND status = 'pago'), 0) as entradas,
      COALESCE(SUM(valor) FILTER (WHERE tipo = 'saida' AND status = 'pago'), 0) as saidas
    FROM financeiro
    WHERE oficina_id = p_oficina_id
      AND data >= p_inicio
      AND data <= p_fim
  ),
  faturamento_os AS (
    SELECT 
      SUM(mao_obra + total_itens) as bruto,
      SUM(desconto_os) as descontos,
      SUM(mao_obra + total_itens - desconto_os) as liquido,
      SUM(total_pecas) as pecas_liquido,
      SUM(total_servicos + mao_obra) as servicos_liquido,
      SUM(total_cmv) as cmv
    FROM os_data
  )
  SELECT jsonb_build_object(
    'caixa', jsonb_build_object(
      'entradas', (SELECT entradas FROM caixa_metrics),
      'saidas', (SELECT saidas FROM caixa_metrics),
      'lucro_caixa', (SELECT entradas - saidas FROM caixa_metrics)
    ),
    'competencia', jsonb_build_object(
      'faturamento_bruto', COALESCE((SELECT bruto FROM faturamento_os), 0) + COALESCE((SELECT bruto FROM vb_data), 0),
      'descontos', COALESCE((SELECT descontos FROM faturamento_os), 0) + COALESCE((SELECT descontos FROM vb_data), 0),
      'faturamento_liquido', COALESCE((SELECT liquido FROM faturamento_os), 0) + COALESCE((SELECT liquido FROM vb_data), 0),
      'pecas_liquido', COALESCE((SELECT pecas_liquido FROM faturamento_os), 0) + COALESCE((SELECT liquido FROM vb_data), 0),
      'servicos_liquido', COALESCE((SELECT servicos_liquido FROM faturamento_os), 0),
      'cmv', COALESCE((SELECT cmv FROM faturamento_os), 0) + COALESCE((SELECT cmv FROM vb_data), 0),
      'lucro_operacional', (COALESCE((SELECT liquido FROM faturamento_os), 0) + COALESCE((SELECT liquido FROM vb_data), 0)) - (COALESCE((SELECT cmv FROM faturamento_os), 0) + COALESCE((SELECT cmv FROM vb_data), 0)),
      'saldo_a_receber', GREATEST(0, (COALESCE((SELECT liquido FROM faturamento_os), 0) + COALESCE((SELECT liquido FROM vb_data), 0)) - (SELECT entradas FROM caixa_metrics))
    )
  ) INTO v_metrics;

  -- 2. Dados Analíticos para o Contador
  SELECT jsonb_agg(item) INTO v_analitico
  FROM (
    SELECT jsonb_build_object(
      'id', f.id,
      'data_competencia', COALESCE(f.data_competencia, f.data),
      'data_pagamento', f.data_pagamento,
      'tipo', f.tipo,
      'origem', f.origem,
      'categoria', COALESCE(cf.nome, f.categoria),
      'descricao', f.descricao,
      'valor_bruto', CASE 
        WHEN f.ordem_servico_id IS NOT NULL THEN (
          SELECT COALESCE(os.valor_mao_obra, 0) + COALESCE((SELECT SUM(valor_total) FROM itens_os WHERE ordem_servico_id = os.id), 0)
          FROM ordens_servico os WHERE os.id = f.ordem_servico_id
        )
        ELSE f.valor 
      END,
      'desconto', CASE 
        WHEN f.ordem_servico_id IS NOT NULL THEN (SELECT COALESCE(os.desconto, 0) FROM ordens_servico os WHERE os.id = f.ordem_servico_id)
        ELSE 0 
      END,
      'valor_liquido', f.valor,
      'status', f.status,
      'classificacao', f.classificacao,
      'numero_documento', f.numero_documento,
      'ordem_servico_id', f.ordem_servico_id,
      'observacoes_contador', f.observacoes_contador,
      'is_estimado', EXISTS (
        SELECT 1 FROM itens_os i 
        WHERE i.ordem_servico_id = f.ordem_servico_id 
        AND i.tipo = 'peca' 
        AND (i.custo_unitario IS NULL OR i.custo_unitario = 0)
      )
    ) as item
    FROM financeiro f
    LEFT JOIN categorias_financeiras cf ON cf.id = f.categoria_id
    WHERE f.oficina_id = p_oficina_id
      AND f.data >= p_inicio
      AND f.data <= p_fim
      AND f.classificacao = 'empresa'
    ORDER BY f.data ASC
  ) sub;

  -- 3. Ressalvas
  SELECT jsonb_build_object(
    'tem_ressalva', COUNT(*) > 0,
    'itens_sem_custo', COUNT(*),
    'impacto_estimado', COUNT(*) * 20.64
  ) INTO v_ressalvas
  FROM itens_os i
  JOIN ordens_servico os ON os.id = i.ordem_servico_id
  WHERE os.oficina_id = p_oficina_id
    AND os.data_conclusao::date >= p_inicio
    AND os.data_conclusao::date <= p_fim
    AND i.tipo = 'peca'
    AND (i.custo_unitario IS NULL OR i.custo_unitario = 0);

  RETURN jsonb_build_object(
    'metrics', v_metrics,
    'analitico', COALESCE(v_analitico, '[]'::jsonb),
    'ressalvas', v_ressalvas
  );
END;
$function$