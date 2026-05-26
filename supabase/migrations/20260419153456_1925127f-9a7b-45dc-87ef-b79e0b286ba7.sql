
-- Ajusta os triggers de rate-limit para honrar uma flag de sessão controlada,
-- usada exclusivamente em seeds/admin. Para o usuário final, o limite continua valendo.

CREATE OR REPLACE FUNCTION public.rate_limit_clientes_insert()
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
    SELECT count(*) FROM public.clientes
     WHERE oficina_id = NEW.oficina_id
       AND created_at > now() - interval '1 minute'
  ) >= 30 THEN
    RAISE EXCEPTION 'rate_limit_exceeded' USING HINT = 'Muitas operações em pouco tempo. Aguarde um momento.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.rate_limit_veiculos_insert()
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
    SELECT count(*) FROM public.veiculos
     WHERE oficina_id = NEW.oficina_id
       AND created_at > now() - interval '1 minute'
  ) >= 30 THEN
    RAISE EXCEPTION 'rate_limit_exceeded' USING HINT = 'Muitas operações em pouco tempo. Aguarde um momento.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.rate_limit_os_insert()
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
    SELECT count(*) FROM public.ordens_servico
     WHERE oficina_id = NEW.oficina_id
       AND created_at > now() - interval '1 minute'
  ) >= 30 THEN
    RAISE EXCEPTION 'rate_limit_exceeded' USING HINT = 'Muitas operações em pouco tempo. Aguarde um momento.';
  END IF;
  RETURN NEW;
END;
$$;
