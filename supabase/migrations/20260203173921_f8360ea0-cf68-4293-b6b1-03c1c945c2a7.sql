-- =========================================
-- CORREÇÃO: Restringir INSERT em audit_logs
-- =========================================
-- O warning "RLS Policy Always True" foi gerado pela política anterior
-- Vamos substituir por uma política mais restrita

DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

-- Nova política: Apenas usuários autenticados podem inserir logs de suas próprias ações
CREATE POLICY "Authenticated users can insert their audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND user_id = auth.uid()
);

-- Também garantir que o trigger pode inserir (via SECURITY DEFINER na função)