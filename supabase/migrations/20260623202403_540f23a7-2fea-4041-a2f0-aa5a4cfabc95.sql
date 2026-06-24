-- Hardening final: não permitir orçamento público por número sequencial, mesmo com oficina_id.
REVOKE EXECUTE ON FUNCTION public.get_public_orcamento_by_oficina_numero(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_public_orcamento_by_oficina_numero(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_public_orcamento_by_oficina_numero(uuid, integer) FROM authenticated;

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
BEGIN
  RETURN json_build_object(
    'error', 'legacy_orcamento_numero_disabled',
    'message', 'Link por número desativado por segurança. Gere um novo link seguro do orçamento.'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_orcamento_by_oficina_numero(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_public_orcamento_by_oficina_numero(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_public_orcamento_by_oficina_numero(uuid, integer) FROM authenticated;