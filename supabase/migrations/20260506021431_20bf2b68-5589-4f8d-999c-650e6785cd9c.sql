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
      'quantidade', i.quantidade,
      'valor_unitario', i.valor_unitario,
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
    'data_servico', os.data_servico,
    'valor_servico', os.valor_servico,
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
      'razao_social', oc.razao_social
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