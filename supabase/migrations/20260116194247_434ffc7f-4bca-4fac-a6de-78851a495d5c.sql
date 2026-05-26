-- Create table for quotes/budgets
CREATE TABLE public.orcamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  oficina_id UUID NOT NULL REFERENCES public.oficinas(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  veiculo_id UUID REFERENCES public.veiculos(id) ON DELETE SET NULL,
  numero INTEGER,
  titulo TEXT NOT NULL,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'enviado', 'aprovado', 'rejeitado', 'convertido')),
  validade DATE,
  valor_total NUMERIC DEFAULT 0,
  custo_total NUMERIC DEFAULT 0,
  desconto NUMERIC DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for quote items (linked to inventory)
CREATE TABLE public.itens_orcamento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  orcamento_id UUID NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  estoque_id UUID REFERENCES public.estoque(id) ON DELETE SET NULL,
  nome_item TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'produto' CHECK (tipo IN ('produto', 'servico')),
  quantidade INTEGER NOT NULL DEFAULT 1,
  valor_unitario NUMERIC DEFAULT 0,
  custo_unitario NUMERIC DEFAULT 0,
  valor_total NUMERIC GENERATED ALWAYS AS (quantidade * valor_unitario) STORED,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_orcamento ENABLE ROW LEVEL SECURITY;

-- RLS policies for orcamentos
CREATE POLICY "Usuários podem ver orçamentos de suas oficinas" 
ON public.orcamentos 
FOR SELECT 
USING (has_oficina_access(auth.uid(), oficina_id));

CREATE POLICY "Usuários podem criar orçamentos em suas oficinas" 
ON public.orcamentos 
FOR INSERT 
WITH CHECK (has_oficina_access(auth.uid(), oficina_id));

CREATE POLICY "Usuários podem atualizar orçamentos de suas oficinas" 
ON public.orcamentos 
FOR UPDATE 
USING (has_oficina_access(auth.uid(), oficina_id));

CREATE POLICY "Proprietários podem deletar orçamentos" 
ON public.orcamentos 
FOR DELETE 
USING (is_oficina_owner(auth.uid(), oficina_id));

-- RLS policies for itens_orcamento
CREATE POLICY "Usuários podem ver itens de orçamentos de suas oficinas" 
ON public.itens_orcamento 
FOR SELECT 
USING (orcamento_id IN (
  SELECT id FROM public.orcamentos WHERE has_oficina_access(auth.uid(), oficina_id)
));

CREATE POLICY "Usuários podem criar itens em orçamentos de suas oficinas" 
ON public.itens_orcamento 
FOR INSERT 
WITH CHECK (orcamento_id IN (
  SELECT id FROM public.orcamentos WHERE has_oficina_access(auth.uid(), oficina_id)
));

CREATE POLICY "Usuários podem atualizar itens de orçamentos de suas oficinas" 
ON public.itens_orcamento 
FOR UPDATE 
USING (orcamento_id IN (
  SELECT id FROM public.orcamentos WHERE has_oficina_access(auth.uid(), oficina_id)
));

CREATE POLICY "Usuários podem deletar itens de orçamentos de suas oficinas" 
ON public.itens_orcamento 
FOR DELETE 
USING (orcamento_id IN (
  SELECT id FROM public.orcamentos WHERE has_oficina_access(auth.uid(), oficina_id)
));

-- Trigger to update updated_at
CREATE TRIGGER update_orcamentos_updated_at
BEFORE UPDATE ON public.orcamentos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to auto-generate quote number
CREATE OR REPLACE FUNCTION public.generate_orcamento_numero()
RETURNS TRIGGER AS $$
DECLARE
  last_numero INTEGER;
BEGIN
  SELECT COALESCE(MAX(numero), 0) INTO last_numero
  FROM public.orcamentos
  WHERE oficina_id = NEW.oficina_id;
  
  NEW.numero := last_numero + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_orcamento_numero
BEFORE INSERT ON public.orcamentos
FOR EACH ROW
EXECUTE FUNCTION public.generate_orcamento_numero();

-- Function to deduct stock when quote is converted to OS
CREATE OR REPLACE FUNCTION public.baixar_estoque_orcamento(p_orcamento_id UUID)
RETURNS VOID AS $$
DECLARE
  item RECORD;
BEGIN
  FOR item IN 
    SELECT estoque_id, quantidade 
    FROM public.itens_orcamento 
    WHERE orcamento_id = p_orcamento_id 
    AND estoque_id IS NOT NULL
  LOOP
    UPDATE public.estoque 
    SET quantidade = quantidade - item.quantidade
    WHERE id = item.estoque_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;