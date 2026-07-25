# Relatório Final de Cutover e Hardening Multi-Tenant — Mechanic Raiz Pro
**Data:** 2026-07-24
**Projeto Supabase Live:** `kurlgmngmglhvknwxjee` (PostgreSQL 17.6)
**Status do Banco Live:** PROTEGIDO E BLINDADO NO LIVE
**Status do Repositório Git:** MIGRATION E EVIDÊNCIAS PRONTAS (SEM COMMIT/PUSH)

---

## 1. Síntese do Processo de Governança

1. **Confirmação Live Inicial**
   - 15 RPCs consultadas no catálogo `pg_proc` do projeto `kurlgmngmglhvknwxjee`.
   - Fonte da verdade: `pg_get_functiondef()`, `has_function_privilege()`, `proconfig`, `proacl`.

2. **Snapshot de Origem / Estado Final**
   - `reports/migration/final_security_snapshot_live.json` contém corpo live, grants, owner, security type e search_path das 15 RPCs.

3. **Migration Oficial Versionável**
   - `supabase/migrations/20260724235444_security_hardening_multitenant_official.sql` gerada a partir do estado live final.
   - Dry-run executado com `ROLLBACK`: `reports/migration/security_hardening_official_dry_run_output.txt`.
   - Resultado: `15_RPC_OFFICIAL_DRY_RUN_OK`.

4. **Regras Preservadas**
   - Sem refatorar cálculos.
   - Sem reescrever fluxo financeiro/estoque/parcelas/orçamento.
   - `get_financeiro_resumo` preservada como `SECURITY INVOKER`; apenas grants fechados.
   - `deletar_item_os_atomic` incluída no dossiê final: possui validação equivalente, resolve `oficina_id` via OS real e chama `public.has_oficina_access(auth.uid(), v_oficina_real)`.

---

## 2. Matriz Definitiva das 15 RPCs

| RPC | Modo | Guard / Isolamento | Grants Pós-Ajuste |
|---|---|---|---|
| `converter_orcamento_em_os` | DEFINER | `auth.uid()` + `has_oficina_access(p_oficina_id)` | `authenticated`, `service_role` |
| `criar_orcamento_completo` | DEFINER | `auth.uid()` + `has_oficina_access(p_oficina_id)` | `authenticated`, `service_role` |
| `criar_venda_balcao` | DEFINER | `auth.uid()` + `has_oficina_access(p_oficina_id)` + cliente/estoque | `authenticated`, `service_role` |
| `deletar_item_os_atomic` | DEFINER | resolve OS real -> `v_oficina_real` -> `has_oficina_access` | `authenticated`, `service_role` |
| `finalizar_os_atomica` | DEFINER | `auth.uid()` + `has_oficina_access(v_os.oficina_id)` pós `FOR UPDATE` | `authenticated`, `service_role` |
| `gerar_parcelas_atomic` | DEFINER | `auth.uid()` + `has_oficina_access(p_oficina_id)` + validação OS/orçamento | `authenticated`, `service_role` |
| `get_financeiro_resumo` | INVOKER | RLS-based; corpo preservado | `authenticated`, `service_role` |
| `get_financeiro_v2` | DEFINER | `auth.uid()` + `has_oficina_access(p_oficina_id)` | `authenticated`, `service_role` |
| `get_financeiro_v2_preview_limpeza` | DEFINER | `auth.uid()` + `has_oficina_access(p_oficina_id)` | `authenticated`, `service_role` |
| `get_financeiro_v2_series` | DEFINER | `auth.uid()` + `has_oficina_access(p_oficina_id)` | `authenticated`, `service_role` |
| `get_pre_fiscal_unificado` | DEFINER | `auth.uid()` + `has_oficina_access(p_oficina_id)` | `authenticated`, `service_role` |
| `reabrir_os_atomica` | DEFINER | resolve `v_oficina_id` -> `has_oficina_access` | `authenticated`, `service_role` |
| `reabrir_os_v2` | DEFINER | resolve `v_oficina_id` -> `has_oficina_access` | `authenticated`, `service_role` |
| `recalcular_totais_os` | DEFINER | resolve OS -> oficina -> `has_oficina_access` | `authenticated`, `service_role` |
| `upsert_financeiro_os` | DEFINER | `auth.uid()` + `has_oficina_access(p_oficina_id)` + validação OS | `authenticated`, `service_role` |

---

## 3. Evidência Objetiva

### 3.1 Catalog pós-ajuste
Arquivo: `reports/migration/final_security_snapshot_live.json`

Critérios conferidos para as 15 RPCs:
- `anon_exec = false`
- `public_exec = false`
- `auth_exec = true`
- `service_role_exec = true`
- `search_path = public, pg_temp`
- `has_oficina_access` presente onde há `SECURITY DEFINER` e bypass de RLS

### 3.2 Prova cross-tenant final
Arquivo: `reports/migration/security_hardening_cross_tenant_proof_final.txt`

Resultado:
- `ACCESS_A_TO_A=true`
- `ACCESS_A_TO_B=false`
- 12/12 tentativas de Usuário A contra Oficina B bloqueadas com `42501`.

### 3.3 Regressão funcional
Arquivo: `reports/migration/security_hardening_regression_results.txt`

Resultado:
- `get_financeiro_v2` própria oficina: PASS
- `get_financeiro_v2_series` própria oficina: PASS
- `get_financeiro_v2_preview_limpeza` própria oficina: PASS
- `get_pre_fiscal_unificado` própria oficina: PASS
- `get_financeiro_resumo` própria oficina: PASS
- `recalcular_totais_os` própria OS: PASS
- Checagens de existência de OS/financeiro: PASS

---

## 4. Arquivos Recomendados Para Staging/Commit

Código/migration:
- `supabase/migrations/20260724235444_security_hardening_multitenant_official.sql`
- `scripts/hardening/generate_official_migration_file.mjs`

Evidências:
- `reports/migration/final_security_snapshot_live.json`
- `reports/migration/security_hardening_cross_tenant_proof_final.txt`
- `reports/migration/security_hardening_regression_results.txt`
- `reports/migration/security_hardening_official_dry_run_output.txt`
- `reports/migration/RELATORIO_FINAL_CUTOVER.md`

Observação: existem muitos arquivos `untracked` antigos em `reports/migration/`; não devem ser adicionados em massa. Usar `git add` só com os paths acima.

---

## 5. Critério Final

- Banco live protegido: OK.
- Migration oficial reproduz estado live: OK (dry-run rollback OK).
- Cross-tenant bloqueado: OK.
- Fluxo legítimo funcionando: OK.
- Rastreabilidade pronta: OK.
- Commit/push: pendente por decisão do usuário.
