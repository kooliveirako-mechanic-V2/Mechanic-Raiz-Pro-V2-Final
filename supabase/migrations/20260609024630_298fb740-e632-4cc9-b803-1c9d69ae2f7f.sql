-- 1. Melhorar fn_tg_reabrir_os para garantir integridade financeira
CREATE OR REPLACE FUNCTION public.fn_tg_reabrir_os()
 RETURNS trigger
 LANGUAGE plpgsql
 AS $function$
DECLARE
    v_item RECORD;
BEGIN
    -- Se mudar de 'finalizado' para qualquer outro status
    IF OLD.status = 'finalizado' AND NEW.status != 'finalizado' THEN

        -- A. LOG DA REABERTURA PARA AUDITORIA
        INSERT INTO public.log_financeiro_estoque_audit (
            oficina_id, entidade_tipo, entidade_id, acao, dados_anteriores
        )
        VALUES (
            OLD.oficina_id,
            'ordem_servico',
            OLD.id,
            'reabertura',
            jsonb_build_object(
                'status', OLD.status, 
                'numero', OLD.numero, 
                'valor_servico', OLD.valor_servico,
                'data_reabertura', now()
            )
        );

        -- B. PROTEÇÃO DO CAIXA REAL (COMPETÊNCIA MANTIDA, CAIXA MANTIDO)
        -- Marcamos lançamentos pagos como 'vinculados a OS reaberta' para o contador saber
        UPDATE public.financeiro
        SET observacoes_contador = COALESCE(observacoes_contador, '') || ' [OS #' || OLD.numero || ' REABERTA - Pagamento mantido]',
            updated_at = now()
        WHERE ordem_servico_id = OLD.id 
        AND status = 'pago';

        -- C. CANCELAR SALDO A RECEBER (Para não duplicar faturamento ao refinalizar)
        UPDATE public.financeiro
        SET status = 'cancelado',
            observacoes_contador = COALESCE(observacoes_contador, '') || ' [Cancelado por reabertura OS #' || OLD.numero || ']',
            updated_at = now()
        WHERE ordem_servico_id = OLD.id 
        AND status IN ('a_receber', 'a_pagar');

    END IF;

    RETURN NEW;
END;
$function$;

-- 2. Garantir que o cancelamento de OS também trate o financeiro corretamente
CREATE OR REPLACE FUNCTION public.fn_tg_cancelar_os()
 RETURNS trigger
 LANGUAGE plpgsql
 AS $function$
BEGIN
    IF NEW.status = 'cancelado' AND OLD.status != 'cancelado' THEN
        -- Se não houve pagamento, cancelamos tudo no financeiro
        -- Se houve pagamento, o administrador deve decidir se estorna (reembolso) ou mantém
        -- Por padrão, cancelamos apenas o que está 'a_receber'
        UPDATE public.financeiro
        SET status = 'cancelado',
            observacoes_contador = COALESCE(observacoes_contador, '') || ' [OS CANCELADA #' || OLD.numero || ']',
            updated_at = now()
        WHERE ordem_servico_id = OLD.id 
        AND status = 'a_receber';
        
        -- Log de cancelamento
        INSERT INTO public.log_financeiro_estoque_audit (
            oficina_id, entidade_tipo, entidade_id, acao, dados_anteriores
        )
        VALUES (
            OLD.oficina_id,
            'ordem_servico',
            OLD.id,
            'cancelamento',
            jsonb_build_object('status', OLD.status, 'valor', OLD.valor_servico)
        );
    END IF;
    RETURN NEW;
END;
$function$;

-- Tentar criar o trigger de cancelamento se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tg_cancelar_os') THEN
        CREATE TRIGGER tg_cancelar_os
        BEFORE UPDATE OF status ON public.ordens_servico
        FOR EACH ROW EXECUTE FUNCTION fn_tg_cancelar_os();
    END IF;
END $$;

-- 3. Ajustar criar_venda_balcao para garantir lançamento financeiro imediato
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
  v_qty NUMERIC;
  v_price NUMERIC;
  v_custo NUMERIC;
  v_estoque_id UUID;
  v_user_id UUID := auth.uid();
  v_financeiro_id UUID;
BEGIN
  -- 1. Criar a venda (status pendente)
  INSERT INTO vendas_balcao (
    oficina_id, cliente_id, forma_pagamento, 
    forma_pagamento_id, observacao, valor_total, created_by, status
  ) VALUES (
    p_oficina_id, p_cliente_id, p_forma_pagamento, 
    p_forma_pagamento_id, p_observacao, 0, v_user_id, 'pendente'
  ) RETURNING id, numero INTO v_venda_id, v_numero;

  -- 2. Processar itens
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

    -- Atualizar estoque manualmente para garantir baixa imediata
    IF v_estoque_id IS NOT NULL THEN
      UPDATE estoque 
      SET quantidade = GREATEST(0, quantidade - v_qty),
          ultima_saida = now()
      WHERE id = v_estoque_id;
    END IF;

    v_total := v_total + (v_qty * v_price);
  END LOOP;

  -- 3. Finalizar Venda e Lançar no Financeiro
  IF v_total > 0 THEN
    INSERT INTO financeiro (
      oficina_id,
      tipo,
      categoria,
      valor,
      status,
      descricao,
      data_vencimento,
      data_pagamento,
      forma_pagamento_id,
      venda_balcao_id
    ) VALUES (
      p_oficina_id,
      'entrada',
      'venda_balcao',
      v_total,
      'pago', -- Venda balcão assume-se paga no ato
      'Venda Balcão #' || v_numero,
      CURRENT_DATE,
      now(),
      p_forma_pagamento_id,
      v_venda_id
    ) RETURNING id INTO v_financeiro_id;
  END IF;

  UPDATE vendas_balcao 
  SET valor_total = v_total,
      status = 'concluida',
      financeiro_id = v_financeiro_id
  WHERE id = v_venda_id;

  RETURN jsonb_build_object(
    'success', true, 
    'id', v_venda_id, 
    'numero', v_numero, 
    'valor_total', v_total,
    'financeiro_id', v_financeiro_id
  );
END;
$function$;

-- 4. Criar função para cancelamento manual de venda balcão (caso não queiram deletar)
CREATE OR REPLACE FUNCTION public.cancelar_venda_balcao(p_venda_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 AS $function$
DECLARE
    v_venda RECORD;
BEGIN
    SELECT * INTO v_venda FROM public.vendas_balcao WHERE id = p_venda_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Venda não encontrada');
    END IF;
    
    IF v_venda.status = 'cancelada' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Venda já cancelada');
    END IF;
    
    -- O estorno de estoque e financeiro será disparado pelo trigger de update de status ou delete
    UPDATE public.vendas_balcao
    SET status = 'cancelada'
    WHERE id = p_venda_id;
    
    RETURN jsonb_build_object('success', true);
END;
$function$;

-- 5. Atualizar trigger_estornar_venda_balcao para lidar com cancelamento (UPDATE)
CREATE OR REPLACE FUNCTION public.estornar_venda_balcao()
 RETURNS trigger
 LANGUAGE plpgsql
 AS $function$
DECLARE
  item RECORD;
  v_quantidade_atual INTEGER;
BEGIN
  -- Se foi excluída OU status mudou para 'cancelada'
  IF (TG_OP = 'DELETE' AND OLD.status = 'concluida') OR 
     (TG_OP = 'UPDATE' AND OLD.status = 'concluida' AND NEW.status = 'cancelada') THEN
     
    FOR item IN 
      SELECT ivb.estoque_id, ivb.quantidade, ivb.nome_item 
      FROM public.itens_venda_balcao ivb 
      WHERE ivb.venda_id = OLD.id 
      AND ivb.estoque_id IS NOT NULL 
    LOOP
      -- Devolver ao estoque
      SELECT quantidade INTO v_quantidade_atual FROM public.estoque WHERE id = item.estoque_id;
      
      UPDATE public.estoque 
      SET quantidade = quantidade + item.quantidade 
      WHERE id = item.estoque_id;
      
      -- Registrar movimentação de estorno
      INSERT INTO public.estoque_movimentacoes (
        estoque_id, oficina_id, tipo, quantidade,
        quantidade_anterior, quantidade_nova,
        motivo, referencia_tipo, referencia_id, user_id
      ) VALUES (
        item.estoque_id, OLD.oficina_id, 'entrada', item.quantidade,
        v_quantidade_atual, v_quantidade_atual + item.quantidade,
        'Estorno (Venda ' || (CASE WHEN TG_OP = 'DELETE' THEN 'Excluída' ELSE 'Cancelada' END) || '): ' || item.nome_item,
        'venda_balcao', OLD.id, auth.uid()
      );
    END LOOP;

    -- Estornar financeiro associado (marcar como cancelado para manter rastro)
    UPDATE public.financeiro 
    SET status = 'cancelado',
        observacoes_contador = COALESCE(observacoes_contador, '') || ' [Venda Balcão Cancelada #' || OLD.numero || ']',
        updated_at = now()
    WHERE venda_balcao_id = OLD.id;
    
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;

-- Recriar trigger de estorno para disparar no UPDATE também
DROP TRIGGER IF EXISTS trigger_estornar_venda_balcao ON public.vendas_balcao;
CREATE TRIGGER trigger_estornar_venda_balcao
AFTER DELETE OR UPDATE OF status ON public.vendas_balcao
FOR EACH ROW EXECUTE FUNCTION estornar_venda_balcao();

-- 6. Garantir GRANTs
GRANT EXECUTE ON FUNCTION public.criar_venda_balcao TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_venda_balcao TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_tg_reabrir_os TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_tg_cancelar_os TO authenticated;
