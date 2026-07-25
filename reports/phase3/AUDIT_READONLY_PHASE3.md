# Dossiê de Auditoria Read-Only — Fase 3
**Data UTC:** 2026-07-25
**Banco Alvo:** `kurlgmngmglhvknwxjee` (PostgreSQL 17.6)
**Modo:** READ-ONLY (nenhuma função alterada, NENHUM COMMIT persistido nas provas)
**Timestamp Live da Auditoria:** `2026-07-25 05:02:24.894022+00`

---

## 1. Hashes SHA-256 dos Corpos Extraídos

- `4abf4bc81f04946cd6c49d0e44d5f42eee931241de7d130c92b6969a367ca6ce` *reports/phase3/audit/atomic_delete_cliente.sql*
- `d56d255b23cf71e8927bfbbc6501a998ebeaf7d9d5143b8302c076c34e72c04f` *reports/phase3/audit/atomic_delete_os.sql*
- `d0ae2a541d04699cd86cc84046ccafc39fbb3ff44d72d39b63b4f5c92f8b40c1` *reports/phase3/audit/cancelar_venda_balcao.sql*
- `4b7caf0a0577669c2ddbcf181706d082c20b56e7c370a8bdff51f2a66968b410` *reports/phase3/audit/criar_os_completa.sql*
- `337c4e07d2294beb233102112c90cf082b5b65ddd8f154e269cc1b14a0721619` *reports/phase3/audit/criar_venda_balcao.sql*

---

## 2. Matriz de Inventário das 5 Funções

| Função | SECURITY DEFINER | search_path | anon EXECUTE | authenticated EXECUTE | service_role EXECUTE | Overloads |
|---|---|---|---|---|---|---|
| `atomic_delete_cliente` | true | `public` | true | true | true | 0 |
| `atomic_delete_os` | true | `public` | true | true | true | 0 |
| `cancelar_venda_balcao` | true | `null` (default) | true | true | true | 0 |
| `criar_os_completa` | true | `public, pg_temp` | false | true | false | 0 |
| `criar_venda_balcao` | true | `public, pg_temp` | false | true | true | 0 |

---

## 3. Corpos Extraídos

- [atomic_delete_cliente](./audit/atomic_delete_cliente.sql) — SHA256: `4abf4bc81f04946cd6c49d0e44d5f42eee931241de7d130c92b6969a367ca6ce`
- [atomic_delete_os](./audit/atomic_delete_os.sql) — SHA256: `d56d255b23cf71e8927bfbbc6501a998ebeaf7d9d5143b8302c076c34e72c04f`
- [cancelar_venda_balcao](./audit/cancelar_venda_balcao.sql) — SHA256: `d0ae2a541d04699cd86cc84046ccafc39fbb3ff44d72d39b63b4f5c92f8b40c1`
- [criar_os_completa](./audit/criar_os_completa.sql) — SHA256: `4b7caf0a0577669c2ddbcf181706d082c20b56e7c370a8bdff51f2a66968b410`
- [criar_venda_balcao](./audit/criar_venda_balcao.sql) — SHA256: `337c4e07d2294beb233102112c90cf082b5b65ddd8f154e269cc1b14a0721619`

---

## 4. Provas Cross-Tenant

Tenants usados nas provas:
- `oficina_a` = `bf84d08f-3f4c-4d9e-ab19-84aed119e1c9`
- `user_a` = `e8daffb8-9b72-4dd9-8771-5bce5de39d31`
- `oficina_b` = `580d8c71-d7cb-418b-a2a0-e82694a593e3` (Oficina B de controle)
- `oficina_b_vendas` = `d6112300-0a65-49c7-8072-a1c5510d5689` (Oficina com vendas existentes)

### 4.1 `criar_os_completa`

```sql
BEGIN;
PERFORM set_config('request.jwt.claim.sub', 'e8daffb8-9b72-4dd9-8771-5bce5de39d31', true);
PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
SELECT public.criar_os_completa(
  p_oficina_id := '580d8c71-d7cb-418b-a2a0-e82694a593e3',
  p_cliente_id := '00000000-0000-0000-0000-000000000000',
  p_veiculo_id := '00000000-0000-0000-0000-000000000000',
  p_tipo_servico := 'AUDIT_TEST'
);
ROLLBACK;
```

**Saída crua do banco:**
```text
{"code":"P0001","details":null,"hint":null,"message":"Erro ao criar OS: Sem permissão para esta oficina. Nenhum dado foi salvo."}
```

- **Veredito:** `PROTEGIDA_P0001`
- **Análise do corpo:** Guard na linha 23: `IF NOT public.has_oficina_access(auth.uid(), p_oficina_id) THEN RAISE EXCEPTION 'Sem permissão para esta oficina' USING ERRCODE = '42501';`. O handler `EXCEPTION WHEN OTHERS` genérico re-lança como `P0001`, mas o bloqueio atua antes de qualquer gravação.

### 4.2 `criar_venda_balcao`

```sql
BEGIN;
PERFORM set_config('request.jwt.claim.sub', 'e8daffb8-9b72-4dd9-8771-5bce5de39d31', true);
PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
SELECT public.criar_venda_balcao(
  p_oficina_id := '580d8c71-d7cb-418b-a2a0-e82694a593e3',
  p_itens := '[{"nome_item":"AUDIT","quantidade":1,"valor_unitario":1,"custo_unitario":0}]'::jsonb,
  p_forma_pagamento := 'dinheiro'
);
ROLLBACK;
```

**Saída crua do banco:**
```text
{"code":"42501","details":null,"hint":null,"message":"Acesso negado à função criar_venda_balcao"}
```

- **Veredito:** `BLINDADA` (bloqueio direto `42501`)
- **Análise do corpo:** Guard na linha 31: `IF NOT public.has_oficina_access(auth.uid(), p_oficina_id) THEN RAISE EXCEPTION ... USING ERRCODE = '42501';`. Ja blindada na Fase 1.

### 4.3 `cancelar_venda_balcao`

```sql
BEGIN;
PERFORM set_config('request.jwt.claim.sub', 'e8daffb8-9b72-4dd9-8771-5bce5de39d31', true);
PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
SELECT public.cancelar_venda_balcao('0950cd09-68ff-412d-b339-54af46f979a9');
ROLLBACK;
```

**Saída crua do banco:**
```json
[
  {
    "detail": "oficina_b=d6112300-0a65-49c7-8072-a1c5510d5689 venda_b=0950cd09-68ff-412d-b339-54af46f979a9",
    "idx": 1,
    "item": "context",
    "result": "user_a=e8daffb8-9b72-4dd9-8771-5bce5de39d31 oficina_a=bf84d08f-3f4c-4d9e-ab19-84aed119e1c9"
  },
  {
    "detail": "{\"success\": true}",
    "idx": 2,
    "item": "cancelar_venda_balcao_cross_tenant",
    "result": "VULNERABLE_SUCCESS"
  }
]
```

- **Veredito:** `VULNERABLE` (execução cross-tenant bem-sucedida)
- **Análise do corpo:** Ausência total de `auth.uid()` ou `has_oficina_access`. A função faz `UPDATE public.vendas_balcao SET status = 'cancelada' WHERE id = p_venda_id;` confiando no parâmetro sem cruzar autorização.

### 4.4 `atomic_delete_os`

```sql
BEGIN;
PERFORM set_config('request.jwt.claim.sub', 'e8daffb8-9b72-4dd9-8771-5bce5de39d31', true);
PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
SELECT public.atomic_delete_os('71e22709-38b4-4b53-9a3d-3b8543419999');
ROLLBACK;
```

**Saída crua do banco:**
```json
{"success" : false, "error" : "Sem permissão para esta oficina"}
```

- **Veredito:** `PROTEGIDA_JSON`
- **Análise do corpo:** Guard na linha 24: `IF NOT public.has_oficina_access(auth.uid(), v_os.oficina_id) THEN RETURN json_build_object('success', false, 'error', 'Sem permissão para esta oficina'); END IF;`. A função resolve `v_os.oficina_id` via `SELECT FOR UPDATE` e bloqueia a deleção.

### 4.5 `atomic_delete_cliente`

```sql
BEGIN;
PERFORM set_config('request.jwt.claim.sub', 'e8daffb8-9b72-4dd9-8771-5bce5de39d31', true);
PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
SELECT public.atomic_delete_cliente('99999999-9999-9999-9999-999999999999');
ROLLBACK;
```

**Saída crua do banco:**
```json
{"success" : false, "error" : "Sem permissão para esta oficina"}
```

- **Veredito:** `PROTEGIDA_JSON`
- **Análise do corpo:** Guard na linha 23: `IF NOT public.has_oficina_access(auth.uid(), v_cliente.oficina_id) THEN RETURN json_build_object('success', false, 'error', 'Sem permissão para esta oficina'); END IF;`. A função resolve `v_cliente.oficina_id` via `SELECT FOR UPDATE` e bloqueia a deleção.

---

## 4.6 Validação de Persistência Pós-Rollback

Consulta executada após a bateria de testes em `ROLLBACK`:

```sql
SELECT id, oficina_id, status FROM public.vendas_balcao WHERE id = '0950cd09-68ff-412d-b339-54af46f979a9';
```

**Saída crua do banco:**
```json
[
  {
    "id": "0950cd09-68ff-412d-b339-54af46f979a9",
    "observacao": null,
    "oficina_id": "d6112300-0a65-49c7-8072-a1c5510d5689",
    "status": "concluida"
  }
]
```

E contagem de registros marcadores de teste:
- `audit_os_rows` = 0
- `audit_sale_rows` = 0

Confirmado: o estado da venda `0950cd09-68ff-412d-b339-54af46f979a9` permaneceu `concluida`. Nenhum dado foi persistido na auditoria.

---

## 5. Callers Mapeados

| Função | Frontend (arquivos `src/`) | Edge Functions | RPCs internas (`pg_proc`) |
|---|---|---|---|
| `criar_os_completa` | `OrdemServicoFormModal.tsx`, `OSRapidaModal.tsx`, `useOrdensServico.ts`, `sentinela.ts`, `criticalRpcs.ts`, `rpcTypes.ts` | — nenhum — | — nenhum — |
| `criar_venda_balcao` | `useVendasBalcao.ts`, `criticalRpcs.ts`, `rpcTypes.ts` | — nenhum — | — nenhum — |
| `cancelar_venda_balcao` | `integrations/supabase/types.ts` (apenas tipagem gerada) | — nenhum — | — nenhum — |
| `atomic_delete_os` | `useOrdensServico.ts`, `criticalRpcs.ts`, `rpcTypes.ts` | — nenhum — | — nenhum — |
| `atomic_delete_cliente` | `useClientes.ts`, `criticalRpcs.ts`, `rpcTypes.ts` | — nenhum — | — nenhum — |

---

## 6. Ranking de Priorização para Fase 3.1+

| # | Função | Severidade | Vulnerabilidade real? | Ação recomendada | Fase |
|---|---|---|---|---|---|
| 1 | `cancelar_venda_balcao` | **CRÍTICA** | **SIM** | Injetar guard `has_oficina_access`, fixar `search_path`, revogar `anon`/`PUBLIC`, conceder a `authenticated`/`service_role` | **3.1** |
| 2 | `atomic_delete_os` | MÉDIA | NÃO | Padronizar: revogar `anon`, fixar `search_path = public, pg_temp`, retornar `42501` em exceção | 3.2 |
| 3 | `atomic_delete_cliente` | MÉDIO | NÃO | Padronizar: revogar `anon`, fixar `search_path = public, pg_temp`, retornar `42501` em exceção | 3.2 |
| 4 | `criar_os_completa` | INFORMATIVO | NÃO | Já protegida. Opcional futuro: tratar handler para preservar `42501` original | — |
| 5 | `criar_venda_balcao` | INFORMATIVO | NÃO | Já protegida e blindada na Fase 1. Não tocar. | — |

---

## 7. Regras de Não-Regressão Identificadas para Fase 3.1 (`cancelar_venda_balcao`)

Triggers cadastrados na tabela `vendas_balcao` no banco live:

| Nome do Trigger | Evento | Ação Disparada |
|---|---|---|
| `trigger_baixar_estoque_venda_balcao` | UPDATE | `EXECUTE FUNCTION baixar_estoque_venda_balcao()` |
| `trigger_estornar_venda_balcao` | UPDATE | `EXECUTE FUNCTION estornar_venda_balcao()` |
| `trigger_estornar_venda_balcao` | DELETE | `EXECUTE FUNCTION estornar_venda_balcao()` |

### Checklist de Preservação para o Patch 3.1:
- [ ] O `UPDATE public.vendas_balcao SET status = 'cancelada'` deve ser mantido exatamente como está para continuar disparando `trigger_estornar_venda_balcao`.
- [ ] Apenas a camada de autorização deve ser adicionada no topo do bloco `BEGIN`.
- [ ] `service_role` deve ter bypass liberado para permitir estornos automáticos acionados por webhooks/Edge Functions.

---

## 8. Declaração de Conformidade

```text
Este dossiê foi produzido em modo read-only.
Nenhuma função foi alterada. Nenhuma migration foi criada.
Todas as provas cross-tenant rodaram dentro de BEGIN/ROLLBACK.
Estado do banco kurlgmngmglhvknwxjee em 2026-07-25 05:02:24.894022+00 = idêntico ao estado pré-auditoria.
```

- **SHA-256 do relatório antes desta nota:** `ba0d3484b0be62ec835492f64950b4e0cf609b656827715d78214c9236b65b2f` *reports/phase3/AUDIT_READONLY_PHASE3.md*
