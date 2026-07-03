-- Performance optimization: consolidate 8 dashboard queries into single RPC
-- This reduces roundtrips from 8 to 1 for the operational stats section

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(
  p_oficina_id uuid,
  p_data_inicio date,
  p_data_fim date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_hoje date := CURRENT_DATE;
  v_servicos_hoje int;
  v_servicos_finalizados_hoje int;
  v_total_clientes int;
  v_novos_clientes_mes int;
  v_servicos_atrasados int;
  v_estoque_baixo int;
  v_servicos_atual int;
  v_servicos_prev int;
  v_clientes_prev int;
  v_prev_inicio date;
  v_prev_fim date;
BEGIN
  -- AUTHZ: verify user has access to this oficina
  IF NOT public.has_oficina_access(v_uid, p_oficina_id) THEN
    RAISE EXCEPTION 'Acesso negado à oficina' USING ERRCODE = '42501';
  END IF;

  -- Calculate previous period (same duration, shifted back)
  v_prev_fim := p_data_inicio - interval '1 day';
  v_prev_inicio := v_prev_fim - (p_data_fim - p_data_inicio);

  -- 1. Serviços hoje (all + finalizados)
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'finalizado')
  INTO v_servicos_hoje, v_servicos_finalizados_hoje
  FROM public.ordens_servico
  WHERE oficina_id = p_oficina_id
    AND data_servico = v_hoje;

  -- 2. Total clientes
  SELECT COUNT(*) INTO v_total_clientes
  FROM public.clientes
  WHERE oficina_id = p_oficina_id;

  -- 3. Novos clientes no período
  SELECT COUNT(*) INTO v_novos_clientes_mes
  FROM public.clientes
  WHERE oficina_id = p_oficina_id
    AND created_at >= p_data_inicio
    AND created_at <= p_data_fim + interval '1 day';

  -- 4. Serviços atrasados (pendente/em_andamento com data < hoje)
  SELECT COUNT(*) INTO v_servicos_atrasados
  FROM public.ordens_servico
  WHERE oficina_id = p_oficina_id
    AND status IN ('pendente', 'em_andamento')
    AND data_servico < v_hoje;

  -- 5. Estoque abaixo do mínimo
  SELECT COUNT(*) INTO v_estoque_baixo
  FROM public.estoque
  WHERE oficina_id = p_oficina_id
    AND arquivado = false
    AND quantidade <= COALESCE(alerta_minimo, 0);

  -- 6. Serviços finalizados no período atual
  SELECT COUNT(*) INTO v_servicos_atual
  FROM public.ordens_servico
  WHERE oficina_id = p_oficina_id
    AND status = 'finalizado'
    AND data_servico >= p_data_inicio
    AND data_servico <= p_data_fim;

  -- 7. Serviços finalizados no período anterior
  SELECT COUNT(*) INTO v_servicos_prev
  FROM public.ordens_servico
  WHERE oficina_id = p_oficina_id
    AND status = 'finalizado'
    AND data_servico >= v_prev_inicio
    AND data_servico <= v_prev_fim;

  -- 8. Clientes no período anterior
  SELECT COUNT(*) INTO v_clientes_prev
  FROM public.clientes
  WHERE oficina_id = p_oficina_id
    AND created_at >= v_prev_inicio
    AND created_at <= v_prev_fim + interval '1 day';

  RETURN jsonb_build_object(
    'servicos_hoje', v_servicos_hoje,
    'servicos_finalizados_hoje', v_servicos_finalizados_hoje,
    'total_clientes', v_total_clientes,
    'novos_clientes_mes', v_novos_clientes_mes,
    'servicos_atrasados', v_servicos_atrasados,
    'estoque_baixo', v_estoque_baixo,
    'servicos_atual_count', v_servicos_atual,
    'servicos_prev_count', v_servicos_prev,
    'clientes_prev_count', v_clientes_prev
  );
END;
$function$;

-- Grant execute to authenticated users (RLS via has_oficina_access inside)
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(uuid, date, date) TO authenticated;
