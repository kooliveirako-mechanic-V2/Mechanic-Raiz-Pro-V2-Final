
-- 1) registrar_sinal_os: gravar categoria='sinal'
CREATE OR REPLACE FUNCTION public.registrar_sinal_os(p_os_id uuid, p_valor numeric, p_forma_pagamento_id uuid DEFAULT NULL::uuid, p_forma_pagamento_nome text DEFAULT NULL::text, p_data_pagamento date DEFAULT NULL::date, p_observacao text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_os RECORD;
  v_total_produtos numeric;
  v_total_mao_obra_itens numeric;
  v_master_total numeric;
  v_sinal_atual numeric;
  v_novo_sinal numeric;
  v_cliente_nome text;
  v_veiculo_label text;
  v_forma_nome text;
  v_descricao text;
  v_data date;
  v_financeiro_id uuid;
  v_sinal_id uuid;
  v_desconto numeric := 0;
BEGIN
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor do sinal deve ser maior que zero';
  END IF;

  v_data := COALESCE(p_data_pagamento, CURRENT_DATE);

  SELECT * INTO v_os FROM public.ordens_servico WHERE id = p_os_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de serviço não encontrada';
  END IF;

  v_desconto := COALESCE(v_os.desconto, 0);

  SELECT
    COALESCE(SUM(COALESCE(quantidade,1) * COALESCE(valor_unitario,0)), 0),
    COALESCE(SUM(COALESCE(valor_mao_obra,0)), 0)
  INTO v_total_produtos, v_total_mao_obra_itens
  FROM public.itens_os WHERE ordem_servico_id = p_os_id;

  v_master_total := (v_total_produtos + COALESCE(v_os.valor_mao_obra, 0) + v_total_mao_obra_itens) - v_desconto;

  v_sinal_atual := COALESCE(v_os.valor_sinal, 0);
  v_novo_sinal := v_sinal_atual + p_valor;

  IF v_master_total > 0 AND v_novo_sinal > v_master_total + 0.05 THEN
    RAISE EXCEPTION 'Sinal (R$ %) ultrapassa o total líquido da OS (R$ %)', v_novo_sinal, v_master_total;
  END IF;

  UPDATE public.ordens_servico
    SET valor_sinal = v_novo_sinal, updated_at = now()
    WHERE id = p_os_id;

  SELECT c.nome INTO v_cliente_nome FROM public.clientes c WHERE c.id = v_os.cliente_id;
  SELECT (COALESCE(v.modelo, '') || CASE WHEN v.placa IS NOT NULL THEN ' • ' || v.placa ELSE '' END) INTO v_veiculo_label FROM public.veiculos v WHERE v.id = v_os.veiculo_id;

  v_forma_nome := COALESCE(p_forma_pagamento_nome, 'Dinheiro');
  v_descricao := 'Sinal OS #' || COALESCE(v_os.numero::text, '?') || ' — ' || v_cliente_nome || ' — ' || v_veiculo_label;

  INSERT INTO public.financeiro (
    oficina_id, ordem_servico_id, tipo, categoria, origem, valor, data, data_pagamento,
    descricao, status, forma_pagamento_id
  ) VALUES (
    v_os.oficina_id, p_os_id, 'entrada', 'sinal',
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

  RETURN jsonb_build_object('success', true, 'sinal_id', v_sinal_id, 'valor_sinal_total', v_novo_sinal, 'master_total', v_master_total);
END;
$function$;

-- 2) Sentinela: corrigir status e tipo + adicionar 2 detectores
CREATE OR REPLACE FUNCTION public.get_sentinela_detectores_admin()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_os_sem_item int;
  v_estoque_neg int;
  v_parcela_sem_fin int;
  v_os_sem_parcela int;
  v_os_valor_divergente int;
  v_os_sem_entrada_principal int;
BEGIN
  SELECT count(*) INTO v_os_sem_item
  FROM public.ordens_servico os
  WHERE os.status = 'finalizado'
    AND NOT EXISTS (SELECT 1 FROM public.itens_os i WHERE i.ordem_servico_id = os.id);

  SELECT count(*) INTO v_estoque_neg FROM public.estoque WHERE quantidade < 0;

  SELECT count(*) INTO v_parcela_sem_fin
  FROM public.parcelas_pagamento p
  WHERE p.status = 'pago'
    AND p.ordem_servico_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.financeiro f
      WHERE f.ordem_servico_id = p.ordem_servico_id AND f.tipo = 'entrada'
    );

  SELECT count(*) INTO v_os_sem_parcela
  FROM public.ordens_servico os
  WHERE os.status = 'finalizado'
    AND COALESCE(os.valor_servico, 0) > 0
    AND NOT EXISTS (SELECT 1 FROM public.parcelas_pagamento pp WHERE pp.ordem_servico_id = os.id);

  -- NOVO: OS finalizada com diferença > R$0,05 entre líquido e (sinais + entradas principais)
  WITH sin AS (
    SELECT s.ordem_servico_id, SUM(s.valor) AS sinal_total
    FROM public.os_sinais s GROUP BY 1
  ),
  ent AS (
    SELECT f.ordem_servico_id, SUM(f.valor) AS entradas_principais
    FROM public.financeiro f
    WHERE f.tipo = 'entrada'
      AND f.ordem_servico_id IS NOT NULL
      AND (f.categoria IS NULL OR f.categoria NOT IN ('comissao','sinal'))
    GROUP BY 1
  )
  SELECT count(*) INTO v_os_valor_divergente
  FROM public.ordens_servico os
  LEFT JOIN sin ON sin.ordem_servico_id = os.id
  LEFT JOIN ent ON ent.ordem_servico_id = os.id
  WHERE os.status = 'finalizado'
    AND COALESCE(os.valor_servico,0) > 0
    AND ABS(COALESCE(os.valor_servico,0) - COALESCE(os.desconto,0)
            - COALESCE(sin.sinal_total,0) - COALESCE(ent.entradas_principais,0)) > 0.05;

  -- NOVO: OS finalizada com sinal mas sem nenhum lançamento principal
  SELECT count(*) INTO v_os_sem_entrada_principal
  FROM public.ordens_servico os
  WHERE os.status = 'finalizado'
    AND COALESCE(os.valor_servico,0) > 0
    AND EXISTS (SELECT 1 FROM public.os_sinais s WHERE s.ordem_servico_id = os.id)
    AND NOT EXISTS (
      SELECT 1 FROM public.financeiro f
      WHERE f.ordem_servico_id = os.id
        AND f.tipo = 'entrada'
        AND (f.categoria IS NULL OR f.categoria NOT IN ('comissao','sinal'))
    )
    AND COALESCE(os.valor_servico,0) - COALESCE(os.desconto,0)
        - COALESCE((SELECT SUM(valor) FROM public.os_sinais s WHERE s.ordem_servico_id = os.id), 0) > 0.05;

  RETURN jsonb_build_object(
    'detectores', jsonb_build_array(
      jsonb_build_object('id','os_sem_item','severidade','red','label','OS finalizada sem item','count',v_os_sem_item),
      jsonb_build_object('id','estoque_negativo','severidade','red','label','Estoque negativo','count',v_estoque_neg),
      jsonb_build_object('id','parcela_paga_sem_financeiro','severidade','yellow','label','Parcela paga sem financeiro','count',v_parcela_sem_fin),
      jsonb_build_object('id','os_finalizada_sem_parcela','severidade','yellow','label','OS finalizada > R$0 sem parcela','count',v_os_sem_parcela),
      jsonb_build_object('id','os_finalizada_valor_divergente','severidade','red','label','OS finalizada com valor financeiro divergente','count',v_os_valor_divergente),
      jsonb_build_object('id','os_finalizada_sem_entrada_principal','severidade','red','label','OS finalizada com sinal mas sem entrada principal','count',v_os_sem_entrada_principal)
    ),
    'total_inconsistencias', v_os_sem_item + v_estoque_neg + v_parcela_sem_fin + v_os_sem_parcela + v_os_valor_divergente + v_os_sem_entrada_principal
  );
END;
$function$;
