-- Criar função para busca pública de Orçamento (sem RLS)
CREATE OR REPLACE FUNCTION public.get_public_orcamento(orcamento_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    'custo_total', o.custo_total,
    'desconto', o.desconto,
    'validade', o.validade,
    'observacoes', o.observacoes,
    'created_at', o.created_at,
    'oficina', json_build_object(
      'nome', of.nome,
      'logo_url', of.logo_url,
      'telefone', of.telefone,
      'endereco', of.endereco
    ),
    'cliente', CASE WHEN c.id IS NOT NULL THEN json_build_object(
      'nome', c.nome,
      'telefone', c.telefone
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
$$;