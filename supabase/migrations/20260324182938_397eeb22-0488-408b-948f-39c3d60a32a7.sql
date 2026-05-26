
-- Delete trigger-created duplicates (from oficinas insert trigger)
DELETE FROM public.subscriptions;
DELETE FROM public.categorias_financeiras;
DELETE FROM public.centros_custo;
DELETE FROM public.formas_pagamento;
