/**
 * FUNNEL EVENT TRACKING
 * 
 * Stores activation/conversion events in dedicated funnel_events table.
 * Fire-and-forget: never blocks UI.
 */

import { supabase } from "@/integrations/supabase/client";

export type FunnelEvent =
  | "signup_completed"
  | "wizard_started"
  | "wizard_step_completed"
  | "wizard_dismissed"
  | "wizard_abandoned"
  | "client_created"
  | "vehicle_created"
  | "first_os_started"
  | "first_os_created"
  | "first_os_finalized"
  | "os_created"
  | "os_finalized"
  | "os_creation_abandoned"
  | "trial_expiring_banner_seen"
  | "trial_expired"
  | "upgrade_page_viewed"
  | "checkout_started"
  | "checkout_completed"
  | "os_rapida_opened"
  | "onboarding_completed"
  | "returned_after_email";

// Singleton events: one per session. Repeatable events need entity-specific keys.
const SINGLETON_EVENTS: Set<FunnelEvent> = new Set([
  "signup_completed",
  "wizard_started",
  "wizard_abandoned",
  "first_os_started",
  "first_os_created",
  "first_os_finalized",
  "upgrade_page_viewed",
  "trial_expiring_banner_seen",
  "trial_expired",
  "onboarding_completed",
]);

interface FunnelEventData {
  event: FunnelEvent;
  oficina_id?: string;
  user_id?: string;
  step?: string;
  source?: string;
  entity_id?: string; // OS id, payment id, etc. for repeatable event dedup
  metadata?: Record<string, unknown>;
}

// Build dedup_key based on event type
function buildDedupKey(event: FunnelEvent, sessionId: string, step?: string, entityId?: string): string {
  if (SINGLETON_EVENTS.has(event)) {
    return sessionId;
  }
  // Repeatable events: use entity_id if available, otherwise session+step or session+timestamp
  if (entityId) return `${sessionId}:${entityId}`;
  if (step) return `${sessionId}:${step}`;
  return `${sessionId}:${Date.now()}`;
}

// Session ID: stable per tab session
let _sessionId: string | null = null;
function getSessionId() {
  if (!_sessionId) {
    _sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
  return _sessionId;
}

// Compute trial day from subscription
function getTrialDay(): number | null {
  try {
    const raw = localStorage.getItem("mechpro_trial_start");
    if (!raw) return null;
    const start = new Date(raw).getTime();
    return Math.floor((Date.now() - start) / 86400000);
  } catch {
    return null;
  }
}

// Fire-and-forget: never block UI
export function trackFunnelEvent({ event, oficina_id, user_id, step, source, entity_id, metadata }: FunnelEventData) {
  try {
    console.info(`[funnel] ${event}`, { oficina_id, step, entity_id, ...metadata });

    if (!oficina_id) {
      console.warn(`[funnel] ⚠️ evento descartado sem oficina_id: ${event}`, { step, source, entity_id, metadata });
      return;
    }

    const resolveAndInsert = async () => {
      let uid = user_id;
      if (!uid) {
        const { data: { user } } = await supabase.auth.getUser();
        uid = user?.id;
      }
      if (!uid) return;

      let planType: string | null = null;
      try {
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("plan_type")
          .eq("oficina_id", oficina_id)
          .maybeSingle();
        planType = sub?.plan_type || null;
      } catch { /* skip */ }

      const sessionId = getSessionId();
      const dedupKey = buildDedupKey(event, sessionId, step, entity_id);

      const { error } = await supabase
        .from("funnel_events" as any)
        .upsert({
          event,
          oficina_id,
          user_id: uid,
          plan_type: planType,
          trial_day: getTrialDay(),
          session_id: sessionId,
          source: source || null,
          step: step || null,
          dedup_key: dedupKey,
          metadata: metadata || {},
        }, { onConflict: 'event,oficina_id,dedup_key', ignoreDuplicates: true } as any);

      if (error && !error.message?.includes('duplicate')) console.warn("[funnel] track error:", error.message);
    };

    resolveAndInsert();
  } catch {
    // Never let tracking break the app
  }
}
