
-- =============================================
-- CORREÇÃO FINAL: AUDIT LOGS 100% IMUTÁVEIS
-- =============================================

-- Remover policy de INSERT que permite usuários inserirem diretamente
DROP POLICY IF EXISTS "Sistema pode inserir logs de auditoria" ON public.audit_logs;

-- Audit logs devem ser inseridos APENAS via triggers (SECURITY DEFINER)
-- Nenhuma policy de INSERT = usuários não podem inserir diretamente
-- Os triggers usam SECURITY DEFINER e bypassing RLS automaticamente

-- Manter apenas SELECT para proprietários
-- UPDATE e DELETE já estão bloqueados (sem policies)

-- RESULTADO:
-- ✅ SELECT: Apenas proprietários
-- ❌ INSERT: Bloqueado para usuários (apenas triggers)
-- ❌ UPDATE: Bloqueado
-- ❌ DELETE: Bloqueado
-- = LOGS 100% IMUTÁVEIS
