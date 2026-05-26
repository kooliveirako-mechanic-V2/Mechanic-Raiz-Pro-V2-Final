
-- C1: Atomic upsert function for financial records on OS finalization
-- Replaces the SELECT+INSERT race condition pattern
CREATE OR REPLACE FUNCTION public.upsert_financeiro_os(
  p_oficina_id uuid,
  p_ordem_servico_id uuid,
  p_tipo_servico text,
  p_valor_mao_de_obra numeric,
  p_forma_pagamento_id uuid DEFAULT NULL,
  p_origem text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_itens numeric;
  v_valor_total numeric;
  v_existing_id uuid;
  v_result json;
BEGIN
  -- Check if financial record already exists
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

  -- Skip if total is zero
  IF v_valor_total <= 0 THEN
    RETURN json_build_object('success', true, 'action', 'skipped', 'reason', 'zero_value');
  END IF;

  -- Insert financial record
  INSERT INTO public.financeiro (
    oficina_id,
    ordem_servico_id,
    tipo,
    origem,
    valor,
    data,
    descricao,
    status,
    forma_pagamento_id
  ) VALUES (
    p_oficina_id,
    p_ordem_servico_id,
    'entrada',
    COALESCE(p_origem, 'Serviço ' || p_tipo_servico),
    v_valor_total,
    CURRENT_DATE,
    p_tipo_servico || ' - OS Finalizada' || 
      CASE WHEN v_total_itens > 0 
        THEN ' (inclui R$' || TRIM(TO_CHAR(v_total_itens, 'FM999999990.00')) || ' em itens)'
        ELSE ''
      END,
    'pago',
    p_forma_pagamento_id
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_existing_id;

  IF v_existing_id IS NOT NULL THEN
    RETURN json_build_object('success', true, 'action', 'created', 'id', v_existing_id, 'valor', v_valor_total);
  ELSE
    -- Concurrent insert happened
    RETURN json_build_object('success', true, 'action', 'exists');
  END IF;

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Add unique constraint to prevent duplicate financial records per OS
-- Using a partial unique index (only one financeiro per ordem_servico_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_financeiro_ordem_servico_unique 
ON public.financeiro (ordem_servico_id) 
WHERE ordem_servico_id IS NOT NULL;
