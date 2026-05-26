
-- Table: commission rates per employee per oficina
CREATE TABLE public.comissoes_funcionarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oficina_id uuid NOT NULL REFERENCES public.oficinas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  percentual numeric NOT NULL DEFAULT 0 CHECK (percentual >= 0 AND percentual <= 100),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (oficina_id, user_id)
);

ALTER TABLE public.comissoes_funcionarios ENABLE ROW LEVEL SECURITY;

-- Only owner/admin can manage commissions
CREATE POLICY "comissoes_select" ON public.comissoes_funcionarios
  FOR SELECT TO authenticated
  USING (has_oficina_access(auth.uid(), oficina_id));

CREATE POLICY "comissoes_manage" ON public.comissoes_funcionarios
  FOR ALL TO authenticated
  USING (is_oficina_owner(auth.uid(), oficina_id) OR has_role(auth.uid(), oficina_id, 'administrador'::app_role));

-- Update RPC to also create commission expense
CREATE OR REPLACE FUNCTION public.upsert_financeiro_os(
  p_oficina_id uuid, 
  p_ordem_servico_id uuid, 
  p_tipo_servico text, 
  p_valor_mao_de_obra numeric, 
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
  v_total_itens numeric;
  v_valor_total numeric;
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
BEGIN
  -- Check if financial record already exists for this OS
  SELECT id INTO v_existing_id
  FROM public.financeiro
  WHERE ordem_servico_id = p_ordem_servico_id
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN json_build_object('success', true, 'action', 'exists', 'id', v_existing_id);
  END IF;

  -- Calculate total from itens_os
  SELECT COALESCE(SUM(COALESCE(valor_total, quantidade * valor_unitario, 0)), 0)
  INTO v_total_itens
  FROM public.itens_os
  WHERE ordem_servico_id = p_ordem_servico_id;

  v_valor_total := COALESCE(p_valor_mao_de_obra, 0) + v_total_itens;

  IF v_valor_total <= 0 THEN
    RETURN json_build_object('success', true, 'action', 'skipped', 'reason', 'zero_value');
  END IF;

  v_num_parcelas := GREATEST(COALESCE(p_numero_parcelas, 1), 1);
  v_parcela_valor := ROUND(v_valor_total / v_num_parcelas, 2);
  v_data_base := CURRENT_DATE;

  IF v_num_parcelas = 1 THEN
    INSERT INTO public.financeiro (
      oficina_id, ordem_servico_id, tipo, origem, valor, data, descricao, status, forma_pagamento_id
    ) VALUES (
      p_oficina_id, p_ordem_servico_id, 'entrada',
      COALESCE(p_origem, 'Serviço ' || p_tipo_servico),
      v_valor_total, CURRENT_DATE,
      p_tipo_servico || ' - OS Finalizada' || 
        CASE WHEN v_total_itens > 0 
          THEN ' (inclui R$' || TRIM(TO_CHAR(v_total_itens, 'FM999999990.00')) || ' em itens)'
          ELSE ''
        END,
      'pago', p_forma_pagamento_id
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_existing_id;
  ELSE
    FOR v_i IN 1..v_num_parcelas LOOP
      IF v_i = v_num_parcelas THEN
        v_parcela_valor := v_valor_total - (ROUND(v_valor_total / v_num_parcelas, 2) * (v_num_parcelas - 1));
      END IF;

      INSERT INTO public.financeiro (
        oficina_id, ordem_servico_id, tipo, origem, valor, data, descricao, status, forma_pagamento_id
      ) VALUES (
        p_oficina_id, p_ordem_servico_id, 'entrada',
        COALESCE(p_origem, 'Serviço ' || p_tipo_servico),
        v_parcela_valor,
        v_data_base + (v_i - 1) * INTERVAL '1 month',
        'Parcela ' || v_i || '/' || v_num_parcelas || ' — ' || p_tipo_servico,
        CASE WHEN v_i = 1 THEN 'pago' ELSE 'a_receber' END,
        p_forma_pagamento_id
      );
    END LOOP;
  END IF;

  -- AUTO-COMMISSION: Check if OS has a responsavel with commission configured
  SELECT os.responsavel_id, os.numero
  INTO v_responsavel_id, v_os_numero
  FROM public.ordens_servico os
  WHERE os.id = p_ordem_servico_id;

  IF v_responsavel_id IS NOT NULL THEN
    SELECT cf.percentual INTO v_comissao_pct
    FROM public.comissoes_funcionarios cf
    WHERE cf.oficina_id = p_oficina_id
      AND cf.user_id = v_responsavel_id
      AND cf.ativo = true;

    IF v_comissao_pct IS NOT NULL AND v_comissao_pct > 0 THEN
      v_comissao_valor := ROUND(COALESCE(p_valor_mao_de_obra, 0) * v_comissao_pct / 100, 2);
      
      IF v_comissao_valor > 0 THEN
        -- Get responsavel name
        SELECT COALESCE(p.nome, 'Funcionário') INTO v_responsavel_nome
        FROM public.profiles p
        WHERE p.user_id = v_responsavel_id;

        INSERT INTO public.financeiro (
          oficina_id, ordem_servico_id, tipo, origem, valor, data, descricao, status
        ) VALUES (
          p_oficina_id, p_ordem_servico_id, 'saida',
          'Comissão',
          v_comissao_valor, CURRENT_DATE,
          'Comissão ' || v_responsavel_nome || ' (' || TRIM(TO_CHAR(v_comissao_pct, 'FM990')) || '%) — OS #' || COALESCE(v_os_numero::text, ''),
          'a_pagar'
        );
      END IF;
    END IF;
  END IF;

  RETURN json_build_object('success', true, 'action', 'created', 'valor', v_valor_total, 'parcelas', v_num_parcelas);

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;
