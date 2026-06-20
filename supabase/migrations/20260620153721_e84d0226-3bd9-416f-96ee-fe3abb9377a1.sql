-- ============================================================
-- LIMPEZA: remover RPCs duplicadas/órfãs + índices compostos
-- ============================================================

-- 1) funnel_scoreboard: drop versão 2-arg, manter 3-arg (com p_oficina_tipo)
DROP FUNCTION IF EXISTS public.funnel_scoreboard(timestamp with time zone, timestamp with time zone);

-- 2) reabrir_os_atomica: drop versão simples 1-arg, manter 2-arg (que reverte estoque/financeiro + auditoria)
DROP FUNCTION IF EXISTS public.reabrir_os_atomica(uuid);

-- 3) rate_limit_os_insert: drop versão TRIGGER órfã (nenhum trigger a usa), manter 1-arg(uuid) chamada pelas RPCs
DROP FUNCTION IF EXISTS public.rate_limit_os_insert();

-- 4) Índices compostos faltantes em ordens_servico
CREATE INDEX IF NOT EXISTS idx_ordens_servico_oficina_status_data_servico
  ON public.ordens_servico (oficina_id, status, data_servico);

CREATE INDEX IF NOT EXISTS idx_ordens_servico_oficina_cliente
  ON public.ordens_servico (oficina_id, cliente_id);