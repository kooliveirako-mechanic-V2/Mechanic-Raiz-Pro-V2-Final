UPDATE subscriptions 
SET status = 'trial', 
    plan_type = 'moto_pro', 
    expires_at = NULL, 
    trial_ends_at = '2026-03-10 18:46:14.314+00',
    updated_at = NOW()
WHERE oficina_id = '26e1d8bb-1eac-4e6a-adc4-b3e31635d1f8';