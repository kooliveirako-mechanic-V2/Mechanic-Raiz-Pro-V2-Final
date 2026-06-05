CREATE TABLE IF NOT EXISTS public.log_backfill_custo_itens_os (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id uuid NOT NULL,
  item_os_id uuid NOT NULL REFERENCES public.itens_os(id),
  ordem_servico_id uuid NOT NULL REFERENCES public.ordens_servico(id),
  estoque_id uuid REFERENCES public.estoque(id),
  custo_anterior numeric,
  custo_novo numeric NOT NULL,
  quantidade numeric,
  impacto_total numeric,
  criterio_usado text NOT NULL,
  executado_por uuid REFERENCES auth.users(id),
  executado_em timestamptz DEFAULT now(),
  revertido boolean DEFAULT false,
  revertido_em timestamptz,
  observacao text
);

GRANT SELECT, INSERT, UPDATE ON public.log_backfill_custo_itens_os TO authenticated;
GRANT ALL ON public.log_backfill_custo_itens_os TO service_role;
ALTER TABLE public.log_backfill_custo_itens_os ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total por oficina_id" ON public.log_backfill_custo_itens_os
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.ordens_servico os
    JOIN public.user_roles ur ON ur.oficina_id = os.oficina_id
    WHERE os.id = ordem_servico_id
    AND ur.user_id = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.ordens_servico os
    JOIN public.user_roles ur ON ur.oficina_id = os.oficina_id
    WHERE os.id = ordem_servico_id
    AND ur.user_id = auth.uid()
  )
);