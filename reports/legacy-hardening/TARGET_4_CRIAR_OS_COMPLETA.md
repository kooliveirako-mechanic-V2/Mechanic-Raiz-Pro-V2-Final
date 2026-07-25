# Legacy Hotfix — Target 4: criar_os_completa

**Projeto alvo:** `cuhkkoqqeguascdsvtky` (produção viva; NÃO é o projeto linkado deste repo)
**Função:** `public.criar_os_completa(...)` (36 parâmetros)
**Data/hora UTC:** 2026-07-25 17:00
**Migration:** `supabase/migrations_legacy/20260725170000_phase3_4_old_criar_os_completa.sql`

> Nota: nenhum dado real (e-mail, JWT, anon key, nome de oficina, UUID de usuário/cliente/veículo/OS) consta neste relatório. Identificadores substituídos por placeholders.

## Diff estrutural

| Campo | Antes | Depois |
|---|---|---|
| MD5 do corpo | `7aa3de563188a8a49ee82923b0c6cbe2` | `72102685eff7628f3cdd5de995ce7edc` |
| Bytes | 6568 | 7112 |
| `search_path` | `public` | `public, pg_temp` |
| Guard autorização | ausente | `auth.uid()` + `has_oficina_access` + cliente/veículo da oficina |
| Bypass `service_role` | ausente | presente |
| Grants | `anon`/`PUBLIC` com EXECUTE | `anon`/`PUBLIC` revogados; `authenticated`/`service_role` mantidos |

Corpo funcional (rate limiting, inserção em `ordens_servico`, loop de `itens_os`, agregação de totais, chamada a `finalizar_os_atomica`, atualização de `veiculos.km_atual`) mantido 100% equivalente.

## Provas efetuadas

| # | Prova | Resultado | Esperado | Status |
|---|---|---|---|---|
| 1 | Legítima (criar OS na própria oficina) | `{"success":true,"os_id":"...","status":"em_andamento"}` | success=true | PASS |
| 2 | Cross-tenant oficina (`user_a` → `oficina_b`) | `ERROR: Erro ao criar OS: Sem permissão para esta oficina.` | `42501` | PASS |
| 3 | IDs mistos (`oficina_a` + `cliente_b`) | `ERROR: Erro ao criar OS: Cliente não pertence à oficina.` | `42501` | PASS |
| 4 | REST Anon sem JWT | HTTP 401 `42501 permission denied for function criar_os_completa` | 401/403 | PASS |

## Catálogo pós-patch (projeto `cuhkkoqqeguascdsvtky`)

- `anon_exec` = false
- `auth_exec` = true
- `svc_exec` = true
- `proconfig` = `["search_path=public, pg_temp"]`
- `guard_ok` = true
