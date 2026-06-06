-- Adiciona os novos valores ao enum app_role
-- Como enums no Postgres não podem ser alterados facilmente dentro de transações se usados em tabelas,
-- usamos uma abordagem segura de adicionar os valores.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'master';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'platform_admin';

-- Garante que as permissões estejam corretas
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
