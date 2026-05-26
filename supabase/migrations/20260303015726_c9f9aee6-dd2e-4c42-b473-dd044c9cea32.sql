
-- =============================================
-- P1-1: Corrigir RLS de itens_os para funcionários
-- As políticas atuais usam oficinas.user_id = auth.uid(), excluindo funcionários
-- =============================================

-- DROP das políticas antigas de itens_os
DROP POLICY IF EXISTS "Usuários podem ver itens de OS de suas oficinas" ON public.itens_os;
DROP POLICY IF EXISTS "Usuários podem criar itens de OS em suas oficinas" ON public.itens_os;
DROP POLICY IF EXISTS "Usuários podem atualizar itens de OS de suas oficinas" ON public.itens_os;
DROP POLICY IF EXISTS "Usuários podem deletar itens de OS de suas oficinas" ON public.itens_os;

-- Novas políticas usando has_oficina_access via ordens_servico
CREATE POLICY "Usuários podem ver itens de OS de suas oficinas"
ON public.itens_os FOR SELECT
USING (
  ordem_servico_id IN (
    SELECT id FROM ordens_servico WHERE has_oficina_access(auth.uid(), oficina_id)
  )
);

CREATE POLICY "Usuários podem criar itens de OS em suas oficinas"
ON public.itens_os FOR INSERT
WITH CHECK (
  ordem_servico_id IN (
    SELECT id FROM ordens_servico WHERE has_oficina_access(auth.uid(), oficina_id)
  )
);

CREATE POLICY "Usuários podem atualizar itens de OS de suas oficinas"
ON public.itens_os FOR UPDATE
USING (
  ordem_servico_id IN (
    SELECT id FROM ordens_servico WHERE has_oficina_access(auth.uid(), oficina_id)
  )
);

CREATE POLICY "Usuários podem deletar itens de OS de suas oficinas"
ON public.itens_os FOR DELETE
USING (
  ordem_servico_id IN (
    SELECT id FROM ordens_servico WHERE has_oficina_access(auth.uid(), oficina_id)
  )
);

-- =============================================
-- P1-2: Permitir funcionários verem seu próprio role
-- =============================================

CREATE POLICY "Funcionários podem ver seu próprio role"
ON public.user_roles FOR SELECT
USING (user_id = auth.uid());

-- =============================================
-- P2-1: Corrigir inconsistência DELETE de veículos
-- Trocar is_oficina_owner por has_oficina_access (alinhado com clientes)
-- =============================================

DROP POLICY IF EXISTS "Proprietários podem deletar veículos" ON public.veiculos;

CREATE POLICY "Usuários podem deletar veículos de suas oficinas"
ON public.veiculos FOR DELETE
USING (has_oficina_access(auth.uid(), oficina_id));

-- =============================================
-- P1-3: Índices de performance para queries frequentes
-- =============================================

-- Índice para financeiro por oficina + data (query mais frequente)
CREATE INDEX IF NOT EXISTS idx_financeiro_oficina_data ON public.financeiro (oficina_id, data DESC);

-- Índice para ordens_servico por oficina + status (kanban + dashboard)
CREATE INDEX IF NOT EXISTS idx_os_oficina_status ON public.ordens_servico (oficina_id, status);

-- Índice para ordens_servico por oficina + data (listagem)
CREATE INDEX IF NOT EXISTS idx_os_oficina_data ON public.ordens_servico (oficina_id, data_servico DESC);

-- Índice para estoque por oficina (listagem principal)
CREATE INDEX IF NOT EXISTS idx_estoque_oficina_nome ON public.estoque (oficina_id, nome);

-- Índice para parcelas por oficina + status (alertas)
CREATE INDEX IF NOT EXISTS idx_parcelas_oficina_status ON public.parcelas_pagamento (oficina_id, status);

-- Índice para notificações não lidas
CREATE INDEX IF NOT EXISTS idx_notificacoes_oficina_lida ON public.notificacoes (oficina_id, lida) WHERE lida = false;
