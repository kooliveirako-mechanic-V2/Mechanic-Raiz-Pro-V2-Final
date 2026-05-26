# CHANGELOG — Auditoria Técnica 360° Mechanic Raiz Pro

## [Auditoria 2026-03] — Correções Críticas de Integridade

**Data:** 19/03/2026  
**Engenheiro responsável:** Auditoria automatizada + revisão manual  
**Escopo:** Integridade financeira, consistência de dados, acesso multi-tenant, performance

---

### 🔴 Crítico

- **[C1] Registros financeiros órfãos corrigidos**
  - **Problema:** `upsertFinanceiroOS()` não era chamado em todos os fluxos de finalização, ou falhava silenciosamente. 38 OS finalizadas existiam sem registro correspondente no `financeiro`.
  - **Correção:** Criada função PostgreSQL `upsert_financeiro_os()` como RPC `SECURITY DEFINER` com `ON CONFLICT`, substituindo o padrão `SELECT + INSERT` que tinha race condition.
  - **Índice:** Criado `idx_financeiro_ordem_servico_unique` (UNIQUE parcial) em `financeiro.ordem_servico_id`.
  - **Trigger:** `registrar_historico_financeiro()` corrigido para suportar operações sem contexto de auth (recuperação/sistema).
  - **Arquivos:** `src/lib/financeiroOS.ts`, migrations `20260319171224`, `20260319171315`

- **[C2] Dashboard subestimava faturamento**
  - **Problema:** `useDashboard` somava apenas `valor_servico` das OS, ignorando `itens_os`. Uma OS com R$120 de mão de obra + R$873 em peças aparecia como R$120.
  - **Correção:** Refatorado para usar tabela `financeiro` (que já inclui valor total via RPC). Aplicado em: `stats.faturamentoMes`, `chartData`, `monthlyComparison`.
  - **Arquivo:** `src/hooks/useDashboard.ts`

- **[C3] OS finalizadas com valor R$0,00**
  - **Problema:** Validação de valor mínimo era contornada via drag-and-drop no Kanban.
  - **Status:** 2 OS legítimas identificadas (sem valor e sem itens). O `upsert_financeiro_os()` agora ignora corretamente OS com valor total ≤ 0 (`action: 'skipped'`).

---

### 🟠 Alto

- **[A1] OficinaContext excluía membros de equipe**
  - **Problema:** `fetchOficinas` usava apenas `.eq("user_id", user.id)`, ignorando funcionários em `user_roles`.
  - **Correção:** Refatorado para buscar oficinas onde o usuário é dono OU possui registro ativo em `user_roles`.
  - **Arquivo:** `src/contexts/OficinaContext.tsx`

- **[A2] Financeiro limitado a 2 meses** — Pendente para próxima sprint
- **[A3] Sem monitoramento de erros (Sentry)** — Pendente para próxima sprint
- **[A4] Coluna `lucro` estruturalmente incorreta** — Pendente para próxima sprint

---

### 🟡 Médio

- **[M1] updateEstoque sobrescrevia todos os campos**
  - **Problema:** `updateEstoque` enviava payload completo, sobrescrevendo campos não editados com `null`.
  - **Correção:** Refatorado para usar partial update (apenas campos com valor definido).
  - **Arquivo:** `src/hooks/useEstoque.ts`

- **[M4] createCliente ignorava CPF/CNPJ e endereço**
  - **Problema:** Campos `cpf_cnpj` e `endereco` não eram incluídos no payload de insert.
  - **Correção:** Campos adicionados ao insert com fallback para `null`.
  - **Arquivo:** `src/hooks/useClientes.ts`

- **[M5] topServices sem filtro de data**
  - **Problema:** Query buscava histórico inteiro ao invés de filtrar pelo mês atual.
  - **Correção:** Adicionado filtro `data_servico` com `inicioMes` e `fimMes`.
  - **Arquivo:** `src/hooks/useDashboard.ts`

- **[M2] Sem paginação em OS e Clientes** — Pendente para próxima sprint
- **[M3] Dashboard com 8+ queries paralelas** — Pendente para próxima sprint

---

### 🟢 Baixo (Pendentes)

- **[B1]** logBusinessEvent usa localStorage — migrar para tabela de auditoria
- **[B2]** Sem rate limiting nas edge functions
- **[B4]** VeiculoInput.tipo limitado

---

### Banco de Dados — Correções Diretas

| Item | Ação |
|---|---|
| Índice UNIQUE | `idx_financeiro_ordem_servico_unique` em `financeiro(ordem_servico_id)` |
| Trigger | `registrar_historico_financeiro` — skip quando `auth.uid() IS NULL` |
| RPC | `upsert_financeiro_os()` — SECURITY DEFINER com ON CONFLICT |
| Dado | OS 1105 — financeiro corrigido de R$923,00 → R$993,00 |
| Dado | 2 OS com R$0 (1002, 1021) — legítimas, corretamente ignoradas |

---

### Validação Pós-Correção

| Check | Resultado |
|---|---|
| OS finalizadas sem financeiro (exceto R$0) | ✅ 0 |
| Divergência valores OS × Financeiro | ✅ 0 |
| Financeiro com valor zero | ✅ 0 |
| Dados órfãos (itens, clientes, estoque) | ✅ 0 |
| Estoque negativo | ✅ 0 |
| Veículos sem cliente | ✅ 0 |
