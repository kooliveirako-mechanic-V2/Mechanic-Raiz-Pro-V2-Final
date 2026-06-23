-- 1. Adicionar coluna venda_balcao_id na tabela financeiro
ALTER TABLE public.financeiro ADD COLUMN IF NOT EXISTS venda_balcao_id uuid REFERENCES public.vendas_balcao(id) ON DELETE SET NULL;

-- 2. Recriar criar_venda_balcao (agora a coluna existe)
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
    p_forma_pagamento_id, p_observacao, 0, v_user_id, 'concluida'
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
  SET valor_total = v_total, financeiro_id = v_financeiro_id
  WHERE id = v_venda_id;

  RETURN jsonb_build_object('success', true, 'id', v_venda_id, 'numero', v_numero, 'valor_total', v_total, 'financeiro_id', v_financeiro_id);
END;
$function$;
