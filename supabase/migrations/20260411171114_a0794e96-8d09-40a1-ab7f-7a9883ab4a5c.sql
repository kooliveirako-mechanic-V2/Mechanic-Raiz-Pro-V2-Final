
CREATE UNIQUE INDEX IF NOT EXISTS idx_funnel_events_dedup 
ON public.funnel_events (event, oficina_id, session_id) 
WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_funnel_events_event_created 
ON public.funnel_events (event, created_at);

CREATE INDEX IF NOT EXISTS idx_funnel_events_oficina_created 
ON public.funnel_events (oficina_id, created_at);
