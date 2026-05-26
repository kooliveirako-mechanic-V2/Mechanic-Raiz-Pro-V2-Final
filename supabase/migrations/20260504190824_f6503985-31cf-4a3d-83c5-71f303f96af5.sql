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

  IF NOT FOUND THEN
    RETURN;
  END IF;

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

  -- Safety net: não apaga valor histórico de OS finalizada que já teve financeiro lançado.
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
  END IF;

  UPDATE public.ordens_servico
  SET valor_servico = v_total_receita,
      custo_servico = CASE WHEN v_total_custo > 0 THEN v_total_custo ELSE custo_servico END
  WHERE id = p_os_id
    AND (
      valor_servico IS DISTINCT FROM v_total_receita
      OR (v_total_custo > 0 AND custo_servico IS DISTINCT FROM v_total_custo)
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.tg_recalcular_totais_os_itens()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_os_id uuid;
BEGIN
  v_os_id := COALESCE(NEW.ordem_servico_id, OLD.ordem_servico_id);
  PERFORM public.recalcular_totais_os(v_os_id);
  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS tg_recalcular_totais_os ON public.itens_os;
DROP TRIGGER IF EXISTS trigger_recalcular_totais_os ON public.itens_os;
DROP TRIGGER IF EXISTS recalc_totais_os_itens ON public.itens_os;

CREATE TRIGGER tg_recalcular_totais_os
AFTER INSERT OR UPDATE OR DELETE ON public.itens_os
FOR EACH ROW
EXECUTE FUNCTION public.tg_recalcular_totais_os_itens();

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
  -- tratar como mão de obra, não como total absoluto.
  IF COALESCE(NEW.valor_mao_obra, 0) <= 0
     AND COALESCE(NEW.valor_servico, 0) > 0
     AND (TG_OP = 'INSERT' OR NEW.valor_servico IS DISTINCT FROM OLD.valor_servico)
     AND NOT v_tem_itens THEN
    NEW.valor_mao_obra := NEW.valor_servico;
  END IF;

  NEW.valor_servico := v_total_produtos + GREATEST(COALESCE(NEW.valor_mao_obra, 0), v_total_mao_obra_itens);

  IF v_total_custo > 0 THEN
    NEW.custo_servico := v_total_custo;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tg_normalizar_totais_ordem_servico ON public.ordens_servico;
DROP TRIGGER IF EXISTS trigger_normalizar_totais_ordem_servico ON public.ordens_servico;

CREATE TRIGGER tg_normalizar_totais_ordem_servico
BEFORE INSERT OR UPDATE OF valor_servico, valor_mao_obra ON public.ordens_servico
FOR EACH ROW
EXECUTE FUNCTION public.tg_normalizar_totais_ordem_servico();