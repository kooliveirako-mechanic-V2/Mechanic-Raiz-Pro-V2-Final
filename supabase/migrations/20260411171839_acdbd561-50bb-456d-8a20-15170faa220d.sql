-- Drop the overly aggressive dedup index
DROP INDEX IF EXISTS idx_funnel_events_dedup;

-- Add dedup_key column for granular deduplication
ALTER TABLE public.funnel_events ADD COLUMN IF NOT EXISTS dedup_key text;

-- Create smarter unique index using dedup_key
CREATE UNIQUE INDEX idx_funnel_events_dedup_v2 
ON public.funnel_events (event, oficina_id, dedup_key) 
WHERE dedup_key IS NOT NULL;