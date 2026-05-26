ALTER TABLE public.financeiro DROP CONSTRAINT IF EXISTS financeiro_categoria_check;
ALTER TABLE public.financeiro ADD CONSTRAINT financeiro_categoria_check
  CHECK (categoria = ANY (ARRAY['operacional'::text, 'prejuizo'::text, 'comissao'::text, 'sinal'::text, 'venda_balcao'::text]));