CREATE OR REPLACE FUNCTION public.get_sentinela_detectores()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_os_sem_item int;
  v_estoque_neg int;
  v_parcela_sem_fin int;
  v_os_sem_parcela int;
BEGIN
  IF v_uid IS NULL OR NOT public.is_super_admin(v_uid) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_os_sem_item
  FROM public.ordens_servico os
  WHERE os.status = 'finalizada'
    AND NOT EXISTS (SELECT 1 FROM public.itens_os i WHERE i.ordem_servico_id = os.id);

  SELECT count(*) INTO v_estoque_neg FROM public.estoque WHERE quantidade < 0;

  SELECT count(*) INTO v_parcela_sem_fin
  FROM public.parcelas_pagamento p
  WHERE p.status = 'pago'
    AND p.ordem_servico_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.financeiro f
      WHERE f.ordem_servico_id = p.ordem_servico_id AND f.tipo = 'receita'
    );

  SELECT count(*) INTO v_os_sem_parcela
  FROM public.ordens_servico os
  WHERE os.status = 'finalizada'
    AND COALESCE(os.valor_servico, 0) > 0
    AND NOT EXISTS (SELECT 1 FROM public.parcelas_pagamento pp WHERE pp.ordem_servico_id = os.id);

  RETURN jsonb_build_object(
    'calculated_at', now(),
    'detectores', jsonb_build_array(
      jsonb_build_object('id','os_sem_item','severidade','red','label','OS finalizada sem item','count',v_os_sem_item),
      jsonb_build_object('id','estoque_negativo','severidade','red','label','Estoque negativo','count',v_estoque_neg),
      jsonb_build_object('id','parcela_paga_sem_financeiro','severidade','yellow','label','Parcela paga sem registro financeiro','count',v_parcela_sem_fin),
      jsonb_build_object('id','os_finalizada_sem_parcela','severidade','yellow','label','OS finalizada > R$0 sem parcela','count',v_os_sem_parcela)
    ),
    'total_inconsistencias', v_os_sem_item + v_estoque_neg + v_parcela_sem_fin + v_os_sem_parcela
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_sentinela_detectores_admin()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_os_sem_item int;
  v_estoque_neg int;
  v_parcela_sem_fin int;
  v_os_sem_parcela int;
BEGIN
  SELECT count(*) INTO v_os_sem_item
  FROM public.ordens_servico os
  WHERE os.status = 'finalizada'
    AND NOT EXISTS (SELECT 1 FROM public.itens_os i WHERE i.ordem_servico_id = os.id);

  SELECT count(*) INTO v_estoque_neg FROM public.estoque WHERE quantidade < 0;

  SELECT count(*) INTO v_parcela_sem_fin
  FROM public.parcelas_pagamento p
  WHERE p.status = 'pago'
    AND p.ordem_servico_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.financeiro f
      WHERE f.ordem_servico_id = p.ordem_servico_id AND f.tipo = 'receita'
    );

  SELECT count(*) INTO v_os_sem_parcela
  FROM public.ordens_servico os
  WHERE os.status = 'finalizada'
    AND COALESCE(os.valor_servico, 0) > 0
    AND NOT EXISTS (SELECT 1 FROM public.parcelas_pagamento pp WHERE pp.ordem_servico_id = os.id);

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
$function$;