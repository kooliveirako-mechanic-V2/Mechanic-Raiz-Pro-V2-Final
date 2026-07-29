-- Correção 3c — data_competencia passa a ser NOT NULL.
--
-- PRÉ-REQUISITOS VERIFICADOS (2026-07-29, banco NOVO kurlgmngmglhvknwxjee):
--   3a) trigger trg_financeiro_competencia_default instalado e provado
--       (INSERT sem data_competencia nasce preenchido)
--   3b) backfill concluído: 339 nulas -> 0, 488/488 preenchidas
--       muda_de_mes = 19 / R$ 18.833,15 (bateu com o dry-run)
--       invariante OK: soma total permaneceu R$ 532.227,01 em 488 linhas
--   9 provas anti-regressão repassaram após o backfill:
--       valor_servico 410/410 · desconto 14/14 · lucro 14/14
--       sinal 0 divergentes · parcelas 0 divergentes
--       aritmética RPC em período sujo 8/8
--
-- SEM DEFAULT — DELIBERADO. O plano original pedia "NOT NULL com default", mas
-- em Postgres o DEFAULT é aplicado ao montar a tupla, ANTES do BEFORE trigger.
-- Com um DEFAULT (ex. CURRENT_DATE), NEW.data_competencia nunca chegaria NULL
-- ao trigger, o COALESCE nunca dispararia, e um lançamento retroativo
-- (data = '2026-01-15') gravaria competência de HOJE. O DEFAULT sabotaria a
-- correção. O trigger 3a é a única fonte de preenchimento.
--
-- LOCK: SET NOT NULL toma ACCESS EXCLUSIVE e faz varredura completa. Com 488
-- linhas é instantâneo. Reavaliar se a tabela crescer para centenas de milhares.
--
-- ROLLBACK: scripts/migration/rollback_financeiro_competencia_not_null_20260729.sql

ALTER TABLE public.financeiro
  ALTER COLUMN data_competencia SET NOT NULL;

COMMENT ON COLUMN public.financeiro.data_competencia IS
  'Regime de competência: data do fato gerador. Preenchida pelo trigger trg_financeiro_competencia_default quando omitida (COALESCE com data). NOT NULL desde 2026-07-29 — não adicionar DEFAULT, isso desativaria o trigger.';
