CREATE OR REPLACE FUNCTION public.recalcular_totais_os(p_os_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total_receita NUMERIC := 0;
  v_total_custo NUMERIC := 0;
BEGIN
  SELECT 
    COALESCE(SUM(COALESCE(valor_total, (quantidade * COALESCE(valor_unitario, 0)) + COALESCE(valor_mao_obra, 0))), 0),
    COALESCE(SUM(
      CASE WHEN estoque_id IS NOT NULL THEN
        quantidade * COALESCE((SELECT custo_unitario FROM estoque WHERE id = itens_os.estoque_id), 0)
      ELSE 0 END
    ), 0)
  INTO v_total_receita, v_total_custo
  FROM itens_os
  WHERE ordem_servico_id = p_os_id;

  UPDATE ordens_servico
  SET valor_servico = v_total_receita,
      custo_servico = v_total_custo
  WHERE id = p_os_id;
END;
$function$;