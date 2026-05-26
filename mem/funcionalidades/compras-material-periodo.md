---
name: Compras de Material no Período (Card Financeiro)
description: Card informativo que soma entradas de estoque (peças) no período — feedback do cliente Moisés
type: feature
---
**Objetivo:** Mostrar ao dono da oficina quanto saiu de caixa em **compras de material** (peças/produtos) no período, separado das despesas operacionais.

**Fonte de dados:** `estoque_movimentacoes` WHERE `tipo='entrada'` AND `created_at` no período → soma `quantidade * custo`. Onde `custo = COALESCE(NULLIF(movimentacao.custo_unitario,0), estoque.custo_unitario, 0)`. **Fallback obrigatório**: na prática quase nenhuma entrada grava `custo_unitario` na movimentação — o valor real vive em `estoque.custo_unitario`. Exclui itens com `tipo_item='servico'`.

**Hook:** `src/hooks/useComprasMaterialPeriodo.ts` — leitura pura, NÃO altera estoque/OS/financeiro. Sem filtro = mês atual.

**Componente:** `src/components/financeiro/ComprasMaterialCard.tsx` — usado em `Financeiro.tsx` (desktop, variant `desktop`) e `MobileFinanceiroPreFiscal.tsx` (variant `mobile`). Esconde-se quando `total <= 0` pra evitar ruído.

**Regras invioláveis:**
- Não somar isso ao Lucro nem às Despesas — é só indicador informativo
- Respeitar `valoresOcultos` (modo privacidade)
- Respeitar `dateFilter` quando passado (desktop tem filtro, mobile usa mês corrente)

**Próximas ondas (não implementadas ainda):** (B) Compra direta pra OS sem passar pelo estoque + lançamento financeiro auto, (C) split de entrada de nota, (D) relatório Compras × Consumo.
