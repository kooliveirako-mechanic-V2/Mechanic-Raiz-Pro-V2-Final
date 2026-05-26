
-- Tornar o bucket os-fotos público
UPDATE storage.buckets SET public = true WHERE id = 'os-fotos';

-- Criar apenas as policies que não existem ainda
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Usuários autenticados podem fazer upload de fotos' AND tablename = 'objects') THEN
    CREATE POLICY "Usuários autenticados podem fazer upload de fotos"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'os-fotos' AND auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Usuários autenticados podem deletar fotos' AND tablename = 'objects') THEN
    CREATE POLICY "Usuários autenticados podem deletar fotos"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'os-fotos' AND auth.uid() IS NOT NULL);
  END IF;
END $$;
