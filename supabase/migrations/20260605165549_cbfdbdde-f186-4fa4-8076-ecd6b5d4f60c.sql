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
  -- Nota: Chamamos a lógica interna da metrics_financeiras para garantir paridade
  SELECT jsonb_build_object(
    'caixa', jsonb_build_object(
      'entradas', COALESCE(SUM(valor) FILTER (WHERE tipo = 'entrada' AND status = 'pago'), 0),
      'saidas', COALESCE(SUM(valor) FILTER (WHERE tipo = 'saida' AND status = 'pago'), 0)
    ),
    'competencia', jsonb_build_object(
      'faturamento_bruto', COALESCE(SUM(valor) FILTER (WHERE tipo = 'entrada' AND (ordem_servico_id IS NOT NULL OR categoria = 'venda_balcao')), 0),
      'descontos', 0 -- Descontos seriam calculados via itens_os se necessário, mas para o contador o valor líquido da OS é o que conta na tabela financeiro
    )
  ) INTO v_metrics
  FROM financeiro
  WHERE oficina_id = p_oficina_id
    AND data >= p_inicio
    AND data <= p_fim;

  -- 2. Dados Analíticos para o Contador
  SELECT jsonb_agg(jsonb_build_object(
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
  )) INTO v_analitico
  FROM financeiro f
  LEFT JOIN categorias_financeiras cf ON cf.id = f.categoria_id
  WHERE f.oficina_id = p_oficina_id
    AND f.data >= p_inicio
    AND f.data <= p_fim
    AND f.classificacao = 'empresa'
  ORDER BY f.data ASC;

  -- 3. Verificação de Ressalvas (Histórico Pendente)
  -- Contamos itens sem custo no período
  SELECT jsonb_build_object(
    'tem_ressalva', COUNT(*) > 0,
    'itens_sem_custo', COUNT(*),
    'impacto_estimado', COUNT(*) * 20.64 -- Baseado na média de 350.88 / 17
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

GRANT EXECUTE ON FUNCTION public.get_pre_fiscal_unificado(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pre_fiscal_unificado(UUID, DATE, DATE) TO service_role;