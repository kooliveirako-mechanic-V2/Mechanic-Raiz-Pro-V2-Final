
-- ═══════════════════════════════════════════════════════════════
-- ATOMIC DELETE OS: Server-side transaction that guarantees
-- all-or-nothing cleanup of stock, financeiro, parcelas, items
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.atomic_delete_os(p_os_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_os RECORD;
  v_item RECORD;
  v_est RECORD;
BEGIN
  -- 1. Lock and fetch OS
  SELECT id, status, oficina_id INTO v_os
  FROM ordens_servico WHERE id = p_os_id FOR UPDATE;
  
  IF v_os IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'OS não encontrada');
  END IF;

  -- 2. If finalized, restore stock atomically
  IF v_os.status = 'finalizado' THEN
    FOR v_item IN
      SELECT estoque_id, quantidade FROM itens_os
      WHERE ordem_servico_id = p_os_id AND estoque_id IS NOT NULL
    LOOP
      UPDATE estoque
      SET quantidade = quantidade + v_item.quantidade
      WHERE id = v_item.estoque_id;
    END LOOP;

    -- Remove stock movements
    DELETE FROM estoque_movimentacoes
    WHERE referencia_id = p_os_id AND referencia_tipo = 'ordem_servico';
    
    -- Legacy fallback
    DELETE FROM estoque_movimentacoes
    WHERE referencia_tipo = 'itens_os'
    AND referencia_id IN (SELECT id FROM itens_os WHERE ordem_servico_id = p_os_id);
  END IF;

  -- 3. Delete items
  DELETE FROM itens_os WHERE ordem_servico_id = p_os_id;

  -- 4. Delete financeiro (historico cascades via FK)
  DELETE FROM financeiro WHERE ordem_servico_id = p_os_id;

  -- 5. Delete parcelas
  DELETE FROM parcelas_pagamento WHERE ordem_servico_id = p_os_id;

  -- 6. Delete the OS itself
  DELETE FROM ordens_servico WHERE id = p_os_id;

  RETURN json_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- ATOMIC DELETE ORCAMENTO: Single transaction cleanup
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.atomic_delete_orcamento(p_orcamento_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_orc RECORD;
BEGIN
  SELECT id, oficina_id INTO v_orc
  FROM orcamentos WHERE id = p_orcamento_id FOR UPDATE;
  
  IF v_orc IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Orçamento não encontrado');
  END IF;

  DELETE FROM itens_orcamento WHERE orcamento_id = p_orcamento_id;
  DELETE FROM parcelas_pagamento WHERE orcamento_id = p_orcamento_id;
  DELETE FROM pagamentos WHERE orcamento_id = p_orcamento_id;
  DELETE FROM orcamentos WHERE id = p_orcamento_id;

  RETURN json_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- ATOMIC DELETE CLIENTE: Single transaction with pre-checks
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.atomic_delete_cliente(p_cliente_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cliente RECORD;
  v_veic RECORD;
BEGIN
  SELECT id, oficina_id INTO v_cliente
  FROM clientes WHERE id = p_cliente_id FOR UPDATE;
  
  IF v_cliente IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Cliente não encontrado');
  END IF;

  -- Block if active OS exist
  IF EXISTS (
    SELECT 1 FROM ordens_servico
    WHERE cliente_id = p_cliente_id
    AND status IN ('pendente', 'em_andamento', 'em_diagnostico', 'aguardando_peca')
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Cliente possui ordens de serviço ativas. Finalize ou cancele antes de excluir.');
  END IF;

  -- Block if vehicles have OS history
  IF EXISTS (
    SELECT 1 FROM ordens_servico os
    JOIN veiculos v ON v.id = os.veiculo_id
    WHERE v.cliente_id = p_cliente_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Cliente possui veículos com histórico de serviços. Remova as OS primeiro.');
  END IF;

  -- Clean recorrencias for client vehicles
  DELETE FROM recorrencias WHERE veiculo_id IN (SELECT id FROM veiculos WHERE cliente_id = p_cliente_id);

  -- Clean vehicles
  DELETE FROM veiculos WHERE cliente_id = p_cliente_id;

  -- Clean orcamento items and parcelas
  DELETE FROM itens_orcamento WHERE orcamento_id IN (SELECT id FROM orcamentos WHERE cliente_id = p_cliente_id);
  DELETE FROM parcelas_pagamento WHERE orcamento_id IN (SELECT id FROM orcamentos WHERE cliente_id = p_cliente_id);
  DELETE FROM orcamentos WHERE cliente_id = p_cliente_id;

  -- Delete the client
  DELETE FROM clientes WHERE id = p_cliente_id;

  RETURN json_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;
