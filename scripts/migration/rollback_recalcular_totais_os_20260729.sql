CREATE OR REPLACE FUNCTION public.recalcular_totais_os(p_os_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_total_produtos numeric := 0;
  v_total_servicos_catalogo numeric := 0;
  v_total_mao_obra_itens numeric := 0;
  v_mao_obra_global numeric := 0;
  v_desconto numeric := 0;
  v_valor_servico_atual numeric := 0;
  v_status text;
  v_total_receita_bruta numeric := 0;
  v_total_custo numeric := 0;
  v_financeiro_total_pago numeric := 0;
BEGIN
  SELECT
    COALESCE(os.valor_mao_obra, 0),
    COALESCE(os.valor_servico, 0),
    COALESCE(os.desconto, 0),
    os.status
  INTO v_mao_obra_global, v_valor_servico_atual, v_desconto, v_status
  FROM public.ordens_servico os
  WHERE os.id = p_os_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND (auth.uid() IS NULL OR NOT public.has_oficina_access(auth.uid(), (SELECT oficina_id FROM public.ordens_servico WHERE id = p_os_id))) THEN
    RAISE EXCEPTION 'Acesso negado à função %', 'recalcular_totais_os'
      USING ERRCODE = '42501';
  END IF;


  SELECT
    COALESCE(SUM(CASE WHEN ios.tipo = 'produto' OR ios.estoque_id IS NOT NULL
      THEN COALESCE(ios.quantidade, 1) * COALESCE(ios.valor_unitario, 0)
      ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN ios.tipo = 'servico' AND ios.estoque_id IS NULL
      THEN COALESCE(ios.quantidade, 1) * COALESCE(ios.valor_unitario, 0)
      ELSE 0 END), 0),
    COALESCE(SUM(COALESCE(ios.valor_mao_obra, 0)), 0),
    COALESCE(SUM(
      COALESCE(ios.quantidade, 1) * COALESCE(NULLIF(ios.custo_unitario, 0), e.custo_unitario, 0)
    ), 0)
  INTO v_total_produtos, v_total_servicos_catalogo, v_total_mao_obra_itens, v_total_custo
  FROM public.itens_os ios
  LEFT JOIN public.estoque e ON e.id = ios.estoque_id
  WHERE ios.ordem_servico_id = p_os_id;

  -- Contrato oficial:
  -- valor_servico = peças/produtos + serviços de catálogo + maior mão de obra entre global e itemizada.
  -- lucro NÃO é escrito aqui; é GENERATED ALWAYS em ordens_servico.
  v_total_receita_bruta := v_total_produtos + v_total_servicos_catalogo + GREATEST(v_mao_obra_global, v_total_mao_obra_itens);

  -- Safety net para OS finalizada legado: não zera OS já paga se itens antigos estiverem incompletos.
  IF v_total_receita_bruta <= 0 AND v_status = 'finalizado' THEN
    SELECT COALESCE(SUM(valor), 0) INTO v_financeiro_total_pago
    FROM public.financeiro
    WHERE ordem_servico_id = p_os_id
      AND tipo = 'entrada'
      AND origem NOT ILIKE 'Comissão%'
      AND categoria != 'sinal';

    IF v_financeiro_total_pago > 0 THEN
      v_total_receita_bruta := v_financeiro_total_pago + v_desconto;
    ELSIF v_valor_servico_atual > 0 THEN
      v_total_receita_bruta := v_valor_servico_atual;
    END IF;
  END IF;

  UPDATE public.ordens_servico
  SET valor_servico = v_total_receita_bruta,
      custo_servico = v_total_custo
  WHERE id = p_os_id
    AND (
      valor_servico IS DISTINCT FROM v_total_receita_bruta
      OR custo_servico IS DISTINCT FROM v_total_custo
    );
END;
$function$
