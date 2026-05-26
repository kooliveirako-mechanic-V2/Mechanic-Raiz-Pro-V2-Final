CREATE OR REPLACE FUNCTION public.recalcular_totais_os(p_os_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total_itens NUMERIC := 0;
  v_total_custo NUMERIC := 0;
  v_mao_obra_global NUMERIC := 0;
BEGIN
  -- Soma dos itens (peças + serviços + mão de obra por item)
  SELECT 
    COALESCE(SUM(COALESCE(valor_total, (quantidade * COALESCE(valor_unitario, 0)) + COALESCE(valor_mao_obra, 0))), 0),
    COALESCE(SUM(
      CASE WHEN estoque_id IS NOT NULL THEN
        quantidade * COALESCE((SELECT custo_unitario FROM estoque WHERE id = itens_os.estoque_id), 0)
      ELSE quantidade * COALESCE(custo_unitario, 0) END
    ), 0)
  INTO v_total_itens, v_total_custo
  FROM itens_os
  WHERE ordem_servico_id = p_os_id;

  -- CAUSA RAIZ DO BUG: também precisa somar a mão de obra GLOBAL da OS
  SELECT COALESCE(valor_mao_obra, 0)
  INTO v_mao_obra_global
  FROM ordens_servico
  WHERE id = p_os_id;

  UPDATE ordens_servico
  SET valor_servico = v_total_itens + v_mao_obra_global,
      custo_servico = v_total_custo
  WHERE id = p_os_id;
END;
$function$;