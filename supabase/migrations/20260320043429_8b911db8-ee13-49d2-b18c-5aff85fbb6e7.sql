
CREATE OR REPLACE FUNCTION public.public_approve_orcamento(p_orcamento_id uuid, p_action text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_oficina_id uuid;
  v_orcamento_status text;
  v_orcamento_numero integer;
  v_cliente_nome text;
  v_new_status text;
BEGIN
  IF p_action NOT IN ('aprovar', 'rejeitar') THEN
    RETURN json_build_object('success', false, 'error', 'Ação inválida');
  END IF;

  SELECT o.status, o.oficina_id, o.numero, c.nome
  INTO v_orcamento_status, v_oficina_id, v_orcamento_numero, v_cliente_nome
  FROM public.orcamentos o
  LEFT JOIN public.clientes c ON c.id = o.cliente_id
  WHERE o.id = p_orcamento_id;

  IF v_orcamento_status IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Orçamento não encontrado');
  END IF;

  IF v_orcamento_status <> 'enviado' THEN
    RETURN json_build_object('success', false, 'error', 'Este orçamento não está aguardando aprovação');
  END IF;

  v_new_status := CASE WHEN p_action = 'aprovar' THEN 'aprovado' ELSE 'rejeitado' END;

  UPDATE public.orcamentos
  SET status = v_new_status, updated_at = now()
  WHERE id = p_orcamento_id;

  INSERT INTO public.notificacoes (oficina_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
  VALUES (
    v_oficina_id,
    'orcamento',
    CASE WHEN p_action = 'aprovar' 
      THEN '✅ Orçamento #' || COALESCE(v_orcamento_numero::text, '') || ' Aprovado!'
      ELSE '❌ Orçamento #' || COALESCE(v_orcamento_numero::text, '') || ' Rejeitado'
    END,
    'O cliente ' || COALESCE(v_cliente_nome, '') || ' ' || 
    CASE WHEN p_action = 'aprovar' THEN 'aprovou' ELSE 'rejeitou' END || 
    ' o orçamento pelo link público.',
    p_orcamento_id,
    'orcamento'
  );

  RETURN json_build_object('success', true, 'new_status', v_new_status);
END;
$$;
