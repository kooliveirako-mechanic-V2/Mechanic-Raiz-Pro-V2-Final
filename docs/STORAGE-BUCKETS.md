# Storage Buckets — Mechanic Raiz Pro

Documentação dos buckets de armazenamento Supabase Storage utilizados no sistema.

## Buckets

| Bucket | Público | MIME Types | Tamanho Máx | Uso |
|--------|---------|------------|-------------|-----|
| `os-fotos` | Sim | image/jpeg, image/png, image/webp, image/gif, image/heic, image/heif, video/mp4, video/quicktime, video/webm, video/x-m4v | 50 MB | Fotos e vídeos de entrada/saída de OS |
| `os-assinaturas` | Sim | image/png | 500 KB | Assinaturas digitais do cliente |
| `oficina-logos` | Sim | image/jpeg, image/png, image/gif, image/webp, image/svg+xml | 2 MB | Logos das oficinas |
| `marketing` | Sim | Sem restrição | Sem limite | Assets de marketing/landing pages |

## Por que `os-fotos` é público?

**Decisão de design:** O bucket `os-fotos` é intencionalmente público para permitir o compartilhamento de Ordens de Serviço com clientes via link direto (WhatsApp, email).

**Fluxo de uso:**
1. Mecânico tira foto do veículo na entrada
2. Sistema gera URL pública da foto
3. URL é incluída no PDF/link da OS enviado ao cliente
4. Cliente visualiza as fotos sem precisar de login

**Risco aceito:** Qualquer pessoa com a URL pode visualizar a foto.

**Mitigações em vigor:**
- URLs contêm UUID v4 não-enumerável (36 caracteres aleatórios)
- Não há listagem pública do bucket (apenas acesso direto por URL)
- Fotos não contêm dados sensíveis além da imagem do veículo

**Recomendação futura:** Se surgir requisito de privacidade mais restrito, migrar para signed URLs com expiração (ex: 7 dias). Isso exigiria:
- Alterar `resolveFotoUrl()` para gerar signed URLs via `supabase.storage.createSignedUrl()`
- Tornar o bucket privado (`public = false`)
- Ajustar fluxo de compartilhamento para regenerar URLs expiradas

## Políticas de Acesso (RLS)

Todos os buckets têm políticas que permitem:
- **SELECT:** Público (para buckets públicos) ou autenticado
- **INSERT:** Apenas usuários autenticados (`auth.uid() IS NOT NULL`)
- **UPDATE/DELETE:** Apenas usuários com acesso à oficina dona do arquivo

## Referências

- Migration inicial: `20260115204827_f0174f6e-b7b0-4789-b671-b2a578921d31.sql`
- Hardening de MIME/size: `20260521021104_9d6d7ad8-ca23-47cd-8f82-fd92a470a880.sql`
- Bucket privado (revertido): `20260131032917_8def4f7a-1caa-4f9e-a825-29f36af9f338.sql`
