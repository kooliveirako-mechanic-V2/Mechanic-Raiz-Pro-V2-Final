-- Confirma todos os usuários pendentes (resgate dos cadastros que ficaram presos por confirmação de e-mail)
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    confirmation_token = '',
    confirmation_sent_at = NULL
WHERE email_confirmed_at IS NULL;