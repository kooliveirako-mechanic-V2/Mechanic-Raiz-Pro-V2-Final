# Fase 3.1 — Provas Pós-Migration
**Função:** `public.cancelar_venda_balcao(p_venda_id uuid)`
**Banco Live:** `kurlgmngmglhvknwxjee`

---

## Migration Aplicada

`supabase/migrations/20260725054000_phase3_1_harden_cancelar_venda_balcao.sql`

Mudanças autorizadas:
1. Atributo `SET search_path TO public, pg_temp`.
2. Guard como primeiro statement executável, com bypass explícito de `service_role`.
3. `REVOKE EXECUTE` de `PUBLIC, anon`; `GRANT EXECUTE` para `authenticated, service_role`.

Dry-run com `ROLLBACK` antes de aplicar:
```json
{"anon_can":false,"auth_can":true,"guard_ok":true,"search_path_ok":true,"svc_can":true}
```

---

## Prova A — Tenant Legítimo

Venda própria com estoque + financeiro: `0950cd09-68ff-412d-b339-54af46f979a9`, oficina `d6112300-0a65-49c7-8072-a1c5510d5689`, usuário `53aaf6e1-67e1-4900-8c25-151966093ed7`.

Executada em `BEGIN/ROLLBACK`.

**Saída crua:**
```json
{
  "proof": "A_legitimate_cancel",
  "result": "PASS",
  "detail": {
    "response": {"success": true},
    "status_before": "concluida",
    "status_after": "cancelada"
  }
}
```

---

## Prova B — Cross-Tenant Bloqueado

Usuário da Oficina A tentou cancelar venda de Oficina B.

**Saída crua:**
```json
{
  "proof": "B_cross_tenant",
  "result": "PASS_42501",
  "detail": {"message": "Acesso negado", "sqlstate": "42501"}
}
```

---

## Prova C — Anon REST Bloqueado

Requisição POST para `/rest/v1/rpc/cancelar_venda_balcao` usando apenas chave anon (valor não exposto).

**Saída crua:**
```text
ANON REST cancelar_venda_balcao: HTTP 401 -> {"code":"42501","details":null,"hint":null,"message":"permission denied for function cancelar_venda_balcao"}
```

---

## Prova D — Triggers de Estorno Preservados

Executada em `BEGIN/ROLLBACK` com a venda legítima da Prova A.

### D.1 Estoque

**Saída crua:**
```json
{
  "proof": "D_stock_trigger",
  "result": "PASS",
  "detail": {
    "stock_before": [{"estoque_id":"d7e77045-cab1-4f4c-a6aa-3de0b5da211d","item_qty":1,"quantidade":0}],
    "stock_after":  [{"estoque_id":"d7e77045-cab1-4f4c-a6aa-3de0b5da211d","item_qty":1,"quantidade":1}],
    "moves_before": 0,
    "moves_after": 1,
    "entrada_movements": [{
      "id":"5bba15aa-e6e6-46b1-b807-5b0c6d2b91e3",
      "tipo":"entrada","quantidade":1,"quantidade_anterior":0,"quantidade_nova":1,
      "motivo":"Estorno (Venda Cancelada): Retrovisor Nexpart CG 150"
    }]
  }
}
```

### D.2 Financeiro

**Saída crua:**
```json
{
  "proof": "D_finance_trigger",
  "result": "PASS",
  "detail": {
    "finance_before": [{
      "id":"c42af2c7-d689-4712-9cf9-a5c3bbf1e692",
      "status":"pago","observacoes_contador":null
    }],
    "finance_after": [{
      "id":"c42af2c7-d689-4712-9cf9-a5c3bbf1e692",
      "status":"cancelado","observacoes_contador":" [Venda Balcão Cancelada #69]"
    }]
  }
}
```

---

## Rollback Confirmado

Após as provas:
```json
{
  "venda_id":"0950cd09-68ff-412d-b339-54af46f979a9",
  "venda_status":"concluida",
  "estoque_id":"d7e77045-cab1-4f4c-a6aa-3de0b5da211d",
  "estoque_quantidade":0,
  "financeiro_id":"c42af2c7-d689-4712-9cf9-a5c3bbf1e692",
  "financeiro_status":"pago",
  "observacoes_contador":null,
  "movement_count":0
}
```

Nenhuma prova deixou alteração persistida.

---

## Snapshot Pós-Patch

- `anon_exec=false`
- `authenticated_exec=true`
- `service_role_exec=true`
- `proconfig=["search_path=public, pg_temp"]`
- Guard presente no topo.

## Hashes Finais (SHA-256)

- `50ecfe9f06e34c645a4faa6bf50e6f656a5dd5928b98a4b7d9c3fe305a71547b` *supabase/migrations/20260725054000_phase3_1_harden_cancelar_venda_balcao.sql*
- `e8954a712bee96fae613dc9d6ee3d4a378afc04f04b1c7c13d19bce020c73041` *reports/phase3.1/00_pre_audit.md*
- `7f2af9bcf3b4eb425450959da73afb39dfd901b58f78cbc993cd247d11d101ea` *reports/phase3.1/02_frontend_scan.md*
- `f0ea9c372a5f43eb0842c89ea903a31777eb497c452f17ebdf696165be53b1be` *reports/phase3.1/audit/cancelar_venda_balcao.before.sql*
- `58196cb27ece37cb8d2f351c51aa807136bd371e1dcf0ca45b0f64286ac6e90c` *reports/phase3.1/audit/cancelar_venda_balcao.after.sql*
- `7d937655501500482296624e803f648a2c72b7bf18286ad22d6154c0e28b0fbf` *reports/phase3.1/audit/function_diff.patch*
