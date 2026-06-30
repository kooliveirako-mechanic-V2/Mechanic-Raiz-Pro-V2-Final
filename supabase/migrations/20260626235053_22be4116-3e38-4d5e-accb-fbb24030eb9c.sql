-- B4: Fechar bucket os-assinaturas - policy T2 + remover policy pública

DROP POLICY IF EXISTS "os_assinaturas_select_owned" ON storage.objects;

CREATE POLICY "os_assinaturas_select_owned"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'os-assinaturas'
  AND EXISTS (
    SELECT 1
    FROM public.ordens_servico os
    WHERE os.assinatura_cliente_path = storage.objects.name
      AND public.has_oficina_access(auth.uid(), os.oficina_id)
  )
);

DROP POLICY IF EXISTS "os_assinaturas_public_read" ON storage.objects;