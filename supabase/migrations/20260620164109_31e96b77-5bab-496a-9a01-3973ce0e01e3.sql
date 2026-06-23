
-- =========================================================================
-- SENTINELA RAIZ — FASE 1 — FUNDAÇÃO
-- =========================================================================

-- 1) HELPER: is_super_admin (cross-tenant)
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'super_admin'::app_role
      AND active = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;

-- 2) GRANT super_admin para ko.oliveira2016@gmail.com
-- Idempotente: ON CONFLICT no índice único (user_id, oficina_id)
DO $$
DECLARE
  v_user_id uuid := '82879702-5e29-4d83-86a4-08a9f061a6a4';
  v_oficina_id uuid;
BEGIN
  SELECT oficina_id INTO v_oficina_id
  FROM public.user_roles
  WHERE user_id = v_user_id AND active = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_oficina_id IS NULL THEN
    RAISE NOTICE 'Usuário sem oficina ativa — super_admin não concedido';
    RETURN;
  END IF;

  INSERT INTO public.user_roles (user_id, oficina_id, role, active)
  VALUES (v_user_id, v_oficina_id, 'super_admin'::app_role, true)
  ON CONFLICT (user_id, oficina_id) DO UPDATE
    SET role = 'super_admin'::app_role,
        active = true,
        updated_at = now()
    WHERE user_roles.role <> 'super_admin'::app_role;
END $$;

-- 3) TABELA: sentinela_snapshot (cache do score, 1 linha)
CREATE TABLE IF NOT EXISTS public.sentinela_snapshot (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  payload jsonb NOT NULL,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sentinela_snapshot TO authenticated;
GRANT ALL ON public.sentinela_snapshot TO service_role;

ALTER TABLE public.sentinela_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "snapshot_super_admin_read"
ON public.sentinela_snapshot FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_sentinela_snapshot_updated_at
BEFORE UPDATE ON public.sentinela_snapshot
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) TABELA: sentinela_alertas_enviados (cooldown 30 min por tipo)
CREATE TABLE IF NOT EXISTS public.sentinela_alertas_enviados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  alert_key text NOT NULL,
  payload jsonb,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alertas_type_sent ON public.sentinela_alertas_enviados (alert_type, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_alertas_key_sent  ON public.sentinela_alertas_enviados (alert_key, sent_at DESC);

GRANT SELECT ON public.sentinela_alertas_enviados TO authenticated;
GRANT ALL ON public.sentinela_alertas_enviados TO service_role;

ALTER TABLE public.sentinela_alertas_enviados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alertas_super_admin_read"
ON public.sentinela_alertas_enviados FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- =========================================================================
-- RPCs
-- =========================================================================

-- 5) get_sentinela_detectores — 4 detectores de bug silencioso
CREATE OR REPLACE FUNCTION public.get_sentinela_detectores()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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
    AND NOT EXISTS (SELECT 1 FROM public.itens_os i WHERE i.os_id = os.id);

  SELECT count(*) INTO v_estoque_neg
  FROM public.estoque WHERE quantidade < 0;

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
$$;

REVOKE ALL ON FUNCTION public.get_sentinela_detectores() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_sentinela_detectores() TO authenticated, service_role;

-- 6) get_sentinela_modulos — status por módulo
CREATE OR REPLACE FUNCTION public.get_sentinela_modulos()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_total_erros int;
  v_erros_os int;
  v_erros_fin int;
  v_erros_estoque int;
BEGIN
  IF v_uid IS NULL OR NOT public.is_super_admin(v_uid) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_total_erros
  FROM public.audit_logs
  WHERE action = 'runtime_error' AND created_at > now() - interval '24 hours';

  SELECT count(*) INTO v_erros_os
  FROM public.audit_logs
  WHERE action = 'runtime_error'
    AND created_at > now() - interval '24 hours'
    AND (new_data->>'rpc' LIKE '%os%' OR new_data->>'rpc' LIKE '%orcamento%');

  SELECT count(*) INTO v_erros_fin
  FROM public.audit_logs
  WHERE action = 'runtime_error'
    AND created_at > now() - interval '24 hours'
    AND (new_data->>'rpc' LIKE '%financ%' OR new_data->>'rpc' LIKE '%parcela%' OR new_data->>'rpc' LIKE '%pagamento%');

  SELECT count(*) INTO v_erros_estoque
  FROM public.audit_logs
  WHERE action = 'runtime_error'
    AND created_at > now() - interval '24 hours'
    AND new_data->>'rpc' LIKE '%estoque%';

  RETURN jsonb_build_object(
    'calculated_at', now(),
    'modulos', jsonb_build_array(
      jsonb_build_object('id','os_orcamentos','label','OS & Orçamentos','erros_24h',v_erros_os,
        'status', CASE WHEN v_erros_os = 0 THEN 'green' WHEN v_erros_os < 5 THEN 'yellow' ELSE 'red' END),
      jsonb_build_object('id','financeiro','label','Financeiro','erros_24h',v_erros_fin,
        'status', CASE WHEN v_erros_fin = 0 THEN 'green' WHEN v_erros_fin < 3 THEN 'yellow' ELSE 'red' END),
      jsonb_build_object('id','estoque','label','Estoque','erros_24h',v_erros_estoque,
        'status', CASE WHEN v_erros_estoque = 0 THEN 'green' WHEN v_erros_estoque < 5 THEN 'yellow' ELSE 'red' END),
      jsonb_build_object('id','geral','label','Sistema (geral)','erros_24h',v_total_erros,
        'status', CASE WHEN v_total_erros = 0 THEN 'green' WHEN v_total_erros < 10 THEN 'yellow' ELSE 'red' END)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_sentinela_modulos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_sentinela_modulos() TO authenticated, service_role;

-- 7) get_sentinela_logs — feed de erros
CREATE OR REPLACE FUNCTION public.get_sentinela_logs(_limit int DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_logs jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.is_super_admin(v_uid) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(t ORDER BY (t->>'created_at') DESC), '[]'::jsonb) INTO v_logs
  FROM (
    SELECT jsonb_build_object(
      'id', id,
      'created_at', created_at,
      'oficina_id', oficina_id,
      'user_id', user_id,
      'rpc', new_data->>'rpc',
      'message', new_data->>'message',
      'severity', COALESCE(new_data->>'severity', 'error'),
      'payload_keys', CASE WHEN new_data ? 'payload'
                            THEN (SELECT jsonb_agg(k) FROM jsonb_object_keys(new_data->'payload') k)
                            ELSE '[]'::jsonb END
    ) AS t
    FROM public.audit_logs
    WHERE action = 'runtime_error'
    ORDER BY created_at DESC
    LIMIT GREATEST(LEAST(_limit, 500), 1)
  ) sub;

  RETURN jsonb_build_object('calculated_at', now(), 'logs', v_logs);
END;
$$;

REVOKE ALL ON FUNCTION public.get_sentinela_logs(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_sentinela_logs(int) TO authenticated, service_role;

-- 8) get_sentinela_score — score total + componentes + cache 5 min
CREATE OR REPLACE FUNCTION public.get_sentinela_score()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cached jsonb;
  v_cached_at timestamptz;

  v_total_rpc int;
  v_erros_rpc int;
  v_taxa_sucesso numeric;

  v_detectores jsonb;
  v_total_inc int;
  v_integridade numeric;

  v_cobertura_total int := 12;
  v_cobertura_envoltas int := 0;
  v_cobertura_pct numeric;

  v_uptime numeric := 100.0;

  v_dias_deploy int;
  v_frescor numeric;

  v_score numeric;
  v_nivel text;
  v_payload jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.is_super_admin(v_uid) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Cache 5 minutos
  SELECT payload, calculated_at INTO v_cached, v_cached_at
  FROM public.sentinela_snapshot WHERE id = 1;

  IF v_cached IS NOT NULL AND v_cached_at > now() - interval '5 minutes' THEN
    RETURN v_cached || jsonb_build_object('from_cache', true);
  END IF;

  -- Taxa de Sucesso RPC (24h) — proxy: 100 - (erros * 2), piso 0
  SELECT count(*) INTO v_total_rpc
  FROM public.audit_logs WHERE created_at > now() - interval '24 hours';

  SELECT count(*) INTO v_erros_rpc
  FROM public.audit_logs
  WHERE action = 'runtime_error' AND created_at > now() - interval '24 hours';

  v_taxa_sucesso := CASE
    WHEN v_total_rpc = 0 THEN 100
    ELSE GREATEST(0, 100 - (v_erros_rpc::numeric / GREATEST(v_total_rpc,1)) * 100)
  END;

  -- Integridade (4 detectores)
  v_detectores := public.get_sentinela_detectores();
  v_total_inc := COALESCE((v_detectores->>'total_inconsistencias')::int, 0);
  v_integridade := GREATEST(0, 100 - (v_total_inc * 5));

  -- Cobertura: lê do snapshot se a app gravar; default 0 até wrapper rodar
  -- (Fase 2 atualiza este número via UPSERT no snapshot)
  v_cobertura_envoltas := COALESCE((v_cached->'meta'->>'rpcs_envoltas')::int, 0);
  v_cobertura_pct := LEAST(100, (v_cobertura_envoltas::numeric / v_cobertura_total) * 100);

  -- Uptime: simplificado (100 enquanto não há tabela de health pings)
  v_uptime := 100;

  -- Frescor de Deploy: usa última linha de audit_logs como proxy de atividade
  SELECT EXTRACT(day FROM now() - MAX(created_at))::int INTO v_dias_deploy
  FROM public.audit_logs;
  v_dias_deploy := COALESCE(v_dias_deploy, 30);
  v_frescor := CASE
    WHEN v_dias_deploy <= 7 THEN 100
    WHEN v_dias_deploy >= 30 THEN 0
    ELSE 100 - ((v_dias_deploy - 7)::numeric / 23) * 100
  END;

  v_score := round(
    (v_uptime * 0.25) +
    (v_taxa_sucesso * 0.30) +
    (v_integridade * 0.25) +
    (v_cobertura_pct * 0.10) +
    (v_frescor * 0.10)
  );

  v_nivel := CASE
    WHEN v_score >= 90 THEN 'green'
    WHEN v_score >= 70 THEN 'yellow'
    ELSE 'red'
  END;

  v_payload := jsonb_build_object(
    'score', v_score,
    'nivel', v_nivel,
    'calculated_at', now(),
    'from_cache', false,
    'componentes', jsonb_build_array(
      jsonb_build_object('id','uptime','label','Uptime (24h)','peso',0.25,
        'valor',v_uptime,'pontos',round(v_uptime*0.25,2),
        'evidencia_sql','SELECT 100 -- placeholder até system-health-check expor pings'),
      jsonb_build_object('id','taxa_sucesso_rpc','label','Taxa de Sucesso RPC (24h)','peso',0.30,
        'valor',round(v_taxa_sucesso,2),'pontos',round(v_taxa_sucesso*0.30,2),
        'evidencia_sql','SELECT 100 - (count(*) FILTER (WHERE action=''runtime_error'')::numeric / count(*)) * 100 FROM audit_logs WHERE created_at > now() - interval ''24 hours'''),
      jsonb_build_object('id','integridade_dados','label','Integridade de Dados','peso',0.25,
        'valor',v_integridade,'pontos',round(v_integridade*0.25,2),
        'evidencia_sql','SELECT public.get_sentinela_detectores()'),
      jsonb_build_object('id','cobertura_monitoramento','label','Cobertura do Monitoramento','peso',0.10,
        'valor',round(v_cobertura_pct,2),'pontos',round(v_cobertura_pct*0.10,2),
        'evidencia_sql', format('SELECT %s / %s -- rpcs envoltas / total críticas', v_cobertura_envoltas, v_cobertura_total)),
      jsonb_build_object('id','frescor_deploy','label','Frescor de Deploy','peso',0.10,
        'valor',round(v_frescor,2),'pontos',round(v_frescor*0.10,2),
        'evidencia_sql', format('SELECT %s -- dias desde última atividade', v_dias_deploy))
    ),
    'meta', jsonb_build_object('rpcs_envoltas', v_cobertura_envoltas, 'rpcs_total', v_cobertura_total)
  );

  -- UPSERT no snapshot (cache)
  INSERT INTO public.sentinela_snapshot (id, payload, calculated_at)
  VALUES (1, v_payload, now())
  ON CONFLICT (id) DO UPDATE
    SET payload = EXCLUDED.payload,
        calculated_at = EXCLUDED.calculated_at,
        updated_at = now();

  RETURN v_payload;
END;
$$;

REVOKE ALL ON FUNCTION public.get_sentinela_score() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_sentinela_score() TO authenticated, service_role;
