
-- STEP 1: Fix the sequence to be ahead of the current max
SELECT setval('public.os_numero_seq', (SELECT COALESCE(MAX(numero), 0) + 1 FROM public.ordens_servico), false);

-- STEP 2: Make the unique constraint per-oficina instead of global
-- This prevents cross-oficina collisions permanently
DROP INDEX IF EXISTS public.idx_ordens_servico_numero;
CREATE UNIQUE INDEX idx_ordens_servico_numero ON public.ordens_servico (oficina_id, numero);
