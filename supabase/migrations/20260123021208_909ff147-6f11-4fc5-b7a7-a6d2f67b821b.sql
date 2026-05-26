-- Drop existing function first
DROP FUNCTION IF EXISTS public.get_oficina_funcionarios(uuid);

-- Recreate with email column
CREATE OR REPLACE FUNCTION public.get_oficina_funcionarios(_oficina_id uuid)
RETURNS TABLE (
  user_id uuid,
  nome text,
  role app_role,
  email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Proprietário da oficina
  SELECT 
    o.user_id,
    COALESCE(p.nome, 'Proprietário') as nome,
    'proprietario'::app_role as role,
    NULL::text as email
  FROM public.oficinas o
  LEFT JOIN public.profiles p ON p.user_id = o.user_id
  WHERE o.id = _oficina_id
  
  UNION ALL
  
  -- Funcionários e administradores (apenas ativos)
  SELECT 
    ur.user_id,
    COALESCE(p.nome, 'Funcionário') as nome,
    ur.role,
    NULL::text as email
  FROM public.user_roles ur
  LEFT JOIN public.profiles p ON p.user_id = ur.user_id
  WHERE ur.oficina_id = _oficina_id
    AND ur.active = true
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_oficina_funcionarios(uuid) TO authenticated;

-- Create function to add team member by email
CREATE OR REPLACE FUNCTION public.add_team_member_by_email(
  _oficina_id uuid,
  _email text,
  _role app_role
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_nome text;
  v_existing_role app_role;
BEGIN
  -- Check if caller is owner
  IF NOT is_oficina_owner(auth.uid(), _oficina_id) THEN
    RETURN json_build_object('success', false, 'error', 'Apenas o proprietário pode adicionar membros');
  END IF;

  -- Find user by email in auth.users (we have access via security definer)
  SELECT au.id INTO v_user_id
  FROM auth.users au
  WHERE au.email = _email;

  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuário não encontrado. O funcionário precisa criar uma conta primeiro.');
  END IF;

  -- Check if user is already the owner
  IF EXISTS (SELECT 1 FROM oficinas WHERE id = _oficina_id AND user_id = v_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Este usuário já é o proprietário da oficina');
  END IF;

  -- Check if user already has a role in this oficina
  SELECT role INTO v_existing_role
  FROM user_roles
  WHERE user_id = v_user_id AND oficina_id = _oficina_id AND active = true;

  IF v_existing_role IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Este usuário já faz parte da equipe');
  END IF;

  -- Get user name from profile
  SELECT nome INTO v_nome FROM profiles WHERE user_id = v_user_id;

  -- Check if there's an inactive record to reactivate
  IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = v_user_id AND oficina_id = _oficina_id AND active = false) THEN
    UPDATE user_roles
    SET active = true, role = _role, deactivated_at = NULL, updated_at = now()
    WHERE user_id = v_user_id AND oficina_id = _oficina_id;
  ELSE
    -- Insert new role
    INSERT INTO user_roles (user_id, oficina_id, role, active)
    VALUES (v_user_id, _oficina_id, _role, true);
  END IF;

  RETURN json_build_object(
    'success', true, 
    'user_id', v_user_id,
    'nome', COALESCE(v_nome, 'Novo Membro')
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.add_team_member_by_email(uuid, text, app_role) TO authenticated;