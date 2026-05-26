
-- Rate limit log table for public RPCs
CREATE TABLE IF NOT EXISTS public.rate_limit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash text NOT NULL,
  endpoint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_rate_limit_ip_endpoint ON public.rate_limit_log (ip_hash, endpoint, created_at);

-- Auto-cleanup: delete records older than 1 hour
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_log()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.rate_limit_log WHERE created_at < now() - interval '1 hour';
END;
$$;

-- Rate limit check function
CREATE OR REPLACE FUNCTION public.check_rate_limit(p_ip_hash text, p_endpoint text, p_max_requests integer DEFAULT 10)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Count requests in last 60 seconds
  SELECT COUNT(*) INTO v_count
  FROM public.rate_limit_log
  WHERE ip_hash = p_ip_hash
    AND endpoint = p_endpoint
    AND created_at > now() - interval '60 seconds';

  IF v_count >= p_max_requests THEN
    RETURN false; -- rate limited
  END IF;

  -- Log this request
  INSERT INTO public.rate_limit_log (ip_hash, endpoint)
  VALUES (p_ip_hash, p_endpoint);

  RETURN true; -- allowed
END;
$$;

-- Disable RLS on rate_limit_log (it's managed by SECURITY DEFINER functions)
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;

-- Allow anon to use the check function (called from public RPCs)
GRANT EXECUTE ON FUNCTION public.check_rate_limit TO anon;
GRANT EXECUTE ON FUNCTION public.cleanup_rate_limit_log TO anon;
