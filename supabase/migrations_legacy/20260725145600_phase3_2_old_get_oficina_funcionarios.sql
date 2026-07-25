-- LEGACY HOTFIX — Aplicado na produção viva.
-- Target project: cuhkkoqqeguascdsvtky (banco antigo, NÃO é o projeto linkado deste repo).
-- Data/hora UTC: 2026-07-25 14:56 (migration) / 15:10 (smoke test real).
-- Pre-patch MD5: ad424c434c22ac35223d9b58a26e0c84 (829 bytes, language sql)
-- Post-patch MD5: 1d8cd741e487424162c16966e5a513b5 (1133 bytes, language plpgsql)
-- Assinatura e return type intactos; adicionado apenas guard + search_path + lockdown de grants.
-- Campo email mantido NULL::text para evitar vazamento de PII.
-- Este arquivo é registro de rastreabilidade; não é aplicado via `supabase db push` neste repo.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_oficina_funcionarios(_oficina_id uuid)
RETURNS TABLE(user_id uuid, nome text, role app_role, email text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $function$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
    END IF;

    IF NOT public.has_oficina_access(auth.uid(), _oficina_id) THEN
      RAISE EXCEPTION 'forbidden: cross-tenant access denied' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    o.user_id,
    COALESCE(p.nome, 'Proprietário') AS nome,
    'proprietario'::app_role AS role,
    NULL::text AS email
  FROM public.oficinas o
  LEFT JOIN public.profiles p ON p.user_id = o.user_id
  WHERE o.id = _oficina_id

  UNION ALL

  SELECT
    ur.user_id,
    COALESCE(p.nome, 'Funcionário') AS nome,
    ur.role,
    NULL::text AS email
  FROM public.user_roles ur
  LEFT JOIN public.profiles p ON p.user_id = ur.user_id
  WHERE ur.oficina_id = _oficina_id
    AND ur.active = true;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_oficina_funcionarios(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_oficina_funcionarios(uuid) TO authenticated, service_role;

COMMIT;
