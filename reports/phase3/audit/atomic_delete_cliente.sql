CREATE OR REPLACE FUNCTION public.atomic_delete_cliente(p_cliente_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cliente RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  SELECT id, oficina_id INTO v_cliente
  FROM public.clientes
  WHERE id = p_cliente_id
  FOR UPDATE;

  IF v_cliente IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Cliente não encontrado');
  END IF;

  IF NOT public.has_oficina_access(auth.uid(), v_cliente.oficina_id) THEN
    RETURN json_build_object('success', false, 'error', 'Sem permissão para esta oficina');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ordens_servico
    WHERE cliente_id = p_cliente_id
      AND oficina_id = v_cliente.oficina_id
      AND status IN ('pendente', 'em_andamento', 'em_diagnostico', 'aguardando_peca')
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Cliente possui ordens de serviço ativas. Finalize ou cancele antes de excluir.');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.ordens_servico os
    JOIN public.veiculos v ON v.id = os.veiculo_id
    WHERE v.cliente_id = p_cliente_id
      AND os.oficina_id = v_cliente.oficina_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Cliente possui veículos com histórico de serviços. Remova as OS primeiro.');
  END IF;

  DELETE FROM public.recorrencias
  WHERE veiculo_id IN (
    SELECT id FROM public.veiculos
    WHERE cliente_id = p_cliente_id AND oficina_id = v_cliente.oficina_id
  );

  DELETE FROM public.veiculos
  WHERE cliente_id = p_cliente_id AND oficina_id = v_cliente.oficina_id;

  DELETE FROM public.itens_orcamento
  WHERE orcamento_id IN (
    SELECT id FROM public.orcamentos
    WHERE cliente_id = p_cliente_id AND oficina_id = v_cliente.oficina_id
  );

  DELETE FROM public.parcelas_pagamento
  WHERE orcamento_id IN (
    SELECT id FROM public.orcamentos
    WHERE cliente_id = p_cliente_id AND oficina_id = v_cliente.oficina_id
  );

  DELETE FROM public.orcamentos
  WHERE cliente_id = p_cliente_id AND oficina_id = v_cliente.oficina_id;

  DELETE FROM public.clientes
  WHERE id = p_cliente_id AND oficina_id = v_cliente.oficina_id;

  RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$
