
-- ============================================================
-- 1. STATE MACHINE TRIGGER — impede transições ilegais de status
-- ============================================================
CREATE OR REPLACE FUNCTION public.validar_transicao_status_os()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Se status não mudou, deixa passar
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Transições permitidas
  IF OLD.status = 'pendente' AND NEW.status IN ('em_diagnostico', 'em_andamento', 'aguardando_peca', 'cancelado') THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'em_diagnostico' AND NEW.status IN ('em_andamento', 'aguardando_peca', 'cancelado') THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'em_andamento' AND NEW.status IN ('finalizado', 'aguardando_peca', 'cancelado') THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'aguardando_peca' AND NEW.status IN ('em_andamento', 'em_diagnostico', 'cancelado') THEN
    RETURN NEW;
  END IF;

  -- finalizado → em_andamento SOMENTE via RPC (flag de contexto)
  IF OLD.status = 'finalizado' AND NEW.status = 'em_andamento' THEN
    IF current_setting('app.reabertura_autorizada', true) = 'true' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Transição ilegal: OS finalizada só pode ser reaberta via fluxo controlado (RPC reabrir_os_atomica)';
  END IF;

  -- cancelado não volta (sem fluxo específico)
  IF OLD.status = 'cancelado' THEN
    RAISE EXCEPTION 'Transição ilegal: OS cancelada não pode mudar de status';
  END IF;

  -- finalizado não pode ir para outro status que não em_andamento
  IF OLD.status = 'finalizado' THEN
    RAISE EXCEPTION 'Transição ilegal: finalizado → % não é permitido', NEW.status;
  END IF;

  -- Qualquer outra transição não prevista
  RAISE EXCEPTION 'Transição de status não permitida: % → %', OLD.status, NEW.status;
END;
$$;

DROP TRIGGER IF EXISTS tg_validar_transicao_status_os ON public.ordens_servico;

CREATE TRIGGER tg_validar_transicao_status_os
BEFORE UPDATE ON public.ordens_servico
FOR EACH ROW
EXECUTE FUNCTION public.validar_transicao_status_os();


-- ============================================================
-- 2. RPC reabrir_os_atomica — reabertura controlada
-- ============================================================
CREATE OR REPLACE FUNCTION public.reabrir_os_atomica(
  p_os_id UUID,
  p_motivo TEXT DEFAULT 'Reabertura solicitada'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_os RECORD;
  v_item RECORD;
  v_oficina_id UUID;
BEGIN
  -- Lock e validação
  SELECT * INTO v_os
  FROM ordens_servico
  WHERE id = p_os_id
  FOR UPDATE;

  IF v_os IS NULL THEN
    RAISE EXCEPTION 'OS não encontrada: %', p_os_id;
  END IF;

  IF v_os.status <> 'finalizado' THEN
    RAISE EXCEPTION 'Somente OS finalizada pode ser reaberta. Status atual: %', v_os.status;
  END IF;

  v_oficina_id := v_os.oficina_id;

  -- Reverter baixa de estoque (devolver peças)
  FOR v_item IN
    SELECT i.estoque_id, i.quantidade, i.nome_item
    FROM itens_os i
    WHERE i.ordem_servico_id = p_os_id
      AND i.estoque_id IS NOT NULL
  LOOP
    UPDATE estoque
    SET quantidade = quantidade + v_item.quantidade,
        updated_at = now()
    WHERE id = v_item.estoque_id;

    -- Registrar movimentação de estorno
    INSERT INTO estoque_movimentacoes (
      estoque_id, oficina_id, tipo, quantidade,
      quantidade_anterior, quantidade_nova,
      motivo, referencia_id, referencia_tipo
    )
    SELECT
      v_item.estoque_id, v_oficina_id, 'entrada', v_item.quantidade,
      e.quantidade - v_item.quantidade, e.quantidade,
      'Estorno por reabertura de OS #' || v_os.numero,
      p_os_id, 'reabertura_os'
    FROM estoque e WHERE e.id = v_item.estoque_id;
  END LOOP;

  -- Cancelar financeiro derivado da OS
  UPDATE financeiro
  SET status = 'cancelado'::status_pagamento,
      observacoes_contador = COALESCE(observacoes_contador, '') || ' [Cancelado por reabertura OS #' || v_os.numero || ']',
      updated_at = now()
  WHERE ordem_servico_id = p_os_id
    AND oficina_id = v_oficina_id;

  -- Cancelar parcelas pendentes
  UPDATE parcelas_pagamento
  SET status = 'cancelado',
      observacoes = COALESCE(observacoes, '') || ' [Cancelado por reabertura]',
      updated_at = now()
  WHERE ordem_servico_id = p_os_id
    AND oficina_id = v_oficina_id
    AND status = 'pendente';

  -- Autorizar transição e atualizar status
  PERFORM set_config('app.reabertura_autorizada', 'true', true);

  UPDATE ordens_servico
  SET status = 'em_andamento',
      data_conclusao = NULL,
      updated_at = now()
  WHERE id = p_os_id;

  PERFORM set_config('app.reabertura_autorizada', 'false', true);

  -- Auditoria
  INSERT INTO audit_logs (
    user_id, oficina_id, table_name, action, record_id,
    old_data, new_data
  ) VALUES (
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'),
    v_oficina_id,
    'ordens_servico',
    'reabertura',
    p_os_id,
    jsonb_build_object('status', 'finalizado'),
    jsonb_build_object('status', 'em_andamento', 'motivo', p_motivo)
  );

  RETURN jsonb_build_object(
    'success', true,
    'os_id', p_os_id,
    'novo_status', 'em_andamento',
    'motivo', p_motivo
  );
END;
$$;


-- ============================================================
-- 3. DOMAIN CONSTRAINTS — NOT VALID para não bloquear legado
-- ============================================================
ALTER TABLE itens_os
  ADD CONSTRAINT itens_os_quantidade_gt_zero
  CHECK (quantidade > 0) NOT VALID;

ALTER TABLE itens_os
  ADD CONSTRAINT itens_os_valor_unitario_gte_zero
  CHECK (valor_unitario >= 0) NOT VALID;

ALTER TABLE itens_orcamento
  ADD CONSTRAINT itens_orcamento_quantidade_gt_zero
  CHECK (quantidade > 0) NOT VALID;

ALTER TABLE itens_orcamento
  ADD CONSTRAINT itens_orcamento_valor_unitario_gte_zero
  CHECK (valor_unitario >= 0) NOT VALID;
