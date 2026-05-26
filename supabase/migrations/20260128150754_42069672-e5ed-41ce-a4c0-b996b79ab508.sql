-- Adicionar campos fiscais na tabela oficina_configuracoes
ALTER TABLE public.oficina_configuracoes
ADD COLUMN IF NOT EXISTS razao_social TEXT,
ADD COLUMN IF NOT EXISTS cnpj TEXT,
ADD COLUMN IF NOT EXISTS inscricao_municipal TEXT,
ADD COLUMN IF NOT EXISTS municipio TEXT,
ADD COLUMN IF NOT EXISTS regime_tributario TEXT DEFAULT 'mei',
ADD COLUMN IF NOT EXISTS cfop_servicos TEXT DEFAULT '5933',
ADD COLUMN IF NOT EXISTS cfop_vendas TEXT DEFAULT '5102';

-- Adicionar campo NCM na tabela estoque
ALTER TABLE public.estoque
ADD COLUMN IF NOT EXISTS ncm TEXT;

-- Adicionar campo tipo_item na tabela estoque (peça/insumo)
ALTER TABLE public.estoque
ADD COLUMN IF NOT EXISTS tipo_item TEXT DEFAULT 'peca';

-- Comentários para documentação
COMMENT ON COLUMN public.oficina_configuracoes.razao_social IS 'Razão social da oficina para fins fiscais';
COMMENT ON COLUMN public.oficina_configuracoes.cnpj IS 'CNPJ da oficina';
COMMENT ON COLUMN public.oficina_configuracoes.inscricao_municipal IS 'Inscrição municipal da oficina';
COMMENT ON COLUMN public.oficina_configuracoes.municipio IS 'Município da oficina';
COMMENT ON COLUMN public.oficina_configuracoes.regime_tributario IS 'Regime tributário: mei, simples, lucro_presumido, lucro_real';
COMMENT ON COLUMN public.oficina_configuracoes.cfop_servicos IS 'CFOP padrão para serviços';
COMMENT ON COLUMN public.oficina_configuracoes.cfop_vendas IS 'CFOP padrão para vendas';
COMMENT ON COLUMN public.estoque.ncm IS 'Código NCM do produto (8 dígitos)';
COMMENT ON COLUMN public.estoque.tipo_item IS 'Tipo do item: peca ou insumo';