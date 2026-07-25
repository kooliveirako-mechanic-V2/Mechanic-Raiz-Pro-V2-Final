-- Migration oficial de hardening multi-tenant gerada a partir da extração pg_get_functiondef() live.
-- Target project: kurlgmngmglhvknwxjee.
-- Reproduz exatamente o estado corrente do banco (guards + grants + search_path).
-- Se executada em db reset, restaura a proteção multi-tenant completa.
BEGIN;

-- converter_orcamento_em_os
CREATE OR REPLACE FUNCTION public.converter_orcamento_em_os(p_oficina_id uuid, p_orcamento_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_orcamento orcamentos%ROWTYPE;
  v_os_id UUID;
  v_total_bruto_itens NUMERIC := 0;
  v_total_custo NUMERIC := 0;
  v_itens_count INTEGER := 0;
  v_item RECORD;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND (auth.uid() IS NULL OR NOT public.has_oficina_access(auth.uid(), p_oficina_id)) THEN
    RAISE EXCEPTION 'Acesso negado à função %', 'converter_orcamento_em_os'
      USING ERRCODE = '42501';
  END IF;

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
    valor_servico, custo_servico, desconto,
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
    COALESCE(v_orcamento.desconto, 0),
    CURRENT_DATE,
    v_orcamento.observacoes
  )
  RETURNING id INTO v_os_id;

  FOR v_item IN
    SELECT * FROM itens_orcamento
    WHERE orcamento_id = p_orcamento_id
  LOOP
    INSERT INTO itens_os (
      ordem_servico_id, nome_item, quantidade,
      valor_unitario, valor_mao_obra, custo_unitario, estoque_id
    ) VALUES (
      v_os_id, v_item.nome_item,
      COALESCE(v_item.quantidade, 1),
      COALESCE(v_item.valor_unitario, 0),
      COALESCE(v_item.valor_mao_obra, 0),
      COALESCE(v_item.custo_unitario, 0),
      v_item.estoque_id
    );

    v_total_bruto_itens := v_total_bruto_itens +
      (COALESCE(v_item.quantidade, 1) * COALESCE(v_item.valor_unitario, 0)) + COALESCE(v_item.valor_mao_obra, 0);
    v_total_custo := v_total_custo + (COALESCE(v_item.custo_unitario, 0) * COALESCE(v_item.quantidade, 1));
    v_itens_count := v_itens_count + 1;
  END LOOP;

  UPDATE ordens_servico
  SET valor_servico = v_total_bruto_itens,
      custo_servico = v_total_custo
  WHERE id = v_os_id;

  UPDATE orcamentos
  SET status = 'convertido',
      updated_at = NOW()
  WHERE id = p_orcamento_id;

  RETURN jsonb_build_object(
    'success', true,
    'os_id', v_os_id,
    'valor_bruto', v_total_bruto_itens,
    'desconto', v_orcamento.desconto,
    'valor_liquido', v_total_bruto_itens - COALESCE(v_orcamento.desconto, 0),
    'itens_copiados', v_itens_count
  );

EXCEPTION
  WHEN insufficient_privilege THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao converter orçamento: %. Nenhum dado foi salvo.', SQLERRM;
END;
$function$
;

-- criar_orcamento_completo
CREATE OR REPLACE FUNCTION public.criar_orcamento_completo(p_oficina_id uuid, p_titulo text, p_cliente_id uuid DEFAULT NULL::uuid, p_veiculo_id uuid DEFAULT NULL::uuid, p_descricao text DEFAULT NULL::text, p_validade text DEFAULT NULL::text, p_desconto numeric DEFAULT 0, p_observacoes text DEFAULT NULL::text, p_itens jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_orcamento_id UUID;
  v_numero INTEGER;
  v_item JSONB;
  v_itens JSONB;
  v_total NUMERIC := 0;
  v_custo_total NUMERIC := 0;
  v_itens_count INTEGER := 0;
  v_qty NUMERIC;
  v_unit_price NUMERIC;
  v_mao_obra NUMERIC;
  v_custo NUMERIC;
  v_item_total NUMERIC;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND (auth.uid() IS NULL OR NOT public.has_oficina_access(auth.uid(), p_oficina_id)) THEN
    RAISE EXCEPTION 'Acesso negado à função %', 'criar_orcamento_completo'
      USING ERRCODE = '42501';
  END IF;

  v_itens := COALESCE(p_itens, '[]'::jsonb);

  IF jsonb_typeof(v_itens) = 'string' THEN
    BEGIN
      v_itens := (v_itens #>> '{}')::jsonb;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Itens do orçamento inválidos. Nenhum dado foi salvo.';
    END;
  END IF;

  IF jsonb_typeof(v_itens) IS NULL OR jsonb_typeof(v_itens) = 'null' THEN
    v_itens := '[]'::jsonb;
  END IF;

  IF jsonb_typeof(v_itens) <> 'array' THEN
    RAISE EXCEPTION 'Itens do orçamento devem ser enviados como lista. Nenhum dado foi salvo.';
  END IF;

  INSERT INTO orcamentos (
    oficina_id, cliente_id, veiculo_id,
    titulo, descricao, status,
    validade, desconto, observacoes,
    valor_total, custo_total
  ) VALUES (
    p_oficina_id, p_cliente_id, p_veiculo_id,
    p_titulo, p_descricao, 'rascunho',
    CASE WHEN p_validade IS NOT NULL AND p_validade <> '' THEN p_validade::date ELSE NULL END,
    COALESCE(p_desconto, 0), p_observacoes,
    0, 0
  )
  RETURNING id, numero INTO v_orcamento_id, v_numero;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_itens)
  LOOP
    v_qty := GREATEST(COALESCE((v_item->>'quantidade')::NUMERIC, 1), 1);
    v_unit_price := COALESCE((v_item->>'valor_unitario')::NUMERIC, 0);
    v_mao_obra := COALESCE((v_item->>'valor_mao_obra')::NUMERIC, 0);
    v_custo := COALESCE((v_item->>'custo_unitario')::NUMERIC, 0);
    v_item_total := (v_qty * v_unit_price) + v_mao_obra;

    INSERT INTO itens_orcamento (
      orcamento_id, nome_item, tipo,
      quantidade, valor_unitario, valor_mao_obra,
      custo_unitario, estoque_id
    ) VALUES (
      v_orcamento_id,
      v_item->>'nome_item',
      COALESCE(v_item->>'tipo', 'produto'),
      v_qty, v_unit_price, v_mao_obra,
      v_custo,
      NULLIF(v_item->>'estoque_id', '')::UUID
    );

    v_total := v_total + v_item_total;
    v_custo_total := v_custo_total + (v_custo * v_qty);
    v_itens_count := v_itens_count + 1;
  END LOOP;

  UPDATE orcamentos
  SET valor_total = v_total,
      custo_total = v_custo_total
  WHERE id = v_orcamento_id;

  RETURN jsonb_build_object(
    'id', v_orcamento_id,
    'numero', v_numero,
    'valor_total', v_total,
    'custo_total', v_custo_total,
    'itens_inseridos', v_itens_count
  );
END;
$function$
;

-- criar_venda_balcao
CREATE OR REPLACE FUNCTION public.criar_venda_balcao(p_oficina_id uuid, p_itens jsonb, p_forma_pagamento text, p_forma_pagamento_id uuid DEFAULT NULL::uuid, p_cliente_id uuid DEFAULT NULL::uuid, p_observacao text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
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
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND p_cliente_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.clientes
       WHERE id = p_cliente_id AND oficina_id = p_oficina_id
     ) THEN
    RAISE EXCEPTION 'Cliente não pertence à oficina informada'
      USING ERRCODE = '42501';
  END IF;

  IF COALESCE(auth.role(), '') <> 'service_role'
     AND (auth.uid() IS NULL OR NOT public.has_oficina_access(auth.uid(), p_oficina_id)) THEN
    RAISE EXCEPTION 'Acesso negado à função %', 'criar_venda_balcao'
      USING ERRCODE = '42501';
  END IF;

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

    IF COALESCE(auth.role(), '') <> 'service_role'
       AND v_estoque_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.estoque
         WHERE id = v_estoque_id AND oficina_id = p_oficina_id
       ) THEN
      RAISE EXCEPTION 'Estoque não pertence à oficina informada'
        USING ERRCODE = '42501';
    END IF;


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
$function$
;

-- deletar_item_os_atomic
CREATE OR REPLACE FUNCTION public.deletar_item_os_atomic(p_item_id uuid, p_oficina_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_os_id UUID;
  v_estoque_id UUID;
  v_quantidade INTEGER;
  v_os_status TEXT;
  v_nome_item TEXT;
  v_estoque_qtd_atual INTEGER;
  v_oficina_real UUID;
BEGIN
  SELECT io.ordem_servico_id, io.estoque_id, io.quantidade, io.nome_item, os.status
  INTO v_os_id, v_estoque_id, v_quantidade, v_nome_item, v_os_status
  FROM itens_os io
  JOIN ordens_servico os ON os.id = io.ordem_servico_id
  WHERE io.id = p_item_id
  FOR UPDATE OF io;

  IF v_os_id IS NULL THEN
    RAISE EXCEPTION 'Item não encontrado';
  END IF;

  -- >>> GUARDA DE AUTORIZAÇÃO (substitui a checagem que confiava em p_oficina_id) >>>
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING ERRCODE = '42501';
  END IF;
  SELECT oficina_id INTO v_oficina_real
  FROM public.ordens_servico WHERE id = v_os_id;
  IF v_oficina_real IS NULL
     OR NOT public.has_oficina_access(auth.uid(), v_oficina_real) THEN
    RAISE EXCEPTION 'Sem permissão para esta OS' USING ERRCODE = '42501';
  END IF;
  -- <<< FIM DO GUARDA <<<

  -- Restaura estoque se OS finalizada + item vinculado a estoque
  IF v_os_status = 'finalizado' AND v_estoque_id IS NOT NULL AND v_quantidade > 0 THEN
    SELECT quantidade INTO v_estoque_qtd_atual
    FROM estoque
    WHERE id = v_estoque_id
    FOR UPDATE;

    IF v_estoque_qtd_atual IS NOT NULL THEN
      UPDATE estoque
      SET quantidade = quantidade + v_quantidade
      WHERE id = v_estoque_id;

      INSERT INTO estoque_movimentacoes (
        estoque_id, oficina_id, tipo, quantidade,
        quantidade_anterior, quantidade_nova,
        motivo, referencia_tipo, referencia_id
      ) VALUES (
        v_estoque_id, v_oficina_real, 'entrada', v_quantidade,
        v_estoque_qtd_atual, v_estoque_qtd_atual + v_quantidade,
        'Devolvido ao estoque (item removido de OS finalizada)',
        'itens_os', p_item_id
      );
    END IF;
  END IF;

  -- Habilita bypass local APENAS para este DELETE nesta transação
  PERFORM set_config('app.allow_finalized_item_delete', 'on', true);

  DELETE FROM itens_os WHERE id = p_item_id;

  -- Limpa o flag
  PERFORM set_config('app.allow_finalized_item_delete', 'off', true);

  RETURN jsonb_build_object(
    'success', true,
    'nome_item', v_nome_item,
    'estoque_restaurado', (v_os_status = 'finalizado' AND v_estoque_id IS NOT NULL)
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Erro ao deletar item: %. Nenhum dado foi alterado.', SQLERRM;
END;
$function$
;

-- finalizar_os_atomica
CREATE OR REPLACE FUNCTION public.finalizar_os_atomica(p_os_id uuid, p_forma_pagamento text DEFAULT NULL::text, p_forma_pagamento_id uuid DEFAULT NULL::uuid, p_numero_parcelas integer DEFAULT 1, p_fotos_saida text[] DEFAULT NULL::text[], p_observacoes_conclusao text DEFAULT NULL::text, p_itens_novos jsonb DEFAULT '[]'::jsonb, p_valor_mao_obra numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_os ordens_servico%ROWTYPE;
  v_valor_bruto numeric := 0;
  v_total_pecas numeric := 0;
  v_total_servicos_catalogo numeric := 0;
  v_total_mao_obra_itens numeric := 0;
  v_mao_de_obra_global numeric := 0;
  v_mao_de_obra_consolidada numeric := 0;
  v_custo_itens numeric := 0;
  v_custo_total numeric := 0;
  v_item jsonb;
  v_financeiro_result json;
  v_desconto numeric := 0;
  v_forma_normalizada text;
  v_marcar_a_receber boolean := false;
BEGIN
  SELECT * INTO v_os
  FROM public.ordens_servico
  WHERE id = p_os_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OS não encontrada: %', p_os_id;
  END IF;
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND (auth.uid() IS NULL OR NOT public.has_oficina_access(auth.uid(), v_os.oficina_id)) THEN
    RAISE EXCEPTION 'Acesso negado à função %', 'finalizar_os_atomica'
      USING ERRCODE = '42501';
  END IF;


  IF v_os.status = 'finalizado' THEN
    RAISE EXCEPTION 'OS já foi finalizada anteriormente';
  END IF;

  IF v_os.status = 'cancelado' THEN
    RAISE EXCEPTION 'OS cancelada não pode ser finalizada';
  END IF;

  -- Normaliza forma de pagamento recebida
  v_forma_normalizada := NULLIF(TRIM(LOWER(COALESCE(p_forma_pagamento, ''))), '');

  -- Sinaliza intenção explícita de "pagar depois"
  IF v_forma_normalizada IN ('a_receber', 'a receber', 'pendente', 'pagar_depois', 'pagar depois') THEN
    v_marcar_a_receber := true;
    -- Não persistimos forma_pagamento textual nesse caso para não enganar relatórios
    p_forma_pagamento := 'a_receber';
    p_forma_pagamento_id := NULL;
  END IF;

  IF p_valor_mao_obra IS NOT NULL AND p_valor_mao_obra IS DISTINCT FROM COALESCE(v_os.valor_mao_obra, 0) THEN
    UPDATE public.ordens_servico
    SET valor_mao_obra = p_valor_mao_obra
    WHERE id = p_os_id;
    v_os.valor_mao_obra := p_valor_mao_obra;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_itens_novos, '[]'::jsonb))
  LOOP
    DECLARE
      v_qty numeric := COALESCE((v_item->>'quantidade')::numeric, 1);
      v_unit_price numeric := COALESCE((v_item->>'valor_unitario')::numeric, 0);
      v_labor numeric := COALESCE((v_item->>'valor_mao_obra')::numeric, 0);
      v_cost numeric := COALESCE((v_item->>'custo_unitario')::numeric, 0);
      v_estoque_id uuid := NULLIF(v_item->>'estoque_id', '')::uuid;
      v_tipo_item text;
    BEGIN
      v_tipo_item := CASE
        WHEN v_item->>'tipo' IN ('servico', 'produto') THEN v_item->>'tipo'
        WHEN v_estoque_id IS NOT NULL THEN 'produto'
        ELSE 'servico'
      END;

      INSERT INTO public.itens_os (
        ordem_servico_id, nome_item, tipo, quantidade,
        valor_unitario, valor_mao_obra, custo_unitario,
        estoque_id
      ) VALUES (
        p_os_id, v_item->>'nome_item', v_tipo_item, v_qty,
        v_unit_price, v_labor, v_cost,
        v_estoque_id
      );
    END;
  END LOOP;

  SELECT
    COALESCE(SUM(CASE WHEN ios.tipo = 'produto' OR ios.estoque_id IS NOT NULL
      THEN COALESCE(ios.quantidade, 1) * COALESCE(ios.valor_unitario, 0)
      ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN ios.tipo = 'servico' AND ios.estoque_id IS NULL
      THEN COALESCE(ios.quantidade, 1) * COALESCE(ios.valor_unitario, 0)
      ELSE 0 END), 0),
    COALESCE(SUM(COALESCE(ios.valor_mao_obra, 0)), 0),
    COALESCE(SUM(
      COALESCE(ios.quantidade, 1) * COALESCE(NULLIF(ios.custo_unitario, 0), e.custo_unitario, 0)
    ), 0)
  INTO v_total_pecas, v_total_servicos_catalogo, v_total_mao_obra_itens, v_custo_itens
  FROM public.itens_os ios
  LEFT JOIN public.estoque e ON e.id = ios.estoque_id
  WHERE ios.ordem_servico_id = p_os_id;

  v_mao_de_obra_global := COALESCE(v_os.valor_mao_obra, 0);
  v_desconto := COALESCE(v_os.desconto, 0);
  v_mao_de_obra_consolidada := v_total_servicos_catalogo + GREATEST(v_mao_de_obra_global, v_total_mao_obra_itens);
  v_valor_bruto := v_total_pecas + v_mao_de_obra_consolidada;
  v_custo_total := GREATEST(COALESCE(v_os.custo_servico, 0), v_custo_itens);

  -- GUARDA: OS com valor > 0 precisa de forma_pagamento real OU marcação explícita a_receber.
  -- Não bloqueia OS de valor zero (cortesia, ajuste, etc).
  IF (v_valor_bruto - v_desconto) > 0
     AND p_forma_pagamento_id IS NULL
     AND v_marcar_a_receber = false
     AND v_forma_normalizada IS NULL THEN
    RAISE EXCEPTION 'Informe como o cliente pagou ou marque para pagar depois antes de finalizar a OS.'
      USING ERRCODE = 'P0001', HINT = 'pagamento_obrigatorio';
  END IF;

  UPDATE public.ordens_servico SET
    status = 'finalizado',
    forma_pagamento = COALESCE(p_forma_pagamento, v_os.forma_pagamento),
    data_conclusao = CURRENT_DATE,
    valor_servico = v_valor_bruto,
    custo_servico = v_custo_total,
    observacoes_conclusao = COALESCE(p_observacoes_conclusao, v_os.observacoes_conclusao),
    fotos_saida = CASE WHEN COALESCE(array_length(p_fotos_saida, 1), 0) > 0 THEN p_fotos_saida ELSE v_os.fotos_saida END
  WHERE id = p_os_id;

  IF (v_valor_bruto - v_desconto) > 0 THEN
    -- upsert_financeiro_os já trata p_forma_pagamento_id NULL como status 'a_receber'
    v_financeiro_result := public.upsert_financeiro_os(
      v_os.oficina_id,
      p_os_id,
      v_os.tipo_servico,
      v_mao_de_obra_consolidada,
      p_forma_pagamento_id,
      'Serviço ' || v_os.tipo_servico,
      p_numero_parcelas
    );

    IF COALESCE((v_financeiro_result->>'success')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'Falha ao registrar financeiro da OS: %', COALESCE(v_financeiro_result->>'error', 'erro desconhecido');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'os_id', p_os_id,
    'valor_bruto', v_valor_bruto,
    'valor_liquido', v_valor_bruto - v_desconto,
    'valor_total', v_valor_bruto,
    'status', 'finalizado',
    'a_receber', v_marcar_a_receber
  );
END;
$function$
;

-- gerar_parcelas_atomic
CREATE OR REPLACE FUNCTION public.gerar_parcelas_atomic(p_oficina_id uuid, p_ordem_servico_id uuid DEFAULT NULL::uuid, p_orcamento_id uuid DEFAULT NULL::uuid, p_valor_total numeric DEFAULT 0, p_numero_parcelas integer DEFAULT 1, p_data_primeira_parcela date DEFAULT CURRENT_DATE, p_intervalo_dias integer DEFAULT 30, p_forma_pagamento_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_valor_parcela NUMERIC;
  v_valor_ultima NUMERIC;
  v_soma NUMERIC := 0;
  i INTEGER;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND (auth.uid() IS NULL OR NOT public.has_oficina_access(auth.uid(), p_oficina_id)) THEN
    RAISE EXCEPTION 'Acesso negado à função %', 'gerar_parcelas_atomic'
      USING ERRCODE = '42501';
  END IF;

  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    IF p_ordem_servico_id IS NULL AND p_orcamento_id IS NULL THEN
      RAISE EXCEPTION 'Origem financeira obrigatória'
        USING ERRCODE = '42501';
    END IF;

    IF p_ordem_servico_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.ordens_servico
         WHERE id = p_ordem_servico_id AND oficina_id = p_oficina_id
       ) THEN
      RAISE EXCEPTION 'OS não pertence à oficina informada'
        USING ERRCODE = '42501';
    END IF;

    IF p_orcamento_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.orcamentos
         WHERE id = p_orcamento_id AND oficina_id = p_oficina_id
       ) THEN
      RAISE EXCEPTION 'Orçamento não pertence à oficina informada'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_numero_parcelas < 1 OR p_numero_parcelas > 24 THEN
    RAISE EXCEPTION 'Número de parcelas deve ser entre 1 e 24';
  END IF;

  IF p_valor_total <= 0 THEN
    RAISE EXCEPTION 'Valor total deve ser maior que zero';
  END IF;

  IF p_ordem_servico_id IS NOT NULL THEN
    DELETE FROM parcelas_pagamento
    WHERE ordem_servico_id = p_ordem_servico_id
    AND status IN ('pendente');
  END IF;

  IF p_orcamento_id IS NOT NULL THEN
    DELETE FROM parcelas_pagamento
    WHERE orcamento_id = p_orcamento_id
    AND status IN ('pendente');
  END IF;

  v_valor_parcela := ROUND(p_valor_total / p_numero_parcelas, 2);

  FOR i IN 1..p_numero_parcelas LOOP
    IF i = p_numero_parcelas THEN
      v_valor_ultima := ROUND(p_valor_total - v_soma, 2);
    ELSE
      v_valor_ultima := v_valor_parcela;
    END IF;

    INSERT INTO parcelas_pagamento (
      oficina_id, ordem_servico_id, orcamento_id,
      numero_parcela, total_parcelas, valor,
      data_vencimento, forma_pagamento_id, status
    ) VALUES (
      p_oficina_id, p_ordem_servico_id, p_orcamento_id,
      i, p_numero_parcelas, v_valor_ultima,
      p_data_primeira_parcela + ((i - 1) * p_intervalo_dias),
      p_forma_pagamento_id, 'pendente'
    );

    v_soma := v_soma + v_valor_ultima;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'parcelas_geradas', p_numero_parcelas,
    'valor_total', v_soma
  );

EXCEPTION
  WHEN insufficient_privilege THEN RAISE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao gerar parcelas: %. Nenhum dado foi salvo.', SQLERRM;
END;
$function$
;

-- get_financeiro_resumo
CREATE OR REPLACE FUNCTION public.get_financeiro_resumo(p_oficina_id uuid, p_meses_historico integer DEFAULT 6)
 RETURNS json
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_inicio_range date;
  v_fim_range date;
  v_inicio_mes_atual date;
  v_fim_mes_atual date;
  v_inicio_mes_anterior date;
  v_fim_mes_anterior date;
BEGIN
  -- Calcular ranges
  v_fim_range := (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::date;
  v_inicio_range := (date_trunc('month', CURRENT_DATE) - (p_meses_historico - 1) * interval '1 month')::date;
  v_inicio_mes_atual := date_trunc('month', CURRENT_DATE)::date;
  v_fim_mes_atual := v_fim_range;
  v_inicio_mes_anterior := (date_trunc('month', CURRENT_DATE) - interval '1 month')::date;
  v_fim_mes_anterior := (date_trunc('month', CURRENT_DATE) - interval '1 day')::date;

  RETURN (
    SELECT json_build_object(
      'registros', (
        SELECT COALESCE(json_agg(f.*), '[]'::json)
        FROM (
          SELECT id, tipo, origem, ordem_servico_id, valor, data, descricao, created_at, status,
                 categoria_id, forma_pagamento_id, fornecedor_id, centro_custo_id, classificacao,
                 numero_documento, data_competencia, data_pagamento, recorrente, recorrencia_tipo,
                 observacoes_contador, comprovante_url, oficina_id, valor_mao_obra, valor_pecas
          FROM financeiro
          WHERE oficina_id = p_oficina_id
            AND data >= v_inicio_mes_anterior
            AND data <= v_fim_mes_atual
          ORDER BY data DESC
        ) f
      ),
      'mes_atual', (
        WITH totais_custo_os AS (
          -- Soma única do custo por OS finalizada no mês
          SELECT SUM(COALESCE(custo_servico, 0)) as total_custo
          FROM ordens_servico
          WHERE oficina_id = p_oficina_id
            AND status = 'finalizado'
            AND data_servico >= v_inicio_mes_atual
            AND data_servico <= v_fim_mes_atual
        )
        SELECT json_build_object(
          'entradas', COALESCE(SUM(CASE WHEN f.tipo = 'entrada' THEN f.valor ELSE 0 END), 0),
          'saidas', COALESCE(SUM(CASE WHEN f.tipo = 'saida' THEN f.valor ELSE 0 END), 0),
          'lucro', COALESCE(SUM(CASE WHEN f.tipo = 'entrada' THEN f.valor ELSE 0 END), 0) -
                   COALESCE(SUM(CASE WHEN f.tipo = 'saida' THEN f.valor ELSE 0 END), 0) -
                   COALESCE((SELECT total_custo FROM totais_custo_os), 0)
        )
        FROM financeiro f
        WHERE f.oficina_id = p_oficina_id
          AND f.data >= v_inicio_mes_atual
          AND f.data <= v_fim_mes_atual
      ),
      'mes_anterior', (
        WITH totais_custo_os AS (
          SELECT SUM(COALESCE(custo_servico, 0)) as total_custo
          FROM ordens_servico
          WHERE oficina_id = p_oficina_id
            AND status = 'finalizado'
            AND data_servico >= v_inicio_mes_anterior
            AND data_servico <= v_fim_mes_anterior
        )
        SELECT json_build_object(
          'entradas', COALESCE(SUM(CASE WHEN f.tipo = 'entrada' THEN f.valor ELSE 0 END), 0),
          'saidas', COALESCE(SUM(CASE WHEN f.tipo = 'saida' THEN f.valor ELSE 0 END), 0),
          'lucro', COALESCE(SUM(CASE WHEN f.tipo = 'entrada' THEN f.valor ELSE 0 END), 0) -
                   COALESCE(SUM(CASE WHEN f.tipo = 'saida' THEN f.valor ELSE 0 END), 0) -
                   COALESCE((SELECT total_custo FROM totais_custo_os), 0)
        )
        FROM financeiro f
        WHERE f.oficina_id = p_oficina_id
          AND f.data >= v_inicio_mes_anterior
          AND f.data <= v_fim_mes_anterior
      ),
      'mensal', (
        SELECT COALESCE(json_agg(m_data), '[]'::json)
        FROM (
          SELECT
            to_char(gs, 'YYYY-MM') as mes,
            COALESCE((SELECT SUM(valor) FROM financeiro WHERE oficina_id = p_oficina_id AND tipo = 'entrada' AND date_trunc('month', data) = date_trunc('month', gs)), 0) as entradas,
            COALESCE((SELECT SUM(valor) FROM financeiro WHERE oficina_id = p_oficina_id AND tipo = 'saida' AND date_trunc('month', data) = date_trunc('month', gs)), 0) as saidas,
            COALESCE((SELECT SUM(valor) FROM financeiro WHERE oficina_id = p_oficina_id AND tipo = 'entrada' AND date_trunc('month', data) = date_trunc('month', gs)), 0) -
            COALESCE((SELECT SUM(valor) FROM financeiro WHERE oficina_id = p_oficina_id AND tipo = 'saida' AND date_trunc('month', data) = date_trunc('month', gs)), 0) -
            COALESCE((SELECT SUM(custo_servico) FROM ordens_servico WHERE oficina_id = p_oficina_id AND status = 'finalizado' AND date_trunc('month', data_servico) = date_trunc('month', gs)), 0) as lucro
          FROM generate_series(v_inicio_range, v_fim_range, interval '1 month') gs
          ORDER BY gs
        ) m_data
      )
    )
  );
END;
$function$
;

-- get_financeiro_v2
CREATE OR REPLACE FUNCTION public.get_financeiro_v2(p_oficina_id uuid, p_data_inicio date, p_data_fim date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_resultado JSONB;
    v_oficina_nome TEXT;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND (auth.uid() IS NULL OR NOT public.has_oficina_access(auth.uid(), p_oficina_id)) THEN
    RAISE EXCEPTION 'Acesso negado à função %', 'get_financeiro_v2'
      USING ERRCODE = '42501';
  END IF;

    SELECT nome INTO v_oficina_nome FROM oficinas WHERE id = p_oficina_id;

    WITH registros_os AS (
        SELECT
            os.id,
            os.numero,
            os.status,
            COALESCE(os.valor_servico, 0) as valor_servico,
            COALESCE(os.desconto, 0) as desconto,
            COALESCE((SELECT SUM(COALESCE(it.custo_unitario, 0) * it.quantidade) FROM itens_os it WHERE it.ordem_servico_id = os.id), 0) as cmv_calc,
            os.data_conclusao,
            COALESCE((SELECT SUM(f.valor) FROM financeiro f WHERE f.ordem_servico_id = os.id AND f.status::text = 'pago' AND f.tipo = 'entrada'), 0) as recebido_vinculado
        FROM ordens_servico os
        WHERE os.oficina_id = p_oficina_id AND os.status = 'finalizado'
          AND os.data_conclusao::DATE BETWEEN p_data_inicio AND p_data_fim
    ),
    registros_vendas AS (
        SELECT
            v.id,
            v.numero,
            v.status,
            COALESCE(v.valor_total, 0) as valor_bruto,
            COALESCE((SELECT SUM(COALESCE(it.custo_unitario, 0) * it.quantidade) FROM itens_venda_balcao it WHERE it.venda_id = v.id), 0) as cmv_calc,
            v.created_at,
            COALESCE((SELECT SUM(f.valor) FROM financeiro f WHERE f.venda_balcao_id = v.id AND f.status::text = 'pago' AND f.tipo = 'entrada'), 0) as recebido_vinculado
        FROM vendas_balcao v
        WHERE v.oficina_id = p_oficina_id AND v.status IN ('concluida', 'finalizada')
          AND v.created_at::DATE BETWEEN p_data_inicio AND p_data_fim
    ),
    registros_financeiro_raw AS (
        SELECT
            id,
            descricao,
            tipo,
            status::text as status_txt,
            valor,
            COALESCE(data_pagamento, data) as data_referencia,
            ordem_servico_id,
            venda_balcao_id,
            origem
        FROM financeiro
        WHERE oficina_id = p_oficina_id
          AND COALESCE(data_pagamento, data)::DATE BETWEEN p_data_inicio AND p_data_fim
    ),
    caixa_sum AS (
        SELECT
            COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END), 0) as entradas,
            COALESCE(SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END), 0) as saídas
        FROM registros_financeiro_raw
        WHERE status_txt = 'pago'
    ),
    os_totals AS (
        SELECT
            -- CORREÇÃO OFICIAL: Usar apenas valor_servico consolidado da OS - desconto.
            SUM(valor_servico - desconto) as liq,
            SUM(recebido_vinculado) as vinc,
            SUM(cmv_calc) as cmv,
            COUNT(*) as qtd
        FROM registros_os
    ),
    venda_totals AS (
        SELECT
            SUM(valor_bruto) as liq,
            SUM(recebido_vinculado) as vinc,
            SUM(cmv_calc) as cmv,
            COUNT(*) as qtd
        FROM registros_vendas
    )
    SELECT jsonb_build_object(
        'periodo', jsonb_build_object('inicio', p_data_inicio, 'fim', p_data_fim),
        'oficina', jsonb_build_object('id', p_oficina_id, 'nome', v_oficina_nome),
        'competencia', jsonb_build_object(
            'faturamento_liquido', COALESCE((SELECT liq FROM os_totals), 0) + COALESCE((SELECT liq FROM venda_totals), 0),
            'recebido_vinculado_competencia', COALESCE((SELECT vinc FROM os_totals), 0) + COALESCE((SELECT vinc FROM venda_totals), 0),
            'saldo_a_receber_competencia', (COALESCE((SELECT liq FROM os_totals), 0) + COALESCE((SELECT liq FROM venda_totals), 0)) - (COALESCE((SELECT vinc FROM os_totals), 0) + COALESCE((SELECT vinc FROM venda_totals), 0))
        ),
        'custos', jsonb_build_object(
            'cmv_total', COALESCE((SELECT cmv FROM os_totals), 0) + COALESCE((SELECT cmv FROM venda_totals), 0)
        ),
        'resultado', jsonb_build_object(
            'lucro_operacional', (COALESCE((SELECT liq FROM os_totals), 0) + COALESCE((SELECT liq FROM venda_totals), 0)) - (COALESCE((SELECT cmv FROM os_totals), 0) + COALESCE((SELECT cmv FROM venda_totals), 0))
        ),
        'caixa', jsonb_build_object(
            'entradas_pagas_no_periodo', (SELECT entradas FROM caixa_sum),
            'saidas_pagas_no_periodo', (SELECT saídas FROM caixa_sum),
            'saldo_caixa_periodo', (SELECT entradas - saídas FROM caixa_sum)
        ),
        'contadores', jsonb_build_object(
            'servicos_finalizados', COALESCE((SELECT qtd FROM os_totals), 0),
            'vendas_balcao', COALESCE((SELECT qtd FROM venda_totals), 0)
        ),
        'auditoria', jsonb_build_object(
            'avisos', ARRAY['V2 Contrato Alinhado']
        )
    ) INTO v_resultado;

    RETURN v_resultado;
END;
$function$
;

-- get_financeiro_v2_preview_limpeza
CREATE OR REPLACE FUNCTION public.get_financeiro_v2_preview_limpeza(p_oficina_id uuid, p_data_inicio date, p_data_fim date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_resultado JSONB;
    v_oficina_nome TEXT;
    v_ids_os_teste UUID[] := ARRAY[
        'afc9088f-a05e-48c7-875b-185d373bbd1d',
        '40dff110-b259-4e3b-b8f5-319acd7934b2',
        'bc2bf6c9-7856-425f-aaae-00d5fe78c857',
        'a178eb4b-385d-49e3-a1cc-2e3da1a6cc4d'
    ];
    v_ids_vendas_teste UUID[] := ARRAY[
        '75fbd0e2-b530-4390-9d74-d7ab08b3616f'
    ];
    v_ids_financeiro_teste UUID[] := ARRAY[
        'fdbaa996-b3ea-4ba5-99dc-7603eb35fe57',
        'f4e359a6-b196-442f-af5d-c359418459d6',
        'f4a7f8f2-e329-4b4e-8ced-7bc341291f00',
        '2cd61a66-a8db-48f5-99ed-e1e9478fc0f3',
        '6d4be852-9d43-458e-a9ce-5af720e8e5d1'
    ];
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND (auth.uid() IS NULL OR NOT public.has_oficina_access(auth.uid(), p_oficina_id)) THEN
    RAISE EXCEPTION 'Acesso negado à função %', 'get_financeiro_v2_preview_limpeza'
      USING ERRCODE = '42501';
  END IF;

    SELECT nome INTO v_oficina_nome FROM oficinas WHERE id = p_oficina_id;

    WITH registros_os AS (
        SELECT
            os.id,
            os.numero,
            os.status,
            COALESCE(os.valor_servico, 0) as valor_servico,
            COALESCE(os.desconto, 0) as desconto,
            COALESCE((SELECT SUM(COALESCE(it.custo_unitario, 0) * it.quantidade) FROM itens_os it WHERE it.ordem_servico_id = os.id), 0) as cmv_calc,
            os.data_conclusao,
            COALESCE((SELECT SUM(f.valor) FROM financeiro f WHERE f.ordem_servico_id = os.id AND f.status::text = 'pago' AND f.tipo = 'entrada' AND NOT (f.id = ANY(v_ids_financeiro_teste))), 0) as recebido_vinculado
        FROM ordens_servico os
        WHERE os.oficina_id = p_oficina_id AND os.status = 'finalizado'
          AND os.data_conclusao::DATE BETWEEN p_data_inicio AND p_data_fim
          AND NOT (os.id = ANY(v_ids_os_teste))
    ),
    registros_vendas AS (
        SELECT
            v.id,
            v.numero,
            v.status,
            COALESCE(v.valor_total, 0) as valor_bruto,
            COALESCE((SELECT SUM(COALESCE(it.custo_unitario, 0) * it.quantidade) FROM itens_venda_balcao it WHERE it.venda_id = v.id), 0) as cmv_calc,
            v.created_at,
            COALESCE((SELECT SUM(f.valor) FROM financeiro f WHERE f.venda_balcao_id = v.id AND f.status::text = 'pago' AND f.tipo = 'entrada' AND NOT (f.id = ANY(v_ids_financeiro_teste))), 0) as recebido_vinculado
        FROM vendas_balcao v
        WHERE v.oficina_id = p_oficina_id AND v.status IN ('concluida', 'finalizada')
          AND v.created_at::DATE BETWEEN p_data_inicio AND p_data_fim
          AND NOT (v.id = ANY(v_ids_vendas_teste))
    ),
    registros_financeiro_raw AS (
        SELECT
            id,
            descricao,
            tipo,
            status::text as status_txt,
            valor,
            COALESCE(data_pagamento, data) as data_referencia,
            ordem_servico_id,
            venda_balcao_id,
            origem
        FROM financeiro
        WHERE oficina_id = p_oficina_id
          AND COALESCE(data_pagamento, data)::DATE BETWEEN p_data_inicio AND p_data_fim
          AND NOT (id = ANY(v_ids_financeiro_teste))
    ),
    caixa_sum AS (
        SELECT
            COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END), 0) as entradas,
            COALESCE(SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END), 0) as saídas
        FROM registros_financeiro_raw
        WHERE status_txt = 'pago'
    ),
    os_totals AS (
        SELECT
            -- CORREÇÃO: Usar apenas valor_servico consolidado da OS - desconto.
            SUM(valor_servico - desconto) as liq,
            SUM(recebido_vinculado) as vinc,
            SUM(cmv_calc) as cmv,
            COUNT(*) as qtd
        FROM registros_os
    ),
    venda_totals AS (
        SELECT
            SUM(valor_bruto) as liq,
            SUM(recebido_vinculado) as vinc,
            SUM(cmv_calc) as cmv,
            COUNT(*) as qtd
        FROM registros_vendas
    ),
    auditoria_ignorados AS (
        -- OS ignoradas
        SELECT
            'OS' as tipo,
            os.numero::int,
            os.id,
            (os.valor_servico - COALESCE(os.desconto, 0))::numeric as valor_liquido,
            (SELECT COALESCE(SUM(it.custo_unitario * it.quantidade), 0) FROM itens_os it WHERE it.ordem_servico_id = os.id)::numeric as cmv,
            ((os.valor_servico - COALESCE(os.desconto, 0)) - (SELECT COALESCE(SUM(it.custo_unitario * it.quantidade), 0) FROM itens_os it WHERE it.ordem_servico_id = os.id))::numeric as lucro,
            EXISTS(SELECT 1 FROM financeiro f WHERE f.ordem_servico_id = os.id AND f.status::text = 'pago') as pago,
            COALESCE((SELECT SUM(f.valor) FROM financeiro f WHERE f.ordem_servico_id = os.id AND f.status::text = 'pago' AND f.id = ANY(v_ids_financeiro_teste)), 0)::numeric as caixa_ignorado,
            ((os.valor_servico - COALESCE(os.desconto, 0)) - COALESCE((SELECT SUM(f.valor) FROM financeiro f WHERE f.ordem_servico_id = os.id AND f.status::text = 'pago' AND f.id = ANY(v_ids_financeiro_teste)), 0))::numeric as saldo_a_receber_ignorado,
            'teste manifesto' as motivo
        FROM ordens_servico os WHERE os.id = ANY(v_ids_os_teste)
        UNION ALL
        -- Vendas ignoradas
        SELECT
            'Venda' as tipo,
            v.numero::int,
            v.id,
            v.valor_total::numeric as valor_liquido,
            (SELECT COALESCE(SUM(it.custo_unitario * it.quantidade), 0) FROM itens_venda_balcao it WHERE it.venda_id = v.id)::numeric as cmv,
            (v.valor_total - (SELECT COALESCE(SUM(it.custo_unitario * it.quantidade), 0) FROM itens_venda_balcao it WHERE it.venda_id = v.id))::numeric as lucro,
            EXISTS(SELECT 1 FROM financeiro f WHERE f.venda_balcao_id = v.id AND f.status::text = 'pago') as pago,
            COALESCE((SELECT SUM(f.valor) FROM financeiro f WHERE f.venda_balcao_id = v.id AND f.status::text = 'pago' AND f.id = ANY(v_ids_financeiro_teste)), 0)::numeric as caixa_ignorado,
            (v.valor_total - COALESCE((SELECT SUM(f.valor) FROM financeiro f WHERE f.venda_balcao_id = v.id AND f.status::text = 'pago' AND f.id = ANY(v_ids_financeiro_teste)), 0))::numeric as saldo_a_receber_ignorado,
            'teste manifesto' as motivo
        FROM vendas_balcao v WHERE v.id = ANY(v_ids_vendas_teste)
    )
    SELECT jsonb_build_object(
        'modo', 'preview_limpeza_logica',
        'dados_alterados', false,
        'periodo', jsonb_build_object('inicio', p_data_inicio, 'fim', p_data_fim),
        'oficina', jsonb_build_object('id', p_oficina_id, 'nome', v_oficina_nome),
        'competencia', jsonb_build_object(
            'faturamento_liquido', (COALESCE((SELECT liq FROM os_totals), 0) + COALESCE((SELECT liq FROM venda_totals), 0))::numeric,
            'recebido_vinculado_competencia', (COALESCE((SELECT vinc FROM os_totals), 0) + COALESCE((SELECT vinc FROM venda_totals), 0))::numeric,
            'saldo_a_receber_competencia', ((COALESCE((SELECT liq FROM os_totals), 0) + COALESCE((SELECT liq FROM venda_totals), 0)) - (COALESCE((SELECT vinc FROM os_totals), 0) + COALESCE((SELECT vinc FROM venda_totals), 0)))::numeric
        ),
        'custos', jsonb_build_object(
            'cmv_total', (COALESCE((SELECT cmv FROM os_totals), 0) + COALESCE((SELECT cmv FROM venda_totals), 0))::numeric
        ),
        'resultado', jsonb_build_object(
            'lucro_operacional', ((COALESCE((SELECT liq FROM os_totals), 0) + COALESCE((SELECT liq FROM venda_totals), 0)) - (COALESCE((SELECT cmv FROM os_totals), 0) + COALESCE((SELECT cmv FROM venda_totals), 0)))::numeric
        ),
        'caixa', jsonb_build_object(
            'entradas_pagas_no_periodo', (SELECT entradas FROM caixa_sum)::numeric,
            'saidas_pagas_no_periodo', (SELECT saídas FROM caixa_sum)::numeric,
            'saldo_caixa_periodo', (SELECT entradas - saídas FROM caixa_sum)::numeric
        ),
        'contadores', jsonb_build_object(
            'servicos_finalizados', (COALESCE((SELECT qtd FROM os_totals), 0))::int,
            'vendas_balcao', (COALESCE((SELECT qtd FROM venda_totals), 0))::int
        ),
        'auditoria', jsonb_build_object(
            'registros_ignorados_por_manifesto', (SELECT jsonb_agg(to_jsonb(t) ORDER BY t.tipo DESC, t.numero) FROM auditoria_ignorados t),
            'avisos', ARRAY['Estoque não ajustado fisicamente. Venda #36 não possui movimentação rastreável. Ajuste físico bloqueado até prova objetiva.']
        )
    ) INTO v_resultado;

    RETURN v_resultado;
END;
$function$
;

-- get_financeiro_v2_series
CREATE OR REPLACE FUNCTION public.get_financeiro_v2_series(p_oficina_id uuid, p_data_inicio date, p_data_fim date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_resultado JSONB;
    v_oficina_nome TEXT;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND (auth.uid() IS NULL OR NOT public.has_oficina_access(auth.uid(), p_oficina_id)) THEN
    RAISE EXCEPTION 'Acesso negado à função %', 'get_financeiro_v2_series'
      USING ERRCODE = '42501';
  END IF;

    SELECT nome INTO v_oficina_nome FROM oficinas WHERE id = p_oficina_id;

    WITH meses AS (
        SELECT
            date_trunc('month', d)::date as mes_inicio,
            (date_trunc('month', d) + interval '1 month' - interval '1 day')::date as mes_fim,
            to_char(d, 'YYYY-MM') as mes_rotulo
        FROM generate_series(
            date_trunc('month', p_data_inicio),
            date_trunc('month', p_data_fim),
            '1 month'::interval
        ) d
    ),
    registros_os AS (
        SELECT
            os.id,
            os.data_conclusao as data_ref,
            (os.valor_servico + (SELECT COALESCE(SUM(it.valor_total), 0) FROM itens_os it WHERE it.ordem_servico_id = os.id) - COALESCE(os.desconto, 0)) as liq,
            (SELECT COALESCE(SUM(it.custo_unitario * it.quantidade), 0) FROM itens_os it WHERE it.ordem_servico_id = os.id) as cmv,
            COALESCE((SELECT SUM(f.valor) FROM financeiro f WHERE f.ordem_servico_id = os.id AND f.status::text = 'pago' AND f.tipo = 'entrada'), 0) as recebido_vinculado
        FROM ordens_servico os
        WHERE os.oficina_id = p_oficina_id AND os.status = 'finalizado'
          AND os.data_conclusao::DATE BETWEEN p_data_inicio AND p_data_fim
    ),
    registros_vendas AS (
        SELECT
            v.id,
            v.created_at::date as data_ref,
            v.valor_total as liq,
            (SELECT COALESCE(SUM(it.custo_unitario * it.quantidade), 0) FROM itens_venda_balcao it WHERE it.venda_id = v.id) as cmv,
            COALESCE((SELECT SUM(f.valor) FROM financeiro f WHERE f.venda_balcao_id = v.id AND f.status::text = 'pago' AND f.tipo = 'entrada'), 0) as recebido_vinculado
        FROM vendas_balcao v
        WHERE v.oficina_id = p_oficina_id AND v.status IN ('concluida', 'finalizada')
          AND v.created_at::DATE BETWEEN p_data_inicio AND p_data_fim
    ),
    registros_caixa AS (
        SELECT
            COALESCE(data_pagamento, data) as data_ref,
            valor,
            tipo
        FROM financeiro
        WHERE oficina_id = p_oficina_id AND status::text = 'pago'
          AND COALESCE(data_pagamento, data)::DATE BETWEEN p_data_inicio AND p_data_fim
    ),
    metricas_mensais AS (
        SELECT
            m.mes_rotulo,
            m.mes_inicio,
            m.mes_fim,
            COALESCE((SELECT SUM(liq) FROM registros_os WHERE data_ref BETWEEN m.mes_inicio AND m.mes_fim), 0) +
            COALESCE((SELECT SUM(liq) FROM registros_vendas WHERE data_ref BETWEEN m.mes_inicio AND m.mes_fim), 0) as faturamento_liq,
            COALESCE((SELECT SUM(recebido_vinculado) FROM registros_os WHERE data_ref BETWEEN m.mes_inicio AND m.mes_fim), 0) +
            COALESCE((SELECT SUM(recebido_vinculado) FROM registros_vendas WHERE data_ref BETWEEN m.mes_inicio AND m.mes_fim), 0) as recebido_vinc,
            COALESCE((SELECT SUM(cmv) FROM registros_os WHERE data_ref BETWEEN m.mes_inicio AND m.mes_fim), 0) +
            COALESCE((SELECT SUM(cmv) FROM registros_vendas WHERE data_ref BETWEEN m.mes_inicio AND m.mes_fim), 0) as cmv_tot,
            COALESCE((SELECT SUM(valor) FROM registros_caixa WHERE tipo = 'entrada' AND data_ref BETWEEN m.mes_inicio AND m.mes_fim), 0) as entradas_caixa,
            COALESCE((SELECT SUM(valor) FROM registros_caixa WHERE tipo = 'saida' AND data_ref BETWEEN m.mes_inicio AND m.mes_fim), 0) as saidas_caixa,
            COALESCE((SELECT COUNT(*) FROM registros_os WHERE data_ref BETWEEN m.mes_inicio AND m.mes_fim), 0) as os_qtd,
            COALESCE((SELECT COUNT(*) FROM registros_vendas WHERE data_ref BETWEEN m.mes_inicio AND m.mes_fim), 0) as vendas_qtd
        FROM meses m
    )
    SELECT jsonb_build_object(
        'periodo', jsonb_build_object('inicio', p_data_inicio, 'fim', p_data_fim),
        'oficina', jsonb_build_object('id', p_oficina_id, 'nome', v_oficina_nome),
        'series', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'mes', mes_rotulo,
                'competencia', jsonb_build_object(
                    'faturamento_liquido', faturamento_liq,
                    'recebido_vinculado_competencia', recebido_vinc,
                    'saldo_a_receber_competencia', faturamento_liq - recebido_vinc
                ),
                'custos', jsonb_build_object('cmv_total', cmv_tot),
                'resultado', jsonb_build_object('lucro_operacional', faturamento_liq - cmv_tot),
                'caixa', jsonb_build_object(
                    'entradas_pagas_no_periodo', entradas_caixa,
                    'saidas_pagas_no_periodo', saidas_caixa,
                    'saldo_caixa_periodo', entradas_caixa - saidas_caixa
                ),
                'contadores', jsonb_build_object(
                    'servicos_finalizados', os_qtd,
                    'vendas_balcao', vendas_qtd
                )
            ) ORDER BY mes_rotulo)
            FROM metricas_mensais
        ), '[]'::jsonb)
    ) INTO v_resultado;

    RETURN v_resultado;
END;
$function$
;

-- get_pre_fiscal_unificado
CREATE OR REPLACE FUNCTION public.get_pre_fiscal_unificado(p_oficina_id uuid, p_inicio date, p_fim date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_metrics JSONB;
    v_result JSONB;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND (auth.uid() IS NULL OR NOT public.has_oficina_access(auth.uid(), p_oficina_id)) THEN
    RAISE EXCEPTION 'Acesso negado à função %', 'get_pre_fiscal_unificado'
      USING ERRCODE = '42501';
  END IF;

    v_metrics := get_metrics_financeiras_unificadas(p_oficina_id, p_inicio, p_fim);
    IF v_metrics->>'error' IS NOT NULL THEN
        RETURN v_metrics;
    END IF;

    v_result := jsonb_build_object(
        'periodo', jsonb_build_object('inicio', p_inicio, 'fim', p_fim),
        'oficina', (SELECT jsonb_build_object('id', id, 'nome', nome) FROM oficinas WHERE id = p_oficina_id),
        'competencia', jsonb_build_object(
            'faturamentoBruto', (v_metrics->'faturamento'->>'bruto')::NUMERIC,
            'descontos', (v_metrics->'faturamento'->>'descontos')::NUMERIC,
            'faturamentoLiquido', (v_metrics->'faturamento'->>'liquido')::NUMERIC,
            'osFinalizadas', (SELECT COUNT(*) FROM ordens_servico WHERE oficina_id = p_oficina_id AND status = 'finalizado' AND COALESCE(data_conclusao, data_servico)::date BETWEEN p_inicio AND p_fim),
            'vendasBalcaoConcluidas', (SELECT COUNT(*) FROM vendas_balcao WHERE oficina_id = p_oficina_id AND status = 'concluida' AND created_at::date BETWEEN p_inicio AND p_fim),
            'pecasBruto', (v_metrics->'categorias'->'pecas'->>'bruto')::NUMERIC,
            'servicosBruto', (v_metrics->'categorias'->'servicos'->>'bruto')::NUMERIC,
            'vendaBalcaoBruto', (v_metrics->'faturamento'->>'venda_balcao_bruto')::NUMERIC,
            'saldoAReceber', (v_metrics->'caixa'->>'saldo_a_receber_competencia')::NUMERIC
        ),
        'custos', jsonb_build_object(
            'cmvOs', (v_metrics->'operacional'->>'custo_pecas')::NUMERIC,
            'cmvBalcao', (v_metrics->'operacional'->>'custo_balcao')::NUMERIC,
            'cmvTotal', (v_metrics->'operacional'->>'custo_total')::NUMERIC
        ),
        'perdas', jsonb_build_object(
            'total', (v_metrics->'operacional'->>'total_perdas')::NUMERIC,
            'retrabalho', (v_metrics->'operacional'->>'perdas_retrabalho')::NUMERIC,
            'garantia', (v_metrics->'operacional'->>'perdas_garantia')::NUMERIC,
            'sinistro', (v_metrics->'operacional'->>'perdas_sinistro')::NUMERIC,
            'prejuizo', (v_metrics->'operacional'->>'perdas_prejuizo')::NUMERIC
        ),
        'caixa', jsonb_build_object(
            'entradasPagas', (v_metrics->'caixa'->>'entradas_oficina_periodo')::NUMERIC,
            'saidasPagas', (v_metrics->'caixa'->>'saidas_oficina_periodo')::NUMERIC,
            'lucroCaixa', (v_metrics->'caixa'->>'lucro_caixa_oficina_periodo')::NUMERIC
        ),
        'despesas', jsonb_build_object(
            'fixas', (v_metrics->'operacional'->>'despesas_fixas')::NUMERIC,
            'variaveis', (v_metrics->'operacional'->>'despesas_variaveis')::NUMERIC,
            'comprasEstoque', (v_metrics->'operacional'->>'compras_estoque')::NUMERIC
        ),
        'resultado', jsonb_build_object(
            'lucroOperacional', (v_metrics->'operacional'->>'lucro_operacional')::NUMERIC,
            'resultadoLiquidoGerencial', (v_metrics->'operacional'->>'resultado_gerencial')::NUMERIC
        ),
        'alertas', jsonb_build_object(
            'itensSemCusto', (v_metrics->'auditoria'->>'total_itens_livres_sem_custo')::NUMERIC,
            'vendasSemCusto', (v_metrics->'auditoria'->>'vendas_balcao_sem_custo')::NUMERIC,
            'historicoComRessalva', (v_metrics->'auditoria'->>'alerta_lucro_inflado')::BOOLEAN,
            'categoriasNaoClassificadas', (SELECT COALESCE(jsonb_agg(DISTINCT categoria), '[]'::jsonb) FROM financeiro WHERE oficina_id = p_oficina_id AND (categoria IS NULL OR categoria = '') AND data BETWEEN p_inicio AND p_fim)
        ),
        'analitico', (
            SELECT COALESCE(jsonb_agg(row), '[]'::jsonb)
            FROM (
                SELECT
                    os.id::text,
                    COALESCE(os.data_conclusao, os.data_servico)::text as data_competencia,
                    NULL::text as data_pagamento,
                    'entrada'::text as tipo,
                    'OS'::text as origem,
                    'Serviços/Peças'::text as categoria,
                    'OS #' || os.numero::text || ' - ' || COALESCE(c.nome, 'Cliente não identificado') as descricao,
                    os.valor_servico as valor_bruto,
                    COALESCE(os.desconto, 0) as desconto,
                    (os.valor_servico - COALESCE(os.desconto, 0)) as valor_liquido,
                    os.status::text as status,
                    'OS'::text as classificacao,
                    os.numero::text as numero_documento
                FROM ordens_servico os
                LEFT JOIN clientes c ON c.id = os.cliente_id
                WHERE os.oficina_id = p_oficina_id AND os.status = 'finalizado'
                AND COALESCE(os.data_conclusao, os.data_servico)::date BETWEEN p_inicio AND p_fim

                UNION ALL

                SELECT
                    v.id::text,
                    v.created_at::text as data_competencia,
                    NULL::text as data_pagamento,
                    'entrada'::text as tipo,
                    'Venda Balcão'::text as origem,
                    'Peças'::text as categoria,
                    'Venda Balcão #' || substring(v.id::text from 1 for 8) || ' - ' || COALESCE(cli.nome, 'Consumidor') as descricao,
                    v.valor_total as valor_bruto,
                    0 as desconto,
                    v.valor_total as valor_liquido,
                    v.status::text as status,
                    'Venda'::text as classificacao,
                    substring(v.id::text from 1 for 8) as numero_documento
                FROM vendas_balcao v
                LEFT JOIN clientes cli ON cli.id = v.cliente_id
                WHERE v.oficina_id = p_oficina_id AND v.status = 'concluida'
                AND v.created_at::date BETWEEN p_inicio AND p_fim

                UNION ALL

                SELECT
                    f.id::text,
                    f.data::text as data_competencia,
                    f.data_pagamento::text as data_pagamento,
                    f.tipo::text as tipo,
                    'Financeiro'::text as origem,
                    COALESCE(f.categoria, 'Não classificado') as categoria,
                    f.descricao,
                    f.valor as valor_bruto,
                    0 as desconto,
                    f.valor as valor_liquido,
                    f.status::text as status,
                    CASE WHEN f.tipo = 'saida' THEN 'Despesa' ELSE 'Receita Direta' END as classificacao,
                    f.id::text as numero_documento
                FROM financeiro f
                WHERE f.oficina_id = p_oficina_id
                AND f.data BETWEEN p_inicio AND p_fim
            ) row
        )
    );

    RETURN v_result;
END;
$function$
;

-- reabrir_os_atomica
CREATE OR REPLACE FUNCTION public.reabrir_os_atomica(p_os_id uuid, p_motivo text DEFAULT 'Reabertura solicitada'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND (auth.uid() IS NULL OR NOT public.has_oficina_access(auth.uid(), v_oficina_id)) THEN
    RAISE EXCEPTION 'Acesso negado à função %', 'reabrir_os_atomica'
      USING ERRCODE = '42501';
  END IF;


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
$function$
;

-- reabrir_os_v2
CREATE OR REPLACE FUNCTION public.reabrir_os_v2(p_os_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_os_numero TEXT;
    v_oficina_id UUID;
BEGIN
    -- Lock para evitar race conditions
    SELECT numero::text, oficina_id INTO v_os_numero, v_oficina_id
    FROM public.ordens_servico
    WHERE id = p_os_id AND status = 'finalizado'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'OS não encontrada ou não está no status finalizado.');
    END IF;
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND (auth.uid() IS NULL OR NOT public.has_oficina_access(auth.uid(), v_oficina_id)) THEN
    RAISE EXCEPTION 'Acesso negado à função %', 'reabrir_os_v2'
      USING ERRCODE = '42501';
  END IF;


    -- O update disparará a trigger tg_reabrir_os que cuida do estoque e financeiro
    UPDATE public.ordens_servico
    SET status = 'em_andamento',
        data_conclusao = NULL,
        updated_at = now()
    WHERE id = p_os_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'OS #' || v_os_numero || ' reaberta. Estoque estornado. Pagamentos realizados foram mantidos no caixa.',
        'os_id', p_os_id
    );
END;
$function$
;

-- recalcular_totais_os
CREATE OR REPLACE FUNCTION public.recalcular_totais_os(p_os_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_total_produtos numeric := 0;
  v_total_servicos_catalogo numeric := 0;
  v_total_mao_obra_itens numeric := 0;
  v_mao_obra_global numeric := 0;
  v_desconto numeric := 0;
  v_valor_servico_atual numeric := 0;
  v_status text;
  v_total_receita_bruta numeric := 0;
  v_total_custo numeric := 0;
  v_financeiro_total_pago numeric := 0;
BEGIN
  SELECT
    COALESCE(os.valor_mao_obra, 0),
    COALESCE(os.valor_servico, 0),
    COALESCE(os.desconto, 0),
    os.status
  INTO v_mao_obra_global, v_valor_servico_atual, v_desconto, v_status
  FROM public.ordens_servico os
  WHERE os.id = p_os_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND (auth.uid() IS NULL OR NOT public.has_oficina_access(auth.uid(), (SELECT oficina_id FROM public.ordens_servico WHERE id = p_os_id))) THEN
    RAISE EXCEPTION 'Acesso negado à função %', 'recalcular_totais_os'
      USING ERRCODE = '42501';
  END IF;


  SELECT
    COALESCE(SUM(CASE WHEN ios.tipo = 'produto' OR ios.estoque_id IS NOT NULL
      THEN COALESCE(ios.quantidade, 1) * COALESCE(ios.valor_unitario, 0)
      ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN ios.tipo = 'servico' AND ios.estoque_id IS NULL
      THEN COALESCE(ios.quantidade, 1) * COALESCE(ios.valor_unitario, 0)
      ELSE 0 END), 0),
    COALESCE(SUM(COALESCE(ios.valor_mao_obra, 0)), 0),
    COALESCE(SUM(
      COALESCE(ios.quantidade, 1) * COALESCE(NULLIF(ios.custo_unitario, 0), e.custo_unitario, 0)
    ), 0)
  INTO v_total_produtos, v_total_servicos_catalogo, v_total_mao_obra_itens, v_total_custo
  FROM public.itens_os ios
  LEFT JOIN public.estoque e ON e.id = ios.estoque_id
  WHERE ios.ordem_servico_id = p_os_id;

  -- Contrato oficial:
  -- valor_servico = peças/produtos + serviços de catálogo + maior mão de obra entre global e itemizada.
  -- lucro NÃO é escrito aqui; é GENERATED ALWAYS em ordens_servico.
  v_total_receita_bruta := v_total_produtos + v_total_servicos_catalogo + GREATEST(v_mao_obra_global, v_total_mao_obra_itens);

  -- Safety net para OS finalizada legado: não zera OS já paga se itens antigos estiverem incompletos.
  IF v_total_receita_bruta <= 0 AND v_status = 'finalizado' THEN
    SELECT COALESCE(SUM(valor), 0) INTO v_financeiro_total_pago
    FROM public.financeiro
    WHERE ordem_servico_id = p_os_id
      AND tipo = 'entrada'
      AND origem NOT ILIKE 'Comissão%'
      AND categoria != 'sinal';

    IF v_financeiro_total_pago > 0 THEN
      v_total_receita_bruta := v_financeiro_total_pago + v_desconto;
    ELSIF v_valor_servico_atual > 0 THEN
      v_total_receita_bruta := v_valor_servico_atual;
    END IF;
  END IF;

  UPDATE public.ordens_servico
  SET valor_servico = v_total_receita_bruta,
      custo_servico = v_total_custo
  WHERE id = p_os_id
    AND (
      valor_servico IS DISTINCT FROM v_total_receita_bruta
      OR custo_servico IS DISTINCT FROM v_total_custo
    );
END;
$function$
;

-- upsert_financeiro_os
CREATE OR REPLACE FUNCTION public.upsert_financeiro_os(p_oficina_id uuid, p_ordem_servico_id uuid, p_tipo_servico text, p_mao_obra_valor numeric, p_forma_pagamento_id uuid DEFAULT NULL::uuid, p_origem text DEFAULT NULL::text, p_numero_parcelas integer DEFAULT 1)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
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
  v_os_oficina_id uuid;
  v_status_financeiro text := 'pago';
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND (auth.uid() IS NULL OR NOT public.has_oficina_access(auth.uid(), p_oficina_id)) THEN
    RAISE EXCEPTION 'Acesso negado à função %', 'upsert_financeiro_os'
      USING ERRCODE = '42501';
  END IF;

  IF p_forma_pagamento_id IS NULL THEN
    v_status_financeiro := 'a_receber';
  END IF;

  -- 1. Validação de pertencimento (Defesa em profundidade)
  SELECT oficina_id INTO v_os_oficina_id
  FROM public.ordens_servico WHERE id = p_ordem_servico_id;

  IF v_os_oficina_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'OS não encontrada');
  END IF;

  IF v_os_oficina_id IS DISTINCT FROM p_oficina_id THEN
    RAISE EXCEPTION 'OS não pertence à oficina informada' USING ERRCODE = '42501';
  END IF;

  -- 2. Checa se já existe lançamento de entrada
  SELECT id INTO v_existing_id FROM public.financeiro
  WHERE ordem_servico_id = p_ordem_servico_id AND tipo = 'entrada' AND categoria NOT IN ('comissao', 'sinal') LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN json_build_object('success', true, 'action', 'exists', 'id', v_existing_id);
  END IF;

  -- 3. Carrega valores da OS
  SELECT
    COALESCE(os.valor_servico, 0),
    COALESCE(os.desconto, 0),
    os.numero,
    COALESCE(os.valor_sinal, 0)
  INTO v_valor_bruto_os, v_desconto_os, v_os_numero, v_valor_sinal
  FROM public.ordens_servico os WHERE os.id = p_ordem_servico_id;

  -- 4. Carrega itens da OS
  SELECT
    COALESCE(SUM(CASE WHEN ios.tipo = 'produto' OR ios.estoque_id IS NOT NULL THEN (COALESCE(ios.quantidade, 1) * COALESCE(ios.valor_unitario, 0)) ELSE 0 END), 0),
    COALESCE(SUM(COALESCE(ios.valor_mao_obra, 0)), 0)
  INTO v_total_pecas_bruto, v_mao_obra_total_bruta
  FROM public.itens_os ios WHERE ios.ordem_servico_id = p_ordem_servico_id;

  -- CORREÇÃO OFICIAL: Regra GREATEST entre mão de obra passada e a dos itens.
  -- NUNCA somar as duas.
  v_mao_obra_total_bruta := GREATEST(COALESCE(p_mao_obra_valor, 0), v_mao_obra_total_bruta);

  IF v_valor_bruto_os <= 0 THEN
    v_valor_bruto_os := v_total_pecas_bruto + v_mao_obra_total_bruta;
  END IF;

  v_valor_liquido_os := GREATEST(v_valor_bruto_os - v_desconto_os, 0);
  v_valor_restante := GREATEST(v_valor_liquido_os - v_valor_sinal, 0);

  IF v_valor_restante <= 0 THEN
    RETURN json_build_object('success', true, 'action', 'skipped', 'message', 'OS sem valor restante para financeiro');
  END IF;

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
$function$
;

ALTER FUNCTION public.converter_orcamento_em_os(p_oficina_id uuid, p_orcamento_id uuid) SET search_path TO public, pg_temp;
ALTER FUNCTION public.criar_orcamento_completo(p_oficina_id uuid, p_titulo text, p_cliente_id uuid, p_veiculo_id uuid, p_descricao text, p_validade text, p_desconto numeric, p_observacoes text, p_itens jsonb) SET search_path TO public, pg_temp;
ALTER FUNCTION public.criar_venda_balcao(p_oficina_id uuid, p_itens jsonb, p_forma_pagamento text, p_forma_pagamento_id uuid, p_cliente_id uuid, p_observacao text) SET search_path TO public, pg_temp;
ALTER FUNCTION public.deletar_item_os_atomic(p_item_id uuid, p_oficina_id uuid) SET search_path TO public, pg_temp;
ALTER FUNCTION public.finalizar_os_atomica(p_os_id uuid, p_forma_pagamento text, p_forma_pagamento_id uuid, p_numero_parcelas integer, p_fotos_saida text[], p_observacoes_conclusao text, p_itens_novos jsonb, p_valor_mao_obra numeric) SET search_path TO public, pg_temp;
ALTER FUNCTION public.gerar_parcelas_atomic(p_oficina_id uuid, p_ordem_servico_id uuid, p_orcamento_id uuid, p_valor_total numeric, p_numero_parcelas integer, p_data_primeira_parcela date, p_intervalo_dias integer, p_forma_pagamento_id uuid) SET search_path TO public, pg_temp;
ALTER FUNCTION public.get_financeiro_resumo(p_oficina_id uuid, p_meses_historico integer) SET search_path TO public, pg_temp;
ALTER FUNCTION public.get_financeiro_v2(p_oficina_id uuid, p_data_inicio date, p_data_fim date) SET search_path TO public, pg_temp;
ALTER FUNCTION public.get_financeiro_v2_preview_limpeza(p_oficina_id uuid, p_data_inicio date, p_data_fim date) SET search_path TO public, pg_temp;
ALTER FUNCTION public.get_financeiro_v2_series(p_oficina_id uuid, p_data_inicio date, p_data_fim date) SET search_path TO public, pg_temp;
ALTER FUNCTION public.get_pre_fiscal_unificado(p_oficina_id uuid, p_inicio date, p_fim date) SET search_path TO public, pg_temp;
ALTER FUNCTION public.reabrir_os_atomica(p_os_id uuid, p_motivo text) SET search_path TO public, pg_temp;
ALTER FUNCTION public.reabrir_os_v2(p_os_id uuid) SET search_path TO public, pg_temp;
ALTER FUNCTION public.recalcular_totais_os(p_os_id uuid) SET search_path TO public, pg_temp;
ALTER FUNCTION public.upsert_financeiro_os(p_oficina_id uuid, p_ordem_servico_id uuid, p_tipo_servico text, p_mao_obra_valor numeric, p_forma_pagamento_id uuid, p_origem text, p_numero_parcelas integer) SET search_path TO public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.converter_orcamento_em_os(p_oficina_id uuid, p_orcamento_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.converter_orcamento_em_os(p_oficina_id uuid, p_orcamento_id uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.criar_orcamento_completo(p_oficina_id uuid, p_titulo text, p_cliente_id uuid, p_veiculo_id uuid, p_descricao text, p_validade text, p_desconto numeric, p_observacoes text, p_itens jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_orcamento_completo(p_oficina_id uuid, p_titulo text, p_cliente_id uuid, p_veiculo_id uuid, p_descricao text, p_validade text, p_desconto numeric, p_observacoes text, p_itens jsonb) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.criar_venda_balcao(p_oficina_id uuid, p_itens jsonb, p_forma_pagamento text, p_forma_pagamento_id uuid, p_cliente_id uuid, p_observacao text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_venda_balcao(p_oficina_id uuid, p_itens jsonb, p_forma_pagamento text, p_forma_pagamento_id uuid, p_cliente_id uuid, p_observacao text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.deletar_item_os_atomic(p_item_id uuid, p_oficina_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deletar_item_os_atomic(p_item_id uuid, p_oficina_id uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.finalizar_os_atomica(p_os_id uuid, p_forma_pagamento text, p_forma_pagamento_id uuid, p_numero_parcelas integer, p_fotos_saida text[], p_observacoes_conclusao text, p_itens_novos jsonb, p_valor_mao_obra numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalizar_os_atomica(p_os_id uuid, p_forma_pagamento text, p_forma_pagamento_id uuid, p_numero_parcelas integer, p_fotos_saida text[], p_observacoes_conclusao text, p_itens_novos jsonb, p_valor_mao_obra numeric) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.gerar_parcelas_atomic(p_oficina_id uuid, p_ordem_servico_id uuid, p_orcamento_id uuid, p_valor_total numeric, p_numero_parcelas integer, p_data_primeira_parcela date, p_intervalo_dias integer, p_forma_pagamento_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gerar_parcelas_atomic(p_oficina_id uuid, p_ordem_servico_id uuid, p_orcamento_id uuid, p_valor_total numeric, p_numero_parcelas integer, p_data_primeira_parcela date, p_intervalo_dias integer, p_forma_pagamento_id uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_financeiro_resumo(p_oficina_id uuid, p_meses_historico integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_financeiro_resumo(p_oficina_id uuid, p_meses_historico integer) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_financeiro_v2(p_oficina_id uuid, p_data_inicio date, p_data_fim date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_financeiro_v2(p_oficina_id uuid, p_data_inicio date, p_data_fim date) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_financeiro_v2_preview_limpeza(p_oficina_id uuid, p_data_inicio date, p_data_fim date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_financeiro_v2_preview_limpeza(p_oficina_id uuid, p_data_inicio date, p_data_fim date) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_financeiro_v2_series(p_oficina_id uuid, p_data_inicio date, p_data_fim date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_financeiro_v2_series(p_oficina_id uuid, p_data_inicio date, p_data_fim date) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_pre_fiscal_unificado(p_oficina_id uuid, p_inicio date, p_fim date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pre_fiscal_unificado(p_oficina_id uuid, p_inicio date, p_fim date) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.reabrir_os_atomica(p_os_id uuid, p_motivo text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reabrir_os_atomica(p_os_id uuid, p_motivo text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.reabrir_os_v2(p_os_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reabrir_os_v2(p_os_id uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.recalcular_totais_os(p_os_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalcular_totais_os(p_os_id uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.upsert_financeiro_os(p_oficina_id uuid, p_ordem_servico_id uuid, p_tipo_servico text, p_mao_obra_valor numeric, p_forma_pagamento_id uuid, p_origem text, p_numero_parcelas integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_financeiro_os(p_oficina_id uuid, p_ordem_servico_id uuid, p_tipo_servico text, p_mao_obra_valor numeric, p_forma_pagamento_id uuid, p_origem text, p_numero_parcelas integer) TO authenticated, service_role;

COMMIT;
