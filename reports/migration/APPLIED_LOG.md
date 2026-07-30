# Log de migrations aplicadas por QUERY DIRETA

**Por que este arquivo existe:** `supabase db push` está inviável neste projeto
por drift de ~250 versões entre o histórico local e o banco NOVO
(`kurlgmngmglhvknwxjee`). Todas as migrations abaixo foram aplicadas por
`supabase db query --linked -f <arquivo>` (ou query manual), **não** pelo
`db push`. O commit no git prova que o SQL existe no repo; **não** prova que
rodou no banco. Este log é a ponte.

**Em um restore / rebuild:** não assuma que o estado do banco reflete as
migrations versionadas. As linhas abaixo foram aplicadas fora do fluxo normal e
precisam ser reconferidas contra o banco (cada uma tem uma prova de verificação
que pode ser re-executada).

---

## 2026-07-30 — Privatização do bucket os-fotos

**Arquivos:**
- `supabase/migrations/20260730223000_validate_os_photo_urls_aceita_temp.sql`
  (trigger aceita `temp/<uuid>/` + bloqueio de `..`)
- `supabase/migrations/20260730230000_os_fotos_privado_select_owned.sql`
  (SELECT owned → drop das 3 policies públicas → `public=false`)

**Aplicação:** query direta, na ordem: trigger primeiro, depois a privatização.

**Prova pós-aplicação (verificável a qualquer momento):**
- `SELECT public FROM storage.buckets WHERE id='os-fotos'` → `false`
- policies `{public}` em `storage.objects` para os-fotos → `0`
- `os_fotos_select_owned` existe e é `{authenticated}`
- URL `/object/public/os-fotos/...` → 400 | `/object/sign/...?token=` → 200 (TTL 600s)

**Rollback:** `scripts/migration/rollback_os_fotos_privado_20260730.sql`
(reabre o vazamento — emergência apenas).

**Pendência de dono (`service_role`):** 3 órfãos em `temp/` formato legado, sem
`user_id`, 0 refs em OS — ilegíveis e indeletáveis pelo cliente após a
privatização. Caminhos:
- `temp/1777432404894-gktlbwm.jpg`
- `temp/1777774400997-llxd1a.jpg`
- `temp/saida-1777432448518-qs9cz5.jpg`

---

## 2026-07-29 — Correções financeiras (auditoria matemática)

Aplicadas por query direta; depois versionadas e mergeadas na `main`
(`3558f69` → `76c7fb7`). Ver `mem: project-auditoria-matematica-financeira-2026-07`.

- `20260729...fix_pre_fiscal_unificado_json_paths` — caminhos JSON (faturamento R$0→real)
- `20260729...fix_custo_servico_fonte_unica` (função) + `..._trigger_normalizar_totais`
  (trigger) — custo de fonte única; **ordem obrigatória**: função antes do trigger
- `20260729...fix_alerta_custo_produto_only` — alerta produto-only + valor R$ na RPC
- `20260729...data_competencia` — trigger + backfill (339→0 nulas) + NOT NULL

**Prova:** `valor_servico` 410/410 · divergência custo→CMV 0 · competência nulas 0 ·
`get_pre_fiscal_unificado` devolve faturamento ≠ null nas oficinas reais.

---

## Pendências operacionais (GitHub / dashboard — não são migration)

- [ ] **Proteger `main`** (GitHub → Settings → Branches → Add rule): exigir PR +
      checks verdes. Hoje **sem proteção** — force-push apaga o histórico.
- [ ] **Limpar os 3 órfãos `temp/`** (dashboard Supabase, `service_role`).
