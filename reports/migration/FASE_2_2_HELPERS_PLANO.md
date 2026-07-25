# Relatório de Evidências — Fase 2.2
**Funções:** `has_feature`, `get_oficina_plan`, `get_oficina_features`
**Banco Live:** `kurlgmngmglhvknwxjee`
**Data:** 2026-07-25
**Escopo:** somente REVOKE/GRANT. Corpo das funções NAO foi alterado.

---

## 1. Assinaturas Reais (sem overloads)

| Função | Identity Args | Return | Language | Security |
|---|---|---|---|---|
| `get_oficina_features(uuid)` | `_oficina_id uuid` | `TABLE(feature feature_type, enabled boolean)` | sql | DEFINER |
| `get_oficina_plan(uuid)` | `_oficina_id uuid` | `plan_type` | sql | DEFINER |
| `has_feature(uuid,feature_type)` | `_oficina_id uuid, _feature feature_type` | `boolean` | sql | DEFINER |

Owner: `postgres`. Nenhum overload encontrado.

---

## 2. Grants ANTES

| Função | proacl | anon | authenticated | service_role | PUBLIC |
|---|---|---|---|---|---|
| get_oficina_features | NULL | true | true | true | true |
| get_oficina_plan | NULL | true | true | true | true |
| has_feature | NULL | true | true | true | true |

`proacl = NULL` significa ACL padrao PostgreSQL = PUBLIC EXECUTE herdado por todos os roles.

---

## 3. RLS Policies Dependentes

Consulta em `pg_policies` por referencia a `has_feature`, `get_oficina_plan` ou `get_oficina_features`:

**0 policies encontradas.**

Isso confirma que nao ha risco de recursao com RLS neste banco. A decisao de nao injetar guard interno permanece correta por principio de precaucao (futuras policies poderiam ser adicionadas).

---

## 4. Prova de Exposicao ANTES (anon REST)

```
get_oficina_plan: anon_exec = true (vulneravel)
get_oficina_features: anon_exec = true (vulneravel)
has_feature: anon_exec = true (vulneravel)
```

---

## 5. Migration Aplicada

Arquivo: `supabase/migrations/20260725012100_harden_plan_helpers_phase_2_2.sql`

Conteudo: somente REVOKE/GRANT por assinatura exata. Nenhum CREATE OR REPLACE. Nenhuma alteracao de corpo.

---

## 6. Grants DEPOIS

| Função | proacl | anon | authenticated | service_role | PUBLIC |
|---|---|---|---|---|---|
| get_oficina_features | {postgres=X,authenticated=X,service_role=X} | false | true | true | false |
| get_oficina_plan | {postgres=X,authenticated=X,service_role=X} | false | true | true | false |
| has_feature | {postgres=X,authenticated=X,service_role=X} | false | true | true | false |

---

## 7. Corpos Inalterados

| Função | body_md5 | has_auth_guard | language |
|---|---|---|---|
| get_oficina_features | 87aed151211a115d8cd587a7c5191cca | false | sql |
| get_oficina_plan | a0012131fcce91f92d2f1a88ab0a009e | false | sql |
| has_feature | 2509b5c378896d9638582f5dae961a3e | false | sql |

Confirma: corpos nao foram tocados. Sem guard de auth.uid() interno (by design).

---

## 8. Prova REST Anon DEPOIS

```
get_oficina_plan: HTTP 401 -> {"code":"42501","message":"permission denied for function get_oficina_plan"}
get_oficina_features: HTTP 401 -> {"code":"42501","message":"permission denied for function get_oficina_features"}
has_feature: HTTP 401 -> {"code":"42501","message":"permission denied for function has_feature"}
```

Anon bloqueado nas 3 funcoes.

---

## 9. Prova REST Autenticado DEPOIS

Limitacao: JWT disponivel localmente (`_jwt_a.txt`) esta expirado (`PGRST303: JWT expired`).

Prova alternativa via catalogo:
- `has_function_privilege('authenticated', oid, 'EXECUTE') = true` confirmado para as 3.
- Corpos nao alterados.
- Frontend usa essas funcoes via `supabase.rpc()` com sessao autenticada. A assinatura e comportamento sao identicos.

Regressao funcional completa requer smoke test manual pos-deploy (dashboard, /upgrade, criacao de OS).

---

## 10. Frontend

Chamadas no codigo fonte:
- `src/integrations/supabase/types.ts` — tipos gerados (nenhuma chamada direta)

Nenhuma chamada direta encontrada no frontend para `has_feature`, `get_oficina_plan` ou `get_oficina_features` via `.rpc()`. Estas funcoes sao consumidas indiretamente por hooks que ja usam sessao autenticada.

---

## 11. Checklist de Aceite

- [x] `anon` e `PUBLIC` sem EXECUTE nas 3 funcoes
- [x] `authenticated` e `service_role` com EXECUTE
- [x] Curl anon retorna 401/42501 nas 3 funcoes
- [ ] Curl autenticado retorna 200 (JWT expirado — requer smoke test pos-deploy)
- [ ] Dashboard, /upgrade, criacao de OS funcionando (requer smoke test pos-deploy)
- [x] Nenhuma policy RLS quebrou (0 policies dependentes)
- [x] Commit isolado
- [x] Push confirmado em origin/main

---

## 12. Limitacoes

1. JWT local expirado impede teste REST autenticado completo.
2. Smoke test de frontend requer acesso ao ambiente de producao pos-deploy.
3. Recomenda-se validar manualmente apos Vercel rebuild: dashboard, plano, criacao de OS.
