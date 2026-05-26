
-- Add valor_mao_obra to itens_os (labor cost per item in work orders)
ALTER TABLE public.itens_os ADD COLUMN valor_mao_obra numeric DEFAULT 0;

-- Add valor_mao_obra to itens_orcamento (labor cost per item in quotes)
ALTER TABLE public.itens_orcamento ADD COLUMN valor_mao_obra numeric DEFAULT 0;
