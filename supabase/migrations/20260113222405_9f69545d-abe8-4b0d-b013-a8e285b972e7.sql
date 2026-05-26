
-- =============================================
-- ESTRUTURA COMPLETA DO SAAS PARA MECÂNICOS
-- =============================================

-- 1. TABELA DE OFICINAS
CREATE TABLE public.oficinas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  logo_url TEXT,
  telefone TEXT,
  endereco TEXT,
  tipo TEXT NOT NULL DEFAULT 'ambos' CHECK (tipo IN ('moto', 'carro', 'ambos')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. TABELA DE CLIENTES
CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  oficina_id UUID NOT NULL REFERENCES public.oficinas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  telefone TEXT,
  email TEXT,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. TABELA DE VEÍCULOS
CREATE TABLE public.veiculos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  oficina_id UUID NOT NULL REFERENCES public.oficinas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('moto', 'carro')),
  marca TEXT NOT NULL,
  modelo TEXT NOT NULL,
  ano INTEGER,
  placa TEXT,
  km_atual INTEGER DEFAULT 0,
  chassi TEXT,
  observacoes TEXT,
  foto_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. TABELA DE ORDENS DE SERVIÇO
CREATE TABLE public.ordens_servico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  oficina_id UUID NOT NULL REFERENCES public.oficinas(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  veiculo_id UUID NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  data_servico DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo_servico TEXT NOT NULL,
  descricao TEXT,
  km_no_servico INTEGER,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'finalizado', 'cancelado')),
  valor_servico DECIMAL(10,2) DEFAULT 0,
  custo_servico DECIMAL(10,2) DEFAULT 0,
  lucro DECIMAL(10,2) GENERATED ALWAYS AS (valor_servico - custo_servico) STORED,
  tem_garantia BOOLEAN DEFAULT false,
  dias_garantia INTEGER DEFAULT 0,
  forma_pagamento TEXT,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. TABELA DE RECORRÊNCIAS
CREATE TABLE public.recorrencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  veiculo_id UUID NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  oficina_id UUID NOT NULL REFERENCES public.oficinas(id) ON DELETE CASCADE,
  tipo_servico TEXT NOT NULL,
  intervalo_dias INTEGER,
  intervalo_km INTEGER,
  ultima_execucao DATE,
  proxima_execucao DATE,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. TABELA DE ESTOQUE
CREATE TABLE public.estoque (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  oficina_id UUID NOT NULL REFERENCES public.oficinas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 0,
  custo_unitario DECIMAL(10,2) DEFAULT 0,
  preco_venda DECIMAL(10,2) DEFAULT 0,
  alerta_minimo INTEGER DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7. TABELA DE ITENS USADOS EM OS
CREATE TABLE public.itens_os (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ordem_servico_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  estoque_id UUID REFERENCES public.estoque(id) ON DELETE SET NULL,
  nome_item TEXT NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 1,
  valor_unitario DECIMAL(10,2) DEFAULT 0,
  valor_total DECIMAL(10,2) GENERATED ALWAYS AS (quantidade * valor_unitario) STORED,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 8. TABELA FINANCEIRA
CREATE TABLE public.financeiro (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  oficina_id UUID NOT NULL REFERENCES public.oficinas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  origem TEXT NOT NULL,
  ordem_servico_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  valor DECIMAL(10,2) NOT NULL,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 9. TABELA DE NOTIFICAÇÕES
CREATE TABLE public.notificacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  oficina_id UUID NOT NULL REFERENCES public.oficinas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT,
  lida BOOLEAN DEFAULT false,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  referencia_id UUID,
  referencia_tipo TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- HABILITAR RLS EM TODAS AS TABELAS
-- =============================================

ALTER TABLE public.oficinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recorrencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_os ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- =============================================
-- POLÍTICAS RLS PARA OFICINAS
-- =============================================

CREATE POLICY "Usuários podem ver suas próprias oficinas"
ON public.oficinas FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar suas próprias oficinas"
ON public.oficinas FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias oficinas"
ON public.oficinas FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias oficinas"
ON public.oficinas FOR DELETE
USING (auth.uid() = user_id);

-- =============================================
-- POLÍTICAS RLS PARA CLIENTES
-- =============================================

CREATE POLICY "Usuários podem ver clientes de suas oficinas"
ON public.clientes FOR SELECT
USING (oficina_id IN (SELECT id FROM public.oficinas WHERE user_id = auth.uid()));

CREATE POLICY "Usuários podem criar clientes em suas oficinas"
ON public.clientes FOR INSERT
WITH CHECK (oficina_id IN (SELECT id FROM public.oficinas WHERE user_id = auth.uid()));

CREATE POLICY "Usuários podem atualizar clientes de suas oficinas"
ON public.clientes FOR UPDATE
USING (oficina_id IN (SELECT id FROM public.oficinas WHERE user_id = auth.uid()));

CREATE POLICY "Usuários podem deletar clientes de suas oficinas"
ON public.clientes FOR DELETE
USING (oficina_id IN (SELECT id FROM public.oficinas WHERE user_id = auth.uid()));

-- =============================================
-- POLÍTICAS RLS PARA VEÍCULOS
-- =============================================

CREATE POLICY "Usuários podem ver veículos de suas oficinas"
ON public.veiculos FOR SELECT
USING (oficina_id IN (SELECT id FROM public.oficinas WHERE user_id = auth.uid()));

CREATE POLICY "Usuários podem criar veículos em suas oficinas"
ON public.veiculos FOR INSERT
WITH CHECK (oficina_id IN (SELECT id FROM public.oficinas WHERE user_id = auth.uid()));

CREATE POLICY "Usuários podem atualizar veículos de suas oficinas"
ON public.veiculos FOR UPDATE
USING (oficina_id IN (SELECT id FROM public.oficinas WHERE user_id = auth.uid()));

CREATE POLICY "Usuários podem deletar veículos de suas oficinas"
ON public.veiculos FOR DELETE
USING (oficina_id IN (SELECT id FROM public.oficinas WHERE user_id = auth.uid()));

-- =============================================
-- POLÍTICAS RLS PARA ORDENS DE SERVIÇO
-- =============================================

CREATE POLICY "Usuários podem ver OS de suas oficinas"
ON public.ordens_servico FOR SELECT
USING (oficina_id IN (SELECT id FROM public.oficinas WHERE user_id = auth.uid()));

CREATE POLICY "Usuários podem criar OS em suas oficinas"
ON public.ordens_servico FOR INSERT
WITH CHECK (oficina_id IN (SELECT id FROM public.oficinas WHERE user_id = auth.uid()));

CREATE POLICY "Usuários podem atualizar OS de suas oficinas"
ON public.ordens_servico FOR UPDATE
USING (oficina_id IN (SELECT id FROM public.oficinas WHERE user_id = auth.uid()));

CREATE POLICY "Usuários podem deletar OS de suas oficinas"
ON public.ordens_servico FOR DELETE
USING (oficina_id IN (SELECT id FROM public.oficinas WHERE user_id = auth.uid()));

-- =============================================
-- POLÍTICAS RLS PARA RECORRÊNCIAS
-- =============================================

CREATE POLICY "Usuários podem ver recorrências de suas oficinas"
ON public.recorrencias FOR SELECT
USING (oficina_id IN (SELECT id FROM public.oficinas WHERE user_id = auth.uid()));

CREATE POLICY "Usuários podem criar recorrências em suas oficinas"
ON public.recorrencias FOR INSERT
WITH CHECK (oficina_id IN (SELECT id FROM public.oficinas WHERE user_id = auth.uid()));

CREATE POLICY "Usuários podem atualizar recorrências de suas oficinas"
ON public.recorrencias FOR UPDATE
USING (oficina_id IN (SELECT id FROM public.oficinas WHERE user_id = auth.uid()));

CREATE POLICY "Usuários podem deletar recorrências de suas oficinas"
ON public.recorrencias FOR DELETE
USING (oficina_id IN (SELECT id FROM public.oficinas WHERE user_id = auth.uid()));

-- =============================================
-- POLÍTICAS RLS PARA ESTOQUE
-- =============================================

CREATE POLICY "Usuários podem ver estoque de suas oficinas"
ON public.estoque FOR SELECT
USING (oficina_id IN (SELECT id FROM public.oficinas WHERE user_id = auth.uid()));

CREATE POLICY "Usuários podem criar itens de estoque em suas oficinas"
ON public.estoque FOR INSERT
WITH CHECK (oficina_id IN (SELECT id FROM public.oficinas WHERE user_id = auth.uid()));

CREATE POLICY "Usuários podem atualizar estoque de suas oficinas"
ON public.estoque FOR UPDATE
USING (oficina_id IN (SELECT id FROM public.oficinas WHERE user_id = auth.uid()));

CREATE POLICY "Usuários podem deletar itens de estoque de suas oficinas"
ON public.estoque FOR DELETE
USING (oficina_id IN (SELECT id FROM public.oficinas WHERE user_id = auth.uid()));

-- =============================================
-- POLÍTICAS RLS PARA ITENS OS
-- =============================================

CREATE POLICY "Usuários podem ver itens de OS de suas oficinas"
ON public.itens_os FOR SELECT
USING (ordem_servico_id IN (
  SELECT id FROM public.ordens_servico 
  WHERE oficina_id IN (SELECT id FROM public.oficinas WHERE user_id = auth.uid())
));

CREATE POLICY "Usuários podem criar itens de OS em suas oficinas"
ON public.itens_os FOR INSERT
WITH CHECK (ordem_servico_id IN (
  SELECT id FROM public.ordens_servico 
  WHERE oficina_id IN (SELECT id FROM public.oficinas WHERE user_id = auth.uid())
));

CREATE POLICY "Usuários podem atualizar itens de OS de suas oficinas"
ON public.itens_os FOR UPDATE
USING (ordem_servico_id IN (
  SELECT id FROM public.ordens_servico 
  WHERE oficina_id IN (SELECT id FROM public.oficinas WHERE user_id = auth.uid())
));

CREATE POLICY "Usuários podem deletar itens de OS de suas oficinas"
ON public.itens_os FOR DELETE
USING (ordem_servico_id IN (
  SELECT id FROM public.ordens_servico 
  WHERE oficina_id IN (SELECT id FROM public.oficinas WHERE user_id = auth.uid())
));

-- =============================================
-- POLÍTICAS RLS PARA FINANCEIRO
-- =============================================

CREATE POLICY "Usuários podem ver financeiro de suas oficinas"
ON public.financeiro FOR SELECT
USING (oficina_id IN (SELECT id FROM public.oficinas WHERE user_id = auth.uid()));

CREATE POLICY "Usuários podem criar registros financeiros em suas oficinas"
ON public.financeiro FOR INSERT
WITH CHECK (oficina_id IN (SELECT id FROM public.oficinas WHERE user_id = auth.uid()));

CREATE POLICY "Usuários podem atualizar financeiro de suas oficinas"
ON public.financeiro FOR UPDATE
USING (oficina_id IN (SELECT id FROM public.oficinas WHERE user_id = auth.uid()));

CREATE POLICY "Usuários podem deletar registros financeiros de suas oficinas"
ON public.financeiro FOR DELETE
USING (oficina_id IN (SELECT id FROM public.oficinas WHERE user_id = auth.uid()));

-- =============================================
-- POLÍTICAS RLS PARA NOTIFICAÇÕES
-- =============================================

CREATE POLICY "Usuários podem ver notificações de suas oficinas"
ON public.notificacoes FOR SELECT
USING (oficina_id IN (SELECT id FROM public.oficinas WHERE user_id = auth.uid()));

CREATE POLICY "Usuários podem criar notificações em suas oficinas"
ON public.notificacoes FOR INSERT
WITH CHECK (oficina_id IN (SELECT id FROM public.oficinas WHERE user_id = auth.uid()));

CREATE POLICY "Usuários podem atualizar notificações de suas oficinas"
ON public.notificacoes FOR UPDATE
USING (oficina_id IN (SELECT id FROM public.oficinas WHERE user_id = auth.uid()));

CREATE POLICY "Usuários podem deletar notificações de suas oficinas"
ON public.notificacoes FOR DELETE
USING (oficina_id IN (SELECT id FROM public.oficinas WHERE user_id = auth.uid()));

-- =============================================
-- FUNÇÃO PARA ATUALIZAR UPDATED_AT
-- =============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TRIGGERS PARA UPDATED_AT
-- =============================================

CREATE TRIGGER update_oficinas_updated_at
BEFORE UPDATE ON public.oficinas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clientes_updated_at
BEFORE UPDATE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_veiculos_updated_at
BEFORE UPDATE ON public.veiculos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ordens_servico_updated_at
BEFORE UPDATE ON public.ordens_servico
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_recorrencias_updated_at
BEFORE UPDATE ON public.recorrencias
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_estoque_updated_at
BEFORE UPDATE ON public.estoque
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- ÍNDICES PARA PERFORMANCE
-- =============================================

CREATE INDEX idx_clientes_oficina ON public.clientes(oficina_id);
CREATE INDEX idx_veiculos_cliente ON public.veiculos(cliente_id);
CREATE INDEX idx_veiculos_oficina ON public.veiculos(oficina_id);
CREATE INDEX idx_ordens_servico_oficina ON public.ordens_servico(oficina_id);
CREATE INDEX idx_ordens_servico_cliente ON public.ordens_servico(cliente_id);
CREATE INDEX idx_ordens_servico_veiculo ON public.ordens_servico(veiculo_id);
CREATE INDEX idx_ordens_servico_status ON public.ordens_servico(status);
CREATE INDEX idx_ordens_servico_data ON public.ordens_servico(data_servico);
CREATE INDEX idx_recorrencias_veiculo ON public.recorrencias(veiculo_id);
CREATE INDEX idx_estoque_oficina ON public.estoque(oficina_id);
CREATE INDEX idx_financeiro_oficina ON public.financeiro(oficina_id);
CREATE INDEX idx_financeiro_data ON public.financeiro(data);
CREATE INDEX idx_notificacoes_oficina ON public.notificacoes(oficina_id);
