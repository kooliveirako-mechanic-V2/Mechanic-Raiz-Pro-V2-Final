
CREATE OR REPLACE FUNCTION public.rate_limit_estoque_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.skip_rate_limit', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF (
    SELECT count(*) FROM public.estoque
     WHERE oficina_id = NEW.oficina_id
       AND created_at > now() - interval '1 minute'
  ) >= 30 THEN
    RAISE EXCEPTION 'rate_limit_exceeded' USING HINT = 'Muitas operações em pouco tempo. Aguarde um momento.';
  END IF;
  RETURN NEW;
END;
$$;
