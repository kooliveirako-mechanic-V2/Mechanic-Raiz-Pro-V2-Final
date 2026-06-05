CREATE OR REPLACE FUNCTION public.get_pre_fiscal_unificado(p_oficina_id uuid, p_inicio date, p_fim date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_user_oficina_id UUID;
  v_user_role TEXT;
  v_result JSONB;
BEGIN
  -- 1. Validação Multi-tenant
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: usuário não autenticado';
  END IF;

  SELECT oficina_id INTO v_user_oficina_id FROM public.profiles WHERE id = v_user_id;
  SELECT role INTO v_user_role FROM public.user_roles WHERE user_id = v_user_id LIMIT 1;

  IF v_user_oficina_id != p_oficina_id AND COALESCE(v_user_role, '') NOT IN ('master', 'super_admin', 'platform_admin') THEN
    RAISE EXCEPTION 'Acesso negado: multi-tenant violation';
  END IF;

  -- 2. Coleta de Dados (Fontes Únicas)
  WITH os_raw AS (
    SELECT 
      os.id,
      os.cliente_id,
      c.nome as cliente_nome,
      COALESCE(os.data_conclusao, os.data_servico)::date as data_competencia,
      COALESCE(os.valor_mao_obra, 0) as valor_mao_obra_fixo,
      COALESCE(os.desconto, 0) as desconto_total_os
    FROM ordens_servico os
    JOIN clientes c ON c.id = os.cliente_id
    WHERE os.oficina_id = p_oficina_id
      AND os.status = 'finalizado'
      AND COALESCE(os.data_conclusao, os.data_servico)::date BETWEEN p_inicio AND p_fim
  ),
  itens_classificados AS (
    SELECT 
      i.ordem_servico_id,
      i.valor_total as bruto_item,
      i.custo_unitario * i.quantidade as custo_item,
      CASE 
        WHEN i.estoque_id IS NOT NULL OR LOWER(i.tipo) IN ('peca', 'peça', 'produto') THEN 'peca'
        WHEN LOWER(i.tipo) IN ('servico', 'serviço', 'mao_obra', 'mão_obra', 'mao de obra', 'mão de obra') OR i.valor_mao_obra > 0 THEN 'servico'
        ELSE 'servico' -- Default para itens não classificados que não entraram nas regras acima
      END as categoria_item
    FROM itens_os i
    WHERE i.ordem_servico_id IN (SELECT id FROM os_raw)
  ),
  os_consolidadas AS (
    SELECT 
      r.id,
      r.cliente_nome,
      r.data_competencia,
      r.valor_mao_obra_fixo,
      r.desconto_total_os,
      -- Brutos por categoria (incluindo mão de obra fixa da OS)
      COALESCE((SELECT SUM(bruto_item) FROM itens_classificados ic WHERE ic.ordem_servico_id = r.id AND ic.categoria_item = 'peca'), 0) as pecas_bruto,
      COALESCE((SELECT SUM(bruto_item) FROM itens_classificados ic WHERE ic.ordem_servico_id = r.id AND ic.categoria_item = 'servico'), 0) + r.valor_mao_obra_fixo as servicos_bruto,
      -- Custo (CMV)
      COALESCE((SELECT SUM(custo_item) FROM itens_classificados ic WHERE ic.ordem_servico_id = r.id AND ic.categoria_item = 'peca'), 0) as pecas_cmv
    FROM os_raw r
  ),
  os_finais AS (
    SELECT 
      *,
      (pecas_bruto + servicos_bruto) as total_bruto,
      (pecas_bruto + servicos_bruto - desconto_total_os) as total_liquido,
      -- Rateio de Desconto
      CASE 
        WHEN (pecas_bruto + servicos_bruto) > 0 THEN ROUND((pecas_bruto / (pecas_bruto + servicos_bruto) * desconto_total_os)::numeric, 2)
        ELSE 0 
      END as pecas_desconto_rateado,
      -- Saldo residual para serviços para evitar erro de centavos
      CASE 
        WHEN (pecas_bruto + servicos_bruto) > 0 THEN desconto_total_os - ROUND((pecas_bruto / (pecas_bruto + servicos_bruto) * desconto_total_os)::numeric, 2)
        ELSE 0 
      END as servicos_desconto_rateado
    FROM os_consolidadas
  ),
  vendas_balcao_data AS (
    SELECT 
      id,
      'Venda Balcão' as cliente_nome,
      created_at::date as data_competencia,
      valor_total as total_bruto,
      0 as desconto_total,
      valor_total as total_liquido,
      valor_total as pecas_bruto,
      0 as servicos_bruto,
      -- Na estrutura simplificada de VB, assume-se CMV 0 se não houver itens detalhados acessíveis aqui
      0 as pecas_cmv
    FROM vendas_balcao
    WHERE oficina_id = p_oficina_id
      AND status = 'concluida'
      AND created_at::date BETWEEN p_inicio AND p_fim
  ),
  recebimentos_vinculados AS (
    SELECT 
      ordem_servico_id,
      venda_balcao_id,
      SUM(valor) as total_recebido
    FROM financeiro
    WHERE oficina_id = p_oficina_id
      AND status = 'pago'
      AND tipo = 'entrada'
      AND (ordem_servico_id IN (SELECT id FROM os_finais) OR venda_balcao_id IN (SELECT id FROM vendas_balcao_data))
    GROUP BY 1, 2
  ),
  -- 3. Métricas de Competência
  competencia_metrics AS (
    SELECT 
      SUM(total_bruto) as faturamento_bruto,
      SUM(desconto_total_os) as descontos,
      SUM(total_liquido) as faturamento_liquido,
      SUM(pecas_bruto - pecas_desconto_rateado) as pecas_liquido,
      SUM(servicos_bruto - servicos_desconto_rateado) as servicos_liquido,
      SUM(pecas_cmv) as cmv,
      SUM(total_liquido - pecas_cmv) as lucro_operacional,
      COALESCE(SUM(rv.total_recebido), 0) as recebido_vinculado
    FROM (
      SELECT id, total_bruto, desconto_total_os, total_liquido, pecas_bruto, pecas_desconto_rateado, servicos_bruto, servicos_desconto_rateado, pecas_cmv, NULL as vb_id FROM os_finais
      UNION ALL
      SELECT id, total_bruto, 0, total_liquido, pecas_bruto, 0, servicos_bruto, 0, pecas_cmv, id FROM vendas_balcao_data
    ) base
    LEFT JOIN recebimentos_vinculados rv ON (rv.ordem_servico_id = base.id OR rv.venda_balcao_id = base.vb_id)
  ),
  -- 4. Métricas de Caixa
  caixa_metrics AS (
    SELECT 
      COALESCE(SUM(valor) FILTER (WHERE tipo = 'entrada' AND status = 'pago'), 0) as entradas,
      COALESCE(SUM(valor) FILTER (WHERE tipo = 'saida' AND status = 'pago'), 0) as saidas
    FROM financeiro
    WHERE oficina_id = p_oficina_id
      AND COALESCE(data_pagamento, data) BETWEEN p_inicio AND p_fim
  ),
  -- 5. Analítico Competência
  analitico_competencia AS (
    SELECT jsonb_agg(row) FROM (
      SELECT 
        data_competencia,
        'OS' as origem,
        id::text as numero,
        cliente_nome as cliente,
        total_bruto as bruto,
        desconto_total_os as desconto,
        total_liquido as liquido,
        (pecas_bruto - pecas_desconto_rateado) as pecas,
        (servicos_bruto - servicos_desconto_rateado) as servicos,
        pecas_cmv as cmv,
        (total_liquido - pecas_cmv) as lucro_op,
        COALESCE(rv.total_recebido, 0) as recebido,
        (total_liquido - COALESCE(rv.total_recebido, 0)) as saldo_a_receber,
        CASE WHEN COALESCE(rv.total_recebido, 0) >= total_liquido THEN 'Pago' ELSE 'Pendente' END as status_pagamento
      FROM os_finais f
      LEFT JOIN recebimentos_vinculados rv ON rv.ordem_servico_id = f.id
      UNION ALL
      SELECT 
        data_competencia,
        'Venda Balcão' as origem,
        id::text as numero,
        cliente_nome,
        total_bruto,
        0 as desconto,
        total_liquido,
        pecas_bruto as pecas,
        0 as servicos,
        pecas_cmv as cmv,
        (total_liquido - pecas_cmv) as lucro_op,
        COALESCE(rv.total_recebido, 0) as recebido,
        (total_liquido - COALESCE(rv.total_recebido, 0)) as saldo_a_receber,
        CASE WHEN COALESCE(rv.total_recebido, 0) >= total_liquido THEN 'Pago' ELSE 'Pendente' END as status_pagamento
      FROM vendas_balcao_data v
      LEFT JOIN recebimentos_vinculados rv ON rv.venda_balcao_id = v.id
      ORDER BY data_competencia DESC
    ) row
  ),
  -- 6. Analítico Caixa
  analitico_caixa AS (
    SELECT jsonb_agg(row) FROM (
      SELECT 
        COALESCE(data_pagamento, data) as data_pagamento,
        tipo,
        origem,
        categoria,
        descricao,
        CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END as entrada,
        CASE WHEN tipo = 'saida' THEN valor ELSE 0 END as saida,
        COALESCE(ordem_servico_id::text, venda_balcao_id::text, '-') as vinculo,
        status,
        observacoes_contador
      FROM financeiro
      WHERE oficina_id = p_oficina_id
        AND COALESCE(data_pagamento, data) BETWEEN p_inicio AND p_fim
      ORDER BY data_pagamento DESC
    ) row
  )
  SELECT jsonb_build_object(
    'competencia', jsonb_build_object(
      'faturamento_bruto', COALESCE((SELECT faturamento_bruto FROM competencia_metrics), 0),
      'descontos', COALESCE((SELECT descontos FROM competencia_metrics), 0),
      'faturamento_liquido', COALESCE((SELECT faturamento_liquido FROM competencia_metrics), 0),
      'pecas_liquido', COALESCE((SELECT pecas_liquido FROM competencia_metrics), 0),
      'servicos_liquido', COALESCE((SELECT servicos_liquido FROM competencia_metrics), 0),
      'cmv', COALESCE((SELECT cmv FROM competencia_metrics), 0),
      'lucro_operacional', COALESCE((SELECT lucro_operacional FROM competencia_metrics), 0),
      'recebido_vinculado', COALESCE((SELECT recebido_vinculado FROM competencia_metrics), 0),
      'saldo_a_receber', GREATEST(0, COALESCE((SELECT faturamento_liquido - recebido_vinculado FROM competencia_metrics), 0))
    ),
    'caixa', jsonb_build_object(
      'entradas', (SELECT entradas FROM caixa_metrics),
      'saidas', (SELECT saidas FROM caixa_metrics),
      'lucro_caixa', (SELECT entradas - saidas FROM caixa_metrics)
    ),
    'analitico_competencia', COALESCE((SELECT * FROM analitico_competencia), '[]'::jsonb),
    'analitico_caixa', COALESCE((SELECT * FROM analitico_caixa), '[]'::jsonb),
    'ressalvas', jsonb_build_object(
      'backfill_pendente', true,
      'historico_estimado', true
    ),
    'contador', jsonb_build_object(
      'projeto', 'Pré-Fiscal Unificado',
      'versao', '2.0',
      'fonte_unica', true
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$