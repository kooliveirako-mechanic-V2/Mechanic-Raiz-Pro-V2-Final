-- ===========================================
-- BLINDAGEM DE SEGURANÇA - CORREÇÕES CRÍTICAS
-- ===========================================

-- =========================================
-- 1. CORRIGIR POLÍTICAS DE STORAGE oficina-logos
-- =========================================
-- Problema: Qualquer usuário autenticado pode fazer upload/update/delete em qualquer pasta
-- Solução: Restringir para apenas proprietários da oficina

DROP POLICY IF EXISTS "Users can upload their workshop logo" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their workshop logo" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their workshop logo" ON storage.objects;

-- Políticas restritas: apenas proprietários podem gerenciar logos
CREATE POLICY "Owners can upload workshop logo"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'oficina-logos'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.oficinas WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Owners can update workshop logo"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'oficina-logos'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.oficinas WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Owners can delete workshop logo"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'oficina-logos'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.oficinas WHERE user_id = auth.uid()
  )
);

-- Limite de tamanho de arquivo (2MB)
UPDATE storage.buckets 
SET file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
WHERE id = 'oficina-logos';

-- =========================================
-- 2. CORRIGIR RLS DE PROFILES - RESTRINGIR VISIBILIDADE
-- =========================================
-- Problema: Política atual permite ver perfis de equipe, podendo expor dados
-- Solução: Simplificar para apenas o próprio perfil ou validação de role ativa

DROP POLICY IF EXISTS "Usuários podem ver apenas seu perfil ou da equipe como proprie" ON public.profiles;

-- Política mais restritiva: usuário vê seu perfil OU proprietário vê perfis da equipe ativa
CREATE POLICY "Usuários podem ver seu próprio perfil"
ON public.profiles FOR SELECT
USING (
  user_id = auth.uid()
);

-- Proprietários podem ver perfis de membros ativos da equipe
CREATE POLICY "Proprietários podem ver perfis da equipe"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.oficinas o
    INNER JOIN public.user_roles ur ON ur.oficina_id = o.id
    WHERE o.user_id = auth.uid()
      AND ur.user_id = profiles.user_id
      AND ur.active = true
  )
);

-- =========================================
-- 3. RESTRINGIR ACESSO A DADOS SENSÍVEIS DE CLIENTES
-- =========================================
-- Problema: Qualquer membro com has_oficina_access pode ver todos os dados de clientes
-- Solução: Manter acesso básico mas proteger dados sensíveis com função

-- Criar função para verificar se pode ver dados sensíveis de clientes
CREATE OR REPLACE FUNCTION public.can_view_full_client_data(_oficina_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    is_oficina_owner(_user_id, _oficina_id) 
    OR has_role(_user_id, _oficina_id, 'administrador'::app_role)
$$;

-- =========================================
-- 4. GARANTIR TRACKING DE ÚLTIMO ACESSO
-- =========================================
-- Anexar trigger de update_last_access nas tabelas principais

-- Criar trigger para atualizar last_accessed_at quando usuário acessa dados
CREATE OR REPLACE FUNCTION public.track_user_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_oficina_id uuid;
BEGIN
  -- Determinar oficina_id
  IF TG_TABLE_NAME = 'oficinas' THEN
    v_oficina_id := NEW.id;
  ELSE
    v_oficina_id := NEW.oficina_id;
  END IF;
  
  -- Atualizar last_accessed_at para o usuário na oficina
  UPDATE public.user_roles 
  SET last_accessed_at = now()
  WHERE user_id = auth.uid() 
    AND oficina_id = v_oficina_id
    AND active = true;
  
  RETURN NEW;
END;
$$;

-- Anexar trigger na tabela ordens_servico (acesso mais frequente)
DROP TRIGGER IF EXISTS track_access_ordens_servico ON public.ordens_servico;
CREATE TRIGGER track_access_ordens_servico
  AFTER INSERT ON public.ordens_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.track_user_access();

-- =========================================
-- 5. ADICIONAR INSERT POLICY PARA AUDIT_LOGS (via trigger)
-- =========================================
-- Permitir que o sistema insira logs via triggers

CREATE POLICY "System can insert audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK (true);  -- Triggers executam como SECURITY DEFINER

-- =========================================
-- 6. CRIAR ÍNDICES PARA PERFORMANCE DE SEGURANÇA
-- =========================================
-- Índices para acelerar verificações de acesso

CREATE INDEX IF NOT EXISTS idx_user_roles_active_lookup 
ON public.user_roles(user_id, oficina_id, active) 
WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_user_roles_last_access 
ON public.user_roles(last_accessed_at) 
WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at 
ON public.audit_logs(oficina_id, created_at DESC);