
-- REPARO HISTÓRICO: Gerar movimentações de estoque faltantes para OS finalizadas
-- que foram criadas antes do fix pendente→finalizado.
-- Idempotente: só insere se a movimentação não existir (checado via NOT EXISTS).

DO $$
DECLARE
  rec RECORD;
  v_saldo_atual INTEGER;
BEGIN
  FOR rec IN
    SELECT 
      os.id as os_id,
      os.numero,
      os.oficina_id,
      ios.estoque_id,
      ios.nome_item,
      ios.quantidade as qty_used
    FROM ordens_servico os
    JOIN itens_os ios ON ios.ordem_servico_id = os.id
    JOIN estoque e ON e.id = ios.estoque_id
    WHERE os.status = 'finalizado'
    AND ios.estoque_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM estoque_movimentacoes em 
      WHERE em.estoque_id = ios.estoque_id 
      AND em.referencia_id = os.id 
      AND em.referencia_tipo = 'ordem_servico'
    )
  LOOP
    -- Get current stock quantity
    SELECT quantidade INTO v_saldo_atual
    FROM estoque WHERE id = rec.estoque_id;

    -- Insert the missing movement record
    INSERT INTO estoque_movimentacoes (
      estoque_id, oficina_id, tipo, quantidade,
      quantidade_anterior, quantidade_nova,
      motivo, referencia_tipo, referencia_id
    ) VALUES (
      rec.estoque_id,
      rec.oficina_id,
      'saida',
      rec.qty_used,
      v_saldo_atual,
      GREATEST(0, v_saldo_atual - rec.qty_used),
      'Reparo histórico - OS #' || rec.numero || ': ' || rec.nome_item,
      'ordem_servico',
      rec.os_id
    );

    -- Update the stock quantity
    UPDATE estoque
    SET quantidade = GREATEST(0, quantidade - rec.qty_used),
        ultima_saida = now()
    WHERE id = rec.estoque_id;

    RAISE NOTICE 'Reparado: OS #% item % (-%)', rec.numero, rec.nome_item, rec.qty_used;
  END LOOP;
END $$;
