
-- 1) Blindar get_sentinela_detectores_admin (cron usa service_role → auth.uid() é NULL e passa)
CREATE OR REPLACE FUNCTION public.get_sentinela_detectores_admin()
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
  v_os_valor_divergente int;
  v_os_sem_entrada_principal int;
BEGIN
  -- Permite apenas: (a) contexto sem usuário (cron/service_role) OU (b) super_admin
  IF v_uid IS NOT NULL AND NOT public.is_super_admin(v_uid) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_os_sem_item
  FROM public.ordens_servico os
  WHERE os.status = 'finalizado'
    AND COALESCE(os.valor_mao_obra, 0) = 0
    AND NOT EXISTS (SELECT 1 FROM public.itens_os i WHERE i.ordem_servico_id = os.id);

  SELECT count(*) INTO v_estoque_neg FROM public.estoque WHERE quantidade < 0;

  SELECT count(*) INTO v_parcela_sem_fin
  FROM public.parcelas_pagamento p
  WHERE p.status = 'pago'
    AND p.ordem_servico_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.financeiro f
      WHERE f.ordem_servico_id = p.ordem_servico_id AND f.tipo = 'entrada'
    );

  SELECT count(*) INTO v_os_sem_parcela
  FROM public.ordens_servico os
  WHERE os.status = 'finalizado'
    AND COALESCE(os.valor_servico, 0) > 0
    AND NOT EXISTS (SELECT 1 FROM public.parcelas_pagamento pp WHERE pp.ordem_servico_id = os.id)
    AND NOT EXISTS (SELECT 1 FROM public.financeiro f WHERE f.ordem_servico_id = os.id AND f.tipo = 'entrada');

  WITH sin AS (
    SELECT s.ordem_servico_id, SUM(s.valor) AS sinal_total
    FROM public.os_sinais s GROUP BY 1
  ),
  ent AS (
    SELECT f.ordem_servico_id, SUM(f.valor) AS entradas_principais
    FROM public.financeiro f
    WHERE f.tipo = 'entrada'
      AND f.ordem_servico_id IS NOT NULL
      AND (f.categoria IS NULL OR f.categoria NOT IN ('comissao','sinal'))
    GROUP BY 1
  )
  SELECT count(*) INTO v_os_valor_divergente
  FROM public.ordens_servico os
  LEFT JOIN sin ON sin.ordem_servico_id = os.id
  LEFT JOIN ent ON ent.ordem_servico_id = os.id
  WHERE os.status = 'finalizado'
    AND COALESCE(os.valor_servico,0) > 0
    AND ABS(COALESCE(os.valor_servico,0) - COALESCE(os.desconto,0)
            - COALESCE(sin.sinal_total,0) - COALESCE(ent.entradas_principais,0)) > 0.05;

  SELECT count(*) INTO v_os_sem_entrada_principal
  FROM public.ordens_servico os
  WHERE os.status = 'finalizado'
    AND COALESCE(os.valor_servico,0) > 0
    AND EXISTS (SELECT 1 FROM public.os_sinais s WHERE s.ordem_servico_id = os.id)
    AND NOT EXISTS (
      SELECT 1 FROM public.financeiro f
      WHERE f.ordem_servico_id = os.id
        AND f.tipo = 'entrada'
        AND (f.categoria IS NULL OR f.categoria NOT IN ('comissao','sinal'))
    )
    AND COALESCE(os.valor_servico,0) - COALESCE(os.desconto,0)
        - COALESCE((SELECT SUM(valor) FROM public.os_sinais s WHERE s.ordem_servico_id = os.id), 0) > 0.05;

  RETURN jsonb_build_object(
    'detectores', jsonb_build_array(
      jsonb_build_object('id','os_sem_item','severidade','red','label','OS finalizada vazia (sem item e sem mão-de-obra)','count',v_os_sem_item),
      jsonb_build_object('id','estoque_negativo','severidade','red','label','Estoque negativo','count',v_estoque_neg),
      jsonb_build_object('id','parcela_paga_sem_financeiro','severidade','yellow','label','Parcela paga sem financeiro','count',v_parcela_sem_fin),
      jsonb_build_object('id','os_finalizada_sem_parcela','severidade','yellow','label','OS finalizada > R$0 sem nenhum financeiro','count',v_os_sem_parcela),
      jsonb_build_object('id','os_finalizada_valor_divergente','severidade','red','label','OS finalizada com valor financeiro divergente','count',v_os_valor_divergente),
      jsonb_build_object('id','os_finalizada_sem_entrada_principal','severidade','red','label','OS finalizada com sinal mas sem entrada principal','count',v_os_sem_entrada_principal)
    ),
    'total_inconsistencias', v_os_sem_item + v_estoque_neg + v_parcela_sem_fin + v_os_sem_parcela + v_os_valor_divergente + v_os_sem_entrada_principal
  );
END;
$function$;

-- 2) Bloqueia execução pública/anônima; libera apenas para authenticated (checagem interna já filtra super_admin)
REVOKE EXECUTE ON FUNCTION public.get_sentinela_score()                    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_sentinela_modulos()                  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_sentinela_detectores()               FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_sentinela_logs(integer)              FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_sentinela_detectores_admin()         FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_sentinela_score()                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sentinela_modulos()                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sentinela_detectores()                TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sentinela_logs(integer)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sentinela_detectores_admin()          TO service_role;

-- 3) Cron idempotente: se já existe job com mesmo nome, mantém; senão, cria
DO $cron$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sentinela-detector-5min') INTO v_exists;
  IF NOT v_exists THEN
    PERFORM cron.schedule(
      'sentinela-detector-5min',
      '*/5 * * * *',
      $job$
      SELECT net.http_post(
        url := 'https://cuhkkoqqeguascdsvtky.supabase.co/functions/v1/sentinela-detector',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1aGtrb3FxZWd1YXNjZHN2dGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMDIyNjYsImV4cCI6MjA4OTg3ODI2Nn0.0alA3zv0qnf9oXI8A2GOIFBG4WhwAzfZjQ1j5a7RTkA'
        ),
        body := jsonb_build_object('source','cron','ts',now())
      );
      $job$
    );
  END IF;
END
$cron$;
