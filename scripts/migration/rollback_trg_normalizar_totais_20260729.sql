CREATE OR REPLACE FUNCTION public.tg_normalizar_totais_ordem_servico()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total_produtos NUMERIC := 0;
  v_total_mao_obra_itens NUMERIC := 0;
  v_total_custo NUMERIC := 0;
  v_tem_itens BOOLEAN := false;
BEGIN
  SELECT
    EXISTS (SELECT 1 FROM public.itens_os ios WHERE ios.ordem_servico_id = NEW.id),
    COALESCE(SUM(COALESCE(ios.quantidade, 1) * COALESCE(ios.valor_unitario, 0)), 0),
    COALESCE(SUM(COALESCE(ios.valor_mao_obra, 0)), 0),
    COALESCE(SUM(
      COALESCE(ios.quantidade, 1) * COALESCE(NULLIF(ios.custo_unitario, 0), e.custo_unitario, 0)
    ), 0)
  INTO v_tem_itens, v_total_produtos, v_total_mao_obra_itens, v_total_custo
  FROM public.itens_os ios
  LEFT JOIN public.estoque e ON e.id = ios.estoque_id
  WHERE ios.ordem_servico_id = NEW.id;

  -- Compatibilidade: se algum cliente antigo mandar apenas valor_servico como valor digitado,
  -- tratar como mão de obra quando ainda não há itens.
  IF COALESCE(NEW.valor_mao_obra, 0) <= 0
     AND COALESCE(NEW.valor_servico, 0) > 0
     AND (TG_OP = 'INSERT' OR NEW.valor_servico IS DISTINCT FROM OLD.valor_servico)
     AND NOT v_tem_itens THEN
    NEW.valor_mao_obra := NEW.valor_servico;
  END IF;

  NEW.valor_servico := v_total_produtos + GREATEST(COALESCE(NEW.valor_mao_obra, 0), v_total_mao_obra_itens);
  NEW.custo_servico := v_total_custo;

  RETURN NEW;
END;
$function$
