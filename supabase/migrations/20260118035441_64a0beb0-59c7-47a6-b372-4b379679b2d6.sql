
-- =============================================
-- CORREÇÃO COMPLETA DE SEGURANÇA - PRODUÇÃO
-- =============================================

-- 1. CORRIGIR POLICIES DA TABELA PAGAMENTOS
-- Remover policies permissivas (USING true)

DROP POLICY IF EXISTS "System can insert payments" ON public.pagamentos;
DROP POLICY IF EXISTS "System can update payments" ON public.pagamentos;
DROP POLICY IF EXISTS "Users can view payments from their oficina" ON public.pagamentos;

-- Criar policies seguras para pagamentos
-- INSERT: Apenas proprietários/admins da oficina ou sistema (via service role)
CREATE POLICY "Proprietários e admins podem criar pagamentos"
ON public.pagamentos
FOR INSERT
WITH CHECK (
  oficina_id IS NULL 
  OR is_oficina_owner(auth.uid(), oficina_id) 
  OR has_role(auth.uid(), oficina_id, 'administrador'::app_role)
);

-- UPDATE: Apenas proprietários/admins da oficina
CREATE POLICY "Proprietários e admins podem atualizar pagamentos"
ON public.pagamentos
FOR UPDATE
USING (
  oficina_id IS NOT NULL 
  AND (
    is_oficina_owner(auth.uid(), oficina_id) 
    OR has_role(auth.uid(), oficina_id, 'administrador'::app_role)
  )
);

-- SELECT: Apenas usuários com acesso à oficina (proprietários e admins para dados financeiros)
CREATE POLICY "Proprietários e admins podem ver pagamentos"
ON public.pagamentos
FOR SELECT
USING (
  oficina_id IS NOT NULL 
  AND (
    is_oficina_owner(auth.uid(), oficina_id) 
    OR has_role(auth.uid(), oficina_id, 'administrador'::app_role)
  )
);

-- DELETE: Apenas proprietários (raro, mas necessário para compliance)
CREATE POLICY "Proprietários podem deletar pagamentos"
ON public.pagamentos
FOR DELETE
USING (
  oficina_id IS NOT NULL 
  AND is_oficina_owner(auth.uid(), oficina_id)
);

-- 2. CORRIGIR POLICIES DA TABELA AUDIT_LOGS
-- Tornar logs imutáveis (apenas INSERT, sem UPDATE/DELETE)

DROP POLICY IF EXISTS "Proprietários podem ver logs de suas oficinas" ON public.audit_logs;

-- SELECT: Apenas proprietários podem ver logs
CREATE POLICY "Proprietários podem ver logs de auditoria"
ON public.audit_logs
FOR SELECT
USING (is_oficina_owner(auth.uid(), oficina_id));

-- INSERT: Sistema pode inserir logs (via triggers ou service role)
-- Usuários autenticados podem inserir logs de suas próprias ações
CREATE POLICY "Sistema pode inserir logs de auditoria"
ON public.audit_logs
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND user_id = auth.uid()
  AND (
    is_oficina_owner(auth.uid(), oficina_id) 
    OR has_oficina_access(auth.uid(), oficina_id)
  )
);

-- UPDATE e DELETE são explicitamente bloqueados (não criar policies = negado por padrão)
-- Isso torna os logs imutáveis

-- 3. CRIAR FUNÇÃO PARA REGISTRAR AUDITORIA AUTOMATICAMENTE
CREATE OR REPLACE FUNCTION public.log_audit_action()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_oficina_id uuid;
  v_old_data jsonb;
  v_new_data jsonb;
BEGIN
  -- Determinar oficina_id baseado na tabela
  IF TG_TABLE_NAME = 'oficinas' THEN
    v_oficina_id := COALESCE(NEW.id, OLD.id);
  ELSIF TG_OP = 'DELETE' THEN
    v_oficina_id := OLD.oficina_id;
  ELSE
    v_oficina_id := NEW.oficina_id;
  END IF;

  -- Preparar dados
  IF TG_OP = 'DELETE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_old_data := NULL;
    v_new_data := to_jsonb(NEW);
  ELSE
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
  END IF;

  -- Inserir log (bypass RLS com security definer)
  INSERT INTO public.audit_logs (
    oficina_id,
    user_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data
  ) VALUES (
    v_oficina_id,
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    v_old_data,
    v_new_data
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. CRIAR TRIGGERS DE AUDITORIA PARA TABELAS CRÍTICAS
-- Pagamentos
DROP TRIGGER IF EXISTS audit_pagamentos ON public.pagamentos;
CREATE TRIGGER audit_pagamentos
AFTER INSERT OR UPDATE OR DELETE ON public.pagamentos
FOR EACH ROW EXECUTE FUNCTION public.log_audit_action();

-- Financeiro
DROP TRIGGER IF EXISTS audit_financeiro ON public.financeiro;
CREATE TRIGGER audit_financeiro
AFTER INSERT OR UPDATE OR DELETE ON public.financeiro
FOR EACH ROW EXECUTE FUNCTION public.log_audit_action();

-- Ordens de Serviço
DROP TRIGGER IF EXISTS audit_ordens_servico ON public.ordens_servico;
CREATE TRIGGER audit_ordens_servico
AFTER INSERT OR UPDATE OR DELETE ON public.ordens_servico
FOR EACH ROW EXECUTE FUNCTION public.log_audit_action();

-- Orçamentos
DROP TRIGGER IF EXISTS audit_orcamentos ON public.orcamentos;
CREATE TRIGGER audit_orcamentos
AFTER INSERT OR UPDATE OR DELETE ON public.orcamentos
FOR EACH ROW EXECUTE FUNCTION public.log_audit_action();

-- Clientes (dados sensíveis)
DROP TRIGGER IF EXISTS audit_clientes ON public.clientes;
CREATE TRIGGER audit_clientes
AFTER INSERT OR UPDATE OR DELETE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.log_audit_action();

-- 5. VERIFICAR E REFORÇAR POLICIES EXISTENTES
-- Garantir que clientes estão isolados por oficina (já existe, mas verificar)
-- As policies existentes usam has_oficina_access que é segura

-- 6. CRIAR FUNÇÃO HELPER PARA VERIFICAR ACESSO A DADOS FINANCEIROS
CREATE OR REPLACE FUNCTION public.can_access_financial_data(_oficina_id uuid, _user_id uuid)
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

-- 7. ATUALIZAR POLICIES DE FINANCEIRO PARA USAR A NOVA FUNÇÃO
DROP POLICY IF EXISTS "Proprietários e admins podem ver financeiro" ON public.financeiro;
DROP POLICY IF EXISTS "Proprietários e admins podem criar registros financeiros" ON public.financeiro;
DROP POLICY IF EXISTS "Proprietários e admins podem atualizar financeiro" ON public.financeiro;
DROP POLICY IF EXISTS "Proprietários podem deletar registros financeiros" ON public.financeiro;

CREATE POLICY "Acesso financeiro apenas para proprietários e admins"
ON public.financeiro
FOR SELECT
USING (can_access_financial_data(oficina_id, auth.uid()));

CREATE POLICY "Criação financeira apenas para proprietários e admins"
ON public.financeiro
FOR INSERT
WITH CHECK (can_access_financial_data(oficina_id, auth.uid()));

CREATE POLICY "Atualização financeira apenas para proprietários e admins"
ON public.financeiro
FOR UPDATE
USING (can_access_financial_data(oficina_id, auth.uid()));

CREATE POLICY "Exclusão financeira apenas para proprietários"
ON public.financeiro
FOR DELETE
USING (is_oficina_owner(auth.uid(), oficina_id));
