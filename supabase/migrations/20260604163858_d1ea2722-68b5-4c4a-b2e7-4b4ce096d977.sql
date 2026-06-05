-- Modifica a função check_user_rate_limit para aceitar chamadas sem usuário logado (service role)
CREATE OR REPLACE FUNCTION public.check_user_rate_limit(p_action text, p_max_requests integer DEFAULT 30, p_window_seconds integer DEFAULT 60)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_count INT;
  v_identifier TEXT;
BEGIN
  -- Se for chamado por service role/internal, bypass do rate limit
  IF v_user_id IS NULL THEN RETURN TRUE; END IF;

  v_identifier := v_user_id::text || ':' || p_action;

  SELECT COUNT(*) INTO v_count
  FROM rate_limit_log
  WHERE ip_hash = v_identifier
  AND endpoint = p_action
  AND created_at > NOW() - (p_window_seconds || ' seconds')::INTERVAL;

  IF v_count >= p_max_requests THEN
    RETURN FALSE;
  END IF;

  INSERT INTO rate_limit_log (ip_hash, endpoint, created_at)
  VALUES (v_identifier, p_action, NOW());

  RETURN TRUE;
END;
$function$;
