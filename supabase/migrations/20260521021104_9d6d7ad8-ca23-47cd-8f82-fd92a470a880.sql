-- Hardening dos buckets de upload: limites de tamanho e MIME types permitidos
-- Aplicado APENAS a uploads futuros. Arquivos existentes permanecem intactos.

-- Bucket os-fotos: fotos e vídeos de OS (entrada/saída/diagnóstico)
UPDATE storage.buckets
SET 
  file_size_limit = 52428800, -- 50 MB
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'video/x-m4v'
  ]
WHERE id = 'os-fotos';

-- Bucket os-assinaturas: só PNGs gerados pelo canvas (pequenos)
UPDATE storage.buckets
SET 
  file_size_limit = 1048576, -- 1 MB (assinaturas são ~50-200KB)
  allowed_mime_types = ARRAY['image/png']
WHERE id = 'os-assinaturas';

-- oficina-logos já tem restrições corretas, mas confirmamos
UPDATE storage.buckets
SET 
  file_size_limit = 2097152, -- 2 MB
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/gif','image/webp','image/svg+xml']
WHERE id = 'oficina-logos';