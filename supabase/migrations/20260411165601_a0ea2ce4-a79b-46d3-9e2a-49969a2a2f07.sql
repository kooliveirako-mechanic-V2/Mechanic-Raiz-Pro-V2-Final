
-- Funnel scoreboard function for dashboard queries
CREATE OR REPLACE FUNCTION public.funnel_scoreboard(
  p_start_date timestamptz DEFAULT now() - interval '7 days',
  p_end_date timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH period_events AS (
    SELECT * FROM funnel_events
    WHERE created_at >= p_start_date AND created_at <= p_end_date
  ),
  signups AS (
    SELECT count(DISTINCT oficina_id) as cnt FROM period_events WHERE event = 'signup_completed'
  ),
  wizard_starts AS (
    SELECT count(DISTINCT oficina_id) as cnt FROM period_events WHERE event = 'wizard_started'
  ),
  wizard_steps AS (
    SELECT count(DISTINCT oficina_id) as cnt FROM period_events WHERE event = 'wizard_step_completed'
  ),
  os_started AS (
    SELECT count(DISTINCT oficina_id) as cnt FROM period_events WHERE event = 'first_os_started'
  ),
  first_os_created AS (
    SELECT count(DISTINCT oficina_id) as cnt FROM period_events WHERE event = 'first_os_created'
  ),
  first_os_finalized AS (
    SELECT count(DISTINCT oficina_id) as cnt FROM period_events WHERE event = 'first_os_finalized'
  ),
  all_os_created AS (
    SELECT count(*) as cnt FROM period_events WHERE event = 'os_created'
  ),
  all_os_finalized AS (
    SELECT count(*) as cnt FROM period_events WHERE event = 'os_finalized'
  ),
  trial_expiring_seen AS (
    SELECT count(DISTINCT oficina_id) as cnt FROM period_events WHERE event = 'trial_expiring_banner_seen'
  ),
  trial_expired AS (
    SELECT count(DISTINCT oficina_id) as cnt FROM period_events WHERE event = 'trial_expired'
  ),
  checkout_started AS (
    SELECT count(DISTINCT oficina_id) as cnt FROM period_events WHERE event = 'checkout_started'
  ),
  checkout_completed AS (
    SELECT count(DISTINCT oficina_id) as cnt FROM period_events WHERE event = 'checkout_completed'
  ),
  avg_time_to_os AS (
    SELECT avg(extract(epoch FROM (os_time - signup_time)) / 3600)::numeric(10,1) as hours
    FROM (
      SELECT oficina_id, min(created_at) as signup_time
      FROM funnel_events WHERE event = 'signup_completed'
      GROUP BY oficina_id
    ) s
    JOIN (
      SELECT oficina_id, min(created_at) as os_time
      FROM funnel_events WHERE event IN ('first_os_created', 'os_created')
      GROUP BY oficina_id
    ) o USING (oficina_id)
  )
  SELECT jsonb_build_object(
    'period_start', p_start_date,
    'period_end', p_end_date,
    'signups', (SELECT cnt FROM signups),
    'wizard_starts', (SELECT cnt FROM wizard_starts),
    'wizard_step_completed', (SELECT cnt FROM wizard_steps),
    'os_started', (SELECT cnt FROM os_started),
    'first_os_created', (SELECT cnt FROM first_os_created),
    'first_os_finalized', (SELECT cnt FROM first_os_finalized),
    'total_os_created', (SELECT cnt FROM all_os_created),
    'total_os_finalized', (SELECT cnt FROM all_os_finalized),
    'trial_expiring_seen', (SELECT cnt FROM trial_expiring_seen),
    'trial_expired', (SELECT cnt FROM trial_expired),
    'checkout_started', (SELECT cnt FROM checkout_started),
    'checkout_completed', (SELECT cnt FROM checkout_completed),
    'avg_hours_to_first_os', (SELECT hours FROM avg_time_to_os)
  );
$$;
