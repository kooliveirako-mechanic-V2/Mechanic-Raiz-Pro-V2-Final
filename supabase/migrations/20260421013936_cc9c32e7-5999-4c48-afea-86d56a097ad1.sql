CREATE OR REPLACE FUNCTION public.check_divergencia_valores()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH agg AS (
    SELECT 
      os.id,
      os.valor_servico AS os_total,
      COALESCE(SUM(f.valor) FILTER (
        WHERE f.tipo = 'entrada' AND f.origem NOT ILIKE 'Comissão%'
      ), 0) AS fin_total
    FROM ordens_servico os
    JOIN financeiro f ON f.ordem_servico_id = os.id
    WHERE os.status = 'finalizado'
      AND COALESCE(os.valor_servico, 0) > 0
    GROUP BY os.id, os.valor_servico
  )
  SELECT COUNT(*)::integer FROM agg WHERE ABS(fin_total - os_total) > 0.01;
$$;