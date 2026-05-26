UPDATE subscriptions 
SET status = 'active', 
    plan_type = 'oficina_pro', 
    expires_at = NOW() + INTERVAL '365 days', 
    trial_ends_at = NULL,
    updated_at = NOW()
WHERE oficina_id = 'bf84d08f-3f4c-4d9e-ab19-84aed119e1c9';