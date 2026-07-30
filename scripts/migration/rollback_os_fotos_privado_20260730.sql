-- ROLLBACK de 20260730230000_os_fotos_privado_select_owned.sql
-- ============================================================
-- Reverte o bucket os-fotos ao estado público anterior. Usar SOMENTE se a
-- privatização quebrar a leitura em produção e não houver tempo para
-- diagnosticar (ex.: cliente ao vivo). Reabre o vazamento — é medida de
-- emergência, não solução.
--
-- Restaura o estado medido em 2026-07-30 (as 3 policies públicas originais),
-- volta o bucket a público e desfaz o escopo de temp/ no INSERT.
-- ============================================================

-- 1) Bucket volta a público
UPDATE storage.buckets SET public = true WHERE id = 'os-fotos';

-- 2) Remover o SELECT owned criado pela migration
DROP POLICY IF EXISTS "os_fotos_select_owned" ON storage.objects;

-- 3) Recriar as 3 policies públicas de SELECT (estado original)
CREATE POLICY "Fotos de OS são publicamente acessíveis"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'os-fotos');

CREATE POLICY "Usuários podem ver fotos de suas oficinas"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'os-fotos');

CREATE POLICY "Usuários autenticados podem ver fotos de suas oficinas"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'os-fotos' AND auth.uid() IS NOT NULL);

-- 4) Restaurar o INSERT no formato anterior (temp/ sem escopo de user_id)
DROP POLICY IF EXISTS "os_fotos_insert_owned" ON storage.objects;

CREATE POLICY "os_fotos_insert_owned"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'os-fotos'
  AND auth.uid() IS NOT NULL
  AND (
    split_part(name, '/', 1) = 'temp'
    OR EXISTS (
      SELECT 1 FROM public.ordens_servico os
      WHERE os.id::text = split_part(storage.objects.name, '/', 1)
        AND public.has_oficina_access(auth.uid(), os.oficina_id)
    )
  )
);
