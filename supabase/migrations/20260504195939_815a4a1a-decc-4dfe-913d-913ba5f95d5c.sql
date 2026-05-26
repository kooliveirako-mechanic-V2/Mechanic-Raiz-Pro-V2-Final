-- PASSO 1: Backfill OS com valor_mao_obra zerado mas com itens
WITH itens_totais AS (
  SELECT
    ordem_servico_id,
    COALESCE(SUM(quantidade * valor_unitario), 0) as total_produtos
  FROM itens_os
  GROUP BY ordem_servico_id
)
UPDATE ordens_servico os
SET valor_mao_obra = GREATEST(
  0,
  COALESCE(os.valor_servico, 0) - COALESCE(it.total_produtos, 0)
)
FROM itens_totais it
WHERE it.ordem_servico_id = os.id
  AND COALESCE(os.valor_mao_obra, 0) = 0
  AND COALESCE(os.valor_servico, 0) > 0;

-- PASSO 1b: OS sem itens, valor_mao_obra=0 mas valor_servico>0
UPDATE ordens_servico os
SET valor_mao_obra = os.valor_servico
WHERE COALESCE(os.valor_mao_obra, 0) = 0
  AND COALESCE(os.valor_servico, 0) > 0
  AND NOT EXISTS (SELECT 1 FROM itens_os WHERE ordem_servico_id = os.id);

-- PASSO 2: Corrigir 13 OS onde valor_mao_obra = valor_servico mas existem peças
WITH itens_totais AS (
  SELECT
    ordem_servico_id,
    COALESCE(SUM(quantidade * valor_unitario), 0) as total_produtos
  FROM itens_os
  GROUP BY ordem_servico_id
)
UPDATE ordens_servico os
SET valor_mao_obra = GREATEST(0, os.valor_servico - it.total_produtos)
FROM itens_totais it
WHERE it.ordem_servico_id = os.id
  AND os.valor_mao_obra = os.valor_servico
  AND it.total_produtos > 0;