-- Adicionar coluna tipo_veiculo na tabela estoque
ALTER TABLE public.estoque 
ADD COLUMN tipo_veiculo TEXT DEFAULT 'ambos' CHECK (tipo_veiculo IN ('carro', 'moto', 'ambos'));

-- Adicionar comentário para documentação
COMMENT ON COLUMN public.estoque.tipo_veiculo IS 'Tipo de veículo para o item: carro, moto ou ambos';