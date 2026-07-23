-- Data Parity SQL
-- Run in BOTH old and new SQL Editor and compare results
-- No writes — read-only

-- 1. Row counts + temporal markers per critical table
SELECT
  'auth.users'          AS tabela, count(*) AS total, min(created_at) AS primeiro, max(created_at) AS ultimo FROM auth.users
UNION ALL SELECT 'auth.identities', count(*), min(created_at), max(created_at) FROM auth.identities
UNION ALL SELECT 'profiles',        count(*), min(created_at), max(updated_at) FROM profiles
UNION ALL SELECT 'user_roles',      count(*), min(created_at), max(created_at) FROM user_roles
UNION ALL SELECT 'oficinas',        count(*), min(created_at), max(updated_at) FROM oficinas
UNION ALL SELECT 'clientes',        count(*), min(created_at), max(updated_at) FROM clientes
UNION ALL SELECT 'veiculos',        count(*), min(criado_em),  max(criado_em)  FROM veiculos
UNION ALL SELECT 'ordens_servico',  count(*), min(created_at), max(updated_at) FROM ordens_servico
UNION ALL SELECT 'orcamentos',      count(*), min(created_at), max(updated_at) FROM orcamentos
UNION ALL SELECT 'financeiro',      count(*), min(created_at), max(updated_at) FROM financeiro
UNION ALL SELECT 'pagamentos',      count(*), min(created_at), max(created_at) FROM pagamentos
UNION ALL SELECT 'subscriptions',   count(*), min(created_at), max(updated_at) FROM subscriptions
UNION ALL SELECT 'estoque',         count(*), min(created_at), max(updated_at) FROM estoque
UNION ALL SELECT 'estoque_movimentacoes', count(*), min(created_at), max(created_at) FROM estoque_movimentacoes
UNION ALL SELECT 'notificacoes',    count(*), min(created_at), max(created_at) FROM notificacoes
UNION ALL SELECT 'idempotency_keys',count(*), min(created_at), max(created_at) FROM idempotency_keys
UNION ALL SELECT 'storage.buckets', count(*), min(created_at), max(updated_at) FROM storage.buckets
UNION ALL SELECT 'storage.objects', count(*), min(created_at), max(updated_at) FROM storage.objects
ORDER BY tabela;

-- 2. Financial sums (detect missing transactions)
SELECT
  sum(valor)              AS total_financeiro,
  count(*)                AS registros,
  sum(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END) AS receitas,
  sum(CASE WHEN tipo = 'despesa' THEN valor ELSE 0 END) AS despesas
FROM financeiro;

-- 3. OS status distribution
SELECT status, count(*) FROM ordens_servico GROUP BY status ORDER BY count DESC;

-- 4. Subscriptions status
SELECT status, plan_type, count(*) FROM subscriptions GROUP BY status, plan_type ORDER BY count DESC;

-- 5. Storage objects per bucket
SELECT bucket_id, count(*) AS objects FROM storage.objects GROUP BY bucket_id ORDER BY bucket_id;

-- 6. Detect rows newer than backup date (2026-07-16) — these exist only in OLD
SELECT 'profiles_post_backup'   AS item, count(*) FROM profiles        WHERE created_at > '2026-07-16'
UNION ALL SELECT 'clientes_post_backup',     count(*) FROM clientes        WHERE created_at > '2026-07-16'
UNION ALL SELECT 'ordens_post_backup',       count(*) FROM ordens_servico  WHERE created_at > '2026-07-16'
UNION ALL SELECT 'financeiro_post_backup',   count(*) FROM financeiro      WHERE created_at > '2026-07-16'
UNION ALL SELECT 'pagamentos_post_backup',   count(*) FROM pagamentos      WHERE created_at > '2026-07-16'
UNION ALL SELECT 'oficinas_post_backup',     count(*) FROM oficinas        WHERE created_at > '2026-07-16';
