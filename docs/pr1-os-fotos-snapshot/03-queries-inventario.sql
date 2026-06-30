-- ============================================================================
-- PR 1 — Entregável 3/7: Queries de inventário (read-only, pós-INSERT)
-- ============================================================================
-- Todas executam SELECT no snapshot. Nenhuma toca ordens_servico ou storage.
-- ============================================================================

-- 3.1 — Universo bruto: as N linhas do último run, com valor_original e
--       path_normalizado completos (formato esperado pela governança de auditoria).
WITH ultimo_run AS (
  SELECT snapshot_run_id
  FROM public.os_fotos_snapshot_pr1
  ORDER BY capturado_em DESC
  LIMIT 1
)
SELECT
  oficina_id, os_id, origem, posicao_array,
  valor_original, path_normalizado,
  tipo_valor, tipo_path, objeto_existe, status_sugerido
FROM public.os_fotos_snapshot_pr1
WHERE snapshot_run_id = (SELECT snapshot_run_id FROM ultimo_run)
ORDER BY origem, os_id, posicao_array;


-- 3.2 — Resumo agregado por status_sugerido (esperado para o run atual:
--       1 requires_promotion, 2 candidate_normalization, 0 órfãos, 0 inválidos).
WITH ultimo_run AS (
  SELECT snapshot_run_id
  FROM public.os_fotos_snapshot_pr1
  ORDER BY capturado_em DESC
  LIMIT 1
)
SELECT status_sugerido, count(*) AS total
FROM public.os_fotos_snapshot_pr1
WHERE snapshot_run_id = (SELECT snapshot_run_id FROM ultimo_run)
GROUP BY status_sugerido
ORDER BY status_sugerido;


-- 3.3 — Resumo por origem (prova de cobertura do UNION ALL entre as duas colunas).
WITH ultimo_run AS (
  SELECT snapshot_run_id
  FROM public.os_fotos_snapshot_pr1
  ORDER BY capturado_em DESC
  LIMIT 1
)
SELECT origem, count(*) AS total
FROM public.os_fotos_snapshot_pr1
WHERE snapshot_run_id = (SELECT snapshot_run_id FROM ultimo_run)
GROUP BY origem
ORDER BY origem;
