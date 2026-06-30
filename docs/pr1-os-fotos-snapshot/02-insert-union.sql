-- ============================================================================
-- PR 1 — Entregável 2/7: INSERT INTO snapshot (UNION ALL fotos_entrada + fotos_saida)
-- ============================================================================
-- Escopo PR 1: só INSERT no snapshot. NÃO toca ordens_servico, NÃO toca
--              storage.objects, NÃO toca a tabela interna de buckets do Storage.
--
-- gen_random_uuid() do snapshot_run_id permite re-rodar o INSERT em N execuções
-- de auditoria sem perder histórico de runs anteriores.
--
-- Correção round 2: snapshot passa a carregar oficina_id no momento da captura
-- (sistema multi-tenant), trazido diretamente de ordens_servico em ambos os
-- ramos do UNION ALL.
-- ============================================================================

INSERT INTO public.os_fotos_snapshot_pr1 (
  snapshot_run_id, oficina_id, os_id, origem, posicao_array,
  valor_original, path_normalizado,
  tipo_valor, tipo_path, objeto_existe, status_sugerido
)
WITH run AS (SELECT gen_random_uuid() AS rid),
refs AS (
  SELECT
    o.oficina_id,
    o.id AS os_id,
    'fotos_entrada'::text AS origem,
    ord  AS posicao_array,
    val  AS valor_original
  FROM public.ordens_servico o
  CROSS JOIN LATERAL unnest(o.fotos_entrada) WITH ORDINALITY AS u(val, ord)
  WHERE o.fotos_entrada IS NOT NULL AND array_length(o.fotos_entrada,1) > 0

  UNION ALL

  SELECT
    o.oficina_id,
    o.id,
    'fotos_saida'::text,
    ord,
    val
  FROM public.ordens_servico o
  CROSS JOIN LATERAL unnest(o.fotos_saida) WITH ORDINALITY AS u(val, ord)
  WHERE o.fotos_saida IS NOT NULL AND array_length(o.fotos_saida,1) > 0
),
norm AS (
  SELECT
    r.*,
    CASE
      WHEN r.valor_original IS NULL OR btrim(r.valor_original) = '' THEN 'vazio'
      WHEN r.valor_original LIKE '%/storage/v1/object/public/os-fotos/%' THEN 'url_publica_os_fotos'
      WHEN r.valor_original LIKE '%/storage/v1/object/public/%'         THEN 'url_publica_outro_bucket'
      WHEN r.valor_original ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/' THEN 'path_relativo_os'
      WHEN r.valor_original LIKE 'temp/%' THEN 'path_relativo_temp'
      ELSE 'desconhecido'
    END AS tipo_valor,
    CASE
      WHEN r.valor_original LIKE '%/storage/v1/object/public/os-fotos/%'
        THEN regexp_replace(r.valor_original, '^.*/storage/v1/object/public/os-fotos/', '')
      WHEN r.valor_original ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
        OR r.valor_original LIKE 'temp/%'
        THEN r.valor_original
      ELSE NULL
    END AS path_normalizado
  FROM refs r
),
classified AS (
  SELECT
    n.*,
    CASE
      WHEN n.path_normalizado LIKE 'temp/%' THEN 'temp'
      WHEN n.path_normalizado ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/' THEN 'os_id'
      WHEN n.path_normalizado IS NULL THEN 'n/a'
      ELSE 'outro'
    END AS tipo_path,
    (so.name IS NOT NULL) AS objeto_existe
  FROM norm n
  LEFT JOIN storage.objects so
    ON so.bucket_id = 'os-fotos' AND so.name = n.path_normalizado
)
SELECT
  (SELECT rid FROM run),
  c.oficina_id, c.os_id, c.origem, c.posicao_array,
  c.valor_original, c.path_normalizado,
  c.tipo_valor, c.tipo_path, c.objeto_existe,
  CASE
    WHEN c.tipo_valor IN ('vazio','desconhecido','url_publica_outro_bucket') THEN 'invalid_reference'
    WHEN c.tipo_path = 'temp' AND c.objeto_existe THEN 'requires_promotion'
    WHEN c.tipo_valor = 'url_publica_os_fotos' AND c.tipo_path = 'os_id' AND c.objeto_existe THEN 'candidate_normalization'
    WHEN c.tipo_valor = 'path_relativo_os' AND c.objeto_existe THEN 'ok'
    WHEN NOT c.objeto_existe AND c.tipo_valor IN ('url_publica_os_fotos','path_relativo_os','path_relativo_temp') THEN 'orphan_reference'
    ELSE 'invalid_reference'
  END
FROM classified c;
