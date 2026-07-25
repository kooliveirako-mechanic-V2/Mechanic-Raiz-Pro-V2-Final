# Relatório de Evidências — Fase 2.1
**Função Alvo:** `public.get_oficina_funcionarios(_oficina_id uuid)`
**Banco Live:** `kurlgmngmglhvknwxjee`
**Data:** 2026-07-25

---

## 1. Estado Antes (Vulnerabilidade Confirmada)
- `SECURITY DEFINER` sem validação de `auth.uid()` ou pertencimento do usuário à oficina.
- Prova cross-tenant (`tmp_fase21_proof_before.sql`):
  - `ACCESS_A_TO_A = true`
  - `ACCESS_A_TO_B = false`
  - Usuário A chamou `get_oficina_funcionarios(Oficina B)` e leu 1 linha com PII.
  - Resultado: `VULNERABLE_1_ROWS`.

---

## 2. Migration Aplicada
- Arquivo: `supabase/migrations/20260725005440_security_hardening_get_oficina_funcionarios.sql`
- Escopo: cirúrgico e isolado de qualquer outra RPC.
- Alteração:
  - Idioma convertido de `sql` para `plpgsql` mantendo assinatura e lógica de negócio.
  - Injetada validação de autorização com bypass de `service_role`:
    ```sql
    IF COALESCE(auth.role(), '') <> 'service_role' THEN
      IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
      END IF;

      IF NOT public.has_oficina_access(auth.uid(), _oficina_id) THEN
        RAISE EXCEPTION 'forbidden: cross-tenant access denied' USING ERRCODE = '42501';
      END IF;
    END IF;
    ```
  - `SET search_path TO public, pg_temp;`
  - `REVOKE EXECUTE FROM PUBLIC, anon;`
  - `GRANT EXECUTE TO authenticated, service_role;`

---

## 3. Estado Depois (Provas Obrigatórias Pós-Alteração)

Resultado da consulta no banco live (`tmp_fase21_proof_after.sql`):

| idx | Item | Resultado | Detalhe |
|---|---|---|---|
| 1 | `ACCESS_A_TO_A` | true | Acesso legítimo OK |
| 2 | `ACCESS_A_TO_B` | false | Isolamento OK |
| 3 | `own_office_regression` | 1 rows | PASS — Usuário A leu própria oficina |
| 4 | `cross_tenant_blocked` | PASS_BLOCKED_42501 | `forbidden: cross-tenant access denied` |
| 5 | `guard_ok` | true | Guard `has_oficina_access` presente |
| 6 | `anon_blocked` | PASS | `anon_can = false` |
| 7 | `authenticated_allowed` | PASS | `auth_can = true` |
| 8 | `service_role_allowed` | PASS | `service_can = true` |

---

## 4. Análise de Cascata e Frontend
- `pg_depend` no banco live: 0 dependências de catálogo registradas para a função.
- Chamadas no frontend:
  - `src/components/configuracoes/TeamModal.tsx`
  - `src/hooks/useFuncionarios.ts`
  - `src/hooks/useOrdensServico.ts`
- Todas as chamadas enviam `_oficina_id: oficinaAtual.id` de um usuário autenticado. Como `has_oficina_access` retorna `true` para a própria oficina, a regressão funcional é PASS (zero quebra de frontend).

---

## 5. Arquivos Desta Fase (Fase 2.1)
- Migration: `supabase/migrations/20260725005440_security_hardening_get_oficina_funcionarios.sql`
- Relatório de evidências: `reports/migration/FASE21_GET_OFICINA_FUNCIONARIOS_EVIDENCE.md`
- Snapshot pós-alteração: `reports/migration/fase21_get_oficina_funcionarios_snapshot_after.json`
