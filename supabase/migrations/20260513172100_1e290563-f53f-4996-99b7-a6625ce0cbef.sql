-- Atualiza get_public_os para incluir tipo do item, defeito relatado e novos campos da oficina
CREATE OR REPLACE FUNCTION public.get_public_os(os_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result json;
  items json;
  sinais json;
  v_total_sinais numeric := 0;
  v_valor_servico numeric := 0;
BEGIN
  SELECT COALESCE(json_agg(
    json_build_object(
      'nome_item', i.nome_item,
      'tipo', i.tipo,
      'quantidade', i.quantidade,
      'valor_unitario', i.valor_unitario,
      'valor_mao_obra', i.valor_mao_obra,
      'valor_total', i.valor_total
    ) ORDER BY i.created_at
  ), '[]'::json) INTO items
  FROM itens_os i
  WHERE i.ordem_servico_id = os_id;

  SELECT COALESCE(json_agg(
    json_build_object(
      'id', s.id,
      'valor', s.valor,
      'forma_pagamento', s.forma_pagamento,
      'data_pagamento', s.data_pagamento
    ) ORDER BY s.data_pagamento, s.created_at
  ), '[]'::json),
  COALESCE(SUM(s.valor), 0)
  INTO sinais, v_total_sinais
  FROM os_sinais s
  WHERE s.ordem_servico_id = os_id;

  SELECT COALESCE(os.valor_servico, 0) INTO v_valor_servico
  FROM ordens_servico os WHERE os.id = os_id;

  SELECT json_build_object(
    'id', os.id,
    'status', os.status,
    'tipo_servico', os.tipo_servico,
    'descricao', os.descricao,
    'hipotese_diagnostico', os.hipotese_diagnostico,
    'data_servico', os.data_servico,
    'valor_servico', os.valor_servico,
    'valor_mao_obra', os.valor_mao_obra,
    'tem_garantia', os.tem_garantia,
    'dias_garantia', os.dias_garantia,
    'created_at', os.created_at,
    'data_conclusao', os.data_conclusao,
    'forma_pagamento', os.forma_pagamento,
    'observacoes_conclusao', os.observacoes_conclusao,
    'km_no_servico', os.km_no_servico,
    'valor_sinal', COALESCE(os.valor_sinal, 0),
    'sinais', sinais,
    'total_sinais', v_total_sinais,
    'saldo_restante', GREATEST(v_valor_servico - v_total_sinais, 0),
    'oficina', json_build_object(
      'nome', o.nome,
      'logo_url', o.logo_url,
      'telefone', o.telefone,
      'endereco', o.endereco,
      'cnpj', oc.cnpj,
      'razao_social', oc.razao_social,
      'cpf_cnpj', o.cpf_cnpj,
      'email_contato', o.email_contato,
      'responsavel_tecnico', o.responsavel_tecnico
    ),
    'cliente', json_build_object(
      'nome', c.nome,
      'telefone', c.telefone,
      'cpf_cnpj', c.cpf_cnpj,
      'endereco', c.endereco
    ),
    'veiculo', json_build_object(
      'marca', v.marca,
      'modelo', v.modelo,
      'placa', v.placa,
      'ano', v.ano,
      'cor', v.cor,
      'km_atual', v.km_atual
    ),
    'itens', items
  ) INTO result
  FROM ordens_servico os
  JOIN oficinas o ON o.id = os.oficina_id
  LEFT JOIN oficina_configuracoes oc ON oc.oficina_id = o.id
  JOIN veiculos v ON v.id = os.veiculo_id
  JOIN clientes c ON c.id = os.cliente_id
  WHERE os.id = os_id;

  RETURN result;
END;
$function$;

-- Atualiza get_public_orcamento para incluir novos campos da oficina
CREATE OR REPLACE FUNCTION public.get_public_orcamento(orcamento_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'id', o.id,
    'numero', o.numero,
    'titulo', o.titulo,
    'descricao', o.descricao,
    'status', o.status,
    'valor_total', o.valor_total,
    'desconto', o.desconto,
    'validade', o.validade,
    'observacoes', o.observacoes,
    'created_at', o.created_at,
    'oficina', json_build_object(
      'nome', of.nome,
      'logo_url', of.logo_url,
      'telefone', of.telefone,
      'endereco', of.endereco,
      'cpf_cnpj', of.cpf_cnpj,
      'email_contato', of.email_contato,
      'responsavel_tecnico', of.responsavel_tecnico
    ),
    'cliente', CASE WHEN c.id IS NOT NULL THEN json_build_object(
      'nome', c.nome
    ) ELSE NULL END,
    'veiculo', CASE WHEN v.id IS NOT NULL THEN json_build_object(
      'marca', v.marca,
      'modelo', v.modelo,
      'placa', v.placa,
      'ano', v.ano
    ) ELSE NULL END,
    'itens', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', i.id,
        'nome_item', i.nome_item,
        'tipo', i.tipo,
        'quantidade', i.quantidade,
        'valor_unitario', i.valor_unitario,
        'valor_mao_obra', i.valor_mao_obra,
        'valor_total', i.valor_total
      )), '[]'::json)
      FROM itens_orcamento i
      WHERE i.orcamento_id = o.id
    )
  ) INTO result
  FROM orcamentos o
  LEFT JOIN oficinas of ON of.id = o.oficina_id
  LEFT JOIN clientes c ON c.id = o.cliente_id
  LEFT JOIN veiculos v ON v.id = o.veiculo_id
  WHERE o.id = orcamento_id;

  RETURN result;
END;
$function$;