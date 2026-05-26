
-- P0: Add missing Auto Elétrica DVI columns to ordens_servico
ALTER TABLE public.ordens_servico 
  ADD COLUMN IF NOT EXISTS checklist_voltagem_bateria text,
  ADD COLUMN IF NOT EXISTS checklist_carga_bateria text,
  ADD COLUMN IF NOT EXISTS checklist_alternador_ok boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS checklist_motor_partida_ok boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS checklist_fusiveis_ok boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS codigo_obd text,
  ADD COLUMN IF NOT EXISTS codigos_obd_lista text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS hipotese_diagnostico text,
  ADD COLUMN IF NOT EXISTS modulos_testados text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tempo_diagnostico_minutos integer DEFAULT 0;
