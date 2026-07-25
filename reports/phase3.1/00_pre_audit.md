# Fase 3.1 — Pré-Auditoria Read-Only
**Função:** `public.cancelar_venda_balcao(p_venda_id uuid)`
**Banco Live:** `kurlgmngmglhvknwxjee`
**Data UTC:** 2026-07-25

---

## 1. Definição Original (antes do patch)

- Arquivo: `reports/phase3.1/audit/cancelar_venda_balcao.before.sql`
- SHA-256: `f0ea9c372a5f43eb0842c89ea903a31777eb497c452f17ebdf696165be53b1be`
- Propriedades: `SECURITY DEFINER`, `LANGUAGE plpgsql`, **sem** `search_path` fixo, **sem** `auth.uid()`, **sem** `has_oficina_access`.

## 2. Grants Antes

Fonte: `information_schema.routine_privileges`

| grantee | privilege_type |
|---|---|
| PUBLIC | EXECUTE |
| postgres | EXECUTE |

`anon` executa por herança de `PUBLIC`.

## 3. Triggers Baseline (não-regressão)

Fonte: `information_schema.triggers` — tabela `vendas_balcao`.

| Trigger | Evento | Função |
|---|---|---|
| `trigger_baixar_estoque_venda_balcao` | UPDATE | `baixar_estoque_venda_balcao()` |
| `trigger_estornar_venda_balcao` | UPDATE | `estornar_venda_balcao()` |
| `trigger_estornar_venda_balcao` | DELETE | `estornar_venda_balcao()` |

Comportamento de `estornar_venda_balcao()` (relevante ao cancelamento):
- Dispara quando `OLD.status='concluida'` e `NEW.status='cancelada'`.
- Devolve estoque (`UPDATE estoque` + insere `estoque_movimentacoes` tipo `entrada`).
- Marca `financeiro.status='cancelado'` para linhas com `venda_balcao_id = OLD.id`.

## 4. Reprodução da Vulnerabilidade (BEGIN/ROLLBACK)

Contexto: usuário da Oficina A tentando cancelar venda da Oficina B.

```sql
BEGIN;
PERFORM set_config('request.jwt.claim.sub', 'e8daffb8-9b72-4dd9-8771-5bce5de39d31', true);
PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
SELECT public.cancelar_venda_balcao('0950cd09-68ff-412d-b339-54af46f979a9');
ROLLBACK;
```

**Saída crua:**
```json
[
  { "idx": 1, "item": "context",
    "result": "user_a=e8daffb8-9b72-4dd9-8771-5bce5de39d31",
    "detail": "venda_b=0950cd09-68ff-412d-b339-54af46f979a9 oficina_b=d6112300-0a65-49c7-8072-a1c5510d5689 status_before=concluida" },
  { "idx": 2, "item": "access_a_to_b", "result": "false" },
  { "idx": 3, "item": "cancelar_cross_tenant", "result": "VULNERABLE_true",
    "detail": "status_after=cancelada res={\"success\": true}" }
]
```

**Veredito:** `VULNERABLE` — `has_oficina_access(A, B)=false`, porém a venda da Oficina B foi cancelada (`concluida`→`cancelada`) sem qualquer bloqueio. Transação revertida via `ROLLBACK`.
