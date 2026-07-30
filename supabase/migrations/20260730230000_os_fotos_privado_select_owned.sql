-- ============================================================
-- os-fotos: SELECT com escopo de oficina + fechamento do acesso público
-- ============================================================
-- ⚠️  NÃO APLICAR ANTES DO SMOKE TEST EM PRODUÇÃO.
--     Pré-requisito: o deploy com signed URLs (commit 76c7fb7) precisa estar
--     no ar E o item 3 do smoke test (abrir OS com foto e a imagem carregar)
--     precisa passar. Aplicar antes disso quebra a leitura de fotos.
--
-- ============================================================
-- ESTADO MEDIDO ANTES (banco NOVO kurlgmngmglhvknwxjee, 2026-07-30)
-- ============================================================
--   os-fotos.public = true
--   3 policies de SELECT, TODAS no papel {public}, TODAS sem escopo de oficina:
--     "Fotos de OS são publicamente acessíveis"        -> bucket_id = 'os-fotos'
--     "Usuários podem ver fotos de suas oficinas"      -> bucket_id = 'os-fotos'
--       (o nome mente: não filtra oficina nenhuma, e é aberta a anon)
--     "Usuários autenticados podem ver fotos..."       -> só auth.uid() IS NOT NULL
--       (qualquer usuário logado lê foto de QUALQUER oficina — cross-tenant)
--   os_fotos_select_owned NÃO EXISTIA (count = 0)
--
-- CONSEQUÊNCIA: bucket público serve /object/public/ SEM avaliar RLS, então
-- qualquer pessoa com a URL — ou que enumere <uuid-da-OS>/entrada-<ts>.jpg —
-- lê foto de veículo, placa e dano de qualquer oficina, sem login.
--
-- ============================================================
-- ORDEM OBRIGATÓRIA (inverter quebra a leitura)
-- ============================================================
--   1) CRIAR o SELECT owned  <- este passo primeiro, sempre
--   2) DROP das 3 policies públicas
--   3) bucket public = false
--
-- Por quê: createSignedUrl exige permissão de SELECT no objeto. Se as 3
-- policies abertas caírem antes de existir um SELECT owned, a assinatura passa
-- a falhar para TODO MUNDO e nenhuma foto carrega — o smoke test verde não
-- protegeria nada, porque a quebra só apareceria depois.
-- ============================================================

-- ------------------------------------------------------------
-- 1) SELECT com escopo: OS da própria oficina OU temp do próprio usuário
-- ------------------------------------------------------------
-- Espelha o padrão de os_fotos_delete_owned, com um acréscimo: aceita
-- temp/<user_id>/<arquivo>, o formato que o app passou a gravar em
-- buildFotoUploadPath() (fix/os-fotos-signed-urls). Sem esse ramo, a foto
-- anexada ANTES de a OS existir não seria legível nem pelo próprio autor.
DROP POLICY IF EXISTS "os_fotos_select_owned" ON storage.objects;

CREATE POLICY "os_fotos_select_owned"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'os-fotos'
  AND auth.uid() IS NOT NULL
  AND position('..' in name) = 0
  AND (
    -- upload temporário: só o próprio dono lê
    (
      split_part(name, '/', 1) = 'temp'
      AND split_part(name, '/', 2) = auth.uid()::text
    )
    OR
    -- foto de OS: precisa ter acesso à oficina daquela OS
    EXISTS (
      SELECT 1
      FROM public.ordens_servico os
      WHERE os.id::text = split_part(storage.objects.name, '/', 1)
        AND public.has_oficina_access(auth.uid(), os.oficina_id)
    )
  )
);

-- ------------------------------------------------------------
-- 2) Fechar o acesso público de leitura
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Fotos de OS são publicamente acessíveis" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem ver fotos de suas oficinas" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem ver fotos de suas oficinas" ON storage.objects;

-- ------------------------------------------------------------
-- 3) INSERT: escopar temp/ pelo próprio usuário
-- ------------------------------------------------------------
-- A policy atual exige apenas split_part(name,'/',1) = 'temp', ou seja,
-- qualquer autenticado pode gravar em temp/<uuid-de-outra-pessoa>/. Não é
-- leitura de dado alheio (o SELECT acima fecha isso), mas permite plantar
-- arquivo no namespace de outro usuário. Alinhado ao mesmo formato do SELECT.
DROP POLICY IF EXISTS "os_fotos_insert_owned" ON storage.objects;

CREATE POLICY "os_fotos_insert_owned"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'os-fotos'
  AND auth.uid() IS NOT NULL
  AND position('..' in name) = 0
  AND (
    (
      split_part(name, '/', 1) = 'temp'
      AND split_part(name, '/', 2) = auth.uid()::text
    )
    OR
    EXISTS (
      SELECT 1
      FROM public.ordens_servico os
      WHERE os.id::text = split_part(storage.objects.name, '/', 1)
        AND public.has_oficina_access(auth.uid(), os.oficina_id)
    )
  )
);

-- ------------------------------------------------------------
-- 4) Bucket privado
-- ------------------------------------------------------------
-- Em alguns projetos o UPDATE direto em storage.buckets é rejeitado por
-- permissão; nesse caso, virar o flag pelo dashboard (Storage > os-fotos >
-- Settings > Public bucket = off) ou pela Management API. O efeito é o mesmo.
UPDATE storage.buckets SET public = false WHERE id = 'os-fotos';

-- ============================================================
-- PROVAS DE SAÍDA (rodar depois de aplicar)
-- ============================================================
--   a) SELECT id, public::text FROM storage.buckets WHERE id='os-fotos';
--        esperado: false
--   b) SELECT policyname, roles::text, cmd FROM pg_policies
--        WHERE schemaname='storage' AND tablename='objects'
--          AND (qual LIKE '%os-fotos%' OR with_check LIKE '%os-fotos%');
--        esperado: nenhuma linha com roles = {public}
--   c) GET em https://<host>/storage/v1/object/public/os-fotos/<path>
--        esperado: 400/403 (antes: servia o arquivo)
--   d) no app logado: abrir OS com foto -> imagem carrega via signed URL
--   e) upload em OS nova -> grava temp/<user_id>/<arquivo> e a preview aparece
--
-- ============================================================
-- LIXO CONHECIDO (não tratado aqui, exige service_role)
-- ============================================================
-- Existem 3 objetos em temp/ no formato ANTIGO (temp/<timestamp>-<rand>.jpg,
-- sem user_id). Nenhuma OS os referencia (0 refs medidas), então são órfãos.
-- Após esta migration eles ficam ilegíveis e indeletáveis pelo cliente — a
-- policy de DELETE exige split_part(name,'/',1) <> 'temp'. Limpeza precisa de
-- service_role. Não afeta nenhuma foto em uso.
--
-- ROLLBACK: scripts/migration/rollback_os_fotos_privado_20260730.sql
