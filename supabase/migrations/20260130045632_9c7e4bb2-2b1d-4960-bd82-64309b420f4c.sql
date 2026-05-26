-- Atualizar a função de criação de trial para usar 14 dias
CREATE OR REPLACE FUNCTION public.create_trial_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.subscriptions (
    oficina_id, 
    status, 
    plan_type, 
    started_at,
    trial_ends_at
  ) VALUES (
    NEW.id, 
    'trial', 
    'moto_pro', 
    now(),
    now() + interval '14 days'  -- 14 dias de trial
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