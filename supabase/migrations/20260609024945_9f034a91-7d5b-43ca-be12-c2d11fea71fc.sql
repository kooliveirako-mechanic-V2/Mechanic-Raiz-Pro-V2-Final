-- 1. Recriar upsert_financeiro_os com as colunas reais da tabela financeiro
CREATE OR REPLACE FUNCTION public.upsert_financeiro_os(
    p_oficina_id uuid,
    p_ordem_servico_id uuid,
    p_tipo_servico text,
    p_mao_obra_valor numeric,
    p_forma_pagamento_id uuid DEFAULT NULL::uuid,
    p_origem text DEFAULT NULL::text,
    p_numero_parcelas integer DEFAULT 1
)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total_pecas_bruto numeric := 0;
  v_mao_obra_total_bruta numeric := 0;
  v_valor_bruto_os numeric := 0;
  v_desconto_os numeric := 0;
  v_valor_sinal numeric := 0;
  v_valor_liquido_os numeric := 0;
  v_valor_restante numeric := 0;
  v_existing_id uuid;
  v_os_numero integer;
  v_status_financeiro text := 'pago';
BEGIN
  IF p_forma_pagamento_id IS NULL THEN
    v_status_financeiro := 'a_receber';
  END IF;

  SELECT id INTO v_existing_id FROM public.financeiro 
  WHERE ordem_servico_id = p_ordem_servico_id AND tipo = 'entrada' AND categoria NOT IN ('comissao', 'sinal') LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN json_build_object('success', true, 'action', 'exists', 'id', v_existing_id);
  END IF;

  SELECT 
    COALESCE(os.valor_servico, 0), 
    COALESCE(os.desconto, 0),
    os.numero,
    COALESCE(os.valor_sinal, 0)
  INTO v_valor_bruto_os, v_desconto_os, v_os_numero, v_valor_sinal
  FROM public.ordens_servico os WHERE os.id = p_ordem_servico_id;

  SELECT 
    COALESCE(SUM(CASE WHEN ios.tipo = 'produto' OR ios.estoque_id IS NOT NULL THEN (COALESCE(ios.quantidade, 1) * COALESCE(ios.valor_unitario, 0)) ELSE 0 END), 0),
    COALESCE(SUM(COALESCE(ios.valor_mao_obra, 0)), 0)
  INTO v_total_pecas_bruto, v_mao_obra_total_bruta
  FROM public.itens_os ios WHERE ios.ordem_servico_id = p_ordem_servico_id;

  v_mao_obra_total_bruta := v_mao_obra_total_bruta + COALESCE(p_mao_obra_valor, 0);
  
  IF v_valor_bruto_os <= 0 THEN
    v_valor_bruto_os := v_total_pecas_bruto + v_mao_obra_total_bruta;
  END IF;

  v_valor_liquido_os := GREATEST(v_valor_bruto_os - v_desconto_os, 0);
  v_valor_restante := GREATEST(v_valor_liquido_os - v_valor_sinal, 0);

  IF v_valor_restante <= 0 THEN
    RETURN json_build_object('success', true, 'action', 'skipped', 'message', 'OS sem valor restante para financeiro');
  END IF;

  -- Usar colunas reais: 'data' em vez de 'data_vencimento', 'origem' é obrigatório
  INSERT INTO public.financeiro (
    oficina_id, ordem_servico_id, tipo, categoria, valor, status,
    descricao, data, data_pagamento, data_competencia, forma_pagamento_id, origem,
    valor_mao_obra, valor_pecas
  ) VALUES (
    p_oficina_id, p_ordem_servico_id, 'entrada', 'operacional', v_valor_restante, 
    v_status_financeiro::public.status_pagamento,
    'OS #' || v_os_numero || ' - ' || p_tipo_servico,
    CURRENT_DATE,
    CASE WHEN v_status_financeiro = 'pago' THEN CURRENT_DATE ELSE NULL END,
    CURRENT_DATE,
    p_forma_pagamento_id,
    COALESCE(p_origem, 'OS #' || v_os_numero),
    v_mao_obra_total_bruta,
    v_total_pecas_bruto
  ) RETURNING id INTO v_existing_id;

  RETURN json_build_object('success', true, 'action', 'created', 'id', v_existing_id);
END;
$function$;

-- 2. Corrigir criar_venda_balcao com as colunas reais
CREATE OR REPLACE FUNCTION public.criar_venda_balcao(
    p_oficina_id uuid,
    p_itens jsonb,
    p_forma_pagamento text,
    p_forma_pagamento_id uuid DEFAULT NULL::uuid,
    p_cliente_id uuid DEFAULT NULL::uuid,
    p_observacao text DEFAULT NULL::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_venda_id UUID;
  v_numero INTEGER;
  v_item JSONB;
  v_total NUMERIC := 0;
  v_total_custo NUMERIC := 0;
  v_qty NUMERIC;
  v_price NUMERIC;
  v_custo NUMERIC;
  v_estoque_id UUID;
  v_user_id UUID := auth.uid();
  v_financeiro_id UUID;
BEGIN
  INSERT INTO vendas_balcao (
    oficina_id, cliente_id, forma_pagamento, 
    forma_pagamento_id, observacao, valor_total, created_by, status
  ) VALUES (
    p_oficina_id, p_cliente_id, p_forma_pagamento, 
    p_forma_pagamento_id, p_observacao, 0, v_user_id, 'pendente'
  ) RETURNING id, numero INTO v_venda_id, v_numero;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_qty   := COALESCE((v_item->>'quantidade')::NUMERIC, 1);
    v_price := COALESCE((v_item->>'valor_unitario')::NUMERIC, 0);
    v_custo := COALESCE((v_item->>'custo_unitario')::NUMERIC, 0);
    v_estoque_id := NULLIF(v_item->>'estoque_id', '')::UUID;

    INSERT INTO itens_venda_balcao (
      venda_id, estoque_id, nome_item, 
      quantidade, valor_unitario, custo_unitario
    ) VALUES (
      v_venda_id, v_estoque_id, v_item->>'nome_item',
      v_qty, v_price, v_custo
    );

    IF v_estoque_id IS NOT NULL THEN
      UPDATE estoque 
      SET quantidade = GREATEST(0, quantidade - v_qty),
          ultima_saida = now()
      WHERE id = v_estoque_id;
    END IF;

    v_total := v_total + (v_qty * v_price);
    v_total_custo := v_total_custo + (v_qty * v_custo);
  END LOOP;

  IF v_total > 0 THEN
    INSERT INTO financeiro (
      oficina_id, tipo, categoria, valor, status,
      descricao, data, data_pagamento, data_competencia, forma_pagamento_id, 
      venda_balcao_id, origem, valor_pecas
    ) VALUES (
      p_oficina_id, 'entrada', 'venda_balcao', v_total, 'pago'::public.status_pagamento,
      'Venda Balcão #' || v_numero, CURRENT_DATE, CURRENT_DATE, CURRENT_DATE, p_forma_pagamento_id, 
      v_venda_id, 'Venda Balcão #' || v_numero, v_total
    ) RETURNING id INTO v_financeiro_id;
  END IF;

  UPDATE vendas_balcao 
  SET valor_total = v_total, status = 'concluida', financeiro_id = v_financeiro_id
  WHERE id = v_venda_id;

  RETURN jsonb_build_object('success', true, 'id', v_venda_id, 'numero', v_numero, 'valor_total', v_total, 'financeiro_id', v_financeiro_id);
END;
$function$;
