-- Adicionar novos campos à tabela estoque
ALTER TABLE public.estoque 
ADD COLUMN IF NOT EXISTS localizacao TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS fornecedor_nome TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS fornecedor_telefone TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS fornecedor_email TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS codigo TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ultima_entrada TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ultima_saida TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Criar tabela de movimentações de estoque
CREATE TABLE IF NOT EXISTS public.estoque_movimentacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  estoque_id UUID NOT NULL REFERENCES public.estoque(id) ON DELETE CASCADE,
  oficina_id UUID NOT NULL REFERENCES public.oficinas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida', 'ajuste')),
  quantidade INTEGER NOT NULL,
  quantidade_anterior INTEGER NOT NULL,
  quantidade_nova INTEGER NOT NULL,
  motivo TEXT DEFAULT NULL,
  referencia_tipo TEXT DEFAULT NULL, -- 'ordem_servico', 'orcamento', 'manual', 'compra'
  referencia_id UUID DEFAULT NULL,
  custo_unitario NUMERIC DEFAULT NULL,
  user_id UUID DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.estoque_movimentacoes ENABLE ROW LEVEL SECURITY;

-- RLS Policies para movimentações
CREATE POLICY "Usuários podem ver movimentações de suas oficinas"
ON public.estoque_movimentacoes
FOR SELECT
USING (has_oficina_access(auth.uid(), oficina_id));

CREATE POLICY "Usuários podem criar movimentações em suas oficinas"
ON public.estoque_movimentacoes
FOR INSERT
WITH CHECK (has_oficina_access(auth.uid(), oficina_id));

-- Função para registrar movimentação automática
CREATE OR REPLACE FUNCTION public.registrar_movimentacao_estoque()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_tipo TEXT;
  v_motivo TEXT;
BEGIN
  -- Determinar tipo de movimentação
  IF NEW.quantidade > OLD.quantidade THEN
    v_tipo := 'entrada';
    v_motivo := 'Ajuste manual de entrada';
  ELSIF NEW.quantidade < OLD.quantidade THEN
    v_tipo := 'saida';
    v_motivo := 'Ajuste manual de saída';
  ELSE
    -- Quantidade não mudou, não registrar
    RETURN NEW;
  END IF;

  -- Registrar movimentação
  INSERT INTO public.estoque_movimentacoes (
    estoque_id,
    oficina_id,
    tipo,
    quantidade,
    quantidade_anterior,
    quantidade_nova,
    motivo,
    referencia_tipo,
    user_id
  ) VALUES (
    NEW.id,
    NEW.oficina_id,
    v_tipo,
    ABS(NEW.quantidade - OLD.quantidade),
    OLD.quantidade,
    NEW.quantidade,
    v_motivo,
    'manual',
    auth.uid()
  );

  -- Atualizar timestamps
  IF NEW.quantidade > OLD.quantidade THEN
    NEW.ultima_entrada := now();
  ELSE
    NEW.ultima_saida := now();
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger para registrar movimentações automaticamente
CREATE TRIGGER trigger_registrar_movimentacao_estoque
BEFORE UPDATE OF quantidade ON public.estoque
FOR EACH ROW
EXECUTE FUNCTION public.registrar_movimentacao_estoque();

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_estoque_movimentacoes_estoque_id 
ON public.estoque_movimentacoes(estoque_id);

CREATE INDEX IF NOT EXISTS idx_estoque_movimentacoes_created_at 
ON public.estoque_movimentacoes(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_estoque_localizacao 
ON public.estoque(localizacao) 
WHERE localizacao IS NOT NULL;