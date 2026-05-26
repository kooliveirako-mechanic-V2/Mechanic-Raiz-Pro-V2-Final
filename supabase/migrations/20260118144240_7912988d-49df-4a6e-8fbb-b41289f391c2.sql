-- Corrigir subscriptions existentes que não têm trial_ends_at definido
-- Estas são subscriptions legadas que precisam ser tratadas como trial
UPDATE public.subscriptions
SET 
  status = 'trial',
  trial_ends_at = created_at + interval '14 days'
WHERE trial_ends_at IS NULL;