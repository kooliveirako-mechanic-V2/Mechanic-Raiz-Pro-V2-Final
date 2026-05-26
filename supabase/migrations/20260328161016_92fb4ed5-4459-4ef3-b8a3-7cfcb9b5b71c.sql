
-- Create mapping table for old_user_id → email (for re-linking on signup)
CREATE TABLE IF NOT EXISTS public.user_migration_map (
  old_user_id uuid PRIMARY KEY,
  email text NOT NULL,
  nome text,
  new_user_id uuid,
  migrated_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS (admin only)
ALTER TABLE public.user_migration_map ENABLE ROW LEVEL SECURITY;

-- No public access - only used by triggers with SECURITY DEFINER
