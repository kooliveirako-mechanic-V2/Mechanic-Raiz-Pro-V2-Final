-- 0) Permitir nova categoria de custo de mercadoria
ALTER TABLE public.financeiro DROP CONSTRAINT IF EXISTS financeiro_categoria_check;
ALTER TABLE public.financeiro ADD CONSTRAINT financeiro_categoria_check
  CHECK (categoria = ANY (ARRAY['operacional'::text, 'prejuizo'::text, 'comissao'::text, 'sinal'::text, 'venda_balcao'::text, 'custo_mercadoria'::text]));

-- 1) Atualizar RPC criar_venda_balcao para lançar custo como saída
CREATE OR REPLACE FUNCTION public.criar_venda_balcao(p_oficina_id uuid, p_itens jsonb, p_forma_pagamento text DEFAULT 'Dinheiro'::text, p_forma_pagamento_id uuid DEFAULT NULL::uuid, p_cliente_id uuid DEFAULT NULL::uuid, p_observacao text DEFAULT NULL::text)
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
  v_custo_total NUMERIC := 0;
  v_qty NUMERIC;
  v_price NUMERIC;
  v_custo NUMERIC;
  v_estoque_id UUID;
  v_estoque_atual NUMERIC;
  v_estoque_nome TEXT;
  v_estoque_custo NUMERIC;
  v_financeiro_id UUID;
  v_cliente_nome TEXT;
  v_user_id UUID := auth.uid();
  v_itens_resumo TEXT;
  v_descricao TEXT;
  v_hora TEXT;
BEGIN
  IF NOT has_oficina_access(v_user_id, p_oficina_id) THEN
    RAISE EXCEPTION 'Sem permissão para criar venda nesta oficina';
  END IF;

  IF p_itens IS NULL OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'Adicione pelo menos 1 item para vender';
  END IF;

  INSERT INTO vendas_balcao (
    oficina_id, cliente_id, forma_pagamento,
    forma_pagamento_id, observacao, valor_total, created_by
  ) VALUES (
    p_oficina_id, p_cliente_id, p_forma_pagamento,
    p_forma_pagamento_id, p_observacao, 0, v_user_id
  ) RETURNING id, numero INTO v_venda_id, v_numero;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_qty   := COALESCE((v_item->>'quantidade')::NUMERIC, 1);
    v_price := COALESCE((v_item->>'valor_unitario')::NUMERIC, 0);
    v_custo := COALESCE((v_item->>'custo_unitario')::NUMERIC, 0);
    v_estoque_id := NULLIF(v_item->>'estoque_id', '')::UUID;

    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Quantidade inválida para: %', v_item->>'nome_item';
    END IF;
    IF v_price <= 0 THEN
      RAISE EXCEPTION 'Valor inválido para: %', v_item->>'nome_item';
    END IF;

    IF v_estoque_id IS NOT NULL THEN
      SELECT quantidade, nome, custo_unitario
        INTO v_estoque_atual, v_estoque_nome, v_estoque_custo
      FROM estoque WHERE id = v_estoque_id AND oficina_id = p_oficina_id
      FOR UPDATE;

      IF v_estoque_atual IS NULL THEN
        RAISE EXCEPTION 'Item de estoque não encontrado: %', v_item->>'nome_item';
      END IF;

      IF v_estoque_atual < v_qty THEN
        RAISE EXCEPTION 'Estoque insuficiente — só há % unidades de %', v_estoque_atual, v_estoque_nome;
      END IF;

      IF v_custo = 0 AND COALESCE(v_estoque_custo, 0) > 0 THEN
        v_custo := v_estoque_custo;
      END IF;

      UPDATE estoque
      SET quantidade = quantidade - v_qty,
          ultima_saida = now()
      WHERE id = v_estoque_id;

      INSERT INTO estoque_movimentacoes (
        estoque_id, oficina_id, tipo, quantidade,
        quantidade_anterior, quantidade_nova,
        motivo, referencia_tipo, referencia_id,
        custo_unitario, user_id
      ) VALUES (
        v_estoque_id, p_oficina_id, 'saida', v_qty,
        v_estoque_atual, v_estoque_atual - v_qty,
        'Venda Balcão #' || v_numero, 'venda_balcao', v_venda_id,
        v_custo, v_user_id
      );
    END IF;

    INSERT INTO itens_venda_balcao (
      venda_id, estoque_id, nome_item,
      quantidade, valor_unitario, custo_unitario
    ) VALUES (
      v_venda_id, v_estoque_id, v_item->>'nome_item',
      v_qty, v_price, v_custo
    );

    v_total := v_total + (v_qty * v_price);
    v_custo_total := v_custo_total + (v_qty * v_custo);
  END LOOP;

  UPDATE vendas_balcao SET valor_total = v_total WHERE id = v_venda_id;

  IF p_cliente_id IS NOT NULL THEN
    SELECT nome INTO v_cliente_nome FROM clientes
    WHERE id = p_cliente_id AND oficina_id = p_oficina_id;
  END IF;

  SELECT
    string_agg(linha, ', ')
  INTO v_itens_resumo
  FROM (
    SELECT
      CASE
        WHEN row_number() OVER (ORDER BY ord) <= 4
          THEN trim(to_char(qty, 'FM999990.##')) || 'x ' || nome
        WHEN row_number() OVER (ORDER BY ord) = 5
          THEN '+' || (count(*) OVER () - 4)::text || ' itens'
        ELSE NULL
      END AS linha
    FROM (
      SELECT
        (i->>'nome_item') AS nome,
        COALESCE((i->>'quantidade')::NUMERIC, 1) AS qty,
        ordinality AS ord
      FROM jsonb_array_elements(p_itens) WITH ORDINALITY AS t(i, ordinality)
    ) src
  ) labeled
  WHERE linha IS NOT NULL;

  v_hora := to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI');

  v_descricao :=
    'Venda Balcão #' || v_numero ||
    ' • ' || v_hora ||
    COALESCE(' • ' || v_cliente_nome, '') ||
    ' • ' || p_forma_pagamento ||
    COALESCE(' • ' || v_itens_resumo, '');

  INSERT INTO financeiro (
    oficina_id, tipo, origem, valor,
    data, data_pagamento, descricao,
    status, forma_pagamento_id, categoria
  ) VALUES (
    p_oficina_id, 'entrada', 'Venda Balcão',
    v_total, CURRENT_DATE, CURRENT_DATE,
    v_descricao,
    'pago', p_forma_pagamento_id, 'venda_balcao'
  ) RETURNING id INTO v_financeiro_id;

  IF v_custo_total > 0 THEN
    INSERT INTO financeiro (
      oficina_id, tipo, origem, valor,
      data, data_pagamento, descricao,
      status, categoria
    ) VALUES (
      p_oficina_id, 'saida', 'Custo Venda Balcão',
      v_custo_total, CURRENT_DATE, CURRENT_DATE,
      'Custo das peças — Venda Balcão #' || v_numero,
      'pago', 'custo_mercadoria'
    );
  END IF;

  UPDATE vendas_balcao
  SET financeiro_id = v_financeiro_id
  WHERE id = v_venda_id;

  RETURN jsonb_build_object(
    'success', true,
    'venda_id', v_venda_id,
    'numero', v_numero,
    'valor_total', v_total,
    'custo_total', v_custo_total,
    'itens', jsonb_array_length(p_itens)
  );
END;
$function$;

-- 2) Backfill histórico: lançar custo das vendas balcão antigas
INSERT INTO financeiro (
  oficina_id, tipo, origem, valor,
  data, data_pagamento, descricao,
  status, categoria
)
SELECT
  vb.oficina_id,
  'saida',
  'Custo Venda Balcão',
  SUM(i.quantidade * COALESCE(NULLIF(i.custo_unitario,0), (SELECT e.custo_unitario FROM estoque e WHERE e.id = i.estoque_id), 0)),
  COALESCE(vb.created_at::date, CURRENT_DATE),
  COALESCE(vb.created_at::date, CURRENT_DATE),
  'Custo das peças — Venda Balcão #' || vb.numero || ' (retroativo)',
  'pago',
  'custo_mercadoria'
FROM vendas_balcao vb
JOIN itens_venda_balcao i ON i.venda_id = vb.id
WHERE vb.status = 'concluida'
  AND NOT EXISTS (
    SELECT 1 FROM financeiro f
    WHERE f.oficina_id = vb.oficina_id
      AND f.tipo = 'saida'
      AND f.origem = 'Custo Venda Balcão'
      AND f.descricao LIKE '%Venda Balcão #' || vb.numero || '%'
  )
GROUP BY vb.id, vb.oficina_id, vb.numero, vb.created_at
HAVING SUM(i.quantidade * COALESCE(NULLIF(i.custo_unitario,0), (SELECT e.custo_unitario FROM estoque e WHERE e.id = i.estoque_id), 0)) > 0;