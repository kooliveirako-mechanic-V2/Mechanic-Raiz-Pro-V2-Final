-- ROLLBACK da Correção 3a — remove o trigger de default de data_competencia.
--
-- Reverte 20260729210000_trg_financeiro_competencia_default.sql
--
-- SEGURO: remover o trigger não altera nenhum dado já gravado. Lançamentos
-- que nasceram com data_competencia preenchida pelo trigger permanecem
-- preenchidos. O efeito é apenas voltar a permitir INSERT com competência nula.
--
-- ATENÇÃO: se o passo 3c (NOT NULL) já tiver sido aplicado, remover este
-- trigger NÃO quebra INSERT — o NOT NULL passa a rejeitar diretamente, com
-- erro de constraint em vez de default silencioso. Para reverter tudo,
-- remova o NOT NULL primeiro:
--   ALTER TABLE public.financeiro ALTER COLUMN data_competencia DROP NOT NULL;

DROP TRIGGER IF EXISTS trg_financeiro_competencia_default ON public.financeiro;
DROP FUNCTION IF EXISTS public.tg_financeiro_competencia_default();
