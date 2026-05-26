-- ═══════════════════════════════════════════════════════════════════
-- MIGRAÇÃO: Sistema de Trial Real com 14 dias
-- ═══════════════════════════════════════════════════════════════════

-- 1. Adicionar coluna trial_ends_at na tabela subscriptions
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS trial_ends_at timestamp with time zone;

-- 2. Atualizar o trigger para criar trial de 14 dias
CREATE OR REPLACE FUNCTION public.create_trial_subscription()
RETURNS TRIGGER AS $$
BEGIN
  -- Criar subscription de trial para nova oficina
  INSERT INTO public.subscriptions (
    oficina_id, 
    status, 
    plan_type, 
    started_at,
    trial_ends_at
  ) VALUES (
    NEW.id, 
    'trial', 
    'moto_pro',  -- Trial dá acesso às features do moto_pro
    now(),
    now() + interval '14 days'
  );
  
  -- Criar notificação de boas-vindas
  INSERT INTO public.notificacoes (
    oficina_id,
    tipo,
    titulo,
    mensagem
  ) VALUES (
    NEW.id,
    'sistema',
    '🎉 Bem-vindo ao MechanicPro!',
    'Seu teste grátis de 14 dias começou! Explore todas as funcionalidades e depois escolha o plano ideal para sua oficina.'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Recriar o trigger (drop se existir e criar novamente)
DROP TRIGGER IF EXISTS on_oficina_created_create_trial ON public.oficinas;

CREATE TRIGGER on_oficina_created_create_trial
  AFTER INSERT ON public.oficinas
  FOR EACH ROW
  EXECUTE FUNCTION public.create_trial_subscription();

-- 4. Atualizar subscriptions existentes sem trial_ends_at (migração de dados)
-- Se existem trials sem data de expiração, definir para 14 dias a partir de agora
UPDATE public.subscriptions 
SET trial_ends_at = now() + interval '14 days'
WHERE status = 'trial' AND trial_ends_at IS NULL;

-- 5. Para oficinas existentes sem subscription, criar trial
INSERT INTO public.subscriptions (oficina_id, status, plan_type, started_at, trial_ends_at)
SELECT 
  o.id,
  'trial',
  'moto_pro',
  now(),
  now() + interval '14 days'
FROM public.oficinas o
LEFT JOIN public.subscriptions s ON s.oficina_id = o.id
WHERE s.id IS NULL;