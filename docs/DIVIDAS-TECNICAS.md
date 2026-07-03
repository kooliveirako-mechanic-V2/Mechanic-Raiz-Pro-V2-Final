# Dívidas Técnicas — Auditoria Julho/2026

Registros de inconsistências identificadas durante a auditoria forense. Estas são **dívidas herdadas**, pré-existentes aos PRs da auditoria atual, e requerem investigação dedicada.

---

## B1: OS Finalizadas Sem Lançamento Financeiro

**Status:** Dívida legada (não causada pelos PRs 1/2/3)  
**Severidade:** 🟡 Baixa (valores zerados)  
**Data identificação:** 2026-07-03

### Evidência

2 OS finalizadas com `valor_servico = 0` e sem registro correspondente em `financeiro`:

| OS # | oficina_id | data_servico | valor_servico | valor_mao_obra |
|------|------------|--------------|---------------|----------------|
| 1002 | a4ec9a0d-... | 2026-03-04 | 0 | 0 |
| 1021 | 20725847-... | 2026-03-04 | 0 | 0 |

### Análise

São OS legítimas zeradas — sem itens e sem mão de obra. A RPC `upsert_financeiro_os` corretamente ignora OS com valor total ≤ 0 (retorna `action: 'skipped'`).

**Não é bug, é comportamento esperado.** Documentado aqui para rastreabilidade.

---

## B7: Divergência Estoque vs. Movimentações

**Status:** Dívida legada (pré-existente à auditoria)  
**Severidade:** 🟠 Média (dados inconsistentes)  
**Data identificação:** 2026-07-03

### Evidência

562 itens de estoque em 15 oficinas onde `quantidade` difere de `SUM(movimentações)`:

```sql
SELECT 
  e.id,
  e.oficina_id,
  e.nome,
  e.quantidade AS qtd_atual,
  COALESCE(SUM(
    CASE WHEN m.tipo = 'entrada' THEN m.quantidade ELSE -m.quantidade END
  ), 0) AS qtd_calculada,
  e.quantidade - COALESCE(SUM(...), 0) AS divergencia
FROM estoque e
LEFT JOIN estoque_movimentacoes m ON m.estoque_id = e.id
GROUP BY e.id
HAVING e.quantidade != COALESCE(SUM(...), 0);
-- Resultado: 562 linhas
```

### Causa Provável

- Importações CSV iniciais que não geraram movimentações
- Ajustes manuais antes da implementação do tracking completo
- Migrações de dados legados

### Ação Recomendada

1. Criar migration de normalização que gere movimentações de ajuste para fechar a divergência
2. Adicionar detector no Sentinela para alertar divergências futuras
3. Priorizar em sprint separada (não bloqueia operação atual)

---

## Notas

- Estas dívidas **não foram introduzidas** pelos PRs da auditoria atual
- A auditoria de Março/2026 já havia corrigido os problemas críticos de integridade
- O sistema está operacional; estas são melhorias de qualidade de dados
