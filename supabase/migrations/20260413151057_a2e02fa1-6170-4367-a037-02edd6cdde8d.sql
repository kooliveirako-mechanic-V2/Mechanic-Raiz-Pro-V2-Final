CREATE OR REPLACE FUNCTION public.rate_limit_os_insert(p_oficina_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_oficina_id IS NULL THEN
    RAISE EXCEPTION 'oficina_id ausente para rate limit';
  END IF;

  IF NOT public.check_user_rate_limit('criar_os', 30, 60) THEN
    RAISE EXCEPTION 'rate_limit_exceeded'
      USING HINT = 'Muitas operações em pouco tempo. Aguarde um momento.';
  END IF;
END;
$$;