-- 1. os-assinaturas bucket: tighten policies
DROP POLICY IF EXISTS "Assinaturas são públicas para leitura" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem fazer upload de assinaturas" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar assinaturas" ON storage.objects;

-- Public can read individual files (needed for public OS portal) but cannot list
CREATE POLICY "os_assinaturas_public_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'os-assinaturas');

-- Upload restricted: path must start with an ordem_servico_id from user's oficina (or 'temp' for new OS)
CREATE POLICY "os_assinaturas_authenticated_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'os-assinaturas'
  AND auth.uid() IS NOT NULL
  AND (
    (storage.foldername(name))[1] = 'temp'
    OR EXISTS (
      SELECT 1 FROM public.ordens_servico os
      JOIN public.user_roles ur ON ur.oficina_id = os.oficina_id
      WHERE os.id::text = (storage.foldername(name))[1]
        AND ur.user_id = auth.uid()
        AND ur.active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.ordens_servico os
      JOIN public.oficinas o ON o.id = os.oficina_id
      WHERE os.id::text = (storage.foldername(name))[1]
        AND o.user_id = auth.uid()
    )
  )
);

CREATE POLICY "os_assinaturas_authenticated_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'os-assinaturas'
  AND (
    (storage.foldername(name))[1] = 'temp'
    OR EXISTS (
      SELECT 1 FROM public.ordens_servico os
      JOIN public.user_roles ur ON ur.oficina_id = os.oficina_id
      WHERE os.id::text = (storage.foldername(name))[1]
        AND ur.user_id = auth.uid()
        AND ur.active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.ordens_servico os
      JOIN public.oficinas o ON o.id = os.oficina_id
      WHERE os.id::text = (storage.foldername(name))[1]
        AND o.user_id = auth.uid()
    )
  )
);

CREATE POLICY "os_assinaturas_authenticated_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'os-assinaturas'
  AND (
    EXISTS (
      SELECT 1 FROM public.ordens_servico os
      JOIN public.user_roles ur ON ur.oficina_id = os.oficina_id
      WHERE os.id::text = (storage.foldername(name))[1]
        AND ur.user_id = auth.uid()
        AND ur.active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.ordens_servico os
      JOIN public.oficinas o ON o.id = os.oficina_id
      WHERE os.id::text = (storage.foldername(name))[1]
        AND o.user_id = auth.uid()
    )
  )
);

-- 2. trial_email_logs: explicit deny for anon
CREATE POLICY "trial_email_logs_deny_anon"
ON public.trial_email_logs FOR SELECT
TO anon
USING (false);