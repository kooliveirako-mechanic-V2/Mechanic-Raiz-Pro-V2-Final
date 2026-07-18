-- Minimal authenticated read grants for existing-account bootstrap on the new Supabase project
-- Scope intentionally limited to SELECT only for the three tables used to load an existing account.

GRANT SELECT ON TABLE public.oficinas TO authenticated;
GRANT SELECT ON TABLE public.user_roles TO authenticated;
GRANT SELECT ON TABLE public.profiles TO authenticated;
