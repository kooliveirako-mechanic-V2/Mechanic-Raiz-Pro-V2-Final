-- Incidente cascata: OS pública também tinha caminho por número sequencial.
-- 1) Remover acesso público direto à tabela de ordens de serviço.
DROP POLICY IF EXISTS "Acesso público para ordens de serviço" ON public.ordens_servico;

-- 2) Desativar função pública por número previsível.
REVOKE EXECUTE ON FUNCTION public.get_public_os_by_numero(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_public_os_by_numero(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_public_os_by_numero(integer) FROM authenticated;

CREATE OR REPLACE FUNCTION public.get_public_os_by_numero(os_numero integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN json_build_object(
    'error', 'legacy_os_numero_disabled',
    'message', 'Link por número desativado por segurança. Gere um novo link seguro da OS.'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_os_by_numero(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_public_os_by_numero(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_public_os_by_numero(integer) FROM authenticated;

-- 3) Garantir que o link seguro por UUID continue funcionando publicamente.
GRANT EXECUTE ON FUNCTION public.get_public_os(uuid) TO anon, authenticated;