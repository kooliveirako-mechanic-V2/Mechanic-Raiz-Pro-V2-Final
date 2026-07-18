-- ============================================================
-- MIGRATION CORRETIVA: Triggers ausentes no projeto novo
--
-- 6 triggers definidos nas migrations não existem no banco novo.
-- 3 deles podem ser criados agora (funções existem).
-- 3 dependem de funções ausentes (validate_veiculo_tipo,
--   validate_orcamento_access, validate_estoque_access) e
--   precisam aguardar o novo snapshot do public.
--
-- SAFE TO RUN: idempotente via CREATE OR REPLACE / IF NOT EXISTS
-- ============================================================

-- ─── 1. on_auth_user_created ────────────────────────────────
-- Crítico: cria profile automaticamente ao criar auth.user.
-- Ausência explica por que os 35 auth.users não têm profile.
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
    RAISE NOTICE 'Created trigger: on_auth_user_created';
  ELSE
    RAISE NOTICE 'Trigger already exists: on_auth_user_created';
  END IF;
END $$;

-- ─── 2. trg_rate_limit_os_insert ────────────────────────────
-- Protege ordens_servico contra inserção em massa.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'trg_rate_limit_os_insert'
      AND n.nspname = 'public'
      AND c.relname = 'ordens_servico'
  ) THEN
    CREATE TRIGGER trg_rate_limit_os_insert
      BEFORE INSERT ON ordens_servico
      FOR EACH ROW
      EXECUTE FUNCTION rate_limit_os_insert();
    RAISE NOTICE 'Created trigger: trg_rate_limit_os_insert';
  ELSE
    RAISE NOTICE 'Trigger already exists: trg_rate_limit_os_insert';
  END IF;
END $$;

-- ─── 3. trg_relink_migrated_user ────────────────────────────
-- Vincula usuários migrados ao criar em auth.users.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'trg_relink_migrated_user'
      AND n.nspname = 'auth'
      AND c.relname = 'users'
  ) THEN
    CREATE TRIGGER trg_relink_migrated_user
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.relink_migrated_user();
    RAISE NOTICE 'Created trigger: trg_relink_migrated_user';
  ELSE
    RAISE NOTICE 'Trigger already exists: trg_relink_migrated_user';
  END IF;
END $$;

-- ─── BLOQUEADOS: funções ausentes ───────────────────────────
-- Os triggers abaixo dependem de funções que não existem no
-- projeto novo. Aguardar novo snapshot do public para criar:
--
--   validate_veiculo_tipo_trigger
--     -> função: public.validate_veiculo_tipo()
--
--   validate_orcamento_access_trigger
--     -> função: public.validate_orcamento_access()
--
--   validate_estoque_access_trigger
--     -> função: public.validate_estoque_access()
--
-- Essas funções virão no próximo restore do schema public.
-- ─────────────────────────────────────────────────────────────
