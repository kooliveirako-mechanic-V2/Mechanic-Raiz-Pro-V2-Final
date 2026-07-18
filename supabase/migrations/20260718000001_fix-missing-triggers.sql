-- ============================================================
-- MIGRATION CORRETIVA: Triggers ausentes no projeto novo
--
-- Aplicado via SQL direto (db push não funciona: banco novo foi
-- restaurado via dump e tem migration history divergente).
--
-- APLICADO (função existe, trigger criado com sucesso):
--   on_auth_user_created — AFTER INSERT ON auth.users
--     → public.handle_new_user()
--     → CRÍTICO: cria profile automaticamente ao criar usuário
--
-- PENDENTES (funções ausentes — aguardar novo snapshot do public):
--   trg_rate_limit_os_insert  → public.rate_limit_os_insert()
--   trg_relink_migrated_user  → public.relink_migrated_user()
--   validate_veiculo_tipo_trigger → public.validate_veiculo_tipo()
--   validate_orcamento_access_trigger → public.validate_orcamento_access()
--   validate_estoque_access_trigger → public.validate_estoque_access()
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'on_auth_user_created'
      AND n.nspname = 'auth'
      AND c.relname = 'users'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

