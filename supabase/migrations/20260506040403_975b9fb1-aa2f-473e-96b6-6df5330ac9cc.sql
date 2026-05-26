-- Adicionar coluna categoria
ALTER TABLE public.financeiro
ADD COLUMN IF NOT EXISTS categoria TEXT NOT NULL DEFAULT 'operacional';

-- Reclassificar comissões existentes
UPDATE public.financeiro SET categoria = 'comissao'
WHERE origem ILIKE 'Comiss%o%' AND categoria = 'operacional';

-- Reclassificar sinais existentes
UPDATE public.financeiro SET categoria = 'sinal'
WHERE origem ILIKE 'Sinal OS%' AND categoria = 'operacional';

-- Index para performance
CREATE INDEX IF NOT EXISTS idx_financeiro_categoria
ON public.financeiro(categoria, oficina_id, data);

-- Constraint opcional de valores válidos
ALTER TABLE public.financeiro
DROP CONSTRAINT IF EXISTS financeiro_categoria_check;

ALTER TABLE public.financeiro
ADD CONSTRAINT financeiro_categoria_check
CHECK (categoria IN ('operacional', 'prejuizo', 'comissao', 'sinal'));