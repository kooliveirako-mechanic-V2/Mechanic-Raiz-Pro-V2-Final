
-- 1) Garantir unicidade por oficina (não afeta números repetidos ENTRE oficinas, apenas DENTRO da mesma)
CREATE UNIQUE INDEX IF NOT EXISTS orcamentos_oficina_numero_uniq
  ON public.orcamentos (oficina_id, numero);

-- 2) Nova RPC pública segura: exige oficina_id + numero
CREATE OR REPLACE FUNCTION public.get_public_orcamento_by_oficina_numero(
  p_oficina_id uuid,
  p_numero integer
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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

  RETURN get_public_orcamento(v_orcamento_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_orcamento_by_oficina_numero(uuid, integer) TO anon, authenticated;
