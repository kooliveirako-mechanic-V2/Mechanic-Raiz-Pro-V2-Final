
-- RPC admin para o cron (sem checagem de super_admin, pois roda com service_role)
CREATE OR REPLACE FUNCTION public.get_sentinela_detectores_admin()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_os_sem_item int;
  v_estoque_neg int;
  v_parcela_sem_fin int;
  v_os_sem_parcela int;
BEGIN
  SELECT count(*) INTO v_os_sem_item
  FROM public.ordens_servico os
  WHERE os.status = 'finalizada'
    AND NOT EXISTS (SELECT 1 FROM public.itens_os i WHERE i.os_id = os.id);

  SELECT count(*) INTO v_estoque_neg FROM public.estoque WHERE quantidade < 0;

  SELECT count(*) INTO v_parcela_sem_fin
  FROM public.parcelas_pagamento p
  WHERE p.status = 'pago'
    AND NOT EXISTS (SELECT 1 FROM public.financeiro f WHERE f.parcela_id = p.id);

  SELECT count(*) INTO v_os_sem_parcela
  FROM public.ordens_servico os
  WHERE os.status = 'finalizada'
    AND COALESCE(os.valor_servico, 0) > 0
    AND NOT EXISTS (SELECT 1 FROM public.parcelas_pagamento pp WHERE pp.os_id = os.id);

  RETURN jsonb_build_object(
    'detectores', jsonb_build_array(
      jsonb_build_object('id','os_sem_item','severidade','red','label','OS finalizada sem item','count',v_os_sem_item),
      jsonb_build_object('id','estoque_negativo','severidade','red','label','Estoque negativo','count',v_estoque_neg),
      jsonb_build_object('id','parcela_paga_sem_financeiro','severidade','yellow','label','Parcela paga sem financeiro','count',v_parcela_sem_fin),
      jsonb_build_object('id','os_finalizada_sem_parcela','severidade','yellow','label','OS finalizada > R$0 sem parcela','count',v_os_sem_parcela)
    ),
    'total_inconsistencias', v_os_sem_item + v_estoque_neg + v_parcela_sem_fin + v_os_sem_parcela
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_sentinela_detectores_admin() FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_sentinela_detectores_admin() TO service_role;

-- Garante extensões para o cron
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
