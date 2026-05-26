-- Drop overly permissive policies on rate_limit_log
DROP POLICY IF EXISTS "rate_limit_insert" ON public.rate_limit_log;
DROP POLICY IF EXISTS "rate_limit_select" ON public.rate_limit_log;

-- Replace with service_role-only policies
CREATE POLICY "rate_limit_insert_service"
  ON public.rate_limit_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "rate_limit_select_service"
  ON public.rate_limit_log
  FOR SELECT
  TO service_role
  USING (true);