
-- Corrigir coluna gerada para incluir valor_mao_obra nos itens_os
ALTER TABLE itens_os DROP COLUMN valor_total;
ALTER TABLE itens_os ADD COLUMN valor_total numeric GENERATED ALWAYS AS ((quantidade::numeric * valor_unitario) + COALESCE(valor_mao_obra, 0)) STORED;

-- Fazer o mesmo para itens_orcamento
ALTER TABLE itens_orcamento DROP COLUMN valor_total;
ALTER TABLE itens_orcamento ADD COLUMN valor_total numeric GENERATED ALWAYS AS ((quantidade::numeric * valor_unitario) + COALESCE(valor_mao_obra, 0)) STORED;
