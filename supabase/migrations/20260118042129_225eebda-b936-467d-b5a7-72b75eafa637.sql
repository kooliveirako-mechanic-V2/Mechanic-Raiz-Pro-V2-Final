-- Atualizar constraint para incluir aguardando_peca
ALTER TABLE ordens_servico DROP CONSTRAINT ordens_servico_status_check;
ALTER TABLE ordens_servico ADD CONSTRAINT ordens_servico_status_check 
  CHECK (status = ANY (ARRAY['pendente'::text, 'em_andamento'::text, 'aguardando_peca'::text, 'finalizado'::text, 'cancelado'::text]));