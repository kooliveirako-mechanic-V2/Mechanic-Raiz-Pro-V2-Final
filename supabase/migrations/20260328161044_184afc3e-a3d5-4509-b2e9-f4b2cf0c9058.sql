
-- Function to re-link migrated user data when they sign up with same email
CREATE OR REPLACE FUNCTION public.relink_migrated_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_map RECORD;
  v_old_uid uuid;
BEGIN
  -- Check if this email has a migration mapping
  SELECT old_user_id, nome INTO v_map
  FROM user_migration_map
  WHERE email = NEW.email AND new_user_id IS NULL
  LIMIT 1;

  IF v_map IS NULL THEN
    RETURN NEW;
  END IF;

  v_old_uid := v_map.old_user_id;

  -- Update profiles: link to new auth user
  UPDATE profiles SET user_id = NEW.id, updated_at = now()
  WHERE user_id = v_old_uid;

  -- Update oficinas: link to new owner
  UPDATE oficinas SET user_id = NEW.id, updated_at = now()
  WHERE user_id = v_old_uid;

  -- Update engagement_emails
  UPDATE engagement_emails SET user_id = NEW.id
  WHERE user_id = v_old_uid;

  -- Update lead_followups
  UPDATE lead_followups SET user_id = NEW.id
  WHERE user_id = v_old_uid;

  -- Update user_roles
  UPDATE user_roles SET user_id = NEW.id, updated_at = now()
  WHERE user_id = v_old_uid;

  -- Update comissoes_funcionarios
  UPDATE comissoes_funcionarios SET user_id = NEW.id, updated_at = now()
  WHERE user_id = v_old_uid;

  -- Mark as migrated
  UPDATE user_migration_map 
  SET new_user_id = NEW.id, migrated_at = now()
  WHERE old_user_id = v_old_uid;

  RETURN NEW;
END;
$$;

-- Trigger on auth.users insert (fires AFTER so the user row exists)
DROP TRIGGER IF EXISTS trg_relink_migrated_user ON auth.users;
CREATE TRIGGER trg_relink_migrated_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.relink_migrated_user();
