-- Create marketing_events table for audit-only mode
CREATE TABLE IF NOT EXISTS public.marketing_events (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id TEXT NOT NULL,
    event_name TEXT NOT NULL,
    mrp_event_name TEXT,
    visitor_id TEXT,
    session_id TEXT,
    page_url TEXT,
    page_path TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_content TEXT,
    utm_term TEXT,
    fbclid TEXT,
    gclid TEXT,
    plan_name TEXT,
    plan_period TEXT,
    plan_price NUMERIC,
    value NUMERIC,
    currency TEXT DEFAULT 'BRL',
    button_location TEXT,
    method TEXT,
    status TEXT,
    user_id UUID REFERENCES auth.users(id),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.marketing_events ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT SELECT, INSERT ON public.marketing_events TO authenticated;
GRANT ALL ON public.marketing_events TO service_role;

-- Policies (Internal audit, only system should insert/view for now if via API)
CREATE POLICY "Enable insert for all users" ON public.marketing_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Only admins can view audit logs" ON public.marketing_events FOR SELECT USING (auth.jwt() ->> 'role' = 'service_role');

-- Create a table for sessions to track visitor flow
CREATE TABLE IF NOT EXISTS public.marketing_sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    visitor_id TEXT NOT NULL UNIQUE,
    session_id TEXT NOT NULL,
    first_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    first_utm_source TEXT,
    first_utm_medium TEXT,
    first_utm_campaign TEXT,
    last_page_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS for sessions
ALTER TABLE public.marketing_sessions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.marketing_sessions TO authenticated;
GRANT ALL ON public.marketing_sessions TO service_role;

CREATE POLICY "Enable insert/update for all users" ON public.marketing_sessions FOR ALL USING (true);
