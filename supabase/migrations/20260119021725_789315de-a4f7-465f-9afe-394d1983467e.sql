-- Remove triggers that restrict features based on plan during trial
DROP TRIGGER IF EXISTS validate_veiculo_tipo_trigger ON public.veiculos;
DROP FUNCTION IF EXISTS public.validate_veiculo_tipo() CASCADE;

DROP TRIGGER IF EXISTS validate_orcamento_access_trigger ON public.orcamentos;
DROP FUNCTION IF EXISTS public.validate_orcamento_access() CASCADE;

DROP TRIGGER IF EXISTS validate_estoque_access_trigger ON public.estoque;
DROP FUNCTION IF EXISTS public.validate_estoque_access() CASCADE;