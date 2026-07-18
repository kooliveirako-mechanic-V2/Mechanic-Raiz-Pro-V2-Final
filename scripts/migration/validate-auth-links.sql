-- Auth Integrity Validation
-- Run in SQL Editor of the NEW project (kurlgmngmglhvknwxjee)
-- Read-only — no writes

-- 1. Overall counts
SELECT
  (SELECT count(*) FROM auth.users)                                          AS auth_users,
  (SELECT count(*) FROM auth.users WHERE encrypted_password IS NOT NULL
                                     AND encrypted_password != '')           AS users_with_password,
  (SELECT count(*) FROM auth.users WHERE encrypted_password IS NULL
                                      OR encrypted_password = '')            AS users_without_password,
  (SELECT count(*) FROM auth.identities)                                     AS auth_identities,
  (SELECT count(*) FROM auth.identities WHERE provider = 'google')           AS google_identities,
  (SELECT count(*) FROM auth.identities WHERE provider = 'email')            AS email_identities,
  (SELECT count(*) FROM auth.users WHERE email_confirmed_at IS NOT NULL)     AS email_confirmed,
  (SELECT count(*) FROM auth.users WHERE deleted_at IS NOT NULL)             AS deleted_users,
  (SELECT count(*) FROM profiles)                                            AS profiles,
  (SELECT count(*) FROM user_roles)                                          AS user_roles;

-- 2. auth.users without profiles
SELECT u.id, u.email, u.created_at, 'auth_user_sem_profile' AS issue
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE p.id IS NULL AND u.deleted_at IS NULL
ORDER BY u.created_at DESC;

-- 3. profiles without auth.users
SELECT p.id, p.email, p.created_at, 'profile_sem_auth_user' AS issue
FROM profiles p
LEFT JOIN auth.users u ON u.id = p.id
WHERE u.id IS NULL
ORDER BY p.created_at DESC;

-- 4. user_roles with no matching auth.user
SELECT ur.user_id, ur.role, ur.oficina_id, 'user_role_sem_auth_user' AS issue
FROM user_roles ur
LEFT JOIN auth.users u ON u.id = ur.user_id
WHERE u.id IS NULL;

-- 5. oficinas with no matching auth.user as owner
SELECT o.id, o.nome, o.owner_id, 'oficina_sem_owner' AS issue
FROM oficinas o
LEFT JOIN auth.users u ON u.id = o.owner_id
WHERE u.id IS NULL;

-- 6. Users by provider
SELECT
  raw_app_meta_data->>'provider' AS primary_provider,
  count(*) AS total,
  count(*) FILTER (WHERE encrypted_password IS NOT NULL AND encrypted_password != '') AS with_password,
  count(*) FILTER (WHERE email_confirmed_at IS NOT NULL) AS email_confirmed
FROM auth.users
WHERE deleted_at IS NULL
GROUP BY primary_provider
ORDER BY total DESC;

-- 7. Recent signups (last 30 days)
SELECT id, email, created_at, raw_app_meta_data->>'provider' AS provider
FROM auth.users
WHERE created_at > NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;

-- 8. identities per provider
SELECT provider, count(*) AS count
FROM auth.identities
GROUP BY provider
ORDER BY count DESC;
