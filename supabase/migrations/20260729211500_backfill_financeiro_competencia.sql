-- Correção 3b — backfill de financeiro.data_competencia (REGISTRO do que foi aplicado).
--
-- Aplicado em 2026-07-29 no banco NOVO (kurlgmngmglhvknwxjee) via query direta.
-- Este arquivo é registro versionado — `supabase db push` está inutilizável neste
-- repo (drift de ~250 versões no histórico remoto). Reaplique manualmente em
-- restore/remix. Idempotente: o WHERE só alcança linhas nulas, então rodar de
-- novo é no-op.
--
-- PRÉ-REQUISITO: 20260729210000_trg_financeiro_competencia_default.sql (3a).
-- SUCESSOR:      20260729213000_financeiro_competencia_not_null.sql (3c).
--
-- REGRA DE PREENCHIMENTO (validada em dry-run antes de aplicar):
--   1) lançamento de OS    -> COALESCE(os.data_conclusao, os.data_servico)
--   2) lançamento de venda -> vendas_balcao.created_at::date
--   3) manual              -> f.data (a própria data do lançamento)
--
-- ESTADO ANTES: 339 de 488 linhas nulas (69,5%), R$ 232.188,64
--   231 com OS · 108 sem OS · dry-run: 339/339 resolvíveis, 0 sem solução
--
-- RESULTADO MEDIDO DEPOIS:
--   nulas 339 -> 0 · preenchidas 488/488
--   muda_de_mes = 19 linhas / R$ 18.833,15  (bateu EXATAMENTE com o dry-run)
--   invariante OK: soma total permaneceu R$ 532.227,01 em 488 linhas
--     (backfill move data, nunca valor)
--
-- PROVAS ANTI-REGRESSÃO REPASSADAS APÓS O BACKFILL:
--   valor_servico 410/410 · desconto bruto 14/14 · lucro 14/14
--   sinal 0 divergentes · parcelas 0 divergentes
--   aritmética RPC em período sujo (jun+mai × 4 oficinas) 8/8
--
-- NOTA: os 19 lançamentos que mudam de mês alteram números históricos que o
-- cliente já viu no pré-fiscal. Não é regressão — é a competência aparecendo.
-- Decisão registrada: sem comunicação retroativa (o valor que o cliente final
-- pagou não muda; só o mês de competência no relatório interno).
--
-- ROLLBACK: restaurar do snapshot public.backup_financeiro_competencia_20260729
--   (guarda id, data e data_competencia original — NULL nas 339):
--     UPDATE public.financeiro f SET data_competencia = b.data_competencia
--       FROM public.backup_financeiro_competencia_20260729 b WHERE b.id = f.id;
--   Requer soltar o NOT NULL antes (ver rollback do 3c).
--   O snapshot foi verificado fechado: RLS ligada, sem grant para authenticated/anon.

UPDATE public.financeiro f
   SET data_competencia = COALESCE(
         (SELECT COALESCE(os.data_conclusao, os.data_servico)
            FROM public.ordens_servico os
           WHERE os.id = f.ordem_servico_id),
         (SELECT v.created_at::date
            FROM public.vendas_balcao v
           WHERE v.id = f.venda_balcao_id),
         f.data
       )
 WHERE f.data_competencia IS NULL;
