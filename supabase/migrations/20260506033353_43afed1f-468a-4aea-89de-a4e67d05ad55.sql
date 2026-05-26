-- Enriquecer descrição do sinal com veículo (modelo + placa)
CREATE OR REPLACE FUNCTION public.registrar_sinal_os(
  p_os_id uuid,
  p_valor numeric,
  p_forma_pagamento_id uuid DEFAULT NULL,
  p_forma_pagamento_nome text DEFAULT NULL,
  p_data_pagamento date DEFAULT NULL,
  p_observacao text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_os RECORD;
  v_total_produtos numeric;
  v_total_mao_obra_itens numeric;
  v_master_total numeric;
  v_sinal_atual numeric;
  v_novo_sinal numeric;
  v_cliente_nome text;
  v_veiculo_modelo text;
  v_veiculo_placa text;
  v_veiculo_label text;
  v_forma_nome text;
  v_descricao text;
  v_data date;
  v_financeiro_id uuid;
  v_sinal_id uuid;
BEGIN
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor do sinal deve ser maior que zero';
  END IF;

  v_data := COALESCE(p_data_pagamento, CURRENT_DATE);

  SELECT * INTO v_os FROM public.ordens_servico WHERE id = p_os_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de serviço não encontrada';
  END IF;

  IF NOT has_oficina_access(auth.uid(), v_os.oficina_id) THEN
    RAISE EXCEPTION 'Sem permissão para esta OS';
  END IF;

  SELECT
    COALESCE(SUM(COALESCE(quantidade,1) * COALESCE(valor_unitario,0)), 0),
    COALESCE(SUM(COALESCE(valor_mao_obra,0)), 0)
  INTO v_total_produtos, v_total_mao_obra_itens
  FROM public.itens_os WHERE ordem_servico_id = p_os_id;

  v_master_total := GREATEST(
    COALESCE(v_os.valor_servico, 0),
    v_total_produtos + GREATEST(COALESCE(v_os.valor_mao_obra,0), v_total_mao_obra_itens)
  );

  v_sinal_atual := COALESCE(v_os.valor_sinal, 0);
  v_novo_sinal := v_sinal_atual + p_valor;

  IF v_master_total > 0 AND v_novo_sinal > v_master_total + 0.01 THEN
    RAISE EXCEPTION 'Sinal (R$ %) ultrapassa o total da OS (R$ %)', v_novo_sinal, v_master_total;
  END IF;

  SELECT c.nome INTO v_cliente_nome
  FROM public.clientes c WHERE c.id = v_os.cliente_id;

  SELECT v.modelo, v.placa INTO v_veiculo_modelo, v_veiculo_placa
  FROM public.veiculos v WHERE v.id = v_os.veiculo_id;

  v_veiculo_label := NULLIF(
    TRIM(BOTH ' ' FROM
      COALESCE(v_veiculo_modelo, '') ||
      CASE WHEN v_veiculo_placa IS NOT NULL AND v_veiculo_placa <> ''
           THEN ' • ' || v_veiculo_placa
           ELSE '' END
    ), ''
  );

  v_forma_nome := COALESCE(p_forma_pagamento_nome, '');
  IF (v_forma_nome IS NULL OR v_forma_nome = '') AND p_forma_pagamento_id IS NOT NULL THEN
    SELECT nome INTO v_forma_nome FROM public.formas_pagamento WHERE id = p_forma_pagamento_id;
  END IF;
  IF v_forma_nome IS NULL OR v_forma_nome = '' THEN
    v_forma_nome := 'Dinheiro';
  END IF;

  UPDATE public.ordens_servico
    SET valor_sinal = v_novo_sinal, updated_at = now()
    WHERE id = p_os_id;

  -- Descrição rica: OS — Cliente — Veículo • Placa — Forma — Data
  v_descricao := 'Sinal OS #' || COALESCE(v_os.numero::text, '?')
    || COALESCE(' — ' || v_cliente_nome, '')
    || COALESCE(' — ' || v_veiculo_label, '')
    || ' — ' || v_forma_nome
    || ' — ' || TO_CHAR(v_data, 'DD/MM/YYYY');

  INSERT INTO public.financeiro (
    oficina_id, ordem_servico_id, tipo, origem, valor, data, data_pagamento,
    descricao, status, forma_pagamento_id
  ) VALUES (
    v_os.oficina_id, p_os_id, 'entrada',
    'Sinal OS #' || COALESCE(v_os.numero::text, ''),
    p_valor, v_data, v_data,
    v_descricao,
    'pago', p_forma_pagamento_id
  ) RETURNING id INTO v_financeiro_id;

  INSERT INTO public.os_sinais (
    ordem_servico_id, oficina_id, valor, forma_pagamento, forma_pagamento_id,
    data_pagamento, observacao, financeiro_id, created_by
  ) VALUES (
    p_os_id, v_os.oficina_id, p_valor, v_forma_nome, p_forma_pagamento_id,
    v_data, p_observacao, v_financeiro_id, auth.uid()
  ) RETURNING id INTO v_sinal_id;

  RETURN jsonb_build_object(
    'success', true,
    'sinal_id', v_sinal_id,
    'financeiro_id', v_financeiro_id,
    'valor_sinal_total', v_novo_sinal,
    'master_total', v_master_total,
    'restante', GREATEST(v_master_total - v_novo_sinal, 0)
  );
END;
$$;