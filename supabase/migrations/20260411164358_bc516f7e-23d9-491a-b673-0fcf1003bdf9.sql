
-- Fix the trigger to use oficina tipo for plan assignment
CREATE OR REPLACE FUNCTION public.create_trial_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_type public.plan_type;
BEGIN
  -- Determine plan based on oficina type
  IF NEW.tipo = 'moto' THEN
    v_plan_type := 'moto_pro';
  ELSE
    v_plan_type := 'oficina_pro';
  END IF;

  INSERT INTO public.subscriptions (
    oficina_id, 
    status, 
    plan_type, 
    started_at,
    trial_ends_at
  ) VALUES (
    NEW.id, 
    'trial', 
    v_plan_type, 
    now(),
    now() + interval '14 days'
  );
  
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
$$;

-- Fix existing subscriptions: update moto_pro to oficina_pro where oficina tipo is NOT moto
UPDATE subscriptions s
SET plan_type = 'oficina_pro',
    updated_at = now()
FROM oficinas o
WHERE s.oficina_id = o.id
  AND s.plan_type = 'moto_pro'
  AND o.tipo != 'moto';
