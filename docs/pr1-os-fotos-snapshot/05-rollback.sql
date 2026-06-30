-- ============================================================================
-- PR 1 — Entregável 5/7: Rollback
-- ============================================================================
-- Como o PR 1 só cria uma tabela nova de snapshot, o rollback é total e
-- não destrutivo para o resto do sistema:
--   - Não há UPDATE a desfazer em ordens_servico.
--   - Não há move/delete a desfazer em storage.objects.
--   - Não há bucket a reverter.
--   - Não há policy a reverter.
-- ============================================================================

DROP TABLE IF EXISTS public.os_fotos_snapshot_pr1;

-- Verificação pós-rollback (deve retornar 0):
-- SELECT count(*) FROM pg_tables
--  WHERE schemaname = 'public' AND tablename = 'os_fotos_snapshot_pr1';
