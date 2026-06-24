-- Reabre OS #1405 via fluxo controlado e remove o financeiro de teste
SELECT public.reabrir_os_atomica(
  '803ce12f-3797-4205-93fb-54929ec91446'::uuid,
  'Reversão de dado de teste do smoke-test mobile'
);

DELETE FROM public.financeiro
WHERE id = 'eb6eff2e-b726-4a5c-a37f-ddbc3fee3ff6'
  AND ordem_servico_id = '803ce12f-3797-4205-93fb-54929ec91446';

UPDATE public.ordens_servico
SET forma_pagamento = NULL,
    data_conclusao = NULL,
    updated_at = now()
WHERE id = '803ce12f-3797-4205-93fb-54929ec91446';