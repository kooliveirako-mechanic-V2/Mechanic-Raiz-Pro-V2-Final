---
name: Recálculo Totais OS — Mão de Obra Global
description: O trigger recalcular_totais_os deve calcular produtos + maior mão de obra entre global e itemizada, sem duplicar
type: feature
---
A função `recalcular_totais_os` (chamada pelo trigger `tg_recalcular_totais_os` em INSERT/UPDATE/DELETE de `itens_os`) deve calcular:

`valor_servico = SUM(itens_os.quantidade * itens_os.valor_unitario) + GREATEST(ordens_servico.valor_mao_obra, SUM(itens_os.valor_mao_obra))`

**Regra raiz:** `itens_os.valor_total` já inclui mão de obra itemizada. Portanto, nunca somar `ordens_servico.valor_mao_obra + SUM(itens_os.valor_total)` sem separar produto/mão de obra, pois duplica quando a mão de obra existe nos dois lugares.

**Compatibilidade com legado:** se a OS usa mão de obra global sem item de serviço, o total deve preservar essa mão de obra global. Se a OS usa mão de obra itemizada, ela deve contar só uma vez.

**Custo:** itens livres (sem `estoque_id`) também devem entrar no custo via `quantidade * custo_unitario` do próprio item.

Qualquer alteração futura nessa função precisa preservar essas duas regras.
