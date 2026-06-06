-- 1. Função para baixa automática em Venda de Balcão
CREATE OR REPLACE FUNCTION public.baixar_estoque_venda_balcao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
 AS $function$
DECLARE
  item RECORD;
  v_quantidade_atual INTEGER;
BEGIN
  -- Se a venda foi concluída
  IF NEW.status = 'concluida' AND (OLD.status IS DISTINCT FROM 'concluida') THEN
    FOR item IN 
      SELECT iv.estoque_id, iv.quantidade, iv.nome_item
      FROM public.itens_venda_balcao iv
      WHERE iv.venda_id = NEW.id 
      AND iv.estoque_id IS NOT NULL
    LOOP
      SELECT quantidade INTO v_quantidade_atual FROM public.estoque WHERE id = item.estoque_id FOR UPDATE;

      INSERT INTO public.estoque_movimentacoes (
        estoque_id, oficina_id, tipo, quantidade,
        quantidade_anterior, quantidade_nova,
        motivo, referencia_tipo, referencia_id, user_id
      ) VALUES (
        item.estoque_id, NEW.oficina_id, 'saida', item.quantidade,
        v_quantidade_atual, v_quantidade_atual - item.quantidade,
        'Venda Balcão #' || NEW.numero || ': ' || item.nome_item,
        'venda_balcao', NEW.id, NEW.created_by
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Trigger para Venda de Balcão
DROP TRIGGER IF EXISTS trigger_baixar_estoque_venda_balcao ON public.vendas_balcao;
CREATE TRIGGER trigger_baixar_estoque_venda_balcao
AFTER UPDATE ON public.vendas_balcao
FOR EACH ROW EXECUTE FUNCTION public.baixar_estoque_venda_balcao();

-- 3. Melhoria no Trigger de Auditoria Manual
CREATE OR REPLACE FUNCTION public.registrar_movimentacao_manual_estoque()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
 AS $function$
BEGIN
  IF NEW.quantidade IS DISTINCT FROM OLD.quantidade THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.estoque_movimentacoes 
      WHERE estoque_id = NEW.id 
      AND created_at >= now() - interval '2 seconds'
      AND (
        ABS(quantidade_nova - NEW.quantidade) < 0.001 
        OR (referencia_id IS NOT NULL AND referencia_tipo IN ('ordem_servico', 'venda_balcao'))
      )
    ) THEN
      INSERT INTO public.estoque_movimentacoes (
        estoque_id, oficina_id, tipo, quantidade,
        quantidade_anterior, quantidade_nova,
        motivo, user_id
      )
      VALUES (
        NEW.id,
        NEW.oficina_id,
        'ajuste',
        ABS(NEW.quantidade - OLD.quantidade),
        OLD.quantidade,
        NEW.quantidade,
        CASE 
          WHEN NEW.quantidade > OLD.quantidade THEN 'Ajuste manual (Entrada)'
          ELSE 'Ajuste manual (Saída)'
        END,
        auth.uid()
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 4. Re-criação da RPC criar_venda_balcao com os ajustes
DROP FUNCTION IF EXISTS public.criar_venda_balcao(uuid, jsonb, text, uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.criar_venda_balcao(
  p_oficina_id uuid, 
  p_itens jsonb, 
  p_forma_pagamento text, 
  p_forma_pagamento_id uuid DEFAULT NULL, 
  p_cliente_id uuid DEFAULT NULL, 
  p_observacao text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
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
BEGIN
  -- Criamos com status 'pendente' inicialmente
  INSERT INTO vendas_balcao (
    oficina_id, cliente_id, forma_pagamento,
    forma_pagamento_id, observacao, valor_total, created_by, status
  ) VALUES (
    p_oficina_id, p_cliente_id, p_forma_pagamento,
    p_forma_pagamento_id, p_observacao, 0, v_user_id, 'pendente'
  ) RETURNING id, numero INTO v_venda_id, v_numero;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_qty   := COALESCE((v_item->>'quantidade')::NUMERIC, 1);
    v_price := COALESCE((v_item->>'valor_unitario')::NUMERIC, 0);
    v_custo := COALESCE((v_item->>'custo_unitario')::NUMERIC, 0);
    v_estoque_id := NULLIF(v_item->>'estoque_id', '')::UUID;

    -- Inserir o item da venda
    INSERT INTO itens_venda_balcao (
      venda_id, estoque_id, nome_item,
      quantidade, valor_unitario, custo_unitario
    ) VALUES (
      v_venda_id, v_estoque_id, v_item->>'nome_item',
      v_qty, v_price, v_custo
    );

    -- Atualiza estoque (dispara o trigger de auditoria manual se não houver movimento recente)
    IF v_estoque_id IS NOT NULL THEN
      UPDATE estoque
      SET quantidade = quantidade - v_qty,
          ultima_saida = now()
      WHERE id = v_estoque_id;
    END IF;

    v_total := v_total + (v_qty * v_price);
  END LOOP;

  -- Finalizar a venda: dispara o trigger trigger_baixar_estoque_venda_balcao
  -- que registrará a movimentação com o motivo correto e ID da venda
  UPDATE vendas_balcao 
  SET valor_total = v_total, 
      status = 'concluida' 
  WHERE id = v_venda_id;

  RETURN jsonb_build_object('success', true, 'id', v_venda_id, 'numero', v_numero, 'valor_total', v_total);
END;
$function$;
