-- Correção 3a — fecha o vazamento de data_competencia nula.
--
-- PROBLEMA MEDIDO (2026-07-29, banco NOVO kurlgmngmglhvknwxjee):
--   339 de 488 lançamentos (69,5%, R$ 232.188,64) com data_competencia NULA.
--   O vazamento AINDA ESTÁ ATIVO: src/components/forms/FinanceiroFormModal.tsx:132
--   faz insert({ tipo, valor, data, ... }) sem data_competencia, então toda
--   despesa/receita manual lançada hoje nasce nula.
--
--   Distribuição por mês de criação confirma que parte do write layer já foi
--   corrigida (upsert_financeiro_os), mas o caminho manual segue furado:
--     2025-11:   5 linhas,  0 com competência
--     2026-03: 105 linhas,  5 com competência
--     2026-06: 119 linhas, 79 com competência
--     2026-07:  37 linhas, 29 com competência
--
-- POR QUE TRIGGER E NÃO SÓ PATCH NO FRONTEND:
--   Existem >= 3 caminhos de escrita (modal manual, upsert_financeiro_os,
--   edge idempotency-guard) e não há garantia de que todos foram mapeados.
--   O trigger é a rede para writers presentes e futuros; o patch no frontend
--   (mesmo release) é o que faz o dado nascer certo e aparece em code review.
--
-- ORDEM OBRIGATÓRIA: 3a (este) -> 3b (backfill das 339) -> 3c (NOT NULL).
--   Aplicar NOT NULL antes do backfill quebraria INSERT em produção.
--
-- COEXISTÊNCIA COM TRIGGERS EXISTENTES em public.financeiro:
--   audit_financeiro, trg_proteger_financeiro_finalizado,
--   trg_validate_financeiro_valores, registrar_historico_financeiro.
--   Este trigger só toca data_competencia; não conflita com nenhum deles.
--   Verificado empiricamente (transação com ROLLBACK) que
--   tg_proteger_financeiro_os_finalizada NÃO bloqueia UPDATE de
--   data_competencia em linha de OS finalizada — a guarda dele é sobre
--   valor/tipo. Portanto as 218 linhas nulas de OS finalizada são
--   backfilláveis no passo 3b.
--
-- ROLLBACK: scripts/migration/rollback_trg_financeiro_competencia_20260729.sql

CREATE OR REPLACE FUNCTION public.tg_financeiro_competencia_default()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- Competência default = data do lançamento. Não sobrescreve valor explícito.
  IF NEW.data_competencia IS NULL THEN
    NEW.data_competencia := NEW.data;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_financeiro_competencia_default ON public.financeiro;

CREATE TRIGGER trg_financeiro_competencia_default
  BEFORE INSERT OR UPDATE ON public.financeiro
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_financeiro_competencia_default();

COMMENT ON FUNCTION public.tg_financeiro_competencia_default() IS
  'Correção 3a: garante data_competencia não-nula em qualquer caminho de escrita. Pré-requisito do NOT NULL (3c).';
