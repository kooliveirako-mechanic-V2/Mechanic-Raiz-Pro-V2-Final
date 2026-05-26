
CREATE TABLE public.ia_base_conhecimento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oficina_id UUID NOT NULL REFERENCES public.oficinas(id) ON DELETE CASCADE,
  conteudo TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(oficina_id)
);

ALTER TABLE public.ia_base_conhecimento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own oficina knowledge base"
  ON public.ia_base_conhecimento FOR SELECT
  TO authenticated
  USING (public.has_oficina_access(oficina_id, auth.uid()));

CREATE POLICY "Users can insert own oficina knowledge base"
  ON public.ia_base_conhecimento FOR INSERT
  TO authenticated
  WITH CHECK (public.has_oficina_access(oficina_id, auth.uid()));

CREATE POLICY "Users can update own oficina knowledge base"
  ON public.ia_base_conhecimento FOR UPDATE
  TO authenticated
  USING (public.has_oficina_access(oficina_id, auth.uid()));
