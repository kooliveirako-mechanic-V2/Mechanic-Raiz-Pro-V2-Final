
-- Criar bucket para assinaturas digitais
INSERT INTO storage.buckets (id, name, public)
VALUES ('os-assinaturas', 'os-assinaturas', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso para o bucket
CREATE POLICY "Assinaturas são públicas para leitura"
ON storage.objects FOR SELECT
USING (bucket_id = 'os-assinaturas');

CREATE POLICY "Usuários autenticados podem fazer upload de assinaturas"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'os-assinaturas' AND auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem deletar assinaturas"
ON storage.objects FOR DELETE
USING (bucket_id = 'os-assinaturas' AND auth.uid() IS NOT NULL);

-- Adicionar coluna de assinatura na tabela ordens_servico
ALTER TABLE public.ordens_servico
ADD COLUMN IF NOT EXISTS assinatura_cliente_url text DEFAULT NULL;
