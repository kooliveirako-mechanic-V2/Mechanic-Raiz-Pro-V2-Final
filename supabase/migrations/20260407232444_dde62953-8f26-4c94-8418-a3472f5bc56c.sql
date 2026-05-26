-- CAUSA RAIZ: rate_limit_log tem RLS ativado mas ZERO policies
-- Isso faz o trigger check_user_rate_limit falhar ao tentar INSERT,
-- bloqueando a criação de orçamentos, clientes, estoque e OS.

-- Policy para INSERT: qualquer usuário autenticado pode registrar rate limit
CREATE POLICY "rate_limit_insert"
ON public.rate_limit_log
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy para SELECT: qualquer usuário autenticado pode ler (necessário para a contagem no check_user_rate_limit)
CREATE POLICY "rate_limit_select"
ON public.rate_limit_log
FOR SELECT
TO authenticated
USING (true);

-- Policy para DELETE: permitir limpeza (expiração de registros antigos)
CREATE POLICY "rate_limit_delete"
ON public.rate_limit_log
FOR DELETE
TO authenticated
USING (true);