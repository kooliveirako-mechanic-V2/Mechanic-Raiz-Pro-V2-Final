-- Criar tabela de perfis para armazenar nomes dos usuários
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  nome text NOT NULL,
  telefone text,
  avatar_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para profiles
CREATE POLICY "Usuários podem ver perfis de colegas da mesma oficina"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur1
    WHERE ur1.user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur2
      WHERE ur2.user_id = profiles.user_id
      AND ur2.oficina_id = ur1.oficina_id
    )
  )
  OR user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.oficinas o
    WHERE o.user_id = profiles.user_id
    AND o.user_id = auth.uid()
  )
);

CREATE POLICY "Usuários podem atualizar seu próprio perfil"
ON public.profiles
FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Usuários podem criar seu próprio perfil"
ON public.profiles
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Adicionar coluna responsavel_id na tabela ordens_servico
ALTER TABLE public.ordens_servico 
ADD COLUMN IF NOT EXISTS responsavel_id uuid REFERENCES auth.users(id);

-- Criar trigger para atualizar updated_at em profiles
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para obter funcionários de uma oficina (incluindo o proprietário)
CREATE OR REPLACE FUNCTION public.get_oficina_funcionarios(_oficina_id uuid)
RETURNS TABLE(user_id uuid, nome text, role app_role)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Proprietário da oficina
  SELECT 
    o.user_id,
    COALESCE(p.nome, 'Proprietário') as nome,
    'proprietario'::app_role as role
  FROM public.oficinas o
  LEFT JOIN public.profiles p ON p.user_id = o.user_id
  WHERE o.id = _oficina_id
  
  UNION ALL
  
  -- Funcionários e administradores
  SELECT 
    ur.user_id,
    COALESCE(p.nome, 'Funcionário') as nome,
    ur.role
  FROM public.user_roles ur
  LEFT JOIN public.profiles p ON p.user_id = ur.user_id
  WHERE ur.oficina_id = _oficina_id
  AND ur.active = true
$$;