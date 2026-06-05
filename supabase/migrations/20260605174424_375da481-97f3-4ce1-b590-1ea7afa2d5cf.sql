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
  -- Faturamento Bruto e Descontos vêm das OS/Vendas concluídas
  -- Caixa vem da tabela financeiro (entradas/saídas pagas)
  WITH os_vendas AS (
    -- Ordens de Serviço
    SELECT 
      SUM(COALESCE(valor_total, 0) + COALESCE(desconto, 0)) as bruto,
      SUM(COALESCE(desconto, 0)) as descontos,
      SUM(COALESCE(valor_total, 0)) as liquido,
      SUM(COALESCE((SELECT SUM(i.valor_total) FROM itens_os i WHERE i.ordem_servico_id = os.id AND i.tipo = 'peca'), 0)) as pecas_liquido,
      SUM(COALESCE((SELECT SUM(i.valor_total) FROM itens_os i WHERE i.ordem_servico_id = os.id AND i.tipo = 'servico'), 0)) as servicos_liquido,
      SUM(COALESCE((SELECT SUM(i.custo_unitario * i.quantidade) FROM itens_os i WHERE i.ordem_servico_id = os.id AND i.tipo = 'peca'), 0)) as cmv
    FROM ordens_servico os
    WHERE os.oficina_id = p_oficina_id
      AND os.status = 'finalizado'
      AND os.data_conclusao::date >= p_inicio
      AND os.data_conclusao::date <= p_fim
    UNION ALL
    -- Vendas Balcão
    SELECT 
      SUM(COALESCE(valor_total, 0) + COALESCE(desconto, 0)) as bruto,
      SUM(COALESCE(desconto, 0)) as descontos,
      SUM(COALESCE(valor_total, 0)) as liquido,
      SUM(COALESCE(valor_total, 0)) as pecas_liquido, -- Venda balcão é 100% peça
      0 as servicos_liquido,
      SUM(COALESCE(custo_total, 0)) as cmv
    FROM vendas_balcao
    WHERE oficina_id = p_oficina_id
      AND data_venda::date >= p_inicio
      AND data_venda::date <= p_fim
  ),
  caixa_metrics AS (
    SELECT 
      COALESCE(SUM(valor) FILTER (WHERE tipo = 'entrada' AND status = 'pago'), 0) as entradas,
      COALESCE(SUM(valor) FILTER (WHERE tipo = 'saida' AND status = 'pago'), 0) as saidas
    FROM financeiro
    WHERE oficina_id = p_oficina_id
      AND data >= p_inicio
      AND data <= p_fim
  )
  SELECT jsonb_build_object(
    'caixa', jsonb_build_object(
      'entradas', (SELECT entradas FROM caixa_metrics),
      'saidas', (SELECT saidas FROM caixa_metrics),
      'lucro_caixa', (SELECT entradas - saidas FROM caixa_metrics)
    ),
    'competencia', jsonb_build_object(
      'faturamento_bruto', COALESCE(SUM(bruto), 0),
      'descontos', COALESCE(SUM(descontos), 0),
      'faturamento_liquido', COALESCE(SUM(liquido), 0),
      'pecas_liquido', COALESCE(SUM(pecas_liquido), 0),
      'servicos_liquido', COALESCE(SUM(servicos_liquido), 0),
      'cmv', COALESCE(SUM(cmv), 0),
      'lucro_operacional', COALESCE(SUM(liquido) - SUM(cmv), 0),
      'saldo_a_receber', GREATEST(0, COALESCE(SUM(liquido), 0) - (SELECT entradas FROM caixa_metrics WHERE (SELECT entradas FROM caixa_metrics) >= 0))
    )
  ) INTO v_metrics
  FROM os_vendas;

  -- 2. Dados Analíticos para o Contador (Detalhamento por Lançamento)
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
      -- Para o contador, o "Bruto" no financeiro deve ser o valor antes do desconto da OS, se houver
      'valor_bruto', CASE 
        WHEN f.ordem_servico_id IS NOT NULL THEN (SELECT os.valor_total + os.desconto FROM ordens_servico os WHERE os.id = f.ordem_servico_id)
        ELSE f.valor 
      END,
      'desconto', CASE 
        WHEN f.ordem_servico_id IS NOT NULL THEN (SELECT os.desconto FROM ordens_servico os WHERE os.id = f.ordem_servico_id)
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

  -- 3. Verificação de Ressalvas (Histórico Pendente)
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