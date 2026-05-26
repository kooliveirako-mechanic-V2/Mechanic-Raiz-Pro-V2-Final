
CREATE OR REPLACE FUNCTION public.funnel_scoreboard(
  p_start_date timestamptz DEFAULT now() - interval '7 days',
  p_end_date timestamptz DEFAULT now(),
  p_oficina_tipo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH filtered_oficinas AS (
    SELECT id FROM oficinas
    WHERE (p_oficina_tipo IS NULL OR tipo = p_oficina_tipo)
  ),
  period_events AS (
    SELECT fe.* FROM funnel_events fe
    JOIN filtered_oficinas fo ON fo.id = fe.oficina_id
    WHERE fe.created_at >= p_start_date AND fe.created_at <= p_end_date
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
  wizard_abandoned AS (
    SELECT count(DISTINCT oficina_id) as cnt FROM period_events WHERE event = 'wizard_abandoned'
  ),
  os_started AS (
    SELECT count(DISTINCT oficina_id) as cnt FROM period_events WHERE event = 'first_os_started'
  ),
  os_creation_abandoned AS (
    SELECT count(DISTINCT oficina_id) as cnt FROM period_events WHERE event = 'os_creation_abandoned'
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
  upgrade_viewed AS (
    SELECT count(DISTINCT oficina_id) as cnt FROM period_events WHERE event = 'upgrade_page_viewed'
  ),
  checkout_started AS (
    SELECT count(DISTINCT oficina_id) as cnt FROM period_events WHERE event = 'checkout_started'
  ),
  checkout_completed AS (
    SELECT count(DISTINCT oficina_id) as cnt FROM period_events WHERE event = 'checkout_completed'
  ),
  returned_email AS (
    SELECT count(DISTINCT oficina_id) as cnt FROM period_events WHERE event = 'returned_after_email'
  ),
  avg_time_to_os AS (
    SELECT avg(extract(epoch FROM (os_time - signup_time)) / 3600)::numeric(10,1) as hours
    FROM (
      SELECT oficina_id, min(created_at) as signup_time
      FROM period_events WHERE event = 'signup_completed'
      GROUP BY oficina_id
    ) s
    JOIN (
      SELECT oficina_id, min(created_at) as os_time
      FROM period_events WHERE event IN ('first_os_created', 'os_created')
      GROUP BY oficina_id
    ) o USING (oficina_id)
  )
  SELECT jsonb_build_object(
    'period_start', p_start_date,
    'period_end', p_end_date,
    'oficina_tipo_filter', p_oficina_tipo,
    'signups', (SELECT cnt FROM signups),
    'wizard_starts', (SELECT cnt FROM wizard_starts),
    'wizard_step_completed', (SELECT cnt FROM wizard_steps),
    'wizard_abandoned', (SELECT cnt FROM wizard_abandoned),
    'os_started', (SELECT cnt FROM os_started),
    'os_creation_abandoned', (SELECT cnt FROM os_creation_abandoned),
    'first_os_created', (SELECT cnt FROM first_os_created),
    'first_os_finalized', (SELECT cnt FROM first_os_finalized),
    'total_os_created', (SELECT cnt FROM all_os_created),
    'total_os_finalized', (SELECT cnt FROM all_os_finalized),
    'trial_expiring_seen', (SELECT cnt FROM trial_expiring_seen),
    'trial_expired', (SELECT cnt FROM trial_expired),
    'upgrade_page_viewed', (SELECT cnt FROM upgrade_viewed),
    'checkout_started', (SELECT cnt FROM checkout_started),
    'checkout_completed', (SELECT cnt FROM checkout_completed),
    'returned_after_email', (SELECT cnt FROM returned_email),
    'avg_hours_to_first_os', (SELECT hours FROM avg_time_to_os)
  );
$$;
