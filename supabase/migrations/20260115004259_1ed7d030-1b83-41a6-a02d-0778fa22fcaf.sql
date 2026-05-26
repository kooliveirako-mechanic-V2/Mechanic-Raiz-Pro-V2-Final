-- =====================================================
-- CORREÇÃO DE SEGURANÇA: Melhorar políticas RLS
-- =====================================================

-- 1. Atualizar políticas da tabela 'clientes' para usar funções security definer
-- (mais seguro que subqueries diretas)

DROP POLICY IF EXISTS "Usuários podem ver clientes de suas oficinas" ON public.clientes;
DROP POLICY IF EXISTS "Usuários podem criar clientes em suas oficinas" ON public.clientes;
DROP POLICY IF EXISTS "Usuários podem atualizar clientes de suas oficinas" ON public.clientes;
DROP POLICY IF EXISTS "Usuários podem deletar clientes de suas oficinas" ON public.clientes;

CREATE POLICY "Usuários podem ver clientes de suas oficinas"
  ON public.clientes FOR SELECT
  USING (public.has_oficina_access(auth.uid(), oficina_id));

CREATE POLICY "Usuários podem criar clientes em suas oficinas"
  ON public.clientes FOR INSERT
  WITH CHECK (public.has_oficina_access(auth.uid(), oficina_id));

CREATE POLICY "Usuários podem atualizar clientes de suas oficinas"
  ON public.clientes FOR UPDATE
  USING (public.has_oficina_access(auth.uid(), oficina_id));

CREATE POLICY "Usuários podem deletar clientes de suas oficinas"
  ON public.clientes FOR DELETE
  USING (public.has_oficina_access(auth.uid(), oficina_id));

-- 2. Restringir políticas da tabela 'notificacoes'
-- Apenas proprietários podem criar/deletar notificações, todos podem marcar como lida

DROP POLICY IF EXISTS "Usuários podem ver notificações de suas oficinas" ON public.notificacoes;
DROP POLICY IF EXISTS "Usuários podem criar notificações em suas oficinas" ON public.notificacoes;
DROP POLICY IF EXISTS "Usuários podem atualizar notificações de suas oficinas" ON public.notificacoes;
DROP POLICY IF EXISTS "Usuários podem deletar notificações de suas oficinas" ON public.notificacoes;

-- Todos com acesso à oficina podem ver notificações
CREATE POLICY "Usuários podem ver notificações de suas oficinas"
  ON public.notificacoes FOR SELECT
  USING (public.has_oficina_access(auth.uid(), oficina_id));

-- Apenas proprietários/admins podem criar notificações
CREATE POLICY "Proprietários podem criar notificações"
  ON public.notificacoes FOR INSERT
  WITH CHECK (
    public.is_oficina_owner(auth.uid(), oficina_id) 
    OR public.has_role(auth.uid(), oficina_id, 'administrador'::app_role)
  );

-- Usuários podem apenas marcar como lida (UPDATE restrito)
CREATE POLICY "Usuários podem marcar notificações como lidas"
  ON public.notificacoes FOR UPDATE
  USING (public.has_oficina_access(auth.uid(), oficina_id));

-- Apenas proprietários podem deletar notificações
CREATE POLICY "Proprietários podem deletar notificações"
  ON public.notificacoes FOR DELETE
  USING (public.is_oficina_owner(auth.uid(), oficina_id));

-- 3. Atualizar outras tabelas críticas para usar funções security definer

-- Ordens de serviço
DROP POLICY IF EXISTS "Usuários podem ver OS de suas oficinas" ON public.ordens_servico;
DROP POLICY IF EXISTS "Usuários podem criar OS em suas oficinas" ON public.ordens_servico;
DROP POLICY IF EXISTS "Usuários podem atualizar OS de suas oficinas" ON public.ordens_servico;
DROP POLICY IF EXISTS "Usuários podem deletar OS de suas oficinas" ON public.ordens_servico;

CREATE POLICY "Usuários podem ver OS de suas oficinas"
  ON public.ordens_servico FOR SELECT
  USING (public.has_oficina_access(auth.uid(), oficina_id));

CREATE POLICY "Usuários podem criar OS em suas oficinas"
  ON public.ordens_servico FOR INSERT
  WITH CHECK (public.has_oficina_access(auth.uid(), oficina_id));

CREATE POLICY "Usuários podem atualizar OS de suas oficinas"
  ON public.ordens_servico FOR UPDATE
  USING (public.has_oficina_access(auth.uid(), oficina_id));

CREATE POLICY "Proprietários podem deletar OS"
  ON public.ordens_servico FOR DELETE
  USING (public.is_oficina_owner(auth.uid(), oficina_id));

-- Financeiro (dados sensíveis - apenas proprietários)
DROP POLICY IF EXISTS "Usuários podem ver financeiro de suas oficinas" ON public.financeiro;
DROP POLICY IF EXISTS "Usuários podem criar registros financeiros em suas oficinas" ON public.financeiro;
DROP POLICY IF EXISTS "Usuários podem atualizar financeiro de suas oficinas" ON public.financeiro;
DROP POLICY IF EXISTS "Usuários podem deletar registros financeiros de suas oficinas" ON public.financeiro;

CREATE POLICY "Proprietários e admins podem ver financeiro"
  ON public.financeiro FOR SELECT
  USING (
    public.is_oficina_owner(auth.uid(), oficina_id) 
    OR public.has_role(auth.uid(), oficina_id, 'administrador'::app_role)
  );

CREATE POLICY "Proprietários e admins podem criar registros financeiros"
  ON public.financeiro FOR INSERT
  WITH CHECK (
    public.is_oficina_owner(auth.uid(), oficina_id) 
    OR public.has_role(auth.uid(), oficina_id, 'administrador'::app_role)
  );

CREATE POLICY "Proprietários e admins podem atualizar financeiro"
  ON public.financeiro FOR UPDATE
  USING (
    public.is_oficina_owner(auth.uid(), oficina_id) 
    OR public.has_role(auth.uid(), oficina_id, 'administrador'::app_role)
  );

CREATE POLICY "Proprietários podem deletar registros financeiros"
  ON public.financeiro FOR DELETE
  USING (public.is_oficina_owner(auth.uid(), oficina_id));