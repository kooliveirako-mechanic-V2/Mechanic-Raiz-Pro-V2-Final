
CREATE OR REPLACE FUNCTION public.get_public_orcamento_by_numero(p_numero integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_orcamento_id uuid;
BEGIN
  SELECT id INTO v_orcamento_id FROM public.orcamentos WHERE numero = p_numero LIMIT 1;
  IF v_orcamento_id IS NULL THEN RETURN NULL; END IF;
  RETURN get_public_orcamento(v_orcamento_id);
END;
$$;
