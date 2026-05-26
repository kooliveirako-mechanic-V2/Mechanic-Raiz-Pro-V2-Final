CREATE TABLE public.tipos_servico_oficina (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oficina_id UUID NOT NULL REFERENCES public.oficinas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tipos_servico_oficina_unique UNIQUE (oficina_id, nome)
);

CREATE INDEX idx_tipos_servico_oficina ON public.tipos_servico_oficina(oficina_id);

ALTER TABLE public.tipos_servico_oficina ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tipos_servico_select" ON public.tipos_servico_oficina
  FOR SELECT USING (has_oficina_access(auth.uid(), oficina_id));

CREATE POLICY "tipos_servico_insert" ON public.tipos_servico_oficina
  FOR INSERT WITH CHECK (has_oficina_access(auth.uid(), oficina_id));

CREATE POLICY "tipos_servico_delete" ON public.tipos_servico_oficina
  FOR DELETE USING (is_oficina_owner(auth.uid(), oficina_id));