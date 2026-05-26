-- =====================================================
-- SECURITY HARDENING MIGRATION
-- Fortalece as funções de segurança existentes
-- =====================================================

-- 1. Atualizar is_oficina_owner com validação de NULL
CREATE OR REPLACE FUNCTION public.is_oficina_owner(_user_id uuid, _oficina_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT CASE
    WHEN _user_id IS NULL OR _oficina_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.oficinas
      WHERE id = _oficina_id
        AND user_id = _user_id
    )
  END
$$;

-- 2. Atualizar has_oficina_access com validação de NULL
CREATE OR REPLACE FUNCTION public.has_oficina_access(_user_id uuid, _oficina_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT CASE
    WHEN _user_id IS NULL OR _oficina_id IS NULL THEN false
    ELSE (
      public.is_oficina_owner(_user_id, _oficina_id)
      OR EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND oficina_id = _oficina_id
      )
    )
  END
$$;

-- 3. Atualizar has_role com validação de NULL
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _oficina_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT CASE
    WHEN _user_id IS NULL OR _oficina_id IS NULL OR _role IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND oficina_id = _oficina_id
        AND role = _role
    )
  END
$$;

-- 4. Atualizar get_user_role com validação de NULL
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid, _oficina_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT CASE
    WHEN _user_id IS NULL OR _oficina_id IS NULL THEN NULL
    WHEN public.is_oficina_owner(_user_id, _oficina_id) THEN 'proprietario'::app_role
    ELSE (SELECT role FROM public.user_roles WHERE user_id = _user_id AND oficina_id = _oficina_id)
  END
$$;

-- 5. Criar função para validar se usuário pode acessar dados sensíveis
-- (apenas proprietário e administrador podem ver dados financeiros e audit logs)
CREATE OR REPLACE FUNCTION public.can_access_sensitive_data(_user_id uuid, _oficina_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT CASE
    WHEN _user_id IS NULL OR _oficina_id IS NULL THEN false
    ELSE (
      public.is_oficina_owner(_user_id, _oficina_id)
      OR public.has_role(_user_id, _oficina_id, 'administrador')
    )
  END
$$;

-- 6. Adicionar trigger para auditar mudanças em user_roles
CREATE OR REPLACE FUNCTION public.audit_role_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (
      oficina_id,
      user_id,
      action,
      table_name,
      record_id,
      new_data
    ) VALUES (
      NEW.oficina_id,
      auth.uid(),
      'ROLE_GRANTED',
      'user_roles',
      NEW.id,
      jsonb_build_object('user_id', NEW.user_id, 'role', NEW.role)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (
      oficina_id,
      user_id,
      action,
      table_name,
      record_id,
      old_data,
      new_data
    ) VALUES (
      NEW.oficina_id,
      auth.uid(),
      'ROLE_CHANGED',
      'user_roles',
      NEW.id,
      jsonb_build_object('user_id', OLD.user_id, 'role', OLD.role),
      jsonb_build_object('user_id', NEW.user_id, 'role', NEW.role)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (
      oficina_id,
      user_id,
      action,
      table_name,
      record_id,
      old_data
    ) VALUES (
      OLD.oficina_id,
      auth.uid(),
      'ROLE_REVOKED',
      'user_roles',
      OLD.id,
      jsonb_build_object('user_id', OLD.user_id, 'role', OLD.role)
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Criar trigger para auditar mudanças em roles
DROP TRIGGER IF EXISTS audit_user_roles_changes ON public.user_roles;
CREATE TRIGGER audit_user_roles_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_role_changes();

-- 7. Atualizar políticas de clientes para usar funções mais seguras
-- (as políticas existentes já usam has_oficina_access, que agora está mais segura)

-- 8. Garantir que user_roles não pode ter user_id nulo
ALTER TABLE public.user_roles ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.user_roles ALTER COLUMN oficina_id SET NOT NULL;

-- 9. Adicionar índices para melhorar performance das funções de segurança
CREATE INDEX IF NOT EXISTS idx_user_roles_user_oficina ON public.user_roles(user_id, oficina_id);
CREATE INDEX IF NOT EXISTS idx_oficinas_user_id ON public.oficinas(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_oficina_id ON public.audit_logs(oficina_id);