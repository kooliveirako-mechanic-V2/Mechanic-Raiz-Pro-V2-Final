-- Adiciona coluna custo_unitario em itens_os para permitir cálculo de lucro real
-- também em itens livres (sem vínculo de estoque).
ALTER TABLE public.itens_os
  ADD COLUMN IF NOT EXISTS custo_unitario numeric DEFAULT 0;

-- Para itens vinculados ao estoque, manter sincronia inicial copiando o custo do estoque
-- (apenas para registros existentes onde custo_unitario está zerado).
UPDATE public.itens_os io
SET custo_unitario = COALESCE(e.custo_unitario, 0)
FROM public.estoque e
WHERE io.estoque_id = e.id
  AND (io.custo_unitario IS NULL OR io.custo_unitario = 0);

COMMENT ON COLUMN public.itens_os.custo_unitario IS
  'Custo de compra unitário do item. Para itens livres (sem estoque_id) é informado pelo usuário; para itens do estoque é copiado de estoque.custo_unitario.';