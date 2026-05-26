
-- campaign_reactivation: service_role only (edge functions)
CREATE POLICY "campaign_service_all" ON public.campaign_reactivation
FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Block authenticated users explicitly
CREATE POLICY "campaign_deny_authenticated" ON public.campaign_reactivation
FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- user_migration_map: enable RLS first (if not already)
ALTER TABLE public.user_migration_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "migration_service_all" ON public.user_migration_map
FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "migration_deny_authenticated" ON public.user_migration_map
FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- rate_limit_log: remove overly permissive DELETE policy
DROP POLICY IF EXISTS "rate_limit_delete" ON public.rate_limit_log;

-- Replace with service_role-only delete
CREATE POLICY "rate_limit_delete_service" ON public.rate_limit_log
FOR DELETE TO service_role USING (true);
