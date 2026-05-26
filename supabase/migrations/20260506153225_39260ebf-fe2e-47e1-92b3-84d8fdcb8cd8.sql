-- Adiciona provider 'email' à conta ko.oliveira2016@gmail.com (que era só Google)
-- para permitir login com email/senha junto do Google no MESMO user_id.
DO $$
DECLARE
  v_uid uuid := '82879702-5e29-4d83-86a4-08a9f061a6a4';
  v_email text := 'ko.oliveira2016@gmail.com';
BEGIN
  -- Cria identity 'email' se não existir
  IF NOT EXISTS (
    SELECT 1 FROM auth.identities WHERE user_id = v_uid AND provider = 'email'
  ) THEN
    INSERT INTO auth.identities (id, user_id, provider, provider_id, identity_data, last_sign_in_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      v_uid,
      'email',
      v_uid::text,
      jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
      now(), now(), now()
    );
  END IF;

  -- Garante que app_metadata.providers inclua 'email'
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object(
           'provider', 'email',
           'providers', (
             SELECT to_jsonb(ARRAY(SELECT DISTINCT unnest(
               COALESCE(
                 ARRAY(SELECT jsonb_array_elements_text(raw_app_meta_data->'providers')),
                 ARRAY[]::text[]
               ) || ARRAY['email','google']
             )))
           )
         ),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at = now()
  WHERE id = v_uid;
END $$;