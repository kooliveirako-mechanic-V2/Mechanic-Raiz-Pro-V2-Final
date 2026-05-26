-- Revoga acesso público à RPC de checagem legada (era enumerável por e-mail).
-- Mantemos a função no banco para uso interno/service_role, mas removemos
-- privilégios de anon e authenticated para impedir lookup pré-login.
REVOKE ALL ON FUNCTION public.check_legacy_migration(text) FROM anon;
REVOKE ALL ON FUNCTION public.check_legacy_migration(text) FROM authenticated;
REVOKE ALL ON FUNCTION public.check_legacy_migration(text) FROM PUBLIC;