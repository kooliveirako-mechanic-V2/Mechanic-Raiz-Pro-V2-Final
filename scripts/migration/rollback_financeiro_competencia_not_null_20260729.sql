-- ROLLBACK da Correção 3c — remove o NOT NULL de financeiro.data_competencia.
--
-- Reverte 20260729213000_financeiro_competencia_not_null.sql
--
-- SEGURO E INSTANTÂNEO: DROP NOT NULL não varre a tabela e não altera dado.
-- Apenas volta a permitir competência nula em INSERT/UPDATE.
--
-- ORDEM DE REVERSÃO COMPLETA da Correção 3 (se for desfazer tudo):
--   1) este arquivo                                    (solta o NOT NULL)
--   2) rollback_trg_financeiro_competencia_20260729.sql (remove o trigger 3a)
--   3) restaurar as 339 competências originais a partir do snapshot 3b:
--        UPDATE public.financeiro f
--           SET data_competencia = b.data_competencia
--          FROM public.backup_financeiro_competencia_20260729 b
--         WHERE b.id = f.id;
--      (o snapshot guarda id, data e data_competencia — que era NULL nas 339)
--
-- Reverter apenas o NOT NULL, mantendo o trigger, é a opção mais conservadora:
-- para de rejeitar INSERT por constraint mas segue preenchendo a competência.

ALTER TABLE public.financeiro
  ALTER COLUMN data_competencia DROP NOT NULL;
