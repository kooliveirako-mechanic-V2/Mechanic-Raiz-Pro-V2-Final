# Checklist de Deploy — Mechanic Raiz Pro

> Obrigatório antes de qualquer deploy em produção.  
> Nenhum item pode ser pulado. Se não se aplica, marque como "N/A" com justificativa.

---

## ✅ Pré-Deploy

### Banco de Dados (se alterado)
- [ ] Migration tem script de rollback documentado?
- [ ] Índices necessários foram criados?
- [ ] Triggers impactados foram testados isoladamente?
- [ ] Policies RLS são PERMISSIVE?

### Financeiro (se alterado)
- [ ] `upsertFinanceiroOS()` continua sendo chamado nos 3 fluxos? (Kanban, Form, OS Rápida)
- [ ] Query V-C1a retorna 0 no ambiente de staging?
- [ ] Query V-C1b retorna 0 no ambiente de staging?
- [ ] Dashboard usa tabela `financeiro` (não `valor_servico` da OS)?

### Estoque (se alterado)
- [ ] `updateEstoque` usa partial update?
- [ ] Nenhum campo é sobrescrito com null indevidamente?

### Clientes (se alterado)
- [ ] Insert inclui todos os campos opcionais (`cpf_cnpj`, `endereco`)?

### Frontend
- [ ] Inputs mobile com `text-base` e `h-12`?
- [ ] Sem `autoFocus` em MobileSheet?
- [ ] Sem componentes declarados dentro de render?
- [ ] Cache invalidado após mutações?

### Geral
- [ ] Testado no Android (dispositivo real ou emulador)?
- [ ] Testado em conexão lenta (3G simulado no DevTools)?
- [ ] `system-health-check` retorna `"healthy"` no staging?
- [ ] Código revisado por pelo menos 1 pessoa?

---

## ✅ Pós-Deploy

- [ ] `system-health-check` retorna `"healthy"` em produção?
- [ ] Queries de integridade (V-C1a, V-C1b, V-Integ) executadas no banco de produção?
- [ ] Nenhum erro novo nos logs nas primeiras 2 horas?
- [ ] Teste manual do fluxo alterado feito em produção?
- [ ] Alertas automáticos noturnos continuam agendados?

---

## 🔄 Rollback

Em caso de problema crítico pós-deploy:
1. Reverter o commit via Git
2. Executar script de rollback da migration (se houver)
3. Redeployar edge functions para a versão anterior
4. Executar queries de integridade para confirmar estado
5. Documentar o incidente no CHANGELOG

---

## 📅 Auditoria Recorrente

| Frequência | Ação |
|---|---|
| **Diária** (automática) | `system-health-check` via pg_cron |
| **Semanal** (10min) | Revisar logs de erro + queries de integridade |
| **Mensal** (30min) | `EXPLAIN ANALYZE` nas queries mais pesadas |
| **Trimestral** (completa) | Re-executar auditoria 360° nos módulos alterados |
