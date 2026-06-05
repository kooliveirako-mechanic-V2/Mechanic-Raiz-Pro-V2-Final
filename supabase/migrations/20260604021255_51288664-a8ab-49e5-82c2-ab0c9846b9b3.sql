-- 1. Corrigir a RPC upsert_financeiro_os para cálculo proporcional correto
CREATE OR REPLACE FUNCTION public.upsert_financeiro_os(
  p_oficina_id uuid, p_ordem_servico_id uuid, p_tipo_servico text,
  p_valor_mao_de_obra numeric, p_forma_pagamento_id uuid DEFAULT NULL::uuid,
  p_origem text DEFAULT NULL::text, p_numero_parcelas integer DEFAULT 1
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_produtos numeric := 0;
  v_total_mao_obra_itens numeric := 0;
  v_mao_obra_global numeric := 0;
  v_mao_obra_base numeric := 0;
  v_valor_total_os numeric := 0;
  v_valor_sinal numeric := 0;
  v_valor_restante numeric := 0;
  v_existing_id uuid;
  v_parcela_valor numeric;
  v_data_base date;
  v_i integer;
  v_num_parcelas integer;
  v_responsavel_id uuid;
  v_comissao_pct numeric;
  v_comissao_valor numeric;
  v_responsavel_nome text;
  v_os_numero integer;
  v_lock_key bigint;
  -- Variáveis para colunas estruturadas
  v_pecas_os numeric := 0;
  v_mao_obra_os numeric := 0;
  v_total_servicos_catalogo numeric := 0;
  v_ratio_mao_obra numeric := 0;
  v_ratio_pecas numeric := 0;
  v_calculo_mao_obra_final numeric := 0;
  v_calculo_pecas_final numeric := 0;
BEGIN
  v_lock_key := ('x' || left(replace(p_ordem_servico_id::text, '-', ''), 15))::bit(64)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Verifica se já tem lançamento "principal"
  SELECT id INTO v_existing_id
  FROM public.financeiro
  WHERE ordem_servico_id = p_ordem_servico_id
    AND tipo = 'entrada'
    AND origem NOT ILIKE 'Comissão%'
    AND origem NOT ILIKE 'Sinal%'
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN json_build_object('success', true, 'action', 'exists', 'id', v_existing_id);
  END IF;

  IF COALESCE(p_valor_mao_de_obra, 0) < 0 THEN
    RETURN json_build_object('success', false, 'error', 'Valor de mão de obra não pode ser negativo');
  END IF;

  SELECT
    COALESCE(os.valor_servico, 0),
    COALESCE(os.valor_mao_obra, 0),
    os.responsavel_id,
    os.numero,
    COALESCE(os.valor_sinal, 0)
  INTO v_valor_total_os, v_mao_obra_global, v_responsavel_id, v_os_numero, v_valor_sinal
  FROM public.ordens_servico os
  WHERE os.id = p_ordem_servico_id;

  -- Calcular totais brutos da OS
  SELECT
    COALESCE(SUM(CASE WHEN ios.tipo = 'produto' OR ios.estoque_id IS NOT NULL THEN COALESCE(ios.valor_total, (COALESCE(ios.quantidade, 1) * COALESCE(ios.valor_unitario, 0))) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN ios.tipo = 'servico' OR ios.estoque_id IS NULL THEN COALESCE(ios.valor_total, (COALESCE(ios.quantidade, 1) * COALESCE(ios.valor_unitario, 0))) ELSE 0 END), 0),
    COALESCE(SUM(COALESCE(ios.valor_mao_obra, 0)), 0)
  INTO v_pecas_os, v_total_servicos_catalogo, v_total_mao_obra_itens
  FROM public.itens_os ios
  WHERE ios.ordem_servico_id = p_ordem_servico_id;

  -- Mão de obra base (global + itens)
  v_mao_obra_base := GREATEST(COALESCE(p_valor_mao_de_obra, 0), v_mao_obra_global, v_total_mao_obra_itens);
  v_mao_obra_os := v_mao_obra_base + v_total_servicos_catalogo;

  -- Se o total_os for zero (casos raros), tenta somar os itens
  IF v_valor_total_os <= 0 THEN
    v_valor_total_os := v_pecas_os + v_mao_obra_os;
  END IF;

  IF v_valor_total_os <= 0 THEN
    RETURN json_build_object('success', true, 'action', 'skipped', 'reason', 'zero_value');
  END IF;

  -- Proporção real de cada componente
  v_ratio_mao_obra := v_mao_obra_os / v_valor_total_os;
  v_ratio_pecas := v_pecas_os / v_valor_total_os;

  -- Valor líquido a lançar (descontando sinal)
  v_valor_restante := GREATEST(v_valor_total_os - v_valor_sinal, 0);

  IF v_valor_restante <= 0 AND v_valor_sinal < v_valor_total_os THEN
     -- Valor residual ínfimo por arredondamento, ignorar
     RETURN json_build_object('success', true, 'action', 'skipped', 'reason', 'fully_paid_by_signal');
  END IF;

  -- Valores finais para o lançamento principal (restante)
  v_calculo_mao_obra_final := v_valor_restante * v_ratio_mao_obra;
  v_calculo_pecas_final := v_valor_restante * v_ratio_pecas;

  v_num_parcelas := GREATEST(COALESCE(p_numero_parcelas, 1), 1);
  v_data_base := CURRENT_DATE;

  IF v_num_parcelas = 1 THEN
    INSERT INTO public.financeiro (
      oficina_id, ordem_servico_id, tipo, origem, valor, data, descricao, status, forma_pagamento_id,
      valor_mao_obra, valor_pecas
    ) VALUES (
      p_oficina_id, p_ordem_servico_id, 'entrada',
      COALESCE(p_origem, 'Serviço ' || p_tipo_servico),
      v_valor_restante, CURRENT_DATE,
      p_tipo_servico || ' - OS Finalizada' ||
        CASE WHEN v_valor_sinal > 0
          THEN ' (já recebido R$' || TRIM(TO_CHAR(v_valor_sinal, 'FM999999990.00')) || ' em sinal)'
          WHEN v_pecas_os > 0
          THEN ' (inclui R$' || TRIM(TO_CHAR(v_pecas_os, 'FM999999990.00')) || ' em produtos/peças)'
          ELSE ''
        END,
      'pago', p_forma_pagamento_id,
      v_calculo_mao_obra_final, v_calculo_pecas_final
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_existing_id;
  ELSE
    v_parcela_valor := ROUND(v_valor_restante / v_num_parcelas, 2);
    FOR v_i IN 1..v_num_parcelas LOOP
      IF v_i = v_num_parcelas THEN
        v_parcela_valor := v_valor_restante - (ROUND(v_valor_restante / v_num_parcelas, 2) * (v_num_parcelas - 1));
      END IF;

      INSERT INTO public.financeiro (
        oficina_id, ordem_servico_id, tipo, origem, valor, data, descricao, status, forma_pagamento_id,
        valor_mao_obra, valor_pecas
      ) VALUES (
        p_oficina_id, p_ordem_servico_id, 'entrada',
        COALESCE(p_origem, 'Serviço ' || p_tipo_servico),
        v_parcela_valor,
        v_data_base + (v_i - 1) * INTERVAL '1 month',
        'Parcela ' || v_i || '/' || v_num_parcelas || ' — ' || p_tipo_servico,
        CASE WHEN v_i = 1 THEN 'pago' ELSE 'a_receber' END,
        p_forma_pagamento_id,
        (v_calculo_mao_obra_final / v_num_parcelas), (v_calculo_pecas_final / v_num_parcelas)
      );
    END LOOP;
  END IF;

  -- Comissão calculada sobre a Mão de Obra BASE (valor do esforço técnico real)
  IF v_responsavel_id IS NOT NULL THEN
    SELECT cf.percentual INTO v_comissao_pct
    FROM public.comissoes_funcionarios cf
    WHERE cf.oficina_id = p_oficina_id
      AND cf.user_id = v_responsavel_id
      AND cf.ativo = true;

    IF v_comissao_pct IS NOT NULL AND v_comissao_pct > 0 THEN
      v_comissao_valor := ROUND(v_mao_obra_base * v_comissao_pct / 100, 2);

      IF v_comissao_valor > 0 THEN
        SELECT nome INTO v_responsavel_nome FROM public.profiles WHERE user_id = v_responsavel_id LIMIT 1;

        INSERT INTO public.financeiro (
          oficina_id, ordem_servico_id, tipo, origem, valor, data, descricao, status
        ) VALUES (
          p_oficina_id, p_ordem_servico_id, 'saida',
          'Comissão ' || COALESCE(v_responsavel_nome, 'funcionário'),
          v_comissao_valor, CURRENT_DATE,
          'Comissão ' || v_comissao_pct || '% sobre mão de obra OS #' || COALESCE(v_os_numero::text, ''),
          'pago'
        );
      END IF;
    END IF;
  END IF;

  RETURN json_build_object(
    'success', true,
    'action', 'created',
    'valor_lancado', v_valor_restante,
    'sinal_descontado', v_valor_sinal
  );
END;
$function$;

-- 2. Backfill massivo com lógica de proporção correta para limpar lixo histórico
-- Aplica-se a todos os registros de entrada vinculados a uma OS
WITH os_totals AS (
  SELECT 
    os.id as os_id,
    os.valor_servico as total_os,
    COALESCE(os.valor_mao_obra, 0) as mao_obra_global,
    -- Soma pecas brutos
    COALESCE((
        SELECT SUM(COALESCE(i.valor_total, (COALESCE(i.quantidade, 1) * COALESCE(i.valor_unitario, 0))))
        FROM public.itens_os i
        WHERE i.ordem_servico_id = os.id
        AND (i.tipo = 'produto' OR i.estoque_id IS NOT NULL)
    ), 0) as pecas_bruto,
    -- Soma servicos catalogo brutos + mao de obra itens
    COALESCE((
        SELECT SUM(COALESCE(i.valor_total, (COALESCE(i.quantidade, 1) * COALESCE(i.valor_unitario, 0))))
        FROM public.itens_os i
        WHERE i.ordem_servico_id = os.id
        AND (i.tipo = 'servico' OR i.estoque_id IS NULL)
    ), 0) + COALESCE(os.valor_mao_obra, 0) as mao_obra_bruto
  FROM public.ordens_servico os
)
UPDATE public.financeiro f
SET
  valor_mao_obra = CASE 
    WHEN ot.total_os > 0 THEN (ot.mao_obra_bruto / ot.total_os) * f.valor
    ELSE f.valor -- Fallback se total OS for zero (improvável)
  END,
  valor_pecas = CASE 
    WHEN ot.total_os > 0 THEN (ot.pecas_bruto / ot.total_os) * f.valor
    ELSE 0
  END
FROM os_totals ot
WHERE f.ordem_servico_id = ot.os_id
AND f.tipo = 'entrada';

-- 3. Caso especial: Venda de Balcão (origem Venda Balcão)
-- Aqui o valor_pecas é o próprio valor do lançamento, já que não tem mão de obra
UPDATE public.financeiro
SET 
  valor_mao_obra = 0,
  valor_pecas = valor
WHERE origem ILIKE 'Venda Balcão%' 
AND tipo = 'entrada';

-- 4. Caso especial: Custos de Peças (saída)
-- O valor_pecas é o próprio valor (custo)
UPDATE public.financeiro
SET 
  valor_mao_obra = 0,
  valor_pecas = valor
WHERE origem ILIKE 'Custo%' 
AND tipo = 'saida';
