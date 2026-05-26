
-- 1. Table
CREATE TABLE public.team_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oficina_id uuid NOT NULL,
  email text NOT NULL,
  role app_role NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status text NOT NULL DEFAULT 'pendente',
  invited_by uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_invites_status_check CHECK (status IN ('pendente','aceito','expirado','cancelado')),
  CONSTRAINT team_invites_role_check CHECK (role IN ('administrador','funcionario'))
);

CREATE INDEX idx_team_invites_token ON public.team_invites(token);
CREATE INDEX idx_team_invites_oficina ON public.team_invites(oficina_id);
CREATE UNIQUE INDEX uq_team_invites_pendente
  ON public.team_invites(oficina_id, lower(email))
  WHERE status = 'pendente';

ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY team_invites_owner_select ON public.team_invites
  FOR SELECT TO authenticated
  USING (is_oficina_owner(auth.uid(), oficina_id));

CREATE POLICY team_invites_owner_insert ON public.team_invites
  FOR INSERT TO authenticated
  WITH CHECK (is_oficina_owner(auth.uid(), oficina_id) AND invited_by = auth.uid());

CREATE POLICY team_invites_owner_update ON public.team_invites
  FOR UPDATE TO authenticated
  USING (is_oficina_owner(auth.uid(), oficina_id));

CREATE POLICY team_invites_owner_delete ON public.team_invites
  FOR DELETE TO authenticated
  USING (is_oficina_owner(auth.uid(), oficina_id));

-- 2. RPC: create invite
CREATE OR REPLACE FUNCTION public.create_team_invite(
  _oficina_id uuid,
  _email text,
  _role app_role
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_token text;
  _invite_id uuid;
  _existing_user uuid;
  _normalized_email text;
BEGIN
  IF NOT is_oficina_owner(auth.uid(), _oficina_id) THEN
    RETURN json_build_object('success', false, 'error', 'Apenas o proprietário pode convidar membros');
  END IF;

  IF _role NOT IN ('administrador','funcionario') THEN
    RETURN json_build_object('success', false, 'error', 'Cargo inválido');
  END IF;

  _normalized_email := lower(trim(_email));

  IF _normalized_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN json_build_object('success', false, 'error', 'E-mail inválido');
  END IF;

  -- Check if already an active member
  SELECT u.id INTO _existing_user
  FROM auth.users u
  WHERE lower(u.email) = _normalized_email
  LIMIT 1;

  IF _existing_user IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _existing_user AND oficina_id = _oficina_id AND active = true
    ) THEN
      RETURN json_build_object('success', false, 'error', 'Este usuário já faz parte da equipe');
    END IF;
  END IF;

  -- Cancel previous pending invites for same email/oficina
  UPDATE public.team_invites
    SET status = 'cancelado'
    WHERE oficina_id = _oficina_id
      AND lower(email) = _normalized_email
      AND status = 'pendente';

  INSERT INTO public.team_invites (oficina_id, email, role, invited_by)
  VALUES (_oficina_id, _normalized_email, _role, auth.uid())
  RETURNING id, token INTO _invite_id, _new_token;

  RETURN json_build_object(
    'success', true,
    'invite_id', _invite_id,
    'token', _new_token,
    'email', _normalized_email,
    'user_exists', _existing_user IS NOT NULL
  );
END;
$$;

-- 3. RPC: public info for invite page
CREATE OR REPLACE FUNCTION public.get_invite_info(_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invite record;
  _oficina_nome text;
BEGIN
  SELECT * INTO _invite
  FROM public.team_invites
  WHERE token = _token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Convite não encontrado');
  END IF;

  IF _invite.status <> 'pendente' THEN
    RETURN json_build_object('success', false, 'error', 'Este convite já foi ' || _invite.status);
  END IF;

  IF _invite.expires_at < now() THEN
    UPDATE public.team_invites SET status = 'expirado' WHERE id = _invite.id;
    RETURN json_build_object('success', false, 'error', 'Este convite expirou');
  END IF;

  SELECT nome INTO _oficina_nome FROM public.oficinas WHERE id = _invite.oficina_id;

  RETURN json_build_object(
    'success', true,
    'email', _invite.email,
    'role', _invite.role,
    'oficina_nome', _oficina_nome,
    'expires_at', _invite.expires_at
  );
END;
$$;

-- 4. RPC: accept invite (requires auth)
CREATE OR REPLACE FUNCTION public.accept_team_invite(_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invite record;
  _user_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Faça login para aceitar o convite');
  END IF;

  SELECT * INTO _invite
  FROM public.team_invites
  WHERE token = _token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Convite não encontrado');
  END IF;

  IF _invite.status <> 'pendente' THEN
    RETURN json_build_object('success', false, 'error', 'Convite já utilizado ou cancelado');
  END IF;

  IF _invite.expires_at < now() THEN
    UPDATE public.team_invites SET status = 'expirado' WHERE id = _invite.id;
    RETURN json_build_object('success', false, 'error', 'Convite expirado');
  END IF;

  SELECT lower(email) INTO _user_email FROM auth.users WHERE id = auth.uid();

  IF _user_email IS DISTINCT FROM lower(_invite.email) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Este convite foi enviado para ' || _invite.email || '. Faça login com esse e-mail.'
    );
  END IF;

  -- Insert or reactivate role
  INSERT INTO public.user_roles (user_id, oficina_id, role, active)
  VALUES (auth.uid(), _invite.oficina_id, _invite.role, true)
  ON CONFLICT (user_id, oficina_id)
  DO UPDATE SET role = EXCLUDED.role, active = true, deactivated_at = NULL;

  UPDATE public.team_invites
    SET status = 'aceito', accepted_at = now(), accepted_by = auth.uid()
    WHERE id = _invite.id;

  RETURN json_build_object(
    'success', true,
    'oficina_id', _invite.oficina_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invite_info(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_team_invite(uuid, text, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_team_invite(text) TO authenticated;
