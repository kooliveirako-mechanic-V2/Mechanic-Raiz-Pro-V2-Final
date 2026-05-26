-- 1. Add tipo column to itens_os (mirrors itens_orcamento)
ALTER TABLE public.itens_os
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'produto'
  CHECK (tipo IN ('servico','produto'));

-- Backfill: itens vinculados ao estoque = peça; itens livres sem custo e com mão de obra/valor = serviço
UPDATE public.itens_os SET tipo = 'produto' WHERE estoque_id IS NOT NULL;
UPDATE public.itens_os SET tipo = 'servico'
  WHERE estoque_id IS NULL
    AND COALESCE(custo_unitario, 0) = 0
    AND (COALESCE(valor_mao_obra, 0) > 0 OR COALESCE(valor_unitario, 0) > 0);

-- 2. Dados de identificação da oficina para cabeçalho/rodapé profissional
ALTER TABLE public.oficinas
  ADD COLUMN IF NOT EXISTS cpf_cnpj TEXT,
  ADD COLUMN IF NOT EXISTS email_contato TEXT,
  ADD COLUMN IF NOT EXISTS responsavel_tecnico TEXT;