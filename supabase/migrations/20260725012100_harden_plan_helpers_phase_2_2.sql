-- Fase 2.2: Lockdown plan/feature helper functions
-- Escopo: apenas REVOKE/GRANT. Corpo das funcoes NAO foi alterado.
-- Motivo: remover execucao anonima de funcoes que expoe informacao comercial cross-tenant.
-- Nota: nenhuma RLS policy depende destas funcoes neste banco (verificado via pg_policies).

-- has_feature
REVOKE EXECUTE ON FUNCTION public.has_feature(uuid, feature_type) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_feature(uuid, feature_type) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_feature(uuid, feature_type) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_feature(uuid, feature_type) TO service_role;

-- get_oficina_plan
REVOKE EXECUTE ON FUNCTION public.get_oficina_plan(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_oficina_plan(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_oficina_plan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_oficina_plan(uuid) TO service_role;

-- get_oficina_features
REVOKE EXECUTE ON FUNCTION public.get_oficina_features(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_oficina_features(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_oficina_features(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_oficina_features(uuid) TO service_role;
