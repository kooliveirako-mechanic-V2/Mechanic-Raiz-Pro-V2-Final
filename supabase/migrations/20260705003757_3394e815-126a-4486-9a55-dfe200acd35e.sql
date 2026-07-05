-- Coluna gerada de placa normalizada (só letras/números, upper)
ALTER TABLE public.veiculos
  ADD COLUMN placa_normalizada TEXT
  GENERATED ALWAYS AS (upper(regexp_replace(coalesce(placa, ''), '[^A-Za-z0-9]', '', 'g'))) STORED;

CREATE INDEX IF NOT EXISTS idx_veiculos_placa_normalizada
  ON public.veiculos (placa_normalizada);

-- Coluna gerada de telefone normalizado (só dígitos)
ALTER TABLE public.clientes
  ADD COLUMN telefone_normalizado TEXT
  GENERATED ALWAYS AS (regexp_replace(coalesce(telefone, ''), '[^0-9]', '', 'g')) STORED;

CREATE INDEX IF NOT EXISTS idx_clientes_telefone_normalizado
  ON public.clientes (telefone_normalizado);
