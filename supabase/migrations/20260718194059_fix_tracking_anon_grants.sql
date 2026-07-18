-- Minimal tracking permissions for public frontend on the new Supabase project
-- marketing_events: direct INSERT from anon/authenticated
-- marketing_sessions: write through SECURITY DEFINER RPC to avoid public table reads

ALTER TABLE IF EXISTS public.marketing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.marketing_sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.marketing_events FROM anon;
REVOKE ALL ON TABLE public.marketing_events FROM authenticated;
GRANT INSERT ON TABLE public.marketing_events TO anon, authenticated;

REVOKE ALL ON TABLE public.marketing_sessions FROM anon;
REVOKE ALL ON TABLE public.marketing_sessions FROM authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'marketing_events'
      AND policyname = 'public insert marketing_events'
  ) THEN
    EXECUTE 'DROP POLICY "public insert marketing_events" ON public.marketing_events';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'marketing_events'
      AND policyname = 'Enable insert for all users'
  ) THEN
    EXECUTE 'CREATE POLICY "Enable insert for all users" ON public.marketing_events FOR INSERT WITH CHECK (true)';
  END IF;
END $$;

DO $$
DECLARE
  policy_name text;
BEGIN
  FOR policy_name IN
    SELECT p.policyname
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename = 'marketing_sessions'
      AND p.roles <> '{service_role}'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.marketing_sessions', policy_name);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.upsert_marketing_session_public(
  p_visitor_id text,
  p_session_id text,
  p_last_seen timestamptz,
  p_last_page_url text,
  p_first_utm_source text DEFAULT NULL,
  p_first_utm_medium text DEFAULT NULL,
  p_first_utm_campaign text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.marketing_sessions (
    visitor_id,
    session_id,
    last_seen,
    last_page_url,
    first_utm_source,
    first_utm_medium,
    first_utm_campaign
  )
  VALUES (
    p_visitor_id,
    p_session_id,
    p_last_seen,
    p_last_page_url,
    p_first_utm_source,
    p_first_utm_medium,
    p_first_utm_campaign
  )
  ON CONFLICT (visitor_id)
  DO UPDATE SET
    session_id = EXCLUDED.session_id,
    last_seen = EXCLUDED.last_seen,
    last_page_url = EXCLUDED.last_page_url,
    first_utm_source = COALESCE(public.marketing_sessions.first_utm_source, EXCLUDED.first_utm_source),
    first_utm_medium = COALESCE(public.marketing_sessions.first_utm_medium, EXCLUDED.first_utm_medium),
    first_utm_campaign = COALESCE(public.marketing_sessions.first_utm_campaign, EXCLUDED.first_utm_campaign);
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_marketing_session_public(text, text, timestamptz, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_marketing_session_public(text, text, timestamptz, text, text, text, text) TO anon, authenticated;
