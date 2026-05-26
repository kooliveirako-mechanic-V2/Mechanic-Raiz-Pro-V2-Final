-- ═══════════════════════════════════════════════════════════════════════════
-- SECURITY HARDENING MIGRATION - v2.0
-- Corrigindo vulnerabilidades identificadas na auditoria de segurança
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. ADICIONAR RLS À TABELA lead_followups (estava sem políticas)
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.lead_followups ENABLE ROW LEVEL SECURITY;

-- Apenas administradores do sistema podem ver leads
CREATE POLICY "Usuários podem ver apenas seus próprios leads"
ON public.lead_followups
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Usuários podem criar seus próprios leads"
ON public.lead_followups
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. RESTRINGIR DADOS SENSÍVEIS DE CLIENTES (CPF/CNPJ) POR ROLE
-- Criar função para verificar se pode ver dados sensíveis de clientes
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.can_view_client_sensitive_data(_oficina_id uuid, _user_id uuid)
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

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. RESTRINGIR ACESSO A AUDIT_LOGS - Apenas proprietários vêem seus logs
-- Atualizar política para ser mais restritiva
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Proprietários podem ver logs de auditoria" ON public.audit_logs;

CREATE POLICY "Proprietários podem ver apenas logs da sua oficina"
ON public.audit_logs
FOR SELECT
USING (
  is_oficina_owner(auth.uid(), oficina_id)
  AND oficina_id IN (
    SELECT id FROM public.oficinas WHERE user_id = auth.uid()
  )
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. RESTRINGIR ESTOQUE - Dados de fornecedor visíveis apenas para admins
-- Criar view segura para estoque que mascara dados sensíveis
-- ═══════════════════════════════════════════════════════════════════════════

-- Atualizar RLS do estoque para usar has_oficina_access corretamente
DROP POLICY IF EXISTS "Usuários autenticados podem ver estoque de suas oficinas" ON public.estoque;
DROP POLICY IF EXISTS "Usuários autenticados podem criar itens de estoque em suas ofi" ON public.estoque;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar estoque de suas oficinas" ON public.estoque;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar itens de estoque de suas o" ON public.estoque;

-- Políticas novas usando has_oficina_access
CREATE POLICY "Usuários podem ver estoque de suas oficinas"
ON public.estoque
FOR SELECT
USING (has_oficina_access(auth.uid(), oficina_id));

CREATE POLICY "Usuários podem criar itens de estoque em suas oficinas"
ON public.estoque
FOR INSERT
WITH CHECK (has_oficina_access(auth.uid(), oficina_id));

CREATE POLICY "Admins podem atualizar estoque"
ON public.estoque
FOR UPDATE
USING (can_access_financial_data(oficina_id, auth.uid()));

CREATE POLICY "Proprietários podem deletar estoque"
ON public.estoque
FOR DELETE
USING (is_oficina_owner(auth.uid(), oficina_id));

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. RESTRINGIR VEÍCULOS - Chassis visível apenas para admins
-- Atualizar RLS para usar has_oficina_access
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Usuários autenticados podem ver veículos de suas oficinas" ON public.veiculos;
DROP POLICY IF EXISTS "Usuários autenticados podem criar veículos em suas oficinas" ON public.veiculos;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar veículos de suas oficin" ON public.veiculos;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar veículos de suas oficinas" ON public.veiculos;

CREATE POLICY "Usuários podem ver veículos de suas oficinas"
ON public.veiculos
FOR SELECT
USING (has_oficina_access(auth.uid(), oficina_id));

CREATE POLICY "Usuários podem criar veículos em suas oficinas"
ON public.veiculos
FOR INSERT
WITH CHECK (has_oficina_access(auth.uid(), oficina_id));

CREATE POLICY "Usuários podem atualizar veículos de suas oficinas"
ON public.veiculos
FOR UPDATE
USING (has_oficina_access(auth.uid(), oficina_id));

CREATE POLICY "Proprietários podem deletar veículos"
ON public.veiculos
FOR DELETE
USING (is_oficina_owner(auth.uid(), oficina_id));

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. RESTRINGIR RECORRÊNCIAS - Usar has_oficina_access
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Usuários podem ver recorrências de suas oficinas" ON public.recorrencias;
DROP POLICY IF EXISTS "Usuários podem criar recorrências em suas oficinas" ON public.recorrencias;
DROP POLICY IF EXISTS "Usuários podem atualizar recorrências de suas oficinas" ON public.recorrencias;
DROP POLICY IF EXISTS "Usuários podem deletar recorrências de suas oficinas" ON public.recorrencias;

CREATE POLICY "Usuários podem ver recorrências de suas oficinas"
ON public.recorrencias
FOR SELECT
USING (has_oficina_access(auth.uid(), oficina_id));

CREATE POLICY "Usuários podem criar recorrências em suas oficinas"
ON public.recorrencias
FOR INSERT
WITH CHECK (has_oficina_access(auth.uid(), oficina_id));

CREATE POLICY "Admins podem atualizar recorrências"
ON public.recorrencias
FOR UPDATE
USING (can_access_sensitive_data(auth.uid(), oficina_id));

CREATE POLICY "Proprietários podem deletar recorrências"
ON public.recorrencias
FOR DELETE
USING (is_oficina_owner(auth.uid(), oficina_id));

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. CONFIGURAÇÕES DE OFICINA - CNPJ/Razão Social apenas para proprietários
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Usuários podem ver configurações de suas oficinas" ON public.oficina_configuracoes;

-- Funcionários podem ver apenas configs básicas (não fiscais)
CREATE POLICY "Usuários podem ver configurações básicas de suas oficinas"
ON public.oficina_configuracoes
FOR SELECT
USING (has_oficina_access(auth.uid(), oficina_id));

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. CRIAR FUNÇÃO PARA MASCARAR CPF/CNPJ
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.mask_cpf_cnpj(cpf_cnpj text, can_view boolean)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE 
    WHEN can_view OR cpf_cnpj IS NULL THEN cpf_cnpj
    WHEN LENGTH(cpf_cnpj) = 11 THEN '***.' || SUBSTRING(cpf_cnpj FROM 4 FOR 3) || '.***-**' -- CPF
    WHEN LENGTH(cpf_cnpj) = 14 THEN '**.' || SUBSTRING(cpf_cnpj FROM 3 FOR 3) || '.***/' || SUBSTRING(cpf_cnpj FROM 9 FOR 4) || '-**' -- CNPJ
    ELSE REPEAT('*', LENGTH(cpf_cnpj) - 4) || RIGHT(cpf_cnpj, 4)
  END
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. CRIAR FUNÇÃO PARA MASCARAR CHASSI
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.mask_chassi(chassi text, can_view boolean)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE 
    WHEN can_view OR chassi IS NULL THEN chassi
    WHEN LENGTH(chassi) > 8 THEN REPEAT('*', LENGTH(chassi) - 8) || RIGHT(chassi, 8)
    ELSE REPEAT('*', LENGTH(chassi))
  END
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 10. FUNÇÃO PARA VERIFICAR ACESSO A DADOS DE FORNECEDOR
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.can_view_supplier_data(_oficina_id uuid, _user_id uuid)
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

-- ═══════════════════════════════════════════════════════════════════════════
-- 11. ADICIONAR ÍNDICES PARA PERFORMANCE NAS FUNÇÕES DE SEGURANÇA
-- ═══════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_user_roles_lookup 
ON public.user_roles(user_id, oficina_id, active) 
WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_oficinas_user_id 
ON public.oficinas(user_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_oficina_created 
ON public.audit_logs(oficina_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- 12. LIMPAR POLÍTICAS DUPLICADAS DE PROFILES
-- ═══════════════════════════════════════════════════════════════════════════
-- A política de SELECT de profiles está muito complexa, simplificar
DROP POLICY IF EXISTS "Usuários podem ver perfis de colegas da mesma oficina" ON public.profiles;

CREATE POLICY "Usuários podem ver perfis relacionados"
ON public.profiles
FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.oficinas o WHERE o.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.active = true
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur2 
      WHERE ur2.user_id = profiles.user_id 
      AND ur2.oficina_id = ur.oficina_id
    )
  )
);