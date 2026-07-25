# Legacy Hotfix — Target 1: cancelar_venda_balcao

**Projeto alvo:** `cuhkkoqqeguascdsvtky` (produção viva; NÃO é o projeto linkado deste repo)
**Função:** `public.cancelar_venda_balcao(p_venda_id uuid)`
**Data/hora UTC:** 2026-07-25 14:42 (migration) / 14:50 (smoke test real)
**Migration:** `supabase/migrations_legacy/20260725144200_phase3_1_old_cancelar_venda_balcao.sql`

> Nota: nenhum dado real (e-mail, JWT, anon key, nome de oficina, UUID de usuário/cliente, ID de venda) consta neste relatório. Identificadores substituídos por placeholders `USER_A`, `OFICINA_A`, `OFICINA_B`, `VENDA_A`, `VENDA_B`.

## Diff estrutural

| Campo | Antes | Depois |
|---|---|---|
| MD5 do corpo | `855778b3e87a36c125d4430b49d75d29` | `7a0b9ffcc5a7d88920ba75cf4fdf1286` |
| Bytes | 805 | 1097 |
| `search_path` | `public` | `public, pg_temp` |
| Guard `has_oficina_access` | ausente | presente |
| Bypass `service_role` | ausente | presente |
| `RAISE 42501` cross-tenant | ausente | presente |
| Grants | `anon`/`PUBLIC` com EXECUTE | `anon`/`PUBLIC` revogados; `authenticated`/`service_role` mantidos |

Corpo funcional (SELECT venda → checagem status → UPDATE status) preservado. Só o gate de autorização foi adicionado antes do UPDATE. Trigger `estornar_venda_balcao()` (AFTER UPDATE OF status) inalterado.

## Provas runtime (sessão autenticada real)

| # | Prova | Resultado | Esperado | Status |
|---|---|---|---|---|
| 1 | Cross-tenant: USER_A cancela venda de OFICINA_B | HTTP 403 / `42501` "Acesso negado" | 42501 | PASS |
| 2 | Legítima: USER_A cancela VENDA_A (própria) | HTTP 200 / `{"success":true}` | 200 | PASS |
| 3 | Status pós-cancelamento | `cancelada` | cancelada | PASS |
| 4 | Estorno de estoque (trigger) | quantidade voltou (saída→entrada) | restaurado | PASS |
| 5 | Financeiro | status `cancelado` | cancelado | PASS |
| 6 | Movimentações | `saida` + `entrada — Estorno (Venda Cancelada)` | 2 linhas | PASS |
| 7 | Console UI | sem 42501 vazando em fluxo legítimo | limpo | PASS |

Seed de teste em produção removido após validação (cleanup confirmado).

## Catálogo pós-patch

- `guard_ok` = true
- `search_path` = `public, pg_temp`
- `anon_exec` = false
- `auth_exec` = true
- `service_role_exec` = true
