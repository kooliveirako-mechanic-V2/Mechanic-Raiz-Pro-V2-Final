-- ═══════════════════════════════════════════════════════════════════════════════
-- SISTEMA DE PLANOS E CONTROLE DE FEATURES
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Criar enum para tipos de plano
CREATE TYPE public.plan_type AS ENUM ('moto_pro', 'oficina_pro');

-- 2. Criar enum para features
CREATE TYPE public.feature_type AS ENUM (
  'clientes',
  'veiculos_moto',
  'veiculos_carro',
  'ordens_servico',
  'agenda',
  'financeiro_basico',
  'financeiro_completo',
  'historico',
  'orcamentos',
  'estoque',
  'relatorios',
  'dashboard_completo'
);

-- 3. Criar tabela de assinaturas
CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  oficina_id UUID NOT NULL REFERENCES public.oficinas(id) ON DELETE CASCADE,
  plan_type plan_type NOT NULL DEFAULT 'moto_pro',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'trial')),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(oficina_id)
);

-- 4. Criar tabela de mapeamento plano -> features
CREATE TABLE public.plan_features (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_type plan_type NOT NULL,
  feature feature_type NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(plan_type, feature)
);

-- 5. Inserir features do plano MOTO PRO
INSERT INTO public.plan_features (plan_type, feature, enabled) VALUES
  ('moto_pro', 'clientes', true),
  ('moto_pro', 'veiculos_moto', true),
  ('moto_pro', 'veiculos_carro', false),
  ('moto_pro', 'ordens_servico', true),
  ('moto_pro', 'agenda', true),
  ('moto_pro', 'financeiro_basico', true),
  ('moto_pro', 'financeiro_completo', false),
  ('moto_pro', 'historico', true),
  ('moto_pro', 'orcamentos', false),
  ('moto_pro', 'estoque', false),
  ('moto_pro', 'relatorios', false),
  ('moto_pro', 'dashboard_completo', false);

-- 6. Inserir features do plano OFICINA PRO (todas habilitadas)
INSERT INTO public.plan_features (plan_type, feature, enabled) VALUES
  ('oficina_pro', 'clientes', true),
  ('oficina_pro', 'veiculos_moto', true),
  ('oficina_pro', 'veiculos_carro', true),
  ('oficina_pro', 'ordens_servico', true),
  ('oficina_pro', 'agenda', true),
  ('oficina_pro', 'financeiro_basico', true),
  ('oficina_pro', 'financeiro_completo', true),
  ('oficina_pro', 'historico', true),
  ('oficina_pro', 'orcamentos', true),
  ('oficina_pro', 'estoque', true),
  ('oficina_pro', 'relatorios', true),
  ('oficina_pro', 'dashboard_completo', true);

-- 7. Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;

-- 8. RLS policies para subscriptions
CREATE POLICY "Users can view their oficina subscription"
  ON public.subscriptions FOR SELECT
  USING (has_oficina_access(auth.uid(), oficina_id));

CREATE POLICY "Only owners can manage subscriptions"
  ON public.subscriptions FOR ALL
  USING (is_oficina_owner(auth.uid(), oficina_id));

-- 9. RLS policies para plan_features (leitura pública para todos autenticados)
CREATE POLICY "Authenticated users can view plan features"
  ON public.plan_features FOR SELECT
  TO authenticated
  USING (true);

-- 10. Função para verificar se oficina tem feature habilitada
CREATE OR REPLACE FUNCTION public.has_feature(_oficina_id UUID, _feature feature_type)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT pf.enabled
      FROM subscriptions s
      JOIN plan_features pf ON pf.plan_type = s.plan_type AND pf.feature = _feature
      WHERE s.oficina_id = _oficina_id
        AND s.status = 'active'
    ),
    -- Default: se não tem assinatura, assume moto_pro
    (
      SELECT pf.enabled
      FROM plan_features pf
      WHERE pf.plan_type = 'moto_pro' AND pf.feature = _feature
    )
  )
$$;

-- 11. Função para obter o plano da oficina
CREATE OR REPLACE FUNCTION public.get_oficina_plan(_oficina_id UUID)
RETURNS plan_type
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT s.plan_type
      FROM subscriptions s
      WHERE s.oficina_id = _oficina_id
        AND s.status = 'active'
    ),
    'moto_pro'::plan_type
  )
$$;

-- 12. Função para obter todas as features da oficina
CREATE OR REPLACE FUNCTION public.get_oficina_features(_oficina_id UUID)
RETURNS TABLE(feature feature_type, enabled BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pf.feature, pf.enabled
  FROM plan_features pf
  WHERE pf.plan_type = get_oficina_plan(_oficina_id)
$$;

-- 13. Trigger para atualizar updated_at
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 14. Policy adicional para bloquear veículos tipo carro se não tem feature
-- Adiciona validação no INSERT/UPDATE de veículos
CREATE OR REPLACE FUNCTION public.validate_veiculo_tipo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se o tipo é carro, verificar se a oficina tem permissão
  IF NEW.tipo = 'carro' AND NOT has_feature(NEW.oficina_id, 'veiculos_carro') THEN
    RAISE EXCEPTION 'Seu plano não permite cadastrar veículos do tipo carro. Faça upgrade para o Oficina Pro.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_veiculo_tipo_trigger
  BEFORE INSERT OR UPDATE ON public.veiculos
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_veiculo_tipo();

-- 15. Policy para bloquear orçamentos se não tem feature
CREATE OR REPLACE FUNCTION public.validate_orcamento_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_feature(NEW.oficina_id, 'orcamentos') THEN
    RAISE EXCEPTION 'Seu plano não permite criar orçamentos profissionais. Faça upgrade para o Oficina Pro.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_orcamento_access_trigger
  BEFORE INSERT ON public.orcamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_orcamento_access();

-- 16. Policy para bloquear estoque se não tem feature
CREATE OR REPLACE FUNCTION public.validate_estoque_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_feature(NEW.oficina_id, 'estoque') THEN
    RAISE EXCEPTION 'Seu plano não permite gerenciar estoque. Faça upgrade para o Oficina Pro.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_estoque_access_trigger
  BEFORE INSERT ON public.estoque
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_estoque_access();