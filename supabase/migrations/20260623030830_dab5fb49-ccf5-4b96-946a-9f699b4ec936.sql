
-- 1) Substituir índice único: agora permite múltiplos lançamentos por OS, mas só 1 principal
DROP INDEX IF EXISTS public.idx_financeiro_ordem_servico_unique;

CREATE UNIQUE INDEX idx_financeiro_os_principal_unique
  ON public.financeiro (ordem_servico_id)
  WHERE ordem_servico_id IS NOT NULL
    AND (categoria IS NULL OR categoria NOT IN ('sinal','comissao'));

-- 2) Backfill retroativo: bypass triggers de proteção (estamos em migration, role postgres)
SET LOCAL session_replication_role = 'replica';

-- 2a) Garante categoria='sinal' em todos os lançamentos vinculados a os_sinais
UPDATE public.financeiro f
SET categoria = 'sinal',
    valor = s.valor,
    descricao = COALESCE(f.descricao, 'Sinal OS')
FROM public.os_sinais s
WHERE s.financeiro_id = f.id
  AND (f.categoria IS DISTINCT FROM 'sinal' OR f.valor <> s.valor);

-- 2b) Para as 9 OS afetadas: criar lançamento PRINCIPAL faltante (restante = valor_servico - desconto - sinais)
INSERT INTO public.financeiro (
  oficina_id, ordem_servico_id, tipo, categoria, valor, status,
  descricao, data, data_pagamento, data_competencia, origem,
  valor_mao_obra, valor_pecas
)
SELECT
  os.oficina_id,
  os.id,
  'entrada',
  'operacional',
  (COALESCE(os.valor_servico,0) - COALESCE(os.desconto,0) - COALESCE(sin.sinal_total,0))::numeric,
  'pago'::public.status_pagamento,
  'OS #' || os.numero || ' - ' || COALESCE(os.tipo_servico,'Serviço') || ' (recuperação retroativa)',
  COALESCE(os.data_conclusao, CURRENT_DATE),
  COALESCE(os.data_conclusao, CURRENT_DATE),
  COALESCE(os.data_conclusao, CURRENT_DATE),
  'OS #' || os.numero || ' (recuperação retroativa)',
  COALESCE((SELECT SUM(COALESCE(valor_mao_obra,0)) FROM public.itens_os WHERE ordem_servico_id = os.id),0) + COALESCE(os.valor_mao_obra,0),
  COALESCE((SELECT SUM(COALESCE(quantidade,1)*COALESCE(valor_unitario,0)) FROM public.itens_os WHERE ordem_servico_id = os.id),0)
FROM public.ordens_servico os
JOIN (
  SELECT ordem_servico_id, SUM(valor) AS sinal_total
  FROM public.os_sinais GROUP BY 1
) sin ON sin.ordem_servico_id = os.id
WHERE os.numero IN (1268,1269,1274,1290,1321,1322,1327,1339,1402)
  AND os.status = 'finalizado'
  AND (COALESCE(os.valor_servico,0) - COALESCE(os.desconto,0) - COALESCE(sin.sinal_total,0)) > 0.05
  AND NOT EXISTS (
    SELECT 1 FROM public.financeiro f
    WHERE f.ordem_servico_id = os.id
      AND f.tipo = 'entrada'
      AND (f.categoria IS NULL OR f.categoria NOT IN ('comissao','sinal'))
  );

SET LOCAL session_replication_role = 'origin';
