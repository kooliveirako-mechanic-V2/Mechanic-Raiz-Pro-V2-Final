
-- Dedicated funnel analytics table
CREATE TABLE public.funnel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL,
  oficina_id uuid NOT NULL REFERENCES oficinas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  plan_type text,
  trial_day integer,
  session_id text,
  source text,
  step text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for querying by oficina and event
CREATE INDEX idx_funnel_events_oficina ON public.funnel_events(oficina_id, event, created_at DESC);
CREATE INDEX idx_funnel_events_created ON public.funnel_events(created_at DESC);

-- RLS
ALTER TABLE public.funnel_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "funnel_insert" ON public.funnel_events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "funnel_select" ON public.funnel_events
  FOR SELECT TO authenticated
  USING (has_oficina_access(auth.uid(), oficina_id));

-- Service role full access for edge functions
CREATE POLICY "funnel_service" ON public.funnel_events
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
