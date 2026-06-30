DROP POLICY IF EXISTS "os_assinaturas_authenticated_update" ON storage.objects;

CREATE POLICY "os_assinaturas_update_owned"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'os-assinaturas'
  AND (storage.foldername(name))[1] <> 'temp'
  AND EXISTS (
    SELECT 1
    FROM public.ordens_servico os
    WHERE os.id::text = (storage.foldername(storage.objects.name))[1]
      AND public.has_oficina_access(auth.uid(), os.oficina_id)
  )
)
WITH CHECK (
  bucket_id = 'os-assinaturas'
  AND (storage.foldername(name))[1] <> 'temp'
  AND EXISTS (
    SELECT 1
    FROM public.ordens_servico os
    WHERE os.id::text = (storage.foldername(storage.objects.name))[1]
      AND public.has_oficina_access(auth.uid(), os.oficina_id)
  )
);