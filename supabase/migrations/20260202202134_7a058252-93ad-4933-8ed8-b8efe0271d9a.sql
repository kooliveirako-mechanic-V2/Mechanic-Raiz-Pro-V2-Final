-- ============================================
-- 1. BAIXA AUTOMÁTICA DE ESTOQUE
-- Trigger que desconta estoque quando OS é finalizada
-- ============================================

CREATE OR REPLACE FUNCTION public.baixar_estoque_os()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item RECORD;
  v_quantidade_atual INTEGER;
BEGIN
  -- Só executa se status mudou para 'finalizado'
  IF NEW.status = 'finalizado' AND (OLD.status IS DISTINCT FROM 'finalizado') THEN
    -- Para cada item da OS que tenha estoque_id
    FOR item IN 
      SELECT ios.estoque_id, ios.quantidade, ios.nome_item, ios.id as item_id
      FROM public.itens_os ios
      WHERE ios.ordem_servico_id = NEW.id 
      AND ios.estoque_id IS NOT NULL
    LOOP
      -- Buscar quantidade atual do estoque
      SELECT quantidade INTO v_quantidade_atual
      FROM public.estoque
      WHERE id = item.estoque_id;

      -- Atualizar quantidade no estoque
      UPDATE public.estoque 
      SET 
        quantidade = GREATEST(0, quantidade - item.quantidade),
        ultima_saida = now()
      WHERE id = item.estoque_id;

      -- Registrar movimentação de saída
      INSERT INTO public.estoque_movimentacoes (
        estoque_id,
        oficina_id,
        tipo,
        quantidade,
        quantidade_anterior,
        quantidade_nova,
        motivo,
        referencia_tipo,
        referencia_id,
        user_id
      ) VALUES (
        item.estoque_id,
        NEW.oficina_id,
        'saida',
        item.quantidade,
        v_quantidade_atual,
        GREATEST(0, v_quantidade_atual - item.quantidade),
        'Baixa automática - OS finalizada: ' || item.nome_item,
        'ordem_servico',
        NEW.id,
        auth.uid()
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para baixa automática
DROP TRIGGER IF EXISTS trigger_baixar_estoque_os ON public.ordens_servico;
CREATE TRIGGER trigger_baixar_estoque_os
  AFTER UPDATE ON public.ordens_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.baixar_estoque_os();

-- ============================================
-- 2. TABELA DE PARCELAS DE PAGAMENTO
-- Suporte a pagamentos parcelados
-- ============================================

CREATE TABLE IF NOT EXISTS public.parcelas_pagamento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  oficina_id UUID NOT NULL REFERENCES public.oficinas(id) ON DELETE CASCADE,
  ordem_servico_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  orcamento_id UUID REFERENCES public.orcamentos(id) ON DELETE SET NULL,
  
  -- Dados da parcela
  numero_parcela INTEGER NOT NULL DEFAULT 1,
  total_parcelas INTEGER NOT NULL DEFAULT 1,
  valor NUMERIC NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  
  -- Status e forma
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'atrasado', 'cancelado')),
  forma_pagamento_id UUID REFERENCES public.formas_pagamento(id),
  
  -- Observações
  observacoes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_parcelas_oficina ON public.parcelas_pagamento(oficina_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_os ON public.parcelas_pagamento(ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_vencimento ON public.parcelas_pagamento(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_parcelas_status ON public.parcelas_pagamento(status);

-- Enable RLS
ALTER TABLE public.parcelas_pagamento ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Usuários podem ver parcelas de suas oficinas" 
ON public.parcelas_pagamento 
FOR SELECT 
USING (has_oficina_access(auth.uid(), oficina_id));

CREATE POLICY "Usuários podem criar parcelas em suas oficinas" 
ON public.parcelas_pagamento 
FOR INSERT 
WITH CHECK (has_oficina_access(auth.uid(), oficina_id));

CREATE POLICY "Admins podem atualizar parcelas" 
ON public.parcelas_pagamento 
FOR UPDATE 
USING (can_access_financial_data(oficina_id, auth.uid()));

CREATE POLICY "Proprietários podem deletar parcelas" 
ON public.parcelas_pagamento 
FOR DELETE 
USING (is_oficina_owner(auth.uid(), oficina_id));

-- Trigger para updated_at
CREATE TRIGGER update_parcelas_updated_at
  BEFORE UPDATE ON public.parcelas_pagamento
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 3. FUNÇÃO PARA ATUALIZAR STATUS DE PARCELAS ATRASADAS
-- Executar diariamente para marcar parcelas vencidas
-- ============================================

CREATE OR REPLACE FUNCTION public.atualizar_parcelas_atrasadas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.parcelas_pagamento
  SET status = 'atrasado'
  WHERE status = 'pendente'
    AND data_vencimento < CURRENT_DATE;
END;
$$;

-- ============================================
-- 4. ALERTAS DE GARANTIA VENCENDO
-- Adicionar campo para controle de notificação de garantia
-- ============================================

ALTER TABLE public.ordens_servico 
ADD COLUMN IF NOT EXISTS alerta_garantia_enviado BOOLEAN DEFAULT false;

-- Índice para busca eficiente de garantias
CREATE INDEX IF NOT EXISTS idx_os_garantia_vencendo 
ON public.ordens_servico(oficina_id, status, tem_garantia, data_conclusao, dias_garantia)
WHERE status = 'finalizado' AND tem_garantia = true;