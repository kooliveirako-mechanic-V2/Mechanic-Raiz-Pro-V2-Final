
-- Force drop ALL policies on oficinas
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname FROM pg_policies WHERE tablename = 'oficinas' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.oficinas', pol.policyname);
  END LOOP;
END $$;

-- Recreate as PERMISSIVE (AS PERMISSIVE goes before FOR)
CREATE POLICY "oficinas_insert_own"
ON public.oficinas
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "oficinas_select_access"
ON public.oficinas
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (has_oficina_access(auth.uid(), id));

CREATE POLICY "oficinas_update_own"
ON public.oficinas
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "oficinas_delete_own"
ON public.oficinas
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
