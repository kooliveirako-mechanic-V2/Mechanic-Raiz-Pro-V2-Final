
-- ============================================================
-- CORREÇÃO A — Bucket os-fotos
-- Bloqueia INSERT/UPDATE/DELETE cruzado entre oficinas.
-- Preserva integralmente as policies de SELECT.
-- Não altera o bucket (continua public=true).
-- ============================================================

-- 1) DROP das 5 policies fracas de ESCRITA (INSERT/UPDATE/DELETE)
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar fotos" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar fotos" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem fazer upload de fotos" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem deletar suas fotos" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem fazer upload de fotos" ON storage.objects;

-- 2) INSERT — permitido para temp/ (autenticado) OU pasta de OS da própria oficina
CREATE POLICY "os_fotos_insert_owned"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'os-fotos'
  AND auth.uid() IS NOT NULL
  AND (
    -- uploads temporários (sem ordemId): só authenticated, pasta temp/
    (split_part(name, '/', 1) = 'temp')
    OR
    -- uploads associados a uma OS: a OS precisa pertencer à oficina do usuário
    EXISTS (
      SELECT 1
      FROM public.ordens_servico os
      WHERE os.id::text = split_part(storage.objects.name, '/', 1)
        AND public.has_oficina_access(auth.uid(), os.oficina_id)
    )
  )
);

-- 3) UPDATE — somente em fotos cuja OS pertença à oficina do usuário (USING + WITH CHECK)
CREATE POLICY "os_fotos_update_owned"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'os-fotos'
  AND auth.uid() IS NOT NULL
  AND split_part(name, '/', 1) <> 'temp'
  AND EXISTS (
    SELECT 1
    FROM public.ordens_servico os
    WHERE os.id::text = split_part(storage.objects.name, '/', 1)
      AND public.has_oficina_access(auth.uid(), os.oficina_id)
  )
)
WITH CHECK (
  bucket_id = 'os-fotos'
  AND auth.uid() IS NOT NULL
  AND split_part(name, '/', 1) <> 'temp'
  AND EXISTS (
    SELECT 1
    FROM public.ordens_servico os
    WHERE os.id::text = split_part(storage.objects.name, '/', 1)
      AND public.has_oficina_access(auth.uid(), os.oficina_id)
  )
);

-- 4) DELETE — somente em fotos cuja OS pertença à oficina do usuário
CREATE POLICY "os_fotos_delete_owned"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'os-fotos'
  AND auth.uid() IS NOT NULL
  AND split_part(name, '/', 1) <> 'temp'
  AND EXISTS (
    SELECT 1
    FROM public.ordens_servico os
    WHERE os.id::text = split_part(storage.objects.name, '/', 1)
      AND public.has_oficina_access(auth.uid(), os.oficina_id)
  )
);
