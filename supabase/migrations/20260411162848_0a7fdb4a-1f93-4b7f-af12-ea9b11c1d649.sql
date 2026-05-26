
-- 1. VALIDATE constraints (legado confirmado limpo)
ALTER TABLE itens_os VALIDATE CONSTRAINT itens_os_quantidade_gt_zero;
ALTER TABLE itens_os VALIDATE CONSTRAINT itens_os_valor_unitario_gte_zero;
ALTER TABLE itens_orcamento VALIDATE CONSTRAINT itens_orcamento_quantidade_gt_zero;
ALTER TABLE itens_orcamento VALIDATE CONSTRAINT itens_orcamento_valor_unitario_gte_zero;

-- 2. ADD valor_mao_obra to OS (formaliza serviço sem itens)
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS valor_mao_obra numeric DEFAULT 0;

-- 3. UPDATE reabrir_os_atomica to block if parcelas are paid
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
  v_parcelas_pagas INT;
BEGIN
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

  -- BLOQUEIO: impedir reabertura se houver parcela já paga
  SELECT count(*) INTO v_parcelas_pagas
  FROM parcelas_pagamento
  WHERE ordem_servico_id = p_os_id
    AND oficina_id = v_oficina_id
    AND status = 'pago';

  IF v_parcelas_pagas > 0 THEN
    RAISE EXCEPTION 'Não é possível reabrir OS com % parcela(s) já paga(s). Estorne os pagamentos antes de reabrir.', v_parcelas_pagas;
  END IF;

  -- Reverter baixa de estoque
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

  -- Cancelar financeiro derivado
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

  -- Autorizar transição
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
