-- Incidente: orçamento público por número sem oficina_id podia misturar oficinas.
-- 1) Remover acesso público direto e amplo à tabela de orçamentos.
DROP POLICY IF EXISTS "Acesso público para orçamentos via UUID" ON public.orcamentos;

-- 2) Desativar a função antiga insegura: ela fazia WHERE numero = p_numero LIMIT 1.
REVOKE EXECUTE ON FUNCTION public.get_public_orcamento_by_numero(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_public_orcamento_by_numero(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_public_orcamento_by_numero(integer) FROM authenticated;

CREATE OR REPLACE FUNCTION public.get_public_orcamento_by_numero(p_numero integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN json_build_object(
    'error', 'legacy_orcamento_numero_disabled',
    'message', 'Link antigo de orçamento desativado por segurança. Gere um novo link com oficina_id.'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_orcamento_by_numero(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_public_orcamento_by_numero(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_public_orcamento_by_numero(integer) FROM authenticated;

-- 3) RPC público por UUID: mantém compatibilidade com links UUID e retorna oficina_id
-- para o frontend redirecionar ao formato seguro /orcamento/o/:oficinaId/:numero.
CREATE OR REPLACE FUNCTION public.get_public_orcamento(orcamento_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'id', o.id,
    'oficina_id', o.oficina_id,
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
      'nome', ofi.nome,
      'logo_url', ofi.logo_url,
      'telefone', ofi.telefone,
      'endereco', ofi.endereco
    ),
    'cliente', CASE WHEN c.id IS NOT NULL THEN json_build_object(
      'nome', c.nome
    ) ELSE NULL END,
    'veiculo', CASE WHEN v.id IS NOT NULL THEN json_build_object(
      'marca', v.marca,
      'modelo', v.modelo,
      'placa', v.placa,
      'ano', v.ano,
      'tipo', v.tipo
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
      FROM public.itens_orcamento i
      WHERE i.orcamento_id = o.id
    )
  ) INTO result
  FROM public.orcamentos o
  LEFT JOIN public.oficinas ofi ON ofi.id = o.oficina_id
  LEFT JOIN public.clientes c ON c.id = o.cliente_id
  LEFT JOIN public.veiculos v ON v.id = o.veiculo_id
  WHERE o.id = orcamento_id;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_orcamento(uuid) TO anon, authenticated;

-- 4) RPC público seguro por oficina + número: garante filtro composto.
CREATE OR REPLACE FUNCTION public.get_public_orcamento_by_oficina_numero(
  p_oficina_id uuid,
  p_numero integer
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_orcamento_id uuid;
  v_ip_hash text;
BEGIN
  v_ip_hash := md5(COALESCE(current_setting('request.headers', true)::json->>'x-forwarded-for', 'unknown'));
  IF NOT check_rate_limit(v_ip_hash, 'get_public_orcamento') THEN
    RETURN json_build_object('error', 'rate_limit_exceeded');
  END IF;

  SELECT id INTO v_orcamento_id
  FROM public.orcamentos
  WHERE oficina_id = p_oficina_id
    AND numero = p_numero
  LIMIT 1;

  IF v_orcamento_id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN public.get_public_orcamento(v_orcamento_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_orcamento_by_oficina_numero(uuid, integer) TO anon, authenticated;