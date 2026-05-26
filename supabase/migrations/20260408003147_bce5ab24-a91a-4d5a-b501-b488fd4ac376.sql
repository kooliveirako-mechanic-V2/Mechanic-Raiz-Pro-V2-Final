
-- FIX: Adicionar 'em_diagnostico' à constraint de status da OS
-- O frontend usa este status extensivamente mas o banco o rejeitava
ALTER TABLE public.ordens_servico DROP CONSTRAINT ordens_servico_status_check;

ALTER TABLE public.ordens_servico ADD CONSTRAINT ordens_servico_status_check 
  CHECK (status = ANY (ARRAY['pendente'::text, 'em_diagnostico'::text, 'em_andamento'::text, 'aguardando_peca'::text, 'finalizado'::text, 'cancelado'::text]));
