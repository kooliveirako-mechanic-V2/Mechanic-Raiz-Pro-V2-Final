# PR 1 — Entregável 6/7: Prova negativa (14 termos no diff)

Regra fechada: nenhum dos 14 termos abaixo pode aparecer no diff do PR 1.
Busca case-insensitive (`rg -i`) restrita ao escopo do PR (arquivos novos em
`docs/pr1-os-fotos-snapshot/`), excluindo este próprio arquivo via
`--glob '!06-prova-negativa.md'` para evitar auto-match dos termos listados
na tabela de justificativa.

**Obrigação adicional:** antes da execução em produção, a mesma prova
negativa deve ser rodada também sobre a **migration final aplicada**
(o arquivo `supabase/migrations/*.sql` gerado pela autorização literal),
não apenas sobre `docs/`. Sem isso, é possível preparar certo no docs e
errar na migration.

## Comando (literal, executado contra o pacote em `docs/`)

```bash
rg -i -n \
  --glob '!06-prova-negativa.md' \
  -e 'UPDATE\s+(public\.)?ordens_servico' \
  -e 'DELETE\s+FROM\s+(public\.)?ordens_servico' \
  -e 'UPDATE\s+storage\.objects' \
  -e 'DELETE\s+FROM\s+storage\.objects' \
  -e 'UPDATE\s+storage\.buckets' \
  -e 'storage\.buckets' \
  -e 'storage\.move' \
  -e 'createSignedUrl' \
  -e 'signedUrl' \
  -e 'getPublicUrl' \
  -e 'CREATE\s+POLICY' \
  -e 'ALTER\s+POLICY' \
  -e 'DROP\s+POLICY' \
  -e 'SECURITY\s+DEFINER' \
  docs/pr1-os-fotos-snapshot/
```

## Saída esperada

```
(nenhum match; exit code 1)
```

Qualquer match → PR 1 vira 🔴 automático e a entrega é rejeitada sem revisão.

## Justificativa por termo

| # | Termo | O que protege |
|---|---|---|
| 1 | `UPDATE … ordens_servico` | Snapshot não pode mexer em OS (escopo PR 2) |
| 2 | `DELETE FROM ordens_servico` | Não exclui registros |
| 3 | `UPDATE storage.objects` | Não renomeia arquivo via tabela interna |
| 4 | `DELETE FROM storage.objects` | Não apaga foto |
| 5 | `UPDATE storage.buckets` | Não privatiza bucket (escopo PR 3) — alteração direta |
| 6 | `storage.buckets` (standalone) | Bloqueia qualquer referência geral à tabela de buckets (SELECT, comentário em SQL, etc.); reforço além do termo #5, que só pega alteração direta |
| 7 | `storage.move` | Não promove `temp/` (escopo PR 2) |
| 8 | `createSignedUrl` | Sem helper de signed URL chamado por nome completo (escopo PR 2) |
| 9 | `signedUrl` | Sem qualquer variante de signed URL (`.signedUrl`, `createSignedUrl`) |
| 10 | `getPublicUrl` | Sem geração de URL pública no frontend |
| 11 | `CREATE POLICY` | Sem RLS nova (escopo PR 3) |
| 12 | `ALTER POLICY` | Sem alteração de RLS |
| 13 | `DROP POLICY` | Sem remoção de RLS |
| 14 | `SECURITY DEFINER` | Sem helper privilegiado novo |
