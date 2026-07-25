# Legacy Hotfix — Target 3: deletar_item_os_atomic

**Projeto alvo:** `cuhkkoqqeguascdsvtky` (produção viva; NÃO é o projeto linkado deste repo)
**Função:** `public.deletar_item_os_atomic(p_item_id uuid, p_oficina_id uuid)`
**Data/hora UTC:** 2026-07-25 16:15
**Migration:** `supabase/migrations_legacy/20260725161500_phase3_3_old_deletar_item_os_atomic.sql`

> Nota: nenhum dado real (e-mail, JWT, anon key, nome de oficina, UUID de usuário/cliente/OS/item) consta neste relatório. Identificadores substituídos por placeholders.

## Diff estrutural

| Campo | Antes | Depois |
|---|---|---|
| MD5 do corpo | `df8dcffab1bde2245acccdc040d9850c` | `1d0b5ae8051f699285361bb579ccac4c` |
| Bytes | 2282 | 2703 |
| `search_path` | `public` | `public, pg_temp` |
| Guard autorização | cosmético (`p_oficina_id`) | real (`v_oficina_real` via OS) |
| Bypass `service_role` | ausente | presente |
| Grants | `anon`/`PUBLIC` com EXECUTE | `anon`/`PUBLIC` revogados; `authenticated`/`service_role` mantidos |

Corpo funcional (restauração de estoque se OS finalizada, `DELETE FROM itens_os`, flags de bypass local `app.allow_finalized_item_delete`, retorno JSON) mantido 100% equivalente. `estoque_movimentacoes.oficina_id` passa a usar `v_oficina_real` resolvida da OS.

## Provas efetuadas

| # | Prova | Resultado | Esperado | Status |
|---|---|---|---|---|
| 1 | Catálogo live | `guard_ok=true`, `resolves_real_oficina=true` | true | PASS |
| 2 | Catálogo grants | `anon=false`, `auth=true`, `service_role=true` | `anon=false` | PASS |
| 3 | REST Anon sem JWT | HTTP 401 `42501 permission denied for function deletar_item_os_atomic` | 401/403 | PASS |
| 4 | REST Anon com Bearer | HTTP 401 `42501 permission denied for function deletar_item_os_atomic` | 401/403 | PASS |
| 5 | Smoke UI em produção | remoção de item em OS própria com devolução ao estoque | limpo | Pendente validação manual |

## Catálogo pós-patch (projeto `cuhkkoqqeguascdsvtky`)

- `anon_exec` = false
- `auth_exec` = true
- `svc_exec` = true
- `proconfig` = `["search_path=public, pg_temp"]`
