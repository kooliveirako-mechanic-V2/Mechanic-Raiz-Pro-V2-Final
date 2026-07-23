-- ============================================================
-- MECHANIC RAIZ PRO — AUDITORIA DO PROJETO NOVO
-- Executar no SQL Editor do Supabase novo (kurlgmngmglhvknwxjee)
-- Somente leitura — nenhum comando altera dados
-- ============================================================

-- 1. IDENTIFICAÇÃO
SELECT current_database(), current_user, version();

-- 2. CONTAGENS GERAIS
SELECT
  (SELECT count(*) FROM information_schema.tables
   WHERE table_schema = 'public') AS information_schema_tables,
  (SELECT count(*) FROM pg_tables
   WHERE schemaname = 'public') AS pg_tables,
  (SELECT count(*) FROM pg_policies
   WHERE schemaname = 'public') AS policies,
  (SELECT count(*) FROM pg_proc p
   JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public') AS public_routines,
  (SELECT count(*) FROM pg_trigger t
   JOIN pg_class c ON c.oid = t.tgrelid
   JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND NOT t.tgisinternal) AS public_triggers,
  (SELECT count(*) FROM auth.users) AS auth_users,
  (SELECT count(*) FROM auth.identities) AS auth_identities,
  (SELECT count(*) FROM storage.buckets) AS buckets,
  (SELECT count(*) FROM storage.objects) AS storage_objects;

-- 3. TABELAS (com RLS status)
SELECT
  t.table_name,
  t.table_type,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced,
  obj_description(c.oid) AS description
FROM information_schema.tables t
JOIN pg_class c ON c.relname = t.table_name
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
WHERE t.table_schema = 'public'
ORDER BY t.table_name;

-- 4. CONTAGENS DAS TABELAS PRINCIPAIS
SELECT
  (SELECT count(*) FROM profiles)              AS profiles,
  (SELECT count(*) FROM oficinas)              AS oficinas,
  (SELECT count(*) FROM user_roles)            AS user_roles,
  (SELECT count(*) FROM clientes)              AS clientes,
  (SELECT count(*) FROM ordens_servico)        AS ordens_servico,
  (SELECT count(*) FROM veiculos)              AS veiculos,
  (SELECT count(*) FROM financeiro)            AS financeiro,
  (SELECT count(*) FROM pagamentos)            AS pagamentos,
  (SELECT count(*) FROM subscriptions)         AS subscriptions,
  (SELECT count(*) FROM estoque)               AS estoque,
  (SELECT count(*) FROM estoque_movimentacoes) AS estoque_movimentacoes,
  (SELECT count(*) FROM orcamentos)            AS orcamentos,
  (SELECT count(*) FROM idempotency_keys)      AS idempotency_keys,
  (SELECT count(*) FROM notificacoes)          AS notificacoes,
  (SELECT count(*) FROM funnel_events)         AS funnel_events;

-- 5. INVENTÁRIO COMPLETO DE ROTINAS (com hash)
SELECT
  p.proname AS routine_name,
  pg_get_function_arguments(p.oid) AS arguments,
  pg_get_function_result(p.oid) AS return_type,
  CASE p.prosecdef WHEN true THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security,
  CASE p.provolatile
    WHEN 'i' THEN 'IMMUTABLE'
    WHEN 's' THEN 'STABLE'
    WHEN 'v' THEN 'VOLATILE'
  END AS volatility,
  r.rolname AS owner,
  md5(pg_get_functiondef(p.oid)) AS definition_hash
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_roles r ON r.oid = p.proowner
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- 6. TRIGGERS E FUNÇÕES ASSOCIADAS
SELECT
  t.tgname AS trigger_name,
  c.relname AS table_name,
  p.proname AS function_name,
  CASE t.tgtype & 2 WHEN 2 THEN 'BEFORE' ELSE 'AFTER' END AS timing,
  CASE
    WHEN t.tgtype & 4  != 0 THEN 'INSERT'
    WHEN t.tgtype & 8  != 0 THEN 'DELETE'
    WHEN t.tgtype & 16 != 0 THEN 'UPDATE'
    ELSE 'OTHER'
  END AS event,
  t.tgenabled AS enabled
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE n.nspname = 'public' AND NOT t.tgisinternal
ORDER BY c.relname, t.tgname;

-- 7. POLICIES RLS
SELECT
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 8. EXTENSÕES
SELECT name, default_version, installed_version, comment
FROM pg_available_extensions
WHERE installed_version IS NOT NULL
ORDER BY name;

-- 9. VIEWS
SELECT table_name, view_definition
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

-- 10. SEQUENCES
SELECT sequence_name, start_value, minimum_value, maximum_value, increment
FROM information_schema.sequences
WHERE sequence_schema = 'public'
ORDER BY sequence_name;

-- 11. FOREIGN KEYS
SELECT
  tc.table_name AS from_table,
  kcu.column_name AS from_column,
  ccu.table_name AS to_table,
  ccu.column_name AS to_column,
  tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- 12. INDEXES
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 13. PUBLICAÇÕES REALTIME
SELECT pubname, puballtables, pubinsert, pubupdate, pubdelete
FROM pg_publication;

SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';

-- 14. STORAGE BUCKETS
SELECT
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at,
  updated_at
FROM storage.buckets
ORDER BY name;

-- 15. OBJETOS POR BUCKET
SELECT
  bucket_id,
  count(*) AS object_count,
  sum(octet_length(name)) AS approx_path_bytes
FROM storage.objects
GROUP BY bucket_id
ORDER BY bucket_id;

-- 16. AUTH — visão geral
SELECT
  id,
  email,
  email_confirmed_at IS NOT NULL AS email_confirmed,
  CASE WHEN encrypted_password IS NOT NULL AND encrypted_password != '' THEN 'has_password' ELSE 'no_password' END AS password_status,
  raw_app_meta_data->>'provider' AS primary_provider,
  created_at,
  last_sign_in_at,
  banned_until IS NOT NULL AS banned,
  deleted_at IS NOT NULL AS deleted
FROM auth.users
ORDER BY created_at;

-- 17. AUTH — identities (OAuth)
SELECT
  user_id,
  provider,
  provider_id,
  created_at
FROM auth.identities
ORDER BY user_id, provider;

-- 18. INTEGRIDADE — ÓRFÃOS E DIVERGÊNCIAS
-- profiles sem auth.users
SELECT p.id, p.email, 'profile_sem_auth_user' AS issue
FROM profiles p
LEFT JOIN auth.users u ON u.id = p.id
WHERE u.id IS NULL;

-- auth.users sem profiles
SELECT u.id, u.email, 'auth_user_sem_profile' AS issue
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- user_roles com usuário inexistente
SELECT ur.user_id, 'user_role_sem_auth_user' AS issue
FROM user_roles ur
LEFT JOIN auth.users u ON u.id = ur.user_id
WHERE u.id IS NULL;

-- oficinas com owner inexistente
SELECT o.id, o.nome, o.owner_id, 'oficina_sem_owner' AS issue
FROM oficinas o
LEFT JOIN auth.users u ON u.id = o.owner_id
WHERE u.id IS NULL;

-- ordens_servico com oficina inexistente
SELECT os.id, os.oficina_id, 'os_sem_oficina' AS issue
FROM ordens_servico os
LEFT JOIN oficinas o ON o.id = os.oficina_id
WHERE o.id IS NULL
LIMIT 50;

-- clientes com oficina inexistente
SELECT c.id, c.oficina_id, 'cliente_sem_oficina' AS issue
FROM clientes c
LEFT JOIN oficinas o ON o.id = c.oficina_id
WHERE o.id IS NULL
LIMIT 50;

-- subscriptions com user/oficina inexistente
SELECT s.id, s.user_id, s.oficina_id, 'subscription_orfao' AS issue
FROM subscriptions s
LEFT JOIN auth.users u ON u.id = s.user_id
LEFT JOIN oficinas o ON o.id = s.oficina_id
WHERE u.id IS NULL OR o.id IS NULL
LIMIT 50;

-- pagamentos com referência inválida
SELECT p.id, p.oficina_id, 'pagamento_sem_oficina' AS issue
FROM pagamentos p
LEFT JOIN oficinas o ON o.id = p.oficina_id
WHERE o.id IS NULL
LIMIT 50;

-- 19. PARIDADE DE DADOS — checksums determinísticos para tabelas críticas
SELECT
  'profiles'       AS tabela, count(*) AS total,
  min(created_at)  AS primeiro, max(created_at) AS ultimo,
  max(updated_at)  AS mais_recente_update
FROM profiles
UNION ALL SELECT 'oficinas', count(*), min(created_at), max(created_at), max(updated_at) FROM oficinas
UNION ALL SELECT 'ordens_servico', count(*), min(created_at), max(created_at), max(updated_at) FROM ordens_servico
UNION ALL SELECT 'clientes', count(*), min(created_at), max(created_at), max(updated_at) FROM clientes
UNION ALL SELECT 'veiculos', count(*), min(criado_em), max(criado_em), NULL FROM veiculos
UNION ALL SELECT 'financeiro', count(*), min(created_at), max(created_at), max(updated_at) FROM financeiro
UNION ALL SELECT 'pagamentos', count(*), min(created_at), max(created_at), NULL FROM pagamentos
UNION ALL SELECT 'subscriptions', count(*), min(created_at), max(created_at), max(updated_at) FROM subscriptions
UNION ALL SELECT 'estoque', count(*), min(created_at), max(created_at), max(updated_at) FROM estoque
UNION ALL SELECT 'orcamentos', count(*), min(created_at), max(created_at), max(updated_at) FROM orcamentos
ORDER BY tabela;

-- 20. CRON JOBS (se extensão pg_cron disponível)
SELECT jobid, schedule, command, nodename, active
FROM cron.job
ORDER BY jobid;
