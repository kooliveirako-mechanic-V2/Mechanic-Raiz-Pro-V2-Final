CREATE OR REPLACE FUNCTION public.reparar_financeiro_historico()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_os RECORD;
  v_criados integer := 0;
  v_ajustados integer := 0;
  v_erros integer := 0;
  v_detalhes jsonb := '[]'::jsonb;
  v_total_os numeric;
  v_total_fin numeric;
  v_diff numeric;
BEGIN
  -- ─── 1) Criar lançamentos faltantes ──────────────────────────────────
  FOR v_os IN
    SELECT os.id, os.oficina_id, os.tipo_servico, os.valor_servico, os.data_conclusao, os.numero, os.forma_pagamento
    FROM ordens_servico os
    WHERE os.status = 'finalizado'
      AND COALESCE(os.valor_servico, 0) > 0
      AND NOT EXISTS (
        SELECT 1 FROM financeiro f WHERE f.ordem_servico_id = os.id
      )
  LOOP
    BEGIN
      INSERT INTO financeiro (
        oficina_id, ordem_servico_id, tipo, origem, valor, data, descricao, status
      ) VALUES (
        v_os.oficina_id, v_os.id, 'entrada',
        'Serviço ' || v_os.tipo_servico,
        v_os.valor_servico,
        COALESCE(v_os.data_conclusao::date, CURRENT_DATE),
        v_os.tipo_servico || ' - OS #' || COALESCE(v_os.numero::text, '') || ' (reparo histórico)',
        'pago'
      );
      v_criados := v_criados + 1;
    EXCEPTION WHEN OTHERS THEN
      v_erros := v_erros + 1;
      v_detalhes := v_detalhes || jsonb_build_object('os_id', v_os.id, 'erro', SQLERRM);
    END;
  END LOOP;

  -- ─── 2) Ajustar valores divergentes ──────────────────────────────────
  -- Soma todos os lançamentos da OS e compara com valor_servico
  FOR v_os IN
    SELECT 
      os.id, 
      os.oficina_id, 
      os.numero,
      os.valor_servico as os_total,
      COALESCE(SUM(f.valor) FILTER (WHERE f.tipo = 'entrada' AND f.origem NOT ILIKE 'Comissão%'), 0) as fin_total,
      COUNT(*) FILTER (WHERE f.tipo = 'entrada' AND f.origem NOT ILIKE 'Comissão%') as fin_count
    FROM ordens_servico os
    JOIN financeiro f ON f.ordem_servico_id = os.id
    WHERE os.status = 'finalizado'
      AND COALESCE(os.valor_servico, 0) > 0
    GROUP BY os.id, os.oficina_id, os.numero, os.valor_servico
    HAVING ABS(COALESCE(SUM(f.valor) FILTER (WHERE f.tipo = 'entrada' AND f.origem NOT ILIKE 'Comissão%'), 0) - os.valor_servico) > 0.01
  LOOP
    BEGIN
      -- Só ajusta se houver exatamente 1 lançamento de entrada (caso simples sem parcelas)
      IF v_os.fin_count = 1 THEN
        UPDATE financeiro
        SET valor = v_os.os_total,
            descricao = COALESCE(descricao, '') || ' [valor ajustado por reparo histórico]',
            updated_at = now()
        WHERE ordem_servico_id = v_os.id
          AND tipo = 'entrada'
          AND origem NOT ILIKE 'Comissão%';
        v_ajustados := v_ajustados + 1;
      ELSE
        -- Múltiplas parcelas: registra como divergência mas não toca (manual)
        v_detalhes := v_detalhes || jsonb_build_object(
          'os_id', v_os.id,
          'numero', v_os.numero,
          'os_total', v_os.os_total,
          'fin_total', v_os.fin_total,
          'parcelas', v_os.fin_count,
          'acao', 'ignorado_parcelado'
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_erros := v_erros + 1;
      v_detalhes := v_detalhes || jsonb_build_object('os_id', v_os.id, 'erro', SQLERRM);
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'criados', v_criados,
    'ajustados', v_ajustados,
    'erros', v_erros,
    'detalhes', v_detalhes
  );
END;
$$;