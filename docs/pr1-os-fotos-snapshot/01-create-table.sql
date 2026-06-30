-- ============================================================================
-- PR 1 — Entregável 1/7: CREATE TABLE de snapshot
-- ============================================================================
-- Objetivo: criar tabela imutável de inventário do bucket os-fotos referenciado
--           por ordens_servico (fotos_entrada + fotos_saida) ANTES de qualquer
--           normalização, promoção ou privatização (PR 2 e PR 3).
--
-- Escopo PR 1 (estrito): apenas cria a tabela de snapshot abaixo.
-- Declaracoes negativas (o que o PR 1 nao faz) estao em
-- docs/pr1-os-fotos-snapshot/00-escopo.md para nao poluir o diff SQL.
--
-- Correções aplicadas após revisão (round 2):
--   (1) valor_original agora é NULL (auditoria precisa registrar referência
--       inválida/nula sem o INSERT quebrar).
--   (2) CREATE TABLE explícito (sem IF NOT EXISTS) — em migration auditada,
--       falha explícita é mais segura que silêncio sobre schema divergente.
--   (3) oficina_id NOT NULL — sistema é multi-tenant; snapshot deve preservar
--       o tenant no momento da captura, sem depender de join futuro com
--       ordens_servico (que pode mudar de estado entre PR 1 e PR 2/PR 3).
-- ============================================================================

CREATE TABLE public.os_fotos_snapshot_pr1 (
  id                BIGSERIAL PRIMARY KEY,
  snapshot_run_id   UUID        NOT NULL,
  capturado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),

  oficina_id        UUID        NOT NULL,
  os_id             UUID        NOT NULL,
  origem            TEXT        NOT NULL CHECK (origem IN ('fotos_entrada','fotos_saida')),
  posicao_array     INTEGER     NOT NULL,

  valor_original    TEXT        NULL,
  path_normalizado  TEXT        NULL,

  tipo_valor        TEXT        NOT NULL CHECK (tipo_valor IN (
                       'vazio','url_publica_os_fotos','url_publica_outro_bucket',
                       'path_relativo_os','path_relativo_temp','desconhecido'
                    )),
  tipo_path         TEXT        NOT NULL CHECK (tipo_path IN ('temp','os_id','outro','n/a')),
  objeto_existe     BOOLEAN     NOT NULL,

  status_sugerido   TEXT        NOT NULL CHECK (status_sugerido IN (
                       'requires_promotion','candidate_normalization',
                       'ok','orphan_reference','invalid_reference'
                    ))
);

-- Tabela é READ-ONLY do ponto de vista de app: somente service_role pode ler/escrever.
-- Não há GRANT para anon nem authenticated — snapshot é instrumento de auditoria
-- interna, não dado de aplicação.
GRANT ALL ON public.os_fotos_snapshot_pr1     TO service_role;
GRANT ALL ON SEQUENCE public.os_fotos_snapshot_pr1_id_seq TO service_role;

ALTER TABLE public.os_fotos_snapshot_pr1 ENABLE ROW LEVEL SECURITY;

-- Sem policies para authenticated/anon. Sem acesso via PostgREST.
-- Auditoria roda via psql/service_role.

CREATE INDEX ix_os_fotos_snapshot_pr1_run     ON public.os_fotos_snapshot_pr1(snapshot_run_id);
CREATE INDEX ix_os_fotos_snapshot_pr1_status  ON public.os_fotos_snapshot_pr1(status_sugerido);
CREATE INDEX ix_os_fotos_snapshot_pr1_os      ON public.os_fotos_snapshot_pr1(os_id);
CREATE INDEX ix_os_fotos_snapshot_pr1_oficina ON public.os_fotos_snapshot_pr1(oficina_id);

COMMENT ON TABLE public.os_fotos_snapshot_pr1 IS
  'PR 1 — Snapshot imutável de referências a fotos em ordens_servico (fotos_entrada + fotos_saida) antes do PR 2 (normalização/promoção) e PR 3 (privatização do bucket).';
