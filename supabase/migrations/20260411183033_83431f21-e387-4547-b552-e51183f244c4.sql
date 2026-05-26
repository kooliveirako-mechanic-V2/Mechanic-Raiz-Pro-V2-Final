
-- Step 1: Fill any existing NULL dedup_key values so the non-partial constraint works
UPDATE public.funnel_events
SET dedup_key = id::text
WHERE dedup_key IS NULL;

-- Step 2: Make dedup_key NOT NULL with a default so future inserts always have a value
ALTER TABLE public.funnel_events
  ALTER COLUMN dedup_key SET DEFAULT gen_random_uuid()::text,
  ALTER COLUMN dedup_key SET NOT NULL;

-- Step 3: Drop the partial unique index that breaks upsert
DROP INDEX IF EXISTS public.idx_funnel_events_dedup_v2;

-- Step 4: Create a proper (non-partial) unique constraint that upsert can use
ALTER TABLE public.funnel_events
  ADD CONSTRAINT uq_funnel_events_dedup UNIQUE (event, oficina_id, dedup_key);
