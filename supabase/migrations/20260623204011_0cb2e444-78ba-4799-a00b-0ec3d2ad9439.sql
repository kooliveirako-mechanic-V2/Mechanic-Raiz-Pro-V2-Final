-- Hardening multi-tenant: funções SECURITY DEFINER de escrita precisam validar auth.uid() + oficina_id.

CREATE OR REPLACE FUNCTION public.atomic_delete_orcamento(p_orcamento_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_orc RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  SELECT id, oficina_id INTO v_orc
  FROM public.orcamentos
  WHERE id = p_orcamento_id
  FOR UPDATE;

  IF v_orc IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Orçamento não encontrado');
  END IF;

  IF NOT public.has_oficina_access(auth.uid(), v_orc.oficina_id) THEN
    RETURN json_build_object('success', false, 'error', 'Sem permissão para esta oficina');
  END IF;

  DELETE FROM public.itens_orcamento WHERE orcamento_id = p_orcamento_id;
  DELETE FROM public.parcelas_pagamento WHERE orcamento_id = p_orcamento_id;
  DELETE FROM public.pagamentos WHERE orcamento_id = p_orcamento_id;
  DELETE FROM public.orcamentos WHERE id = p_orcamento_id;

  RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.atomic_delete_os(p_os_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.atomic_delete_cliente(p_cliente_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.atomic_delete_veiculo(p_veiculo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_veiculo RECORD;
  v_os_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT id, oficina_id INTO v_veiculo
  FROM public.veiculos
  WHERE id = p_veiculo_id
  FOR UPDATE;

  IF v_veiculo IS NULL THEN
    RAISE EXCEPTION 'Veículo não encontrado';
  END IF;

  IF NOT public.has_oficina_access(auth.uid(), v_veiculo.oficina_id) THEN
    RAISE EXCEPTION 'Sem permissão para esta oficina';
  END IF;

  SELECT count(*) INTO v_os_count
  FROM public.ordens_servico
  WHERE veiculo_id = p_veiculo_id
    AND oficina_id = v_veiculo.oficina_id
    AND status NOT IN ('cancelado');

  IF v_os_count > 0 THEN
    RAISE EXCEPTION 'Este veículo possui % ordem(ns) de serviço vinculada(s). Remova as OS antes de excluir o veículo.', v_os_count;
  END IF;

  DELETE FROM public.recorrencias WHERE veiculo_id = p_veiculo_id;
  UPDATE public.orcamentos
  SET veiculo_id = NULL
  WHERE veiculo_id = p_veiculo_id
    AND oficina_id = v_veiculo.oficina_id;
  DELETE FROM public.veiculos
  WHERE id = p_veiculo_id
    AND oficina_id = v_veiculo.oficina_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.atomic_delete_estoque(p_estoque_id uuid, p_oficina_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_nome text;
  v_real_oficina_id uuid;
  v_tem_vinculo boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT nome, oficina_id INTO v_nome, v_real_oficina_id
  FROM public.estoque
  WHERE id = p_estoque_id
  FOR UPDATE;

  IF NOT FOUND OR v_real_oficina_id IS DISTINCT FROM p_oficina_id THEN
    RAISE EXCEPTION 'Item não encontrado ou sem permissão';
  END IF;

  IF NOT public.has_oficina_access(auth.uid(), v_real_oficina_id) THEN
    RAISE EXCEPTION 'Sem permissão para esta oficina';
  END IF;

  SELECT
    EXISTS(SELECT 1 FROM public.itens_os WHERE estoque_id = p_estoque_id)
    OR EXISTS(SELECT 1 FROM public.itens_orcamento WHERE estoque_id = p_estoque_id)
  INTO v_tem_vinculo;

  IF v_tem_vinculo THEN
    UPDATE public.estoque
    SET arquivado = true,
        arquivado_em = now(),
        quantidade = 0,
        updated_at = now()
    WHERE id = p_estoque_id
      AND oficina_id = v_real_oficina_id;

    RETURN jsonb_build_object('success', true, 'nome', v_nome, 'soft_delete', true, 'message', 'Item arquivado (histórico preservado nas OS antigas)');
  END IF;

  DELETE FROM public.estoque_movimentacoes
  WHERE estoque_id = p_estoque_id
    AND oficina_id = v_real_oficina_id;

  DELETE FROM public.estoque
  WHERE id = p_estoque_id
    AND oficina_id = v_real_oficina_id;

  RETURN jsonb_build_object('success', true, 'nome', v_nome, 'soft_delete', false, 'message', 'Item e histórico removidos com sucesso');
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Erro ao excluir item do estoque: %. Nenhuma alteração foi salva.', SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION public.baixar_estoque_orcamento(p_orcamento_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_oficina_id uuid;
  item RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT oficina_id INTO v_oficina_id
  FROM public.orcamentos
  WHERE id = p_orcamento_id;

  IF v_oficina_id IS NULL THEN
    RAISE EXCEPTION 'Orçamento não encontrado';
  END IF;

  IF NOT public.has_oficina_access(auth.uid(), v_oficina_id) THEN
    RAISE EXCEPTION 'Sem permissão para esta oficina';
  END IF;

  FOR item IN
    SELECT estoque_id, quantidade
    FROM public.itens_orcamento
    WHERE orcamento_id = p_orcamento_id
      AND estoque_id IS NOT NULL
  LOOP
    UPDATE public.estoque
    SET quantidade = quantidade - item.quantidade,
        updated_at = now()
    WHERE id = item.estoque_id
      AND oficina_id = v_oficina_id;
  END LOOP;
END;
$$;

-- Revogar execução anônima/pública e liberar só para usuários autenticados.
REVOKE EXECUTE ON FUNCTION public.atomic_delete_orcamento(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.atomic_delete_os(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.atomic_delete_cliente(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.atomic_delete_veiculo(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.atomic_delete_estoque(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.baixar_estoque_orcamento(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.atomic_delete_orcamento(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atomic_delete_os(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atomic_delete_cliente(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atomic_delete_veiculo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atomic_delete_estoque(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.baixar_estoque_orcamento(uuid) TO authenticated;