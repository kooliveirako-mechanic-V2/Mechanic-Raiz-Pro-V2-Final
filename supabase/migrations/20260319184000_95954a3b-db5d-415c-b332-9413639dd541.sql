-- RPC functions for system-health-check

CREATE OR REPLACE FUNCTION public.check_os_sem_financeiro()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::integer
  FROM ordens_servico o
  LEFT JOIN financeiro f ON f.ordem_servico_id = o.id
  WHERE o.status = 'finalizado'
  AND f.id IS NULL
  AND (o.valor_servico > 0 OR EXISTS(
    SELECT 1 FROM itens_os WHERE ordem_servico_id = o.id AND valor_total > 0
  ));
$$;

CREATE OR REPLACE FUNCTION public.check_divergencia_valores()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::integer
  FROM ordens_servico o
  JOIN financeiro f ON f.ordem_servico_id = o.id
  WHERE o.status = 'finalizado'
  AND ABS(
    COALESCE(o.valor_servico,0) +
    COALESCE((SELECT SUM(valor_total) FROM itens_os WHERE ordem_servico_id = o.id),0)
    - COALESCE(f.valor,0)
  ) > 0.01;
$$;

CREATE OR REPLACE FUNCTION public.check_dados_orfaos()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::integer
  FROM itens_os
  WHERE ordem_servico_id NOT IN (SELECT id FROM ordens_servico);
$$;