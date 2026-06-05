CREATE OR REPLACE FUNCTION public.get_pre_fiscal_unificado(
  p_oficina_id UUID,
  p_inicio DATE,
  p_fim DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_metrics JSONB;
  v_analitico JSONB;
  v_ressalvas JSONB;
BEGIN
  -- 1. Obter métricas oficiais do período (Fonte Única)
  SELECT jsonb_build_object(
    'caixa', jsonb_build_object(
      'entradas', COALESCE(SUM(valor) FILTER (WHERE tipo = 'entrada' AND status = 'pago'), 0),
      'saidas', COALESCE(SUM(valor) FILTER (WHERE tipo = 'saida' AND status = 'pago'), 0)
    ),
    'competencia', jsonb_build_object(
      'faturamento_bruto', COALESCE(SUM(valor) FILTER (WHERE tipo = 'entrada' AND (ordem_servico_id IS NOT NULL OR categoria = 'venda_balcao')), 0),
      'descontos', 0 
    )
  ) INTO v_metrics
  FROM financeiro
  WHERE oficina_id = p_oficina_id
    AND data >= p_inicio
    AND data <= p_fim;

  -- 2. Dados Analíticos para o Contador (Removido ORDER BY problemático dentro da agregação direta se houver conflito, mas aqui o erro era de GROUP BY implícito)
  -- Para evitar o erro 42803, usamos uma subquery ou garantimos que não haja ambiguidade
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
      'valor_bruto', f.valor,
      'valor_liquido', f.valor,
      'status', f.status,
      'classificacao', f.classificacao,
      'numero_documento', f.numero_documento,
      'ordem_servico_id', f.ordem_servico_id,
      'observacoes_contador', f.observacoes_contador
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
    AND os.data_finalizacao >= p_inicio
    AND os.data_finalizacao <= p_fim
    AND i.tipo = 'peca'
    AND (i.custo_unitario IS NULL OR i.custo_unitario = 0);

  RETURN jsonb_build_object(
    'metrics', v_metrics,
    'analitico', COALESCE(v_analitico, '[]'::jsonb),
    'ressalvas', v_ressalvas
  );
END;
$$;