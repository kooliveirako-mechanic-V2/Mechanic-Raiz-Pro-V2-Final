
-- Drop and recreate converter_orcamento_em_os with correct return type
DROP FUNCTION IF EXISTS public.converter_orcamento_em_os(UUID, UUID);

CREATE OR REPLACE FUNCTION public.converter_orcamento_em_os(p_oficina_id UUID, p_orcamento_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orcamento orcamentos%ROWTYPE;
  v_os_id UUID;
  v_total_itens NUMERIC := 0;
  v_total_custo NUMERIC := 0;
  v_itens_count INTEGER := 0;
  v_item RECORD;
BEGIN
  SELECT * INTO v_orcamento
  FROM orcamentos
  WHERE id = p_orcamento_id
    AND oficina_id = p_oficina_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado ou sem permissão';
  END IF;

  IF v_orcamento.status = 'convertido' THEN
    RAISE EXCEPTION 'Orçamento já foi convertido em OS';
  END IF;

  IF v_orcamento.cliente_id IS NULL OR v_orcamento.veiculo_id IS NULL THEN
    RAISE EXCEPTION 'Cliente e veículo são obrigatórios para converter';
  END IF;

  INSERT INTO ordens_servico (
    oficina_id, cliente_id, veiculo_id,
    tipo_servico, descricao, status,
    valor_servico, custo_servico,
    data_servico, observacoes
  ) VALUES (
    p_oficina_id,
    v_orcamento.cliente_id,
    v_orcamento.veiculo_id,
    COALESCE(v_orcamento.titulo, 'Serviço'),
    COALESCE(v_orcamento.descricao, 'Orçamento #' || v_orcamento.numero || ' convertido em OS'),
    'pendente',
    0,
    COALESCE(v_orcamento.custo_total, 0),
    CURRENT_DATE,
    v_orcamento.observacoes
  )
  RETURNING id INTO v_os_id;

  FOR v_item IN
    SELECT * FROM itens_orcamento
    WHERE orcamento_id = p_orcamento_id
  LOOP
    -- FIXED: removed valor_total from INSERT (GENERATED ALWAYS column)
    INSERT INTO itens_os (
      ordem_servico_id, nome_item, quantidade,
      valor_unitario, valor_mao_obra, estoque_id
    ) VALUES (
      v_os_id, v_item.nome_item,
      COALESCE(v_item.quantidade, 1),
      COALESCE(v_item.valor_unitario, 0),
      COALESCE(v_item.valor_mao_obra, 0),
      v_item.estoque_id
    );

    v_total_itens := v_total_itens + COALESCE(v_item.valor_total, 
      (COALESCE(v_item.quantidade, 1) * COALESCE(v_item.valor_unitario, 0)) + COALESCE(v_item.valor_mao_obra, 0));
    v_total_custo := v_total_custo + (COALESCE(v_item.custo_unitario, 0) * COALESCE(v_item.quantidade, 1));
    v_itens_count := v_itens_count + 1;
  END LOOP;

  -- FIXED: removed 'lucro = ...' — it is GENERATED ALWAYS
  UPDATE ordens_servico
  SET valor_servico = v_total_itens,
      custo_servico = v_total_custo
  WHERE id = v_os_id;

  UPDATE orcamentos
  SET status = 'convertido',
      updated_at = NOW()
  WHERE id = p_orcamento_id;

  RETURN jsonb_build_object(
    'success', true,
    'os_id', v_os_id,
    'valor_total', v_total_itens,
    'custo_total', v_total_custo,
    'itens_copiados', v_itens_count
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Erro ao converter orçamento: %. Nenhum dado foi salvo.', SQLERRM;
END;
$$;
