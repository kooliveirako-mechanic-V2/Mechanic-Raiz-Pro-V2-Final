UPDATE subscriptions 
SET status = 'active', 
    plan_type = 'oficina_pro', 
    expires_at = NOW() + INTERVAL '365 days', 
    trial_ends_at = NULL,
    updated_at = NOW()
WHERE oficina_id = '26e1d8bb-1eac-4e6a-adc4-b3e31635d1f8';