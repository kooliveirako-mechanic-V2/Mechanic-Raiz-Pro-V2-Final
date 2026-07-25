# Legacy Hotfix — Target 2: get_oficina_funcionarios

**Projeto alvo:** `cuhkkoqqeguascdsvtky` (produção viva; NÃO é o projeto linkado deste repo)
**Função:** `public.get_oficina_funcionarios(_oficina_id uuid)`
**Data/hora UTC:** 2026-07-25 14:56 (migration) / 15:10 (smoke test real)
**Migration:** `supabase/migrations_legacy/20260725145600_phase3_2_old_get_oficina_funcionarios.sql`

> Nota: nenhum dado real (e-mail, JWT, anon key, nome de oficina, UUID de usuário/cliente) consta neste relatório. Identificadores substituídos por placeholders `USER_A`, `OFICINA_A`, `OFICINA_B`.

## Diff estrutural

| Campo | Antes | Depois |
|---|---|---|
| Linguagem | `sql` | `plpgsql` |
| MD5 do corpo | `ad424c434c22ac35223d9b58a26e0c84` | `1d8cd741e487424162c16966e5a513b5` |
| Bytes | 829 | 1133 |
| `search_path` | `public` | `public, pg_temp` |
| Guard `has_oficina_access` | ausente | presente |
| Bypass `service_role` | ausente | presente |
| Grants | `anon`/`PUBLIC` com EXECUTE | `anon`/`PUBLIC` revogados; `authenticated`/`service_role` mantidos |
| Assinatura | `(_oficina_id uuid)` | `(_oficina_id uuid)` |
| Return type | `TABLE(user_id, nome, role, email)` | `TABLE(user_id, nome, role, email)` |
| Campo `email` | `NULL::text` | `NULL::text` (preservado) |

Subconsulta funcional (`proprietario` UNION `user_roles` ativos) intacta.

## Provas runtime (sessão autenticada real)

### Antes (vulnerabilidade real confirmada)
- `POST /rest/v1/rpc/get_oficina_funcionarios` com `_oficina_id` de OFICINA_B usando JWT de USER_A:
  - `HTTP 200`
  - Retornou registros de funcionários e proprietário de OFICINA_B (PII cross-tenant exposta).

### Depois (pós-patch)

| # | Prova | Resultado | Esperado | Status |
|---|---|---|---|---|
| 1 | Legítima: USER_A lista própria equipe (OFICINA_A) | HTTP 200 — registros retornados com `email=null` | 200 + dados | PASS |
| 2 | Cross-tenant: USER_A consulta equipe de OFICINA_B | HTTP 403 / `42501` "forbidden: cross-tenant access denied" | 42501 | PASS |
| 3 | Anônimo: chamada REST sem JWT | HTTP 401 "permission denied for function get_oficina_funcionarios" | 401/403 | PASS |
| 4 | Smoke UI | Configurações → Equipe lista membros sem erro | limpo | PASS |

## Catálogo pós-patch

- `guard_ok` = true
- `search_path` = `public, pg_temp`
- `anon_exec` = false
- `auth_exec` = true
- `service_role_exec` = true
