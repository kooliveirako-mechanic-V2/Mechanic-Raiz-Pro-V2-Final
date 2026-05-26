-- First drop the trigger that depends on the 0-arg function
DROP TRIGGER IF EXISTS trg_rate_limit_os_insert ON public.ordens_servico;

-- Now drop the orphan 0-arg function
DROP FUNCTION IF EXISTS public.rate_limit_os_insert();