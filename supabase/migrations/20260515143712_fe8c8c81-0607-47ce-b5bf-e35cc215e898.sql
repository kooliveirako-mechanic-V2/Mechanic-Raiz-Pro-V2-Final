CREATE TABLE IF NOT EXISTS public.catalogo_servicos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  oficina_id UUID NOT NULL REFERENCES public.oficinas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  valor_mao_obra NUMERIC NOT NULL DEFAULT 0,
  categoria TEXT DEFAULT 'geral',
  tipo_veiculo TEXT DEFAULT 'todos'
    CHECK (tipo_veiculo IN ('todos', 'carro', 'moto', 'eletrica', 'caminhao')),
  tempo_estimado_minutos INTEGER,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalogo_oficina
  ON public.catalogo_servicos(oficina_id, ativo);

CREATE INDEX IF NOT EXISTS idx_catalogo_busca
  ON public.catalogo_servicos(oficina_id, nome);

ALTER TABLE public.catalogo_servicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalogo_select" ON public.catalogo_servicos
  FOR SELECT USING (has_oficina_access(auth.uid(), oficina_id));

CREATE POLICY "catalogo_insert" ON public.catalogo_servicos
  FOR INSERT WITH CHECK (has_oficina_access(auth.uid(), oficina_id));

CREATE POLICY "catalogo_update" ON public.catalogo_servicos
  FOR UPDATE USING (has_oficina_access(auth.uid(), oficina_id));

CREATE POLICY "catalogo_delete" ON public.catalogo_servicos
  FOR DELETE USING (is_oficina_owner(auth.uid(), oficina_id));

CREATE TRIGGER update_catalogo_servicos_updated_at
BEFORE UPDATE ON public.catalogo_servicos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();