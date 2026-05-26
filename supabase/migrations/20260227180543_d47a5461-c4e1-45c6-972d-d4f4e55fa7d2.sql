
-- ═══════════════════════════════════════════════════════════════════
-- P0-3: Fix oficinas RLS - Allow staff to SELECT their oficina
-- ═══════════════════════════════════════════════════════════════════

-- Drop the restrictive owner-only SELECT policy
DROP POLICY IF EXISTS "Usuários podem ver suas próprias oficinas" ON public.oficinas;

-- Create new policy that allows owner AND staff members to see the oficina
CREATE POLICY "Usuários podem ver suas oficinas"
ON public.oficinas
FOR SELECT
USING (has_oficina_access(auth.uid(), id));

-- ═══════════════════════════════════════════════════════════════════
-- P0-4: Create SECURITY DEFINER RPC for Portal Cliente approve/reject
-- This allows unauthenticated clients to update orcamento status via token
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.portal_update_orcamento_status(
  p_token uuid,
  p_orcamento_id uuid,
  p_action text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cliente_id uuid;
  v_oficina_id uuid;
  v_orcamento_status text;
  v_new_status text;
BEGIN
  -- Validate action
  IF p_action NOT IN ('aprovar', 'rejeitar') THEN
    RETURN json_build_object('success', false, 'error', 'Ação inválida');
  END IF;

  -- Validate token and get cliente
  SELECT id, oficina_id INTO v_cliente_id, v_oficina_id
  FROM public.clientes
  WHERE portal_token = p_token;

  IF v_cliente_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Token inválido');
  END IF;

  -- Verify the orcamento belongs to this cliente AND oficina
  SELECT status INTO v_orcamento_status
  FROM public.orcamentos
  WHERE id = p_orcamento_id
    AND cliente_id = v_cliente_id
    AND oficina_id = v_oficina_id;

  IF v_orcamento_status IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Orçamento não encontrado');
  END IF;

  -- Only allow action on 'enviado' status
  IF v_orcamento_status <> 'enviado' THEN
    RETURN json_build_object('success', false, 'error', 'Este orçamento não está aguardando aprovação');
  END IF;

  -- Map action to status
  v_new_status := CASE WHEN p_action = 'aprovar' THEN 'aprovado' ELSE 'rejeitado' END;

  -- Update the orcamento
  UPDATE public.orcamentos
  SET status = v_new_status, updated_at = now()
  WHERE id = p_orcamento_id;

  -- Create notification for the oficina
  INSERT INTO public.notificacoes (oficina_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
  VALUES (
    v_oficina_id,
    'orcamento',
    CASE WHEN p_action = 'aprovar' THEN '✅ Orçamento Aprovado pelo Cliente!' ELSE '❌ Orçamento Rejeitado pelo Cliente' END,
    'O cliente atualizou o status do orçamento #' || p_orcamento_id::text,
    p_orcamento_id,
    'orcamento'
  );

  RETURN json_build_object('success', true, 'new_status', v_new_status);
END;
$$;
