
-- Temporarily drop FK constraint on profiles to allow importing old user_ids
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;

-- Insert profiles from old project (will be done via COPY after this migration)
-- The FK will be recreated later once users re-register and IDs are remapped
