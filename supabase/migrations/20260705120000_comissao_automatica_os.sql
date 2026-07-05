-- PR 2: Comissão automática de funcionário na finalização da OS.
-- Usa ordens_servico.responsavel_id (mecanico_id não existe) e
-- ordens_servico.numero (numero_os não existe).

CREATE OR REPLACE FUNCTION public.gerar_comissao_os(p_os_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_os record;
  v_percentual numeric;
  v_valor_comissao numeric;
  v_responsavel_nome text;
  v_financeiro_id uuid;
BEGIN
  SELECT
    os.id,
    os.oficina_id,
    os.numero,
    os.responsavel_id,
    COALESCE(os.valor_mao_obra, 0) AS valor_mao_obra
  INTO v_os
  FROM public.ordens_servico os
  WHERE os.id = p_os_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'action', 'skipped', 'reason', 'os_not_found');
  END IF;

  IF v_os.responsavel_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'action', 'skipped', 'reason', 'sem_responsavel');
  END IF;

  SELECT cf.percentual
  INTO v_percentual
  FROM public.comissoes_funcionarios cf
  WHERE cf.oficina_id = v_os.oficina_id
    AND cf.user_id = v_os.responsavel_id
    AND cf.ativo = true
  LIMIT 1;

  IF v_percentual IS NULL OR v_percentual <= 0 THEN
    RETURN jsonb_build_object('success', true, 'action', 'skipped', 'reason', 'sem_comissao_ativa');
  END IF;

  v_valor_comissao := ROUND(v_os.valor_mao_obra * v_percentual / 100, 2);

  IF v_valor_comissao <= 0 THEN
    RETURN jsonb_build_object('success', true, 'action', 'skipped', 'reason', 'valor_zero');
  END IF;

  SELECT COALESCE(p.nome, 'Funcionário')
  INTO v_responsavel_nome
  FROM public.profiles p
  WHERE p.user_id = v_os.responsavel_id
  LIMIT 1;

  SELECT f.id
  INTO v_financeiro_id
  FROM public.financeiro f
  WHERE f.oficina_id = v_os.oficina_id
    AND f.ordem_servico_id = v_os.id
    AND f.tipo = 'saida'
    AND f.categoria = 'comissao'
    AND f.descricao = (
      'Comissão ' || v_responsavel_nome ||
      ' (' || TRIM(TO_CHAR(v_percentual, 'FM990D99')) || '%) — OS #' ||
      COALESCE(v_os.numero::text, '')
    )
    AND f.status <> 'cancelado'
  LIMIT 1;

  IF v_financeiro_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'action', 'exists', 'financeiro_id', v_financeiro_id, 'valor', v_valor_comissao);
  END IF;

  INSERT INTO public.financeiro (
    oficina_id, tipo, ordem_servico_id, valor, data, descricao, status, categoria
  ) VALUES (
    v_os.oficina_id, 'saida', v_os.id, v_valor_comissao, CURRENT_DATE,
    'Comissão ' || v_responsavel_nome ||
      ' (' || TRIM(TO_CHAR(v_percentual, 'FM990D99')) || '%) — OS #' ||
      COALESCE(v_os.numero::text, ''),
    'a_pagar'::public.status_pagamento,
    'comissao'
  )
  RETURNING id INTO v_financeiro_id;

  RETURN jsonb_build_object('success', true, 'action', 'created', 'financeiro_id', v_financeiro_id, 'valor', v_valor_comissao, 'responsavel_id', v_os.responsavel_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.gerar_comissao_os(uuid) TO authenticated, service_role;

-- Chamar gerar_comissao_os no final de finalizar_os_atomica, dentro da mesma transação.
CREATE OR REPLACE FUNCTION public.finalizar_os_atomica(
  p_os_id uuid,
  p_forma_pagamento text DEFAULT NULL::text,
  p_forma_pagamento_id uuid DEFAULT NULL::uuid,
  p_numero_parcelas integer DEFAULT 1,
  p_fotos_saida text[] DEFAULT NULL::text[],
  p_observacoes_conclusao text DEFAULT NULL::text,
  p_itens_novos jsonb DEFAULT '[]'::jsonb,
  p_valor_mao_obra numeric DEFAULT NULL::numeric
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

  IF v_os.status = 'finalizado' THEN
    RAISE EXCEPTION 'OS já foi finalizada anteriormente';
  END IF;

  IF v_os.status = 'cancelado' THEN
    RAISE EXCEPTION 'OS cancelada não pode ser finalizada';
  END IF;

  v_forma_normalizada := NULLIF(TRIM(LOWER(COALESCE(p_forma_pagamento, ''))), '');

  IF v_forma_normalizada IN ('a_receber', 'a receber', 'pendente', 'pagar_depois', 'pagar depois') THEN
    v_marcar_a_receber := true;
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

  PERFORM public.gerar_comissao_os(p_os_id);

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
$function$;

-- Cancelar comissão pendente ao reabrir OS finalizada.
CREATE OR REPLACE FUNCTION public.fn_tg_reabrir_os()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_item RECORD;
BEGIN
    IF OLD.status = 'finalizado' AND NEW.status != 'finalizado' THEN

        INSERT INTO public.log_financeiro_estoque_audit (
            oficina_id, entidade_tipo, entidade_id, acao, dados_anteriores, usuario_id
        )
        VALUES (
            OLD.oficina_id,
            'ordem_servico',
            OLD.id,
            'reabertura',
            jsonb_build_object('status', OLD.status, 'numero', OLD.numero, 'valor_total', OLD.valor_total),
            auth.uid()
        );

        FOR v_item IN
            SELECT io.estoque_id, io.quantidade, io.nome_item
            FROM public.itens_os io
            WHERE io.ordem_servico_id = OLD.id
            AND io.estoque_id IS NOT NULL
        LOOP
            UPDATE public.estoque e
            SET quantidade = e.quantidade + v_item.quantidade,
                updated_at = now()
            WHERE e.id = v_item.estoque_id;
        END LOOP;

        UPDATE public.financeiro
        SET observacoes_contador = COALESCE(observacoes_contador, '') || ' [OS #' || OLD.numero || ' REABERTA - Pagamento mantido no caixa]',
            updated_at = now()
        WHERE ordem_servico_id = OLD.id
        AND status = 'pago';

        UPDATE public.financeiro
        SET status = 'cancelado',
            observacoes_contador = COALESCE(observacoes_contador, '') || ' [Cancelado por reabertura OS #' || OLD.numero || ']',
            updated_at = now()
        WHERE ordem_servico_id = OLD.id
        AND status = 'pendente';

        UPDATE public.financeiro
        SET status = 'cancelado'::public.status_pagamento,
            observacoes_contador = COALESCE(observacoes_contador, '') || ' [Comissão cancelada por reabertura da OS #' || OLD.numero || ']',
            updated_at = now()
        WHERE ordem_servico_id = OLD.id
          AND categoria = 'comissao'
          AND tipo = 'saida'
          AND status = 'a_pagar';

    END IF;

    RETURN NEW;
END;
$function$;
