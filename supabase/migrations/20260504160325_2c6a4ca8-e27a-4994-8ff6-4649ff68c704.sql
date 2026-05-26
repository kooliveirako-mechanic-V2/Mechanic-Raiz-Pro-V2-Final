
CREATE OR REPLACE FUNCTION public.recalcular_totais_os(p_os_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total_produtos NUMERIC := 0;
  v_total_mao_obra_itens NUMERIC := 0;
  v_mao_obra_global NUMERIC := 0;
  v_valor_servico_atual NUMERIC := 0;
  v_status TEXT;
  v_total_receita NUMERIC := 0;
  v_total_custo NUMERIC := 0;
  v_financeiro_total NUMERIC := 0;
BEGIN
  SELECT
    COALESCE(os.valor_mao_obra, 0),
    COALESCE(os.valor_servico, 0),
    os.status
  INTO v_mao_obra_global, v_valor_servico_atual, v_status
  FROM public.ordens_servico os
  WHERE os.id = p_os_id;

  SELECT
    COALESCE(SUM(COALESCE(ios.quantidade, 1) * COALESCE(ios.valor_unitario, 0)), 0),
    COALESCE(SUM(COALESCE(ios.valor_mao_obra, 0)), 0),
    COALESCE(SUM(
      COALESCE(ios.quantidade, 1) * COALESCE(NULLIF(ios.custo_unitario, 0), e.custo_unitario, 0)
    ), 0)
  INTO v_total_produtos, v_total_mao_obra_itens, v_total_custo
  FROM public.itens_os ios
  LEFT JOIN public.estoque e ON e.id = ios.estoque_id
  WHERE ios.ordem_servico_id = p_os_id;

  v_total_receita := v_total_produtos + GREATEST(v_mao_obra_global, v_total_mao_obra_itens);

  -- Safety net: nunca zerar OS finalizada que já tem caixa lançado
  IF v_total_receita <= 0 AND v_status = 'finalizado' THEN
    SELECT COALESCE(SUM(valor), 0) INTO v_financeiro_total
    FROM public.financeiro
    WHERE ordem_servico_id = p_os_id
      AND tipo = 'entrada'
      AND origem NOT ILIKE 'Comissão%';

    IF v_financeiro_total > 0 THEN
      v_total_receita := v_financeiro_total;
    ELSIF v_valor_servico_atual > 0 THEN
      v_total_receita := v_valor_servico_atual;
    END IF;
  ELSIF v_total_receita <= 0 AND v_valor_servico_atual > 0 THEN
    v_total_receita := v_valor_servico_atual;
  END IF;

  UPDATE public.ordens_servico
  SET valor_servico = v_total_receita,
      custo_servico = v_total_custo
  WHERE id = p_os_id;
END;
$function$;
