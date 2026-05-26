-- Backfill data_conclusao for finalized OS that are missing it
UPDATE public.ordens_servico
SET data_conclusao = updated_at::date
WHERE status = 'finalizado'
  AND data_conclusao IS NULL;