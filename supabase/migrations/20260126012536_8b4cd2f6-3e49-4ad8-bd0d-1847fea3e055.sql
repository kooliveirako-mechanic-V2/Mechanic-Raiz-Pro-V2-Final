-- Remove a constraint antiga e adiciona uma nova que inclui auto_eletrica
ALTER TABLE public.oficinas DROP CONSTRAINT IF EXISTS oficinas_tipo_check;

ALTER TABLE public.oficinas ADD CONSTRAINT oficinas_tipo_check 
CHECK (tipo IN ('moto', 'carro', 'ambos', 'auto_eletrica'));