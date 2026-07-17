// ═══════════════════════════════════════════════════════════════════
// Subscription price resolver (Correction 1.1)
//
// Pure module — NO Mercado Pago call, NO Supabase call, NO env access.
// Exists so it can be unit-tested without touching the network.
//
// Webhook + verify-payment-status compatibility:
//  - external_reference shape `subscription:<oficina>:<plan_type>` is still
//    built in index.ts using plan_type returned here.
//  - metadata keys (plan_type, original_plan, billing_cycle, plan_key,
//    tipo='subscription') are still produced by buildResolvedSubscription().
// ═══════════════════════════════════════════════════════════════════

export type PlanTypeEnum = 'moto_pro' | 'oficina_pro';
export type OriginalPlan = 'moto_pro' | 'carro_pro' | 'oficina_completa';
export type BillingCycle = 'monthly' | 'annual';

export interface CatalogEntry {
  plan_type: PlanTypeEnum;
  original_plan: OriginalPlan;
  billing_cycle: BillingCycle;
  unit_price: number;
  title: string;
  description: string;
}

export const SUBSCRIPTION_CATALOG: Record<string, CatalogEntry> = {
  moto_pro_monthly:         { plan_type: 'moto_pro',    original_plan: 'moto_pro',         billing_cycle: 'monthly', unit_price: 47.90,  title: 'Assinatura Moto Pro (mensal)',         description: 'Plano mensal Moto Pro - Mechanic Raiz Pro' },
  moto_pro_annual:          { plan_type: 'moto_pro',    original_plan: 'moto_pro',         billing_cycle: 'annual',  unit_price: 479.00, title: 'Assinatura Moto Pro (anual)',          description: 'Plano anual Moto Pro - Mechanic Raiz Pro' },
  carro_pro_monthly:        { plan_type: 'oficina_pro', original_plan: 'carro_pro',        billing_cycle: 'monthly', unit_price: 1.00,  title: 'Assinatura Carro Pro (mensal)',        description: 'Plano mensal Carro Pro - Mechanic Raiz Pro' },
  carro_pro_annual:         { plan_type: 'oficina_pro', original_plan: 'carro_pro',        billing_cycle: 'annual',  unit_price: 1.00, title: 'Assinatura Carro Pro (anual)',         description: 'Plano anual Carro Pro - Mechanic Raiz Pro' },
  oficina_completa_monthly: { plan_type: 'oficina_pro', original_plan: 'oficina_completa', billing_cycle: 'monthly', unit_price: 97.90,  title: 'Assinatura Oficina Completa (mensal)', description: 'Plano mensal Oficina Completa - Mechanic Raiz Pro' },
  oficina_completa_annual:  { plan_type: 'oficina_pro', original_plan: 'oficina_completa', billing_cycle: 'annual',  unit_price: 979.00, title: 'Assinatura Oficina Completa (anual)',  description: 'Plano anual Oficina Completa - Mechanic Raiz Pro' },
};

export const VALID_BILLING_CYCLES: BillingCycle[] = ['monthly', 'annual'];

export interface SubscriptionInput {
  plan_key?: unknown;
  plan_type?: unknown;
  metadata?: Record<string, unknown> | null;
  items?: Array<{ unit_price?: unknown }> | null;
}

export type ResolveError =
  | { ok: false; status: 400; code: 'invalid_billing_cycle'; message: string; candidateKey: string }
  | { ok: false; status: 400; code: 'unknown_plan'; message: string; candidateKey: string };

export interface ResolveOk {
  ok: true;
  planKey: string;
  entry: CatalogEntry;
  /** First client-supplied unit_price seen in items (for divergence log). */
  clientUnitPrice: number | null;
  /** True when client sent a price that differs from the catalog. */
  priceDivergent: boolean;
}

export type ResolveResult = ResolveOk | ResolveError;

/**
 * Resolve a subscription request to a catalog entry.
 *
 * Rules:
 *  - plan_key (if provided) wins over metadata.original_plan / body.plan_type.
 *  - billing_cycle defaults to 'monthly' when absent, but is rejected when present
 *    with an invalid value (e.g. 'lifetime').
 *  - Catalog price ALWAYS wins. Any client unit_price is reported via
 *    `priceDivergent` so the caller can emit a safe console.warn.
 *  - Unknown plan keys return a 400 error.
 *  - This function never throws; it returns a discriminated union.
 */
export function resolveSubscription(body: SubscriptionInput): ResolveResult {
  const meta = (body.metadata || {}) as Record<string, unknown>;
  const rawKey = typeof body.plan_key === 'string' ? body.plan_key : undefined;
  const originalPlan =
    (typeof meta.original_plan === 'string' ? (meta.original_plan as string) : undefined) ||
    (typeof body.plan_type === 'string' ? (body.plan_type as string) : undefined);

  const rawBillingCycle = meta.billing_cycle;
  if (rawBillingCycle !== undefined && rawBillingCycle !== null) {
    if (typeof rawBillingCycle !== 'string' || !VALID_BILLING_CYCLES.includes(rawBillingCycle as BillingCycle)) {
      return {
        ok: false,
        status: 400,
        code: 'invalid_billing_cycle',
        message: 'Ciclo de cobrança inválido',
        candidateKey: String(rawKey ?? originalPlan ?? ''),
      };
    }
  }
  const billingCycle: BillingCycle =
    (typeof rawBillingCycle === 'string' ? (rawBillingCycle as BillingCycle) : 'monthly');

  const candidateKey = rawKey && rawKey.length > 0
    ? rawKey
    : (originalPlan ? `${originalPlan}_${billingCycle}` : '');

  const entry = SUBSCRIPTION_CATALOG[candidateKey] || null;
  if (!entry) {
    return {
      ok: false,
      status: 400,
      code: 'unknown_plan',
      message: 'Plano de assinatura inválido',
      candidateKey,
    };
  }

  // Look at the first numeric client price for divergence reporting only.
  let clientUnitPrice: number | null = null;
  if (Array.isArray(body.items)) {
    for (const it of body.items) {
      if (it && typeof it.unit_price === 'number' && Number.isFinite(it.unit_price)) {
        clientUnitPrice = it.unit_price;
        break;
      }
    }
  }
  const priceDivergent =
    clientUnitPrice !== null &&
    Number(clientUnitPrice.toFixed(2)) !== Number(entry.unit_price.toFixed(2));

  return { ok: true, planKey: candidateKey, entry, clientUnitPrice, priceDivergent };
}

/**
 * Build the server-trusted item + metadata block that REPLACES whatever the
 * client sent for a subscription. Pure — no side effects.
 */
export function buildResolvedSubscription(resolved: ResolveOk, prevMetadata: Record<string, unknown> = {}) {
  const item = {
    id: resolved.planKey,
    title: resolved.entry.title,
    description: resolved.entry.description,
    unit_price: resolved.entry.unit_price,
    quantity: 1,
    category_id: 'services',
  };
  const metadata = {
    ...prevMetadata,
    tipo: 'subscription' as const,
    plan_type: resolved.entry.plan_type,
    original_plan: resolved.entry.original_plan,
    billing_cycle: resolved.entry.billing_cycle,
    plan_key: resolved.planKey,
  };
  return { item, metadata, plan_type: resolved.entry.plan_type };
}
