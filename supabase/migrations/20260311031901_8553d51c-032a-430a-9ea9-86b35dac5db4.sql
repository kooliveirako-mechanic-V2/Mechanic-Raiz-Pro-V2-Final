
-- ═══════════════════════════════════════════════════════════════
-- P0 #1: Convert ALL RLS policies from RESTRICTIVE to PERMISSIVE
-- ═══════════════════════════════════════════════════════════════

-- Helper: Drop all existing policies on all public tables and recreate as PERMISSIVE
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname, tablename 
    FROM pg_policies 
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ═══════ OFICINAS ═══════
CREATE POLICY "oficinas_insert_own" ON public.oficinas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "oficinas_select_own" ON public.oficinas FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "oficinas_select_team" ON public.oficinas FOR SELECT TO authenticated USING (has_oficina_access(auth.uid(), id));
CREATE POLICY "oficinas_update_own" ON public.oficinas FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "oficinas_delete_own" ON public.oficinas FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ═══════ CLIENTES ═══════
CREATE POLICY "clientes_select" ON public.clientes FOR SELECT TO authenticated USING (has_oficina_access(auth.uid(), oficina_id));
CREATE POLICY "clientes_insert" ON public.clientes FOR INSERT TO authenticated WITH CHECK (has_oficina_access(auth.uid(), oficina_id));
CREATE POLICY "clientes_update" ON public.clientes FOR UPDATE TO authenticated USING (has_oficina_access(auth.uid(), oficina_id));
CREATE POLICY "clientes_delete" ON public.clientes FOR DELETE TO authenticated USING (has_oficina_access(auth.uid(), oficina_id));

-- ═══════ VEICULOS ═══════
CREATE POLICY "veiculos_select" ON public.veiculos FOR SELECT TO authenticated USING (has_oficina_access(auth.uid(), oficina_id));
CREATE POLICY "veiculos_insert" ON public.veiculos FOR INSERT TO authenticated WITH CHECK (has_oficina_access(auth.uid(), oficina_id));
CREATE POLICY "veiculos_update" ON public.veiculos FOR UPDATE TO authenticated USING (has_oficina_access(auth.uid(), oficina_id));
CREATE POLICY "veiculos_delete" ON public.veiculos FOR DELETE TO authenticated USING (has_oficina_access(auth.uid(), oficina_id));

-- ═══════ ORDENS_SERVICO ═══════
CREATE POLICY "os_select" ON public.ordens_servico FOR SELECT TO authenticated USING (has_oficina_access(auth.uid(), oficina_id));
CREATE POLICY "os_insert" ON public.ordens_servico FOR INSERT TO authenticated WITH CHECK (has_oficina_access(auth.uid(), oficina_id));
CREATE POLICY "os_update" ON public.ordens_servico FOR UPDATE TO authenticated USING (has_oficina_access(auth.uid(), oficina_id));
CREATE POLICY "os_delete" ON public.ordens_servico FOR DELETE TO authenticated USING (is_oficina_owner(auth.uid(), oficina_id));

-- ═══════ ESTOQUE ═══════
CREATE POLICY "estoque_select" ON public.estoque FOR SELECT TO authenticated USING (has_oficina_access(auth.uid(), oficina_id));
CREATE POLICY "estoque_insert" ON public.estoque FOR INSERT TO authenticated WITH CHECK (has_oficina_access(auth.uid(), oficina_id));
CREATE POLICY "estoque_update" ON public.estoque FOR UPDATE TO authenticated USING (can_access_financial_data(oficina_id, auth.uid()));
CREATE POLICY "estoque_delete" ON public.estoque FOR DELETE TO authenticated USING (is_oficina_owner(auth.uid(), oficina_id));

-- ═══════ FINANCEIRO ═══════
CREATE POLICY "financeiro_select" ON public.financeiro FOR SELECT TO authenticated USING (can_access_financial_data(oficina_id, auth.uid()));
CREATE POLICY "financeiro_insert" ON public.financeiro FOR INSERT TO authenticated WITH CHECK (can_access_financial_data(oficina_id, auth.uid()));
CREATE POLICY "financeiro_update" ON public.financeiro FOR UPDATE TO authenticated USING (can_access_financial_data(oficina_id, auth.uid()));
CREATE POLICY "financeiro_delete" ON public.financeiro FOR DELETE TO authenticated USING (is_oficina_owner(auth.uid(), oficina_id));

-- ═══════ ITENS_OS ═══════
CREATE POLICY "itens_os_select" ON public.itens_os FOR SELECT TO authenticated USING (ordem_servico_id IN (SELECT id FROM ordens_servico WHERE has_oficina_access(auth.uid(), oficina_id)));
CREATE POLICY "itens_os_insert" ON public.itens_os FOR INSERT TO authenticated WITH CHECK (ordem_servico_id IN (SELECT id FROM ordens_servico WHERE has_oficina_access(auth.uid(), oficina_id)));
CREATE POLICY "itens_os_update" ON public.itens_os FOR UPDATE TO authenticated USING (ordem_servico_id IN (SELECT id FROM ordens_servico WHERE has_oficina_access(auth.uid(), oficina_id)));
CREATE POLICY "itens_os_delete" ON public.itens_os FOR DELETE TO authenticated USING (ordem_servico_id IN (SELECT id FROM ordens_servico WHERE has_oficina_access(auth.uid(), oficina_id)));

-- ═══════ ITENS_ORCAMENTO ═══════
CREATE POLICY "itens_orcamento_select" ON public.itens_orcamento FOR SELECT TO authenticated USING (orcamento_id IN (SELECT id FROM orcamentos WHERE has_oficina_access(auth.uid(), oficina_id)));
CREATE POLICY "itens_orcamento_insert" ON public.itens_orcamento FOR INSERT TO authenticated WITH CHECK (orcamento_id IN (SELECT id FROM orcamentos WHERE has_oficina_access(auth.uid(), oficina_id)));
CREATE POLICY "itens_orcamento_update" ON public.itens_orcamento FOR UPDATE TO authenticated USING (orcamento_id IN (SELECT id FROM orcamentos WHERE has_oficina_access(auth.uid(), oficina_id)));
CREATE POLICY "itens_orcamento_delete" ON public.itens_orcamento FOR DELETE TO authenticated USING (orcamento_id IN (SELECT id FROM orcamentos WHERE has_oficina_access(auth.uid(), oficina_id)));

-- ═══════ ORCAMENTOS ═══════
CREATE POLICY "orcamentos_select" ON public.orcamentos FOR SELECT TO authenticated USING (has_oficina_access(auth.uid(), oficina_id));
CREATE POLICY "orcamentos_insert" ON public.orcamentos FOR INSERT TO authenticated WITH CHECK (has_oficina_access(auth.uid(), oficina_id));
CREATE POLICY "orcamentos_update" ON public.orcamentos FOR UPDATE TO authenticated USING (has_oficina_access(auth.uid(), oficina_id));
CREATE POLICY "orcamentos_delete" ON public.orcamentos FOR DELETE TO authenticated USING (is_oficina_owner(auth.uid(), oficina_id));

-- ═══════ NOTIFICACOES ═══════
CREATE POLICY "notificacoes_select" ON public.notificacoes FOR SELECT TO authenticated USING (has_oficina_access(auth.uid(), oficina_id));
CREATE POLICY "notificacoes_insert" ON public.notificacoes FOR INSERT TO authenticated WITH CHECK (is_oficina_owner(auth.uid(), oficina_id) OR has_role(auth.uid(), oficina_id, 'administrador'::app_role));
CREATE POLICY "notificacoes_update" ON public.notificacoes FOR UPDATE TO authenticated USING (has_oficina_access(auth.uid(), oficina_id));
CREATE POLICY "notificacoes_delete" ON public.notificacoes FOR DELETE TO authenticated USING (is_oficina_owner(auth.uid(), oficina_id));

-- ═══════ PARCELAS_PAGAMENTO ═══════
CREATE POLICY "parcelas_select" ON public.parcelas_pagamento FOR SELECT TO authenticated USING (has_oficina_access(auth.uid(), oficina_id));
CREATE POLICY "parcelas_insert" ON public.parcelas_pagamento FOR INSERT TO authenticated WITH CHECK (has_oficina_access(auth.uid(), oficina_id));
CREATE POLICY "parcelas_update" ON public.parcelas_pagamento FOR UPDATE TO authenticated USING (can_access_financial_data(oficina_id, auth.uid()));
CREATE POLICY "parcelas_delete" ON public.parcelas_pagamento FOR DELETE TO authenticated USING (is_oficina_owner(auth.uid(), oficina_id));

-- ═══════ RECORRENCIAS ═══════
CREATE POLICY "recorrencias_select" ON public.recorrencias FOR SELECT TO authenticated USING (has_oficina_access(auth.uid(), oficina_id));
CREATE POLICY "recorrencias_insert" ON public.recorrencias FOR INSERT TO authenticated WITH CHECK (has_oficina_access(auth.uid(), oficina_id));
CREATE POLICY "recorrencias_update" ON public.recorrencias FOR UPDATE TO authenticated USING (can_access_sensitive_data(auth.uid(), oficina_id));
CREATE POLICY "recorrencias_delete" ON public.recorrencias FOR DELETE TO authenticated USING (is_oficina_owner(auth.uid(), oficina_id));

-- ═══════ CATEGORIAS_FINANCEIRAS ═══════
CREATE POLICY "catfin_select" ON public.categorias_financeiras FOR SELECT TO authenticated USING (has_oficina_access(auth.uid(), oficina_id));
CREATE POLICY "catfin_manage" ON public.categorias_financeiras FOR ALL TO authenticated USING (is_oficina_owner(auth.uid(), oficina_id) OR has_role(auth.uid(), oficina_id, 'administrador'::app_role));

-- ═══════ CENTROS_CUSTO ═══════
CREATE POLICY "cc_select" ON public.centros_custo FOR SELECT TO authenticated USING (has_oficina_access(auth.uid(), oficina_id));
CREATE POLICY "cc_manage" ON public.centros_custo FOR ALL TO authenticated USING (is_oficina_owner(auth.uid(), oficina_id) OR has_role(auth.uid(), oficina_id, 'administrador'::app_role));

-- ═══════ FORMAS_PAGAMENTO ═══════
CREATE POLICY "fp_select" ON public.formas_pagamento FOR SELECT TO authenticated USING (has_oficina_access(auth.uid(), oficina_id));
CREATE POLICY "fp_manage" ON public.formas_pagamento FOR ALL TO authenticated USING (is_oficina_owner(auth.uid(), oficina_id) OR has_role(auth.uid(), oficina_id, 'administrador'::app_role));

-- ═══════ FORNECEDORES ═══════
CREATE POLICY "fornecedores_select" ON public.fornecedores FOR SELECT TO authenticated USING (has_oficina_access(auth.uid(), oficina_id));
CREATE POLICY "fornecedores_manage" ON public.fornecedores FOR ALL TO authenticated USING (has_oficina_access(auth.uid(), oficina_id));

-- ═══════ OFICINA_CONFIGURACOES ═══════
CREATE POLICY "config_select" ON public.oficina_configuracoes FOR SELECT TO authenticated USING (has_oficina_access(auth.uid(), oficina_id));
CREATE POLICY "config_insert" ON public.oficina_configuracoes FOR INSERT TO authenticated WITH CHECK (is_oficina_owner(auth.uid(), oficina_id));
CREATE POLICY "config_update" ON public.oficina_configuracoes FOR UPDATE TO authenticated USING (is_oficina_owner(auth.uid(), oficina_id));

-- ═══════ PROFILES ═══════
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "profiles_select_team" ON public.profiles FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM oficinas o JOIN user_roles ur ON ur.oficina_id = o.id WHERE o.user_id = auth.uid() AND ur.user_id = profiles.user_id AND ur.active = true));
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- ═══════ USER_ROLES ═══════
CREATE POLICY "ur_select_own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "ur_select_owner" ON public.user_roles FOR SELECT TO authenticated USING (is_oficina_owner(auth.uid(), oficina_id));
CREATE POLICY "ur_insert" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (is_oficina_owner(auth.uid(), oficina_id));
CREATE POLICY "ur_update" ON public.user_roles FOR UPDATE TO authenticated USING (is_oficina_owner(auth.uid(), oficina_id));
CREATE POLICY "ur_delete" ON public.user_roles FOR DELETE TO authenticated USING (is_oficina_owner(auth.uid(), oficina_id));

-- ═══════ SUBSCRIPTIONS ═══════
CREATE POLICY "sub_select" ON public.subscriptions FOR SELECT TO authenticated USING (has_oficina_access(auth.uid(), oficina_id));
CREATE POLICY "sub_manage" ON public.subscriptions FOR ALL TO authenticated USING (is_oficina_owner(auth.uid(), oficina_id));

-- ═══════ PAGAMENTOS ═══════
CREATE POLICY "pag_select" ON public.pagamentos FOR SELECT TO authenticated USING (oficina_id IS NOT NULL AND is_oficina_owner(auth.uid(), oficina_id));
CREATE POLICY "pag_insert" ON public.pagamentos FOR INSERT TO authenticated WITH CHECK (oficina_id IS NULL OR is_oficina_owner(auth.uid(), oficina_id));
CREATE POLICY "pag_update" ON public.pagamentos FOR UPDATE TO authenticated USING (oficina_id IS NOT NULL AND is_oficina_owner(auth.uid(), oficina_id));
CREATE POLICY "pag_delete" ON public.pagamentos FOR DELETE TO authenticated USING (oficina_id IS NOT NULL AND is_oficina_owner(auth.uid(), oficina_id));

-- ═══════ AUDIT_LOGS ═══════
CREATE POLICY "audit_select" ON public.audit_logs FOR SELECT TO authenticated USING (is_oficina_owner(auth.uid(), oficina_id));
CREATE POLICY "audit_insert" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- ═══════ LEAD_FOLLOWUPS ═══════
CREATE POLICY "leads_select" ON public.lead_followups FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "leads_insert" ON public.lead_followups FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ═══════ ENGAGEMENT_EMAILS ═══════
CREATE POLICY "engagement_deny_all" ON public.engagement_emails FOR ALL TO authenticated USING (false);

-- ═══════ FINANCEIRO_HISTORICO ═══════
CREATE POLICY "finhist_select" ON public.financeiro_historico FOR SELECT TO authenticated USING (is_oficina_owner(auth.uid(), oficina_id));
CREATE POLICY "finhist_insert" ON public.financeiro_historico FOR INSERT TO authenticated WITH CHECK (can_access_financial_data(oficina_id, auth.uid()));

-- ═══════ PLAN_FEATURES ═══════
CREATE POLICY "planfeat_select" ON public.plan_features FOR SELECT TO authenticated USING (true);

-- ═══════ IDEMPOTENCY_KEYS ═══════
CREATE POLICY "idem_select" ON public.idempotency_keys FOR SELECT TO authenticated USING (has_oficina_access(auth.uid(), oficina_id));
CREATE POLICY "idem_insert" ON public.idempotency_keys FOR INSERT TO authenticated WITH CHECK (has_oficina_access(auth.uid(), oficina_id));
CREATE POLICY "idem_delete" ON public.idempotency_keys FOR DELETE TO authenticated USING (has_oficina_access(auth.uid(), oficina_id));

-- ═══════ ESTOQUE_MOVIMENTACOES ═══════
CREATE POLICY "estmov_select" ON public.estoque_movimentacoes FOR SELECT TO authenticated USING (has_oficina_access(auth.uid(), oficina_id));
CREATE POLICY "estmov_insert" ON public.estoque_movimentacoes FOR INSERT TO authenticated WITH CHECK (has_oficina_access(auth.uid(), oficina_id));
