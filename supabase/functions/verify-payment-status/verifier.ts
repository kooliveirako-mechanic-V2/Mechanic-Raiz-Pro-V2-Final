// ═══════════════════════════════════════════════════════════════════
// Pure helpers for verify-payment-status (Correction 2.1)
//
// No network, no DB, no env. Importable from index.ts and from tests.
// ═══════════════════════════════════════════════════════════════════
import { SUBSCRIPTION_CATALOG } from '../mercadopago-create-preference/resolver.ts';

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface MpPayment {
  id: number;
  status: string;
  status_detail?: string;
  external_reference?: string | null;
  transaction_amount?: number;
  metadata?: {
    tipo?: string;
    oficina_id?: string;
    plan_type?: string;
    original_plan?: string;
    billing_cycle?: string;
    plan_key?: string;
  } | null;
}

export interface ParsedReference {
  tipo: string | null;
  oficinaId: string | null;
  planType: string | null;
  planKey: string | null;
  originalPlan: string | null;
  billingCycle: string | null;
}

export function parseReference(payment: MpPayment): ParsedReference {
  const md = payment.metadata || undefined;
  if (md?.tipo) {
    return {
      tipo: md.tipo,
      oficinaId:
        md.oficina_id && UUID_REGEX.test(md.oficina_id) ? md.oficina_id : null,
      planType: md.plan_type ?? null,
      planKey: md.plan_key ?? null,
      originalPlan: md.original_plan ?? null,
      billingCycle: md.billing_cycle ?? null,
    };
  }
  const ref = payment.external_reference;
  if (ref) {
    const parts = ref.split(':');
    if (parts[0] === 'subscription' && parts.length >= 3) {
      return {
        tipo: 'subscription',
        oficinaId: UUID_REGEX.test(parts[1]) ? parts[1] : null,
        planType: parts[2] || null,
        planKey: null,
        originalPlan: null,
        billingCycle: null,
      };
    }
  }
  return {
    tipo: null,
    oficinaId: null,
    planType: null,
    planKey: null,
    originalPlan: null,
    billingCycle: null,
  };
}

export function isValidPaymentId(raw: unknown): boolean {
  if (raw === null || raw === undefined || raw === '') return false;
  return /^\d{1,32}$/.test(String(raw));
}

export type StatusDecision =
  | { action: 'reject_reversed'; status: string }
  | { action: 'not_approved'; status: string }
  | { action: 'continue' };

const REVERSED_STATUSES = new Set([
  'refunded',
  'charged_back',
  'cancelled',
  'canceled', // defensive: MP uses 'cancelled' but tolerate both spellings
]);

export function decideFromStatus(payment: MpPayment): StatusDecision {
  const s = payment.status;
  if (REVERSED_STATUSES.has(s)) return { action: 'reject_reversed', status: s };
  const detail = payment.status_detail ?? '';
  // Defensive: approved but reversed in status_detail.
  if (s === 'approved' && REVERSED_STATUSES.has(detail)) {
    return { action: 'reject_reversed', status: detail };
  }
  if (s !== 'approved') return { action: 'not_approved', status: s };
  return { action: 'continue' };
}

export type CatalogDecision =
  | { ok: true; expected: number }
  | { ok: false; reason: 'plan_key_missing' | 'plan_not_in_catalog' | 'amount_mismatch'; expected: number | null; actual: number | null };

/**
 * Validates a payment's transaction_amount against the server-side catalog
 * resolved from metadata.plan_key (preferred) or original_plan+billing_cycle.
 *
 * Tolerância: 1 centavo (Math.abs(diff) <= 0.01).
 */
export function validateAmountAgainstCatalog(
  ref: ParsedReference,
  amount: number | null | undefined,
): CatalogDecision {
  const key =
    ref.planKey ||
    (ref.originalPlan && ref.billingCycle
      ? `${ref.originalPlan}_${ref.billingCycle}`
      : null);
  if (!key) {
    return { ok: false, reason: 'plan_key_missing', expected: null, actual: amount ?? null };
  }
  const entry = SUBSCRIPTION_CATALOG[key];
  if (!entry) {
    return { ok: false, reason: 'plan_not_in_catalog', expected: null, actual: amount ?? null };
  }
  const paid = typeof amount === 'number' ? amount : NaN;
  if (!Number.isFinite(paid)) {
    return { ok: false, reason: 'amount_mismatch', expected: entry.unit_price, actual: null };
  }
  if (Math.abs(paid - entry.unit_price) > 0.01) {
    return { ok: false, reason: 'amount_mismatch', expected: entry.unit_price, actual: paid };
  }
  return { ok: true, expected: entry.unit_price };
}

export type IdempotencyDecision =
  | { action: 'skip_already_processed' }
  | { action: 'continue' };

export function decideIdempotency(
  existing: { processed_at: string | null } | null | undefined,
): IdempotencyDecision {
  if (existing?.processed_at) return { action: 'skip_already_processed' };
  return { action: 'continue' };
}

export type SubscriptionDecision =
  | { action: 'reject_canceled' }
  | { action: 'noop_already_active' }
  | { action: 'activate'; mode: 'insert' | 'update' };

export function decideFromSubscription(
  sub:
    | {
        status: string | null;
        plan_type: string | null;
        canceled_at: string | null;
      }
    | null
    | undefined,
  planType: string,
): SubscriptionDecision {
  if (sub && (sub.status === 'canceled' || sub.canceled_at)) {
    return { action: 'reject_canceled' };
  }
  if (!sub) return { action: 'activate', mode: 'insert' };
  if (sub.status === 'active' && sub.plan_type === planType) {
    return { action: 'noop_already_active' };
  }
  return { action: 'activate', mode: 'update' };
}

export function mask(value: string | null | undefined): string {
  if (!value) return '∅';
  const s = String(value);
  if (s.length <= 6) return '***';
  return `${s.slice(0, 4)}***${s.slice(-2)}`;
}
