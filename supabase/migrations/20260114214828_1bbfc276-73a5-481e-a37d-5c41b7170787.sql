-- =============================================
-- SEGURANÇA EXTREMA: RBAC + AUDITORIA + HELPERS
-- =============================================

-- 1. ENUM PARA ROLES
CREATE TYPE public.app_role AS ENUM ('proprietario', 'administrador', 'funcionario');

-- 2. TABELA DE ROLES (separada, como mandatório)
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    oficina_id uuid REFERENCES public.oficinas(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'funcionario',
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (user_id, oficina_id)
);

-- Habilitar RLS na tabela de roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. FUNÇÕES SECURITY DEFINER PARA VERIFICAÇÕES SEGURAS
-- Função para verificar se usuário possui determinado papel
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _oficina_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND oficina_id = _oficina_id
      AND role = _role
  )
$$;

-- Função para verificar se usuário é dono da oficina
CREATE OR REPLACE FUNCTION public.is_oficina_owner(_user_id uuid, _oficina_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.oficinas
    WHERE id = _oficina_id
      AND user_id = _user_id
  )
$$;

-- Função para verificar acesso do usuário à oficina (owner OU tem role)
CREATE OR REPLACE FUNCTION public.has_oficina_access(_user_id uuid, _oficina_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.is_oficina_owner(_user_id, _oficina_id)
    OR EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND oficina_id = _oficina_id
    )
$$;

-- Função para obter o papel do usuário em uma oficina
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid, _oficina_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE 
      WHEN public.is_oficina_owner(_user_id, _oficina_id) THEN 'proprietario'::app_role
      ELSE (SELECT role FROM public.user_roles WHERE user_id = _user_id AND oficina_id = _oficina_id)
    END
$$;

-- 4. POLÍTICAS RLS PARA user_roles
CREATE POLICY "Proprietários podem ver roles de suas oficinas"
ON public.user_roles FOR SELECT
USING (public.is_oficina_owner(auth.uid(), oficina_id));

CREATE POLICY "Proprietários podem criar roles em suas oficinas"
ON public.user_roles FOR INSERT
WITH CHECK (public.is_oficina_owner(auth.uid(), oficina_id));

CREATE POLICY "Proprietários podem atualizar roles de suas oficinas"
ON public.user_roles FOR UPDATE
USING (public.is_oficina_owner(auth.uid(), oficina_id));

CREATE POLICY "Proprietários podem deletar roles de suas oficinas"
ON public.user_roles FOR DELETE
USING (public.is_oficina_owner(auth.uid(), oficina_id));

-- 5. TABELA DE LOGS DE AUDITORIA (imutável)
CREATE TABLE public.audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    oficina_id uuid REFERENCES public.oficinas(id) ON DELETE CASCADE NOT NULL,
    user_id uuid NOT NULL,
    action text NOT NULL,
    table_name text NOT NULL,
    record_id uuid,
    old_data jsonb,
    new_data jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índices para performance em consultas de auditoria
CREATE INDEX idx_audit_logs_oficina_id ON public.audit_logs(oficina_id);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_table_name ON public.audit_logs(table_name);

-- Habilitar RLS na tabela de auditoria
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Apenas proprietários podem ver logs de suas oficinas (somente leitura)
CREATE POLICY "Proprietários podem ver logs de suas oficinas"
ON public.audit_logs FOR SELECT
USING (public.is_oficina_owner(auth.uid(), oficina_id));

-- Inserção via trigger apenas (ninguém insere diretamente via API)
-- A inserção será feita via função SECURITY DEFINER

-- 6. FUNÇÃO PARA REGISTRAR AUDITORIA (chamada por triggers)
CREATE OR REPLACE FUNCTION public.log_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _oficina_id uuid;
  _user_id uuid;
BEGIN
  -- Obter user_id do contexto de autenticação
  _user_id := auth.uid();
  
  -- Determinar oficina_id baseado na tabela
  IF TG_TABLE_NAME = 'oficinas' THEN
    _oficina_id := COALESCE(NEW.id, OLD.id);
  ELSE
    _oficina_id := COALESCE(NEW.oficina_id, OLD.oficina_id);
  END IF;
  
  -- Inserir log se temos os dados necessários
  IF _user_id IS NOT NULL AND _oficina_id IS NOT NULL THEN
    INSERT INTO public.audit_logs (
      oficina_id,
      user_id,
      action,
      table_name,
      record_id,
      old_data,
      new_data
    ) VALUES (
      _oficina_id,
      _user_id,
      TG_OP,
      TG_TABLE_NAME,
      COALESCE(NEW.id, OLD.id),
      CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
      CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 7. TRIGGERS DE AUDITORIA NAS TABELAS CRÍTICAS
CREATE TRIGGER audit_clientes
AFTER INSERT OR UPDATE OR DELETE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE TRIGGER audit_veiculos
AFTER INSERT OR UPDATE OR DELETE ON public.veiculos
FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE TRIGGER audit_ordens_servico
AFTER INSERT OR UPDATE OR DELETE ON public.ordens_servico
FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE TRIGGER audit_financeiro
AFTER INSERT OR UPDATE OR DELETE ON public.financeiro
FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE TRIGGER audit_estoque
AFTER INSERT OR UPDATE OR DELETE ON public.estoque
FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE TRIGGER audit_oficinas
AFTER INSERT OR UPDATE OR DELETE ON public.oficinas
FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- 8. TRIGGER PARA UPDATED_AT NA TABELA user_roles
CREATE TRIGGER update_user_roles_updated_at
BEFORE UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();