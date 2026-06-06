-- 1. GATILHO PARA RASTREAR ALTERAÇÕES MANUAIS NO ESTOQUE
CREATE OR REPLACE FUNCTION public.registrar_movimentacao_manual_estoque()
RETURNS TRIGGER AS $$
BEGIN
  -- Só registra se a quantidade mudou e não foi uma movimentação já registrada por outro processo (que passaria motivo/referencia)
  -- Como o app faz o update direto na coluna 'quantidade', pegamos as mudanças que não vêm de triggers específicos
  IF NEW.quantidade IS DISTINCT FROM OLD.quantidade THEN
    -- Verifica se já existe uma movimentação criada neste mesmo statement/transação para este item
    -- Se não houver, criamos uma de 'ajuste manual'
    INSERT INTO public.estoque_movimentacoes (
      estoque_id,
      oficina_id,
      tipo,
      quantidade,
      quantidade_anterior,
      quantidade_nova,
      motivo,
      user_id
    )
    SELECT 
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
    WHERE NOT EXISTS (
      SELECT 1 FROM public.estoque_movimentacoes 
      WHERE estoque_id = NEW.id 
      AND created_at >= now() - interval '1 second'
      AND ABS(quantidade_nova - NEW.quantidade) < 0.001
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_movimentacao_manual_estoque ON public.estoque;
CREATE TRIGGER trigger_movimentacao_manual_estoque
  AFTER UPDATE OF quantidade ON public.estoque
  FOR EACH ROW
  EXECUTE FUNCTION public.registrar_movimentacao_manual_estoque();

-- 2. FUNÇÃO PARA ESTORNAR ESTOQUE DE OS
CREATE OR REPLACE FUNCTION public.estornar_estoque_os()
RETURNS TRIGGER AS $$
DECLARE
  item RECORD;
  v_quantidade_atual INTEGER;
BEGIN
  -- Se a OS estava finalizada e mudou para outro status OU foi deletada
  IF (TG_OP = 'DELETE' AND OLD.status = 'finalizado') OR 
     (TG_OP = 'UPDATE' AND OLD.status = 'finalizado' AND NEW.status IS DISTINCT FROM 'finalizado') THEN
    
    FOR item IN 
      SELECT ios.estoque_id, ios.quantidade, ios.nome_item
      FROM public.itens_os ios
      WHERE ios.ordem_servico_id = OLD.id 
      AND ios.estoque_id IS NOT NULL
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
        'Estorno (OS ' || (CASE WHEN TG_OP = 'DELETE' THEN 'Excluída' ELSE 'Reaberta' END) || '): ' || item.nome_item,
        'ordem_servico', OLD.id, auth.uid()
      );
    END LOOP;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_estornar_estoque_os ON public.ordens_servico;
CREATE TRIGGER trigger_estornar_estoque_os
  AFTER UPDATE OR DELETE ON public.ordens_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.estornar_estoque_os();

-- 3. FUNÇÃO PARA ESTORNAR VENDA BALCÃO
CREATE OR REPLACE FUNCTION public.estornar_venda_balcao()
RETURNS TRIGGER AS $$
DECLARE
  item RECORD;
  v_quantidade_atual INTEGER;
BEGIN
  -- Venda balcão é sempre 'finalizada' ao criar, então estornamos no DELETE
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
      'Estorno (Venda Excluída): ' || item.nome_item,
      'venda_balcao', OLD.id, auth.uid()
    );
  END LOOP;

  -- Estornar financeiro associado
  DELETE FROM public.financeiro 
  WHERE (ordem_servico_id IS NULL AND venda_balcao_id = OLD.id)
     OR (descricao LIKE '%Venda Balcão #' || OLD.numero || '%');

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_estornar_venda_balcao ON public.vendas_balcao;
CREATE TRIGGER trigger_estornar_venda_balcao
  AFTER DELETE ON public.vendas_balcao
  FOR EACH ROW
  EXECUTE FUNCTION public.estornar_venda_balcao();