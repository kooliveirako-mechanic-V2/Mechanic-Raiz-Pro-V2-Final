CREATE OR REPLACE FUNCTION public.atomic_delete_veiculo(p_veiculo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_os_count integer;
BEGIN
  SELECT count(*) INTO v_os_count
  FROM ordens_servico
  WHERE veiculo_id = p_veiculo_id
    AND status NOT IN ('cancelado');
  
  IF v_os_count > 0 THEN
    RAISE EXCEPTION 'Este veículo possui % ordem(ns) de serviço vinculada(s). Remova as OS antes de excluir o veículo.', v_os_count;
  END IF;

  DELETE FROM recorrencias WHERE veiculo_id = p_veiculo_id;

  UPDATE orcamentos SET veiculo_id = NULL WHERE veiculo_id = p_veiculo_id;

  DELETE FROM veiculos WHERE id = p_veiculo_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Veículo não encontrado ou sem permissão para excluir.';
  END IF;
END;
$$;