# Regras Invioláveis — Mechanic Raiz Pro

> Documento criado após auditoria técnica 360° em 19/03/2026.  
> Toda alteração no sistema DEVE seguir estas regras. Violações causam bugs silenciosos em produção.

---

## 🔴 Financeiro

1. **NUNCA** finalize uma OS sem chamar `upsertFinanceiroOS()` via RPC do Supabase.
2. **NUNCA** calcule faturamento usando `valor_servico` das OS — use **SEMPRE** a tabela `financeiro`.
3. **NUNCA** use `SELECT` + `INSERT` para upsert — use sempre `ON CONFLICT` ou a RPC `upsert_financeiro_os`.
4. **NUNCA** remova o índice UNIQUE de `financeiro.ordem_servico_id` (`idx_financeiro_ordem_servico_unique`).
5. **NUNCA** altere a função `upsert_financeiro_os()` sem revisar os 3 fluxos que a chamam:
   - `Servicos.tsx` (Kanban drag-and-drop)
   - `OrdemServicoFormModal.tsx` (formulário)
   - `OSRapidaModal.tsx` (criação rápida)
6. Toda alteração no financeiro **DEVE** ser validada com as queries de integridade:
   ```sql
   -- V-C1a: OS sem financeiro
   SELECT COUNT(*) FROM ordens_servico o
   LEFT JOIN financeiro f ON f.ordem_servico_id = o.id
   WHERE o.status = 'finalizado' AND f.id IS NULL
   AND (o.valor_servico > 0 OR EXISTS(
     SELECT 1 FROM itens_os WHERE ordem_servico_id = o.id AND valor_total > 0
   ));
   -- Esperado: 0

   -- V-C1b: Divergência de valores
   SELECT COUNT(*) FROM ordens_servico o
   JOIN financeiro f ON f.ordem_servico_id = o.id
   WHERE o.status = 'finalizado'
   AND ABS(
     COALESCE(o.valor_servico,0) +
     COALESCE((SELECT SUM(valor_total) FROM itens_os WHERE ordem_servico_id = o.id),0)
     - COALESCE(f.valor,0)
   ) > 0.01;
   -- Esperado: 0
   ```

---

## 🟠 Banco de Dados

1. **NUNCA** faça migration sem script de rollback documentado.
2. **NUNCA** modifique schemas reservados do Supabase (`auth`, `storage`, `realtime`).
3. **NUNCA** use CHECK constraints com `now()` — use validation triggers.
4. Policies RLS devem ser **PERMISSIVE** para evitar bloqueios no onboarding.

---

## 🟡 Estoque

1. **NUNCA** use `updateEstoque` com payload completo — sempre partial update (apenas campos alterados).
2. Campos não enviados **NUNCA** devem ser incluídos como `null` no update.

---

## 🟡 Clientes

1. **NUNCA** omita campos opcionais no `insert` — inclua todos com fallback para `null`.
2. `cpf_cnpj` e `endereco` **DEVEM** estar no payload de criação.

---

## 🟡 Frontend / Mobile

1. Inputs mobile: usar `text-base` e `h-12` para evitar auto-zoom no iOS.
2. **PROIBIDO** `autoFocus` e animações de movimento dentro de `MobileSheet`.
3. **PROIBIDO** declarar componentes funcionais dentro do ciclo de renderização (nested components).
4. **PROIBIDO** `scrollIntoView` programático em eventos de foco mobile.
5. Usar `mode='wait'` em `AnimatePresence` para evitar erros de ref.
6. Invalidação de cache (`queryClient.invalidateQueries`) é **obrigatória** após toda mutação.

---

## 🟢 Geral

1. Todo novo fluxo de finalização de OS **DEVE** ter teste manual documentado antes do deploy.
2. Toda alteração no financeiro **DEVE** ser validada com as queries V-C1a e V-C1b.
3. O endpoint `system-health-check` **DEVE** retornar `"healthy"` antes e depois de cada deploy.
4. **NUNCA** armazene roles na tabela `profiles` — use sempre `user_roles`.
5. **NUNCA** verifique admin status via `localStorage` — use server-side validation.
