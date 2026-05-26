
-- Add numero column (globally unique sequential)
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS numero integer;

-- Create sequence for global OS numbers
CREATE SEQUENCE IF NOT EXISTS public.os_numero_seq START WITH 1001;

-- Set existing OS numbers based on creation order
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) + 1000 AS num
  FROM public.ordens_servico
  WHERE numero IS NULL
)
UPDATE public.ordens_servico os
SET numero = numbered.num
FROM numbered
WHERE os.id = numbered.id;

-- Update sequence to continue after existing
SELECT setval('public.os_numero_seq', COALESCE((SELECT MAX(numero) FROM public.ordens_servico), 1000));

-- Create trigger function for auto-increment
CREATE OR REPLACE FUNCTION public.generate_os_numero()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.numero IS NULL THEN
    NEW.numero := nextval('public.os_numero_seq');
  END IF;
  RETURN NEW;
END;
$function$;

-- Create trigger
DROP TRIGGER IF EXISTS set_os_numero ON public.ordens_servico;
CREATE TRIGGER set_os_numero
  BEFORE INSERT ON public.ordens_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_os_numero();

-- Create unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_ordens_servico_numero ON public.ordens_servico(numero);

-- Create public lookup function by numero
CREATE OR REPLACE FUNCTION public.get_public_os_by_numero(os_numero integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result json;
  v_os_id uuid;
BEGIN
  SELECT id INTO v_os_id FROM ordens_servico WHERE numero = os_numero;
  IF v_os_id IS NULL THEN RETURN NULL; END IF;
  RETURN get_public_os(v_os_id);
END;
$function$;
