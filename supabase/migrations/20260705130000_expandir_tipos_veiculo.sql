-- B4: expandir veiculos.tipo para caminhao/van/onibus/agricola.
-- Constraint original (20260113222405): CHECK (tipo IN ('moto', 'carro')).

ALTER TABLE public.veiculos DROP CONSTRAINT IF EXISTS veiculos_tipo_check;

ALTER TABLE public.veiculos
  ADD CONSTRAINT veiculos_tipo_check
  CHECK (tipo IN ('moto', 'carro', 'caminhao', 'van', 'onibus', 'agricola'));
