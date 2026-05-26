
-- =============================================
-- RPC 1: CONVERTER ORÇAMENTO EM OS (ATÔMICA)
-- =============================================
CREATE OR REPLACE FUNCTION public.converter_orcamento_em_os(
  p_orcamento_id UUID,
  p_oficina_id UUID
)
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
  -- Lock orçamento para evitar conversão dupla
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

  -- ETAPA 1: Criar cabeçalho da OS
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
    0, -- será atualizado depois
    COALESCE(v_orcamento.custo_total, 0),
    CURRENT_DATE,
    v_orcamento.observacoes
  )
  RETURNING id INTO v_os_id;

  -- ETAPA 2: Copiar TODOS os itens do orçamento para itens_os
  FOR v_item IN
    SELECT * FROM itens_orcamento
    WHERE orcamento_id = p_orcamento_id
  LOOP
    INSERT INTO itens_os (
      ordem_servico_id,
      nome_item,
      quantidade,
      valor_unitario,
      valor_mao_obra,
      valor_total,
      estoque_id
    ) VALUES (
      v_os_id,
      v_item.nome_item,
      COALESCE(v_item.quantidade, 1),
      COALESCE(v_item.valor_unitario, 0),
      COALESCE(v_item.valor_mao_obra, 0),
      COALESCE(v_item.valor_total, (COALESCE(v_item.quantidade, 1) * COALESCE(v_item.valor_unitario, 0)) + COALESCE(v_item.valor_mao_obra, 0)),
      v_item.estoque_id
    );

    v_total_itens := v_total_itens + COALESCE(v_item.valor_total, 
      (COALESCE(v_item.quantidade, 1) * COALESCE(v_item.valor_unitario, 0)) + COALESCE(v_item.valor_mao_obra, 0));
    v_total_custo := v_total_custo + (COALESCE(v_item.custo_unitario, 0) * COALESCE(v_item.quantidade, 1));
    v_itens_count := v_itens_count + 1;
  END LOOP;

  -- ETAPA 3: Atualizar totais reais na OS
  UPDATE ordens_servico
  SET valor_servico = v_total_itens,
      custo_servico = v_total_custo,
      lucro = v_total_itens - v_total_custo
  WHERE id = v_os_id;

  -- ETAPA 4: Marcar orçamento como convertido
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

-- =============================================
-- RPC 2: CRIAR ORÇAMENTO COMPLETO (ATÔMICA)
-- =============================================
CREATE OR REPLACE FUNCTION public.criar_orcamento_completo(
  p_oficina_id UUID,
  p_titulo TEXT,
  p_cliente_id UUID DEFAULT NULL,
  p_veiculo_id UUID DEFAULT NULL,
  p_descricao TEXT DEFAULT NULL,
  p_validade TEXT DEFAULT NULL,
  p_desconto NUMERIC DEFAULT 0,
  p_observacoes TEXT DEFAULT NULL,
  p_itens JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orcamento_id UUID;
  v_numero INTEGER;
  v_item JSONB;
  v_total NUMERIC := 0;
  v_custo_total NUMERIC := 0;
  v_itens_count INTEGER := 0;
  v_qty NUMERIC;
  v_unit_price NUMERIC;
  v_mao_obra NUMERIC;
  v_custo NUMERIC;
  v_item_total NUMERIC;
BEGIN
  -- ETAPA 1: Criar cabeçalho do orçamento
  INSERT INTO orcamentos (
    oficina_id, cliente_id, veiculo_id,
    titulo, descricao, status,
    validade, desconto, observacoes,
    valor_total, custo_total
  ) VALUES (
    p_oficina_id, p_cliente_id, p_veiculo_id,
    p_titulo, p_descricao, 'rascunho',
    CASE WHEN p_validade IS NOT NULL AND p_validade != '' 
      THEN p_validade::date ELSE NULL END,
    COALESCE(p_desconto, 0), p_observacoes,
    0, 0
  )
  RETURNING id, numero INTO v_orcamento_id, v_numero;

  -- ETAPA 2: Inserir TODOS os itens
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_qty := GREATEST(COALESCE((v_item->>'quantidade')::NUMERIC, 1), 1);
    v_unit_price := COALESCE((v_item->>'valor_unitario')::NUMERIC, 0);
    v_mao_obra := COALESCE((v_item->>'valor_mao_obra')::NUMERIC, 0);
    v_custo := COALESCE((v_item->>'custo_unitario')::NUMERIC, 0);
    v_item_total := (v_qty * v_unit_price) + v_mao_obra;

    INSERT INTO itens_orcamento (
      orcamento_id, nome_item, tipo,
      quantidade, valor_unitario, valor_mao_obra,
      valor_total, custo_unitario, estoque_id
    ) VALUES (
      v_orcamento_id,
      v_item->>'nome_item',
      COALESCE(v_item->>'tipo', 'produto'),
      v_qty, v_unit_price, v_mao_obra,
      v_item_total, v_custo,
      NULLIF(v_item->>'estoque_id', '')::UUID
    );

    v_total := v_total + v_item_total;
    v_custo_total := v_custo_total + (v_custo * v_qty);
    v_itens_count := v_itens_count + 1;
  END LOOP;

  -- ETAPA 3: Atualizar totais reais
  UPDATE orcamentos
  SET valor_total = v_total,
      custo_total = v_custo_total
  WHERE id = v_orcamento_id;

  RETURN jsonb_build_object(
    'success', true,
    'orcamento_id', v_orcamento_id,
    'numero', v_numero,
    'valor_total', v_total,
    'custo_total', v_custo_total,
    'itens_inseridos', v_itens_count
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Erro ao criar orçamento: %. Nenhum dado foi salvo.', SQLERRM;
END;
$$;

-- =============================================
-- RPC 3: EXCLUIR ESTOQUE ATÔMICO
-- =============================================
CREATE OR REPLACE FUNCTION public.atomic_delete_estoque(
  p_estoque_id UUID,
  p_oficina_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome TEXT;
  v_usado_em_os BOOLEAN;
  v_usado_em_orc BOOLEAN;
BEGIN
  -- Verificar se o item pertence à oficina
  SELECT nome INTO v_nome
  FROM estoque
  WHERE id = p_estoque_id
    AND oficina_id = p_oficina_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item não encontrado ou sem permissão';
  END IF;

  -- Verificar se está sendo usado em OS ativas
  SELECT EXISTS(
    SELECT 1 FROM itens_os io
    JOIN ordens_servico os ON os.id = io.ordem_servico_id
    WHERE io.estoque_id = p_estoque_id
      AND os.status NOT IN ('finalizado', 'cancelado')
  ) INTO v_usado_em_os;

  IF v_usado_em_os THEN
    RAISE EXCEPTION 'Item está vinculado a OS em andamento. Remova dos serviços antes de excluir.';
  END IF;

  -- Verificar se está sendo usado em orçamentos ativos
  SELECT EXISTS(
    SELECT 1 FROM itens_orcamento io
    JOIN orcamentos o ON o.id = io.orcamento_id
    WHERE io.estoque_id = p_estoque_id
      AND o.status NOT IN ('convertido', 'rejeitado')
  ) INTO v_usado_em_orc;

  IF v_usado_em_orc THEN
    RAISE EXCEPTION 'Item está vinculado a orçamentos ativos. Remova dos orçamentos antes de excluir.';
  END IF;

  -- ETAPA 1: Deletar movimentações
  DELETE FROM estoque_movimentacoes
  WHERE estoque_id = p_estoque_id;

  -- ETAPA 2: Deletar o item
  DELETE FROM estoque
  WHERE id = p_estoque_id
    AND oficina_id = p_oficina_id;

  RETURN jsonb_build_object(
    'success', true,
    'nome', v_nome,
    'message', 'Item e histórico removidos com sucesso'
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Erro ao excluir item do estoque: %. Nenhuma alteração foi salva.', SQLERRM;
END;
$$;
