-- Adicionar campos de checklist DVI na tabela ordens_servico
ALTER TABLE public.ordens_servico
ADD COLUMN IF NOT EXISTS checklist_combustivel text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS checklist_riscos boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS checklist_estepe boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS checklist_som boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS checklist_luzes boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS fotos_entrada text[] DEFAULT '{}';

-- Criar bucket para fotos de entrada
INSERT INTO storage.buckets (id, name, public)
VALUES ('os-fotos', 'os-fotos', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para fotos
CREATE POLICY "Usuários podem ver fotos de suas oficinas"
ON storage.objects FOR SELECT
USING (bucket_id = 'os-fotos');

CREATE POLICY "Usuários podem fazer upload de fotos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'os-fotos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Usuários podem deletar suas fotos"
ON storage.objects FOR DELETE
USING (bucket_id = 'os-fotos' AND auth.uid() IS NOT NULL);

-- Adicionar status "aguardando_peca" para Kanban
-- (O status já é um campo texto livre, então só precisamos usá-lo no frontend)

-- Criar função para busca pública de OS (sem RLS)
CREATE OR REPLACE FUNCTION public.get_public_os(os_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'id', os.id,
    'status', os.status,
    'tipo_servico', os.tipo_servico,
    'descricao', os.descricao,
    'data_servico', os.data_servico,
    'valor_servico', os.valor_servico,
    'tem_garantia', os.tem_garantia,
    'dias_garantia', os.dias_garantia,
    'created_at', os.created_at,
    'oficina', json_build_object(
      'nome', o.nome,
      'logo_url', o.logo_url,
      'telefone', o.telefone
    ),
    'veiculo', json_build_object(
      'marca', v.marca,
      'modelo', v.modelo,
      'placa', v.placa
    )
  ) INTO result
  FROM ordens_servico os
  JOIN oficinas o ON o.id = os.oficina_id
  JOIN veiculos v ON v.id = os.veiculo_id
  WHERE os.id = os_id;
  
  RETURN result;
END;
$$;