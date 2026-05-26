
-- Step 1: Force drop ALL existing policies on oficinas
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname FROM pg_policies WHERE tablename = 'oficinas' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.oficinas', pol.policyname);
  END LOOP;
END $$;

-- Step 2: Disable and re-enable RLS to reset state
ALTER TABLE public.oficinas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.oficinas ENABLE ROW LEVEL SECURITY;

-- Step 3: Create PERMISSIVE policies (default behavior, no AS RESTRICTIVE)
CREATE POLICY "oficinas_insert_own"
ON public.oficinas
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "oficinas_select_own"
ON public.oficinas
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "oficinas_select_team"
ON public.oficinas
FOR SELECT
TO authenticated
USING (has_oficina_access(auth.uid(), id));

CREATE POLICY "oficinas_update_own"
ON public.oficinas
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "oficinas_delete_own"
ON public.oficinas
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
