CREATE OR REPLACE FUNCTION public.atomic_delete_os(p_os_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_os RECORD;
  v_item RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  SELECT id, status, oficina_id INTO v_os
  FROM public.ordens_servico
  WHERE id = p_os_id
  FOR UPDATE;

  IF v_os IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'OS não encontrada');
  END IF;

  IF NOT public.has_oficina_access(auth.uid(), v_os.oficina_id) THEN
    RETURN json_build_object('success', false, 'error', 'Sem permissão para esta oficina');
  END IF;

  IF v_os.status = 'finalizado' THEN
    FOR v_item IN
      SELECT estoque_id, quantidade
      FROM public.itens_os
      WHERE ordem_servico_id = p_os_id
        AND estoque_id IS NOT NULL
    LOOP
      UPDATE public.estoque
      SET quantidade = quantidade + v_item.quantidade,
          updated_at = now()
      WHERE id = v_item.estoque_id
        AND oficina_id = v_os.oficina_id;
    END LOOP;
  END IF;

  DELETE FROM public.os_sinais WHERE ordem_servico_id = p_os_id;
  DELETE FROM public.parcelas_pagamento WHERE ordem_servico_id = p_os_id;
  DELETE FROM public.pagamentos WHERE ordem_servico_id = p_os_id;
  DELETE FROM public.itens_os WHERE ordem_servico_id = p_os_id;
  DELETE FROM public.financeiro WHERE ordem_servico_id = p_os_id;
  DELETE FROM public.ordens_servico WHERE id = p_os_id;

  RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$
