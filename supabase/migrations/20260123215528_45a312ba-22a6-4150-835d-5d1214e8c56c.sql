-- =====================================================
-- MÓDULO PRÉ-FISCAL: Expansão do sistema financeiro
-- =====================================================

-- 1. Criar enum para status de pagamento
DO $$ BEGIN
  CREATE TYPE status_pagamento AS ENUM ('pago', 'a_receber', 'a_pagar', 'atrasado', 'cancelado');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2. Criar enum para classificação empresa/pessoal
DO $$ BEGIN
  CREATE TYPE classificacao_financeira AS ENUM ('empresa', 'pessoal');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 3. Criar tabela de categorias financeiras (customizáveis)
CREATE TABLE IF NOT EXISTS public.categorias_financeiras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oficina_id uuid NOT NULL REFERENCES public.oficinas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('entrada', 'saida', 'ambos')),
  cor text DEFAULT '#6B7280',
  icone text DEFAULT 'receipt',
  ativo boolean DEFAULT true,
  padrao boolean DEFAULT false, -- categorias do sistema não podem ser deletadas
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(oficina_id, nome)
);

-- 4. Criar tabela de centros de custo
CREATE TABLE IF NOT EXISTS public.centros_custo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oficina_id uuid NOT NULL REFERENCES public.oficinas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  ativo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(oficina_id, nome)
);

-- 5. Criar tabela de fornecedores
CREATE TABLE IF NOT EXISTS public.fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oficina_id uuid NOT NULL REFERENCES public.oficinas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cnpj_cpf text,
  telefone text,
  email text,
  endereco text,
  observacoes text,
  ativo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 6. Criar tabela de formas de pagamento
CREATE TABLE IF NOT EXISTS public.formas_pagamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oficina_id uuid NOT NULL REFERENCES public.oficinas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'boleto', 'transferencia', 'cheque', 'outro')),
  taxa_percentual numeric DEFAULT 0,
  dias_recebimento integer DEFAULT 0,
  ativo boolean DEFAULT true,
  padrao boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(oficina_id, nome)
);

-- 7. Expandir tabela financeiro com campos pré-fiscais
ALTER TABLE public.financeiro 
  ADD COLUMN IF NOT EXISTS categoria_id uuid REFERENCES public.categorias_financeiras(id),
  ADD COLUMN IF NOT EXISTS centro_custo_id uuid REFERENCES public.centros_custo(id),
  ADD COLUMN IF NOT EXISTS fornecedor_id uuid REFERENCES public.fornecedores(id),
  ADD COLUMN IF NOT EXISTS forma_pagamento_id uuid REFERENCES public.formas_pagamento(id),
  ADD COLUMN IF NOT EXISTS status status_pagamento DEFAULT 'pago',
  ADD COLUMN IF NOT EXISTS classificacao classificacao_financeira DEFAULT 'empresa',
  ADD COLUMN IF NOT EXISTS data_competencia date,
  ADD COLUMN IF NOT EXISTS data_pagamento date,
  ADD COLUMN IF NOT EXISTS recorrente boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS recorrencia_tipo text CHECK (recorrencia_tipo IN ('mensal', 'semanal', 'anual')),
  ADD COLUMN IF NOT EXISTS observacoes_contador text,
  ADD COLUMN IF NOT EXISTS comprovante_url text,
  ADD COLUMN IF NOT EXISTS numero_documento text,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- 8. Criar tabela de histórico de alterações financeiras (auditoria)
CREATE TABLE IF NOT EXISTS public.financeiro_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financeiro_id uuid NOT NULL REFERENCES public.financeiro(id) ON DELETE CASCADE,
  oficina_id uuid NOT NULL REFERENCES public.oficinas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  acao text NOT NULL CHECK (acao IN ('criacao', 'edicao', 'exclusao')),
  dados_anteriores jsonb,
  dados_novos jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- 9. Índices para performance
CREATE INDEX IF NOT EXISTS idx_financeiro_categoria ON public.financeiro(categoria_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_centro_custo ON public.financeiro(centro_custo_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_fornecedor ON public.financeiro(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_classificacao ON public.financeiro(classificacao);
CREATE INDEX IF NOT EXISTS idx_financeiro_status ON public.financeiro(status);
CREATE INDEX IF NOT EXISTS idx_financeiro_data_competencia ON public.financeiro(data_competencia);
CREATE INDEX IF NOT EXISTS idx_categorias_oficina ON public.categorias_financeiras(oficina_id);
CREATE INDEX IF NOT EXISTS idx_centros_custo_oficina ON public.centros_custo(oficina_id);
CREATE INDEX IF NOT EXISTS idx_fornecedores_oficina ON public.fornecedores(oficina_id);
CREATE INDEX IF NOT EXISTS idx_formas_pagamento_oficina ON public.formas_pagamento(oficina_id);

-- 10. RLS Policies para categorias_financeiras
ALTER TABLE public.categorias_financeiras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver categorias de suas oficinas"
  ON public.categorias_financeiras FOR SELECT
  USING (has_oficina_access(auth.uid(), oficina_id));

CREATE POLICY "Proprietários podem gerenciar categorias"
  ON public.categorias_financeiras FOR ALL
  USING (is_oficina_owner(auth.uid(), oficina_id) OR has_role(auth.uid(), oficina_id, 'administrador'));

-- 11. RLS Policies para centros_custo
ALTER TABLE public.centros_custo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver centros de custo de suas oficinas"
  ON public.centros_custo FOR SELECT
  USING (has_oficina_access(auth.uid(), oficina_id));

CREATE POLICY "Proprietários podem gerenciar centros de custo"
  ON public.centros_custo FOR ALL
  USING (is_oficina_owner(auth.uid(), oficina_id) OR has_role(auth.uid(), oficina_id, 'administrador'));

-- 12. RLS Policies para fornecedores
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver fornecedores de suas oficinas"
  ON public.fornecedores FOR SELECT
  USING (has_oficina_access(auth.uid(), oficina_id));

CREATE POLICY "Usuários podem gerenciar fornecedores"
  ON public.fornecedores FOR ALL
  USING (has_oficina_access(auth.uid(), oficina_id));

-- 13. RLS Policies para formas_pagamento
ALTER TABLE public.formas_pagamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver formas de pagamento de suas oficinas"
  ON public.formas_pagamento FOR SELECT
  USING (has_oficina_access(auth.uid(), oficina_id));

CREATE POLICY "Proprietários podem gerenciar formas de pagamento"
  ON public.formas_pagamento FOR ALL
  USING (is_oficina_owner(auth.uid(), oficina_id) OR has_role(auth.uid(), oficina_id, 'administrador'));

-- 14. RLS Policies para financeiro_historico
ALTER TABLE public.financeiro_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Proprietários podem ver histórico financeiro"
  ON public.financeiro_historico FOR SELECT
  USING (can_access_financial_data(oficina_id, auth.uid()));

CREATE POLICY "Sistema pode criar histórico"
  ON public.financeiro_historico FOR INSERT
  WITH CHECK (can_access_financial_data(oficina_id, auth.uid()));

-- 15. Função para criar categorias padrão
CREATE OR REPLACE FUNCTION public.criar_categorias_padrao_financeiro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Categorias de entrada padrão
  INSERT INTO public.categorias_financeiras (oficina_id, nome, tipo, cor, icone, padrao) VALUES
    (NEW.id, 'Serviço', 'entrada', '#10B981', 'wrench', true),
    (NEW.id, 'Venda de peças', 'entrada', '#3B82F6', 'package', true),
    (NEW.id, 'Pagamento pendente', 'entrada', '#F59E0B', 'clock', true),
    (NEW.id, 'Outros (Entrada)', 'entrada', '#6B7280', 'plus', true);
    
  -- Categorias de saída padrão
  INSERT INTO public.categorias_financeiras (oficina_id, nome, tipo, cor, icone, padrao) VALUES
    (NEW.id, 'Compra de peças', 'saida', '#EF4444', 'package', true),
    (NEW.id, 'Fornecedores', 'saida', '#8B5CF6', 'truck', true),
    (NEW.id, 'Salários', 'saida', '#EC4899', 'users', true),
    (NEW.id, 'Aluguel', 'saida', '#F97316', 'home', true),
    (NEW.id, 'Conta de luz', 'saida', '#FBBF24', 'zap', true),
    (NEW.id, 'Conta de água', 'saida', '#06B6D4', 'droplet', true),
    (NEW.id, 'Internet', 'saida', '#6366F1', 'wifi', true),
    (NEW.id, 'Manutenção', 'saida', '#84CC16', 'tool', true),
    (NEW.id, 'Impostos', 'saida', '#DC2626', 'file-text', true),
    (NEW.id, 'Outros (Saída)', 'saida', '#6B7280', 'minus', true);
  
  -- Centros de custo padrão
  INSERT INTO public.centros_custo (oficina_id, nome, descricao) VALUES
    (NEW.id, 'Oficina', 'Custos operacionais da oficina'),
    (NEW.id, 'Administrativo', 'Custos administrativos e gestão'),
    (NEW.id, 'Estoque', 'Compra e manutenção de estoque');
  
  -- Formas de pagamento padrão
  INSERT INTO public.formas_pagamento (oficina_id, nome, tipo, padrao) VALUES
    (NEW.id, 'Dinheiro', 'dinheiro', true),
    (NEW.id, 'PIX', 'pix', true),
    (NEW.id, 'Cartão de Crédito', 'cartao_credito', true),
    (NEW.id, 'Cartão de Débito', 'cartao_debito', true),
    (NEW.id, 'Boleto', 'boleto', true),
    (NEW.id, 'Transferência', 'transferencia', true);
    
  RETURN NEW;
END;
$$;

-- 16. Trigger para criar categorias padrão ao criar oficina
DROP TRIGGER IF EXISTS trigger_criar_categorias_padrao ON public.oficinas;
CREATE TRIGGER trigger_criar_categorias_padrao
  AFTER INSERT ON public.oficinas
  FOR EACH ROW
  EXECUTE FUNCTION public.criar_categorias_padrao_financeiro();

-- 17. Função para registrar histórico de alterações
CREATE OR REPLACE FUNCTION public.registrar_historico_financeiro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.financeiro_historico (financeiro_id, oficina_id, user_id, acao, dados_novos)
    VALUES (NEW.id, NEW.oficina_id, auth.uid(), 'criacao', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.financeiro_historico (financeiro_id, oficina_id, user_id, acao, dados_anteriores, dados_novos)
    VALUES (NEW.id, NEW.oficina_id, COALESCE(auth.uid(), OLD.oficina_id), 'edicao', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- 18. Trigger para auditoria do financeiro
DROP TRIGGER IF EXISTS trigger_historico_financeiro ON public.financeiro;
CREATE TRIGGER trigger_historico_financeiro
  AFTER INSERT OR UPDATE ON public.financeiro
  FOR EACH ROW
  EXECUTE FUNCTION public.registrar_historico_financeiro();

-- 19. Criar categorias para oficinas existentes
DO $$
DECLARE
  oficina RECORD;
BEGIN
  FOR oficina IN SELECT id FROM public.oficinas LOOP
    -- Só inserir se a oficina não tem categorias ainda
    IF NOT EXISTS (SELECT 1 FROM public.categorias_financeiras WHERE oficina_id = oficina.id) THEN
      -- Categorias de entrada
      INSERT INTO public.categorias_financeiras (oficina_id, nome, tipo, cor, icone, padrao) VALUES
        (oficina.id, 'Serviço', 'entrada', '#10B981', 'wrench', true),
        (oficina.id, 'Venda de peças', 'entrada', '#3B82F6', 'package', true),
        (oficina.id, 'Pagamento pendente', 'entrada', '#F59E0B', 'clock', true),
        (oficina.id, 'Outros (Entrada)', 'entrada', '#6B7280', 'plus', true);
      -- Categorias de saída
      INSERT INTO public.categorias_financeiras (oficina_id, nome, tipo, cor, icone, padrao) VALUES
        (oficina.id, 'Compra de peças', 'saida', '#EF4444', 'package', true),
        (oficina.id, 'Fornecedores', 'saida', '#8B5CF6', 'truck', true),
        (oficina.id, 'Salários', 'saida', '#EC4899', 'users', true),
        (oficina.id, 'Aluguel', 'saida', '#F97316', 'home', true),
        (oficina.id, 'Conta de luz', 'saida', '#FBBF24', 'zap', true),
        (oficina.id, 'Conta de água', 'saida', '#06B6D4', 'droplet', true),
        (oficina.id, 'Internet', 'saida', '#6366F1', 'wifi', true),
        (oficina.id, 'Manutenção', 'saida', '#84CC16', 'tool', true),
        (oficina.id, 'Impostos', 'saida', '#DC2626', 'file-text', true),
        (oficina.id, 'Outros (Saída)', 'saida', '#6B7280', 'minus', true);
    END IF;
    
    -- Centros de custo padrão
    IF NOT EXISTS (SELECT 1 FROM public.centros_custo WHERE oficina_id = oficina.id) THEN
      INSERT INTO public.centros_custo (oficina_id, nome, descricao) VALUES
        (oficina.id, 'Oficina', 'Custos operacionais da oficina'),
        (oficina.id, 'Administrativo', 'Custos administrativos e gestão'),
        (oficina.id, 'Estoque', 'Compra e manutenção de estoque');
    END IF;
    
    -- Formas de pagamento padrão
    IF NOT EXISTS (SELECT 1 FROM public.formas_pagamento WHERE oficina_id = oficina.id) THEN
      INSERT INTO public.formas_pagamento (oficina_id, nome, tipo, padrao) VALUES
        (oficina.id, 'Dinheiro', 'dinheiro', true),
        (oficina.id, 'PIX', 'pix', true),
        (oficina.id, 'Cartão de Crédito', 'cartao_credito', true),
        (oficina.id, 'Cartão de Débito', 'cartao_debito', true),
        (oficina.id, 'Boleto', 'boleto', true),
        (oficina.id, 'Transferência', 'transferencia', true);
    END IF;
  END LOOP;
END $$;