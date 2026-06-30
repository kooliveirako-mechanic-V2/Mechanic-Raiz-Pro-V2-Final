ALTER TABLE public.ordens_servico
ADD COLUMN IF NOT EXISTS assinatura_cliente_path text;

UPDATE public.ordens_servico
SET assinatura_cliente_path = split_part(
  split_part(assinatura_cliente_url, '?', 1),
  '/storage/v1/object/public/os-assinaturas/',
  2
)
WHERE assinatura_cliente_url IS NOT NULL
  AND assinatura_cliente_path IS NULL
  AND assinatura_cliente_url LIKE '%/storage/v1/object/public/os-assinaturas/%';