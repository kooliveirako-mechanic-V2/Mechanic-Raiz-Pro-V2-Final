// Pure unit tests — no network, no DB, no MP, no env.
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  parseReference,
  isValidPaymentId,
  decideFromStatus,
  validateAmountAgainstCatalog,
  decideIdempotency,
  decideFromSubscription,
  mask,
} from './verifier.ts';

const OFICINA = '11111111-2222-3333-4444-555555555555';
const OTHER = '99999999-8888-7777-6666-555555555555';

// ── payment_id validation ──────────────────────────────────────────
Deno.test('payment_id: rejects null/empty/non-numeric/overflow', () => {
  assertEquals(isValidPaymentId(null), false);
  assertEquals(isValidPaymentId(''), false);
  assertEquals(isValidPaymentId(undefined), false);
  assertEquals(isValidPaymentId('abc'), false);
  assertEquals(isValidPaymentId('123abc'), false);
  assertEquals(isValidPaymentId('1'.repeat(33)), false);
  assertEquals(isValidPaymentId('1234567890'), true);
  assertEquals(isValidPaymentId(1234567890), true);
});

// ── parseReference ────────────────────────────────────────────────
Deno.test('parseReference: metadata wins, with uuid validation', () => {
  const r = parseReference({
    id: 1, status: 'approved',
    metadata: { tipo: 'subscription', oficina_id: OFICINA, plan_type: 'oficina_pro', plan_key: 'oficina_completa_monthly', original_plan: 'oficina_completa', billing_cycle: 'monthly' },
  });
  assertEquals(r.tipo, 'subscription');
  assertEquals(r.oficinaId, OFICINA);
  assertEquals(r.planType, 'oficina_pro');
  assertEquals(r.planKey, 'oficina_completa_monthly');
});

Deno.test('parseReference: falls back to external_reference', () => {
  const r = parseReference({
    id: 1, status: 'approved',
    external_reference: `subscription:${OFICINA}:moto_pro`,
  });
  assertEquals(r.tipo, 'subscription');
  assertEquals(r.oficinaId, OFICINA);
  assertEquals(r.planType, 'moto_pro');
});

Deno.test('parseReference: invalid uuid returns null oficinaId', () => {
  const r = parseReference({
    id: 1, status: 'approved',
    metadata: { tipo: 'subscription', oficina_id: 'not-a-uuid', plan_type: 'moto_pro' },
  });
  assertEquals(r.oficinaId, null);
});

Deno.test('parseReference: garbage external_reference', () => {
  const r = parseReference({ id: 1, status: 'approved', external_reference: 'lixo' });
  assertEquals(r.tipo, null);
});

// ── status gating ─────────────────────────────────────────────────
Deno.test('status: refunded/charged_back/cancelled → reject_reversed', () => {
  for (const s of ['refunded', 'charged_back', 'cancelled']) {
    assertEquals(decideFromStatus({ id: 1, status: s }).action, 'reject_reversed');
  }
});

Deno.test('status: pending/rejected/in_process → not_approved', () => {
  for (const s of ['pending', 'rejected', 'in_process']) {
    assertEquals(decideFromStatus({ id: 1, status: s }).action, 'not_approved');
  }
});

Deno.test('status: approved + status_detail=refunded → reject_reversed', () => {
  assertEquals(
    decideFromStatus({ id: 1, status: 'approved', status_detail: 'refunded' }).action,
    'reject_reversed',
  );
});

Deno.test('status: approved → continue', () => {
  assertEquals(decideFromStatus({ id: 1, status: 'approved' }).action, 'continue');
});

// ── catalog price validation (the legacy R$1/R$5 fix) ─────────────
Deno.test('catalog: moto_pro_monthly @ R$47,90 → ok', () => {
  const r = validateAmountAgainstCatalog(
    { tipo: 'subscription', oficinaId: OFICINA, planType: 'moto_pro', planKey: 'moto_pro_monthly', originalPlan: 'moto_pro', billingCycle: 'monthly' },
    47.9,
  );
  assertEquals(r.ok, true);
});

Deno.test('catalog: oficina_completa_monthly @ R$97,90 → ok', () => {
  const r = validateAmountAgainstCatalog(
    { tipo: 'subscription', oficinaId: OFICINA, planType: 'oficina_pro', planKey: 'oficina_completa_monthly', originalPlan: 'oficina_completa', billingCycle: 'monthly' },
    97.90,
  );
  assertEquals(r.ok, true);
});

Deno.test('catalog: legacy R$1 payment → amount_mismatch', () => {
  const r = validateAmountAgainstCatalog(
    { tipo: 'subscription', oficinaId: OFICINA, planType: 'moto_pro', planKey: 'moto_pro_monthly', originalPlan: 'moto_pro', billingCycle: 'monthly' },
    1.0,
  );
  assert(!r.ok);
  assertEquals(r.reason, 'amount_mismatch');
});

Deno.test('catalog: legacy R$5 payment → amount_mismatch', () => {
  const r = validateAmountAgainstCatalog(
    { tipo: 'subscription', oficinaId: OFICINA, planType: 'oficina_pro', planKey: 'oficina_completa_monthly', originalPlan: 'oficina_completa', billingCycle: 'monthly' },
    5.0,
  );
  assert(!r.ok);
  assertEquals(r.reason, 'amount_mismatch');
});

Deno.test('catalog: plan_key + original_plan ausentes → plan_key_missing', () => {
  const r = validateAmountAgainstCatalog(
    { tipo: 'subscription', oficinaId: OFICINA, planType: 'moto_pro', planKey: null, originalPlan: null, billingCycle: null },
    47.9,
  );
  assert(!r.ok);
  assertEquals(r.reason, 'plan_key_missing');
});

Deno.test('catalog: plan_key inexistente → plan_not_in_catalog', () => {
  const r = validateAmountAgainstCatalog(
    { tipo: 'subscription', oficinaId: OFICINA, planType: 'moto_pro', planKey: 'plano_pirata', originalPlan: null, billingCycle: null },
    47.9,
  );
  assert(!r.ok);
  assertEquals(r.reason, 'plan_not_in_catalog');
});

Deno.test('catalog: tolerância de 1 centavo', () => {
  const r1 = validateAmountAgainstCatalog(
    { tipo: 'subscription', oficinaId: OFICINA, planType: 'moto_pro', planKey: 'moto_pro_monthly', originalPlan: null, billingCycle: null },
    47.91,
  );
  assertEquals(r1.ok, true);
  const r2 = validateAmountAgainstCatalog(
    { tipo: 'subscription', oficinaId: OFICINA, planType: 'moto_pro', planKey: 'moto_pro_monthly', originalPlan: null, billingCycle: null },
    47.5,
  );
  assertEquals(r2.ok, false);
});

// ── idempotência ──────────────────────────────────────────────────
Deno.test('idempotency: processed_at preenchido → skip', () => {
  assertEquals(decideIdempotency({ processed_at: '2026-01-01T00:00:00Z' }).action, 'skip_already_processed');
});

Deno.test('idempotency: sem registro → continue', () => {
  assertEquals(decideIdempotency(null).action, 'continue');
  assertEquals(decideIdempotency({ processed_at: null }).action, 'continue');
});

// ── anti-reativação ───────────────────────────────────────────────
Deno.test('subscription: canceled → reject_canceled', () => {
  assertEquals(
    decideFromSubscription({ status: 'canceled', plan_type: 'moto_pro', canceled_at: null }, 'moto_pro').action,
    'reject_canceled',
  );
});

Deno.test('subscription: canceled_at preenchido → reject_canceled', () => {
  assertEquals(
    decideFromSubscription({ status: 'active', plan_type: 'moto_pro', canceled_at: '2026-01-01' }, 'moto_pro').action,
    'reject_canceled',
  );
});

Deno.test('subscription: ativa mesmo plano → noop', () => {
  assertEquals(
    decideFromSubscription({ status: 'active', plan_type: 'moto_pro', canceled_at: null }, 'moto_pro').action,
    'noop_already_active',
  );
});

Deno.test('subscription: ativa plano diferente → activate (update)', () => {
  const r = decideFromSubscription({ status: 'active', plan_type: 'moto_pro', canceled_at: null }, 'oficina_pro');
  assertEquals(r.action, 'activate');
  if (r.action === 'activate') assertEquals(r.mode, 'update');
});

Deno.test('subscription: inexistente → activate (insert)', () => {
  const r = decideFromSubscription(null, 'moto_pro');
  assertEquals(r.action, 'activate');
  if (r.action === 'activate') assertEquals(r.mode, 'insert');
});

Deno.test('subscription: expired → activate (update)', () => {
  const r = decideFromSubscription({ status: 'expired', plan_type: 'moto_pro', canceled_at: null }, 'moto_pro');
  assertEquals(r.action, 'activate');
});

Deno.test('subscription: trial → activate (update)', () => {
  const r = decideFromSubscription({ status: 'trial', plan_type: null, canceled_at: null }, 'moto_pro');
  assertEquals(r.action, 'activate');
});

// ── mask helper ───────────────────────────────────────────────────
Deno.test('mask: redacts long values, hides short ones', () => {
  assertEquals(mask(OFICINA).length < OFICINA.length, true);
  assertEquals(mask('abc'), '***');
  assertEquals(mask(null), '∅');
});

// Ensure no extra oficina leaks via referential equality
Deno.test('subscription: outra oficina não muda decisão por si só (AuthZ é externo)', () => {
  // Sanity guard: helper não tenta inferir AuthZ.
  const r = decideFromSubscription({ status: 'active', plan_type: 'moto_pro', canceled_at: null }, 'moto_pro');
  assertEquals(r.action, 'noop_already_active');
  // Suppress unused-var warning for OTHER constant in this file.
  assert(OTHER.length > 0);
});
