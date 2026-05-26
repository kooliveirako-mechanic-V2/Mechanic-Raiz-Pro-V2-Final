-- Adicionar coluna para fotos de conclusão/saída da OS
ALTER TABLE public.ordens_servico 
ADD COLUMN IF NOT EXISTS fotos_saida text[] DEFAULT '{}'::text[];

-- Adicionar coluna para data de conclusão
ALTER TABLE public.ordens_servico 
ADD COLUMN IF NOT EXISTS data_conclusao date;

-- Adicionar coluna para observações de conclusão
ALTER TABLE public.ordens_servico 
ADD COLUMN IF NOT EXISTS observacoes_conclusao text;

-- Comentários para documentação
COMMENT ON COLUMN public.ordens_servico.fotos_saida IS 'Fotos tiradas na conclusão do serviço';
COMMENT ON COLUMN public.ordens_servico.data_conclusao IS 'Data em que o serviço foi concluído';
COMMENT ON COLUMN public.ordens_servico.observacoes_conclusao IS 'Observações do mecânico na conclusão';