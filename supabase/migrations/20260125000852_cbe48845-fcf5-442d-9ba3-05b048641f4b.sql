-- Add unique access token to clientes table
ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS portal_token uuid DEFAULT gen_random_uuid() UNIQUE;

-- Create index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_clientes_portal_token ON public.clientes(portal_token);

-- Create function to get client portal data (security definer for public access)
CREATE OR REPLACE FUNCTION public.get_client_portal_data(p_token uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
  v_cliente_id uuid;
  v_oficina_id uuid;
BEGIN
  -- Get cliente and oficina from token
  SELECT id, oficina_id INTO v_cliente_id, v_oficina_id
  FROM clientes
  WHERE portal_token = p_token;

  IF v_cliente_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Build complete portal data
  SELECT json_build_object(
    'cliente', json_build_object(
      'id', c.id,
      'nome', c.nome,
      'telefone', c.telefone,
      'email', c.email
    ),
    'oficina', json_build_object(
      'nome', o.nome,
      'logo_url', o.logo_url,
      'telefone', o.telefone,
      'endereco', o.endereco
    ),
    'veiculos', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', v.id,
        'marca', v.marca,
        'modelo', v.modelo,
        'placa', v.placa,
        'ano', v.ano,
        'tipo', v.tipo,
        'km_atual', v.km_atual,
        'servicos', (
          SELECT COALESCE(json_agg(json_build_object(
            'id', os.id,
            'tipo_servico', os.tipo_servico,
            'descricao', os.descricao,
            'data_servico', os.data_servico,
            'status', os.status,
            'valor_servico', os.valor_servico,
            'tem_garantia', os.tem_garantia,
            'dias_garantia', os.dias_garantia,
            'data_conclusao', os.data_conclusao
          ) ORDER BY os.data_servico DESC), '[]'::json)
          FROM ordens_servico os
          WHERE os.veiculo_id = v.id
        ),
        'recorrencias', (
          SELECT COALESCE(json_agg(json_build_object(
            'id', r.id,
            'tipo_servico', r.tipo_servico,
            'proxima_execucao', r.proxima_execucao,
            'intervalo_dias', r.intervalo_dias,
            'intervalo_km', r.intervalo_km
          ) ORDER BY r.proxima_execucao ASC), '[]'::json)
          FROM recorrencias r
          WHERE r.veiculo_id = v.id AND r.ativo = true
        )
      ) ORDER BY v.created_at DESC), '[]'::json)
      FROM veiculos v
      WHERE v.cliente_id = c.id
    ),
    'orcamentos', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', orc.id,
        'numero', orc.numero,
        'titulo', orc.titulo,
        'descricao', orc.descricao,
        'status', orc.status,
        'valor_total', orc.valor_total,
        'desconto', orc.desconto,
        'validade', orc.validade,
        'created_at', orc.created_at,
        'veiculo', (
          SELECT json_build_object(
            'marca', vv.marca,
            'modelo', vv.modelo,
            'placa', vv.placa
          )
          FROM veiculos vv WHERE vv.id = orc.veiculo_id
        ),
        'itens', (
          SELECT COALESCE(json_agg(json_build_object(
            'nome_item', i.nome_item,
            'tipo', i.tipo,
            'quantidade', i.quantidade,
            'valor_unitario', i.valor_unitario,
            'valor_total', i.valor_total
          )), '[]'::json)
          FROM itens_orcamento i WHERE i.orcamento_id = orc.id
        )
      ) ORDER BY orc.created_at DESC), '[]'::json)
      FROM orcamentos orc
      WHERE orc.cliente_id = c.id
    )
  ) INTO result
  FROM clientes c
  JOIN oficinas o ON o.id = c.oficina_id
  WHERE c.id = v_cliente_id;

  RETURN result;
END;
$$;