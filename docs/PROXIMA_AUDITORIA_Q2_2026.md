# 🔄 Prompt — Auditoria Trimestral Q2 2026

**Data prevista:** Junho 2026  
**Base:** Auditoria Q1 2026 (19/03/2026)

---

## Itens Pendentes da Auditoria Anterior

Estes itens foram identificados mas **não corrigidos** na auditoria Q1. Devem ser priorizados:

### 🟠 Alto
- **[A2]** Financeiro mostra apenas últimos 2 meses — implementar seletor de período dinâmico com filtro server-side
- **[A3]** Sem monitoramento de erros — instalar e configurar Sentry para PWA React
- **[A4]** Coluna `lucro` estruturalmente incorreta — corrigir cálculo para incluir receita de itens_os

### 🟡 Médio
- **[M2]** Sem paginação em OS e Clientes — implementar infinite scroll server-side (limite 20/página)
- **[M3]** Dashboard com 8+ queries paralelas — consolidar em 1-2 RPCs PostgreSQL

### 🟢 Baixo
- **[B1]** logBusinessEvent usa localStorage — migrar para tabela `audit_logs`
- **[B2]** Sem rate limiting nas edge functions `landing-chatbot` e `mercadopago-webhook`
- **[B4]** VeiculoInput.tipo limitado — expandir para caminhão, van, ônibus, maquinário agrícola

---

## Escopo da Auditoria Q2

### 1. Re-validar Correções Q1
```sql
-- Executar todas as queries de integridade
-- V-C1a, V-C1b, V-Integ (todas devem retornar 0)
```

### 2. Verificar health-check
- `system-health-check` deve estar retornando `"healthy"` consistentemente
- Revisar histórico de alertas noturnos — houve algum `"warning"` ou `"critical"`?

### 3. Performance
- Executar `EXPLAIN ANALYZE` nas queries mais pesadas:
  - Dashboard stats (6 queries)
  - Listagem de OS (sem paginação)
  - Listagem de clientes (sem paginação)
- Volume de dados atual vs. capacidade (quantas oficinas? quantas OS total?)

### 4. Segurança
- Revisar RLS policies em novas tabelas criadas desde Q1
- Verificar se `user_roles` está sendo respeitado em todos os endpoints
- Auditar edge functions para SQL injection e rate limiting

### 5. Novos Módulos
- Auditar qualquer módulo novo adicionado desde Q1
- Verificar padrão de upsert financeiro em novos fluxos
- Verificar partial updates em novos CRUDs

### 6. Mobile / UX
- Testar em Android real com volume de dados (100+ clientes, 200+ OS)
- Verificar performance em 3G simulado
- Verificar se inputs seguem padrão `text-base h-12`

---

## Entregáveis Esperados

1. Relatório de integridade atualizado
2. Lista de novos problemas encontrados com classificação de criticidade
3. Atualização do CHANGELOG
4. Prompt da próxima auditoria (Q3 2026)
