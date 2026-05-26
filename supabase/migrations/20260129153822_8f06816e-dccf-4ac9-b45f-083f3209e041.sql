-- Tornar o bucket os-fotos público para que as URLs funcionem
UPDATE storage.buckets SET public = true WHERE id = 'os-fotos';

-- Criar políticas de acesso para o bucket os-fotos
-- Política para upload: usuários autenticados podem fazer upload
CREATE POLICY "Usuários autenticados podem fazer upload de fotos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'os-fotos' 
  AND auth.uid() IS NOT NULL
);

-- Política para leitura: qualquer um pode ver (bucket público)
CREATE POLICY "Fotos de OS são publicamente acessíveis" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'os-fotos');

-- Política para deletar: usuários autenticados podem deletar suas fotos
CREATE POLICY "Usuários autenticados podem deletar fotos" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'os-fotos' 
  AND auth.uid() IS NOT NULL
);

-- Política para atualizar: usuários autenticados podem atualizar
CREATE POLICY "Usuários autenticados podem atualizar fotos" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'os-fotos' 
  AND auth.uid() IS NOT NULL
);