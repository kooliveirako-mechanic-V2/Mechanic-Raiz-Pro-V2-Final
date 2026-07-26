BEGIN;

-- recalcular_totais_orcamento era SECURITY DEFINER com EXECUTE para PUBLIC/anon
-- e sem guard de tenant no corpo. Restringe execução a authenticated/service_role.
-- Aplicado ao banco novo (kurlgmngmglhvknwxjee) via Management API em 2026-07-26;
-- este arquivo garante que db reset/push reaplique a restrição.

REVOKE EXECUTE ON FUNCTION public.recalcular_totais_orcamento(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalcular_totais_orcamento(uuid) TO authenticated, service_role;

COMMIT;
