
-- Fix 3 OS with stale valor_servico
-- The financeiro already has the correct value; only the OS display field needs updating
UPDATE ordens_servico o
SET valor_servico = COALESCE(o.valor_servico, 0) + COALESCE(
  (SELECT SUM(COALESCE(valor_total, quantidade * valor_unitario)) 
   FROM itens_os WHERE ordem_servico_id = o.id), 0
)
WHERE o.status = 'finalizado'
AND o.numero IN (1105, 1128, 1062)
AND EXISTS (SELECT 1 FROM itens_os WHERE ordem_servico_id = o.id);
