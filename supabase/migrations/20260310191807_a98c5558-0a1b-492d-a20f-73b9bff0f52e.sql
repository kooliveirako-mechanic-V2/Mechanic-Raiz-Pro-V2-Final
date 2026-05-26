
-- Drop all RESTRICTIVE policies on oficinas and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Usuários podem criar suas próprias oficinas" ON public.oficinas;
DROP POLICY IF EXISTS "Usuários podem ver suas oficinas" ON public.oficinas;
DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias oficinas" ON public.oficinas;
DROP POLICY IF EXISTS "Usuários podem deletar suas próprias oficinas" ON public.oficinas;

-- Recreate as PERMISSIVE (default)
CREATE POLICY "Usuários podem criar suas próprias oficinas"
ON public.oficinas FOR INSERT
TO public
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem ver suas oficinas"
ON public.oficinas FOR SELECT
TO public
USING (has_oficina_access(auth.uid(), id));

CREATE POLICY "Usuários podem atualizar suas próprias oficinas"
ON public.oficinas FOR UPDATE
TO public
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias oficinas"
ON public.oficinas FOR DELETE
TO public
USING (auth.uid() = user_id);
