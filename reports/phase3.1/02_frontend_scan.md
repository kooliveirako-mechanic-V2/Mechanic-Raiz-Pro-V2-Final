# Fase 3.1 — Scan de Frontend e Edge Functions

## Frontend

Comando executado:
```bash
rg -n "cancelar_venda_balcao" src/
```

**Saída crua:**
```text
src/integrations/supabase/types.ts:2792: cancelar_venda_balcao: { Args: { p_venda_id: string }; Returns: Json }
```

Resultado: nenhuma chamada ativa a `cancelar_venda_balcao` foi encontrada no frontend. A única referência é tipagem gerada do Supabase.

`useVendasBalcao.ts` foi mapeado na auditoria Fase 3 como caller de `criar_venda_balcao`, não de `cancelar_venda_balcao`.

## Edge Functions

Comando executado:
```bash
rg -n "cancelar_venda_balcao" supabase/functions/
```

**Saída crua:**
```text
No matches found
```

Resultado: nenhuma Edge Function chama a RPC alvo.

## Smoke Manual Recomendado

- Abrir detalhe de venda balcão em produção.
- Confirmar botão de cancelar em venda da própria oficina.
- Confirmar sucesso e efeitos de estoque/financeiro na UI.
- Confirmar ausência de `42501` para usuário autenticado autorizado.
