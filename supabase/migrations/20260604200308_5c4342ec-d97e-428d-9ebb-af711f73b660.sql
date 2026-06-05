-- AUDITORIA P0 OS 2026-06-04
-- Backup lógico da função problemática atual (resumo):
-- public.recalcular_totais_os atualizava public.ordens_servico.lucro manualmente.
-- ordens_servico.lucro é coluna GENERATED ALWAYS, portanto qualquer UPDATE lucro = ... falha.
-- Trigger afetado: public.tg_recalcular_totais_os em public.itens_os chama esta função após INSERT/UPDATE/DELETE.

CREATE OR REPLACE FUNCTION public.recalcular_totais_os(p_os_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
$function$;

-- Remover overloads antigos de finalizar_os_atomica e manter somente o contrato oficial com p_valor_mao_obra.
DROP FUNCTION IF EXISTS public.finalizar_os_atomica(uuid, text, uuid, integer, text[], text, jsonb);
DROP FUNCTION IF EXISTS public.finalizar_os_atomica(uuid, text, uuid, integer, jsonb, text, text[]);

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

  RETURN jsonb_build_object(
    'success', true,
    'os_id', p_os_id,
    'valor_bruto', v_valor_bruto,
    'valor_liquido', v_valor_bruto - v_desconto,
    'valor_total', v_valor_bruto,
    'status', 'finalizado'
  );
END;
$function$;