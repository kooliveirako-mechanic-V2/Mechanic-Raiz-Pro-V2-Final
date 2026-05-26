-- =====================================================
-- MIGRAÇÃO: Configurações + Hora na Agenda + Campos extras
-- =====================================================

-- 1. TABELA DE CONFIGURAÇÕES DA OFICINA
-- Persistir preferências que hoje são só estado local
CREATE TABLE public.oficina_configuracoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  oficina_id UUID NOT NULL UNIQUE,
  
  -- Notificações
  whatsapp_notificacoes BOOLEAN DEFAULT true,
  estoque_alertas BOOLEAN DEFAULT true,
  recorrencia_lembretes BOOLEAN DEFAULT true,
  resumo_diario BOOLEAN DEFAULT false,
  
  -- Horário de funcionamento
  horario_abertura TIME DEFAULT '08:00',
  horario_fechamento TIME DEFAULT '18:00',
  dias_funcionamento TEXT[] DEFAULT ARRAY['seg', 'ter', 'qua', 'qui', 'sex', 'sab'],
  
  -- Personalização
  cor_primaria TEXT DEFAULT NULL,
  moeda TEXT DEFAULT 'BRL',
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS para configurações
ALTER TABLE public.oficina_configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver configurações de suas oficinas"
ON public.oficina_configuracoes FOR SELECT
USING (has_oficina_access(auth.uid(), oficina_id));

CREATE POLICY "Proprietários podem atualizar configurações"
ON public.oficina_configuracoes FOR UPDATE
USING (is_oficina_owner(auth.uid(), oficina_id));

CREATE POLICY "Proprietários podem criar configurações"
ON public.oficina_configuracoes FOR INSERT
WITH CHECK (is_oficina_owner(auth.uid(), oficina_id));

-- Trigger para updated_at
CREATE TRIGGER update_oficina_configuracoes_updated_at
BEFORE UPDATE ON public.oficina_configuracoes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2. ADICIONAR HORA NA ORDEM DE SERVIÇO
ALTER TABLE public.ordens_servico 
ADD COLUMN IF NOT EXISTS hora_agendamento TIME DEFAULT NULL;

-- 3. ADICIONAR CAMPOS FALTANTES NOS CLIENTES
ALTER TABLE public.clientes
ADD COLUMN IF NOT EXISTS cpf_cnpj TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS endereco TEXT DEFAULT NULL;

-- 4. ADICIONAR COR NO VEÍCULO
ALTER TABLE public.veiculos
ADD COLUMN IF NOT EXISTS cor TEXT DEFAULT NULL;

-- 5. CRIAR TRIGGER PARA AUTO-CRIAR CONFIGURAÇÕES AO CRIAR OFICINA
CREATE OR REPLACE FUNCTION public.create_oficina_configuracoes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.oficina_configuracoes (oficina_id)
  VALUES (NEW.id)
  ON CONFLICT (oficina_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER create_oficina_configuracoes_trigger
AFTER INSERT ON public.oficinas
FOR EACH ROW
EXECUTE FUNCTION public.create_oficina_configuracoes();

-- 6. CRIAR CONFIGURAÇÕES PARA OFICINAS EXISTENTES
INSERT INTO public.oficina_configuracoes (oficina_id)
SELECT id FROM public.oficinas
ON CONFLICT (oficina_id) DO NOTHING;