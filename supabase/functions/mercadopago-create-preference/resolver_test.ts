// Pure unit tests for the subscription resolver.
// Does NOT call Mercado Pago, Supabase, or any network/env resource.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  resolveSubscription,
  buildResolvedSubscription,
  SUBSCRIPTION_CATALOG,
} from "./resolver.ts";

Deno.test("fraude unit_price: oficina_completa monthly com unit_price=1 → catálogo vence 97,90", () => {
  const res = resolveSubscription({
    plan_key: "oficina_completa_monthly",
    items: [{ unit_price: 1 }],
  });
  if (!res.ok) throw new Error("expected ok");
  assertEquals(res.entry.unit_price, 97.90);
  assertEquals(res.priceDivergent, true);
  assertEquals(res.clientUnitPrice, 1);
  const built = buildResolvedSubscription(res);
  assertEquals(built.item.unit_price, 97.90);
  assertEquals(built.plan_type, "oficina_pro");
});

Deno.test("plano inexistente → 400 unknown_plan", () => {
  const res = resolveSubscription({
    plan_type: "inexistente",
    metadata: { billing_cycle: "monthly" },
  });
  assertEquals(res.ok, false);
  if (res.ok) throw new Error("unreachable");
  assertEquals(res.status, 400);
  assertEquals(res.code, "unknown_plan");
});

Deno.test("billing_cycle inválido (lifetime) → 400 invalid_billing_cycle", () => {
  const res = resolveSubscription({
    plan_type: "moto_pro",
    metadata: { billing_cycle: "lifetime" },
  });
  assertEquals(res.ok, false);
  if (res.ok) throw new Error("unreachable");
  assertEquals(res.code, "invalid_billing_cycle");
});

Deno.test("metadata conflitante: original_plan=moto_pro + body.plan_type=oficina_pro → catálogo usa metadata.original_plan", () => {
  const res = resolveSubscription({
    plan_type: "oficina_pro",
    metadata: { original_plan: "moto_pro", billing_cycle: "monthly" },
  });
  if (!res.ok) throw new Error("expected ok");
  assertEquals(res.planKey, "moto_pro_monthly");
  assertEquals(res.entry.plan_type, "moto_pro");
  assertEquals(res.entry.unit_price, 47.90);
});

Deno.test("carro_pro mensal → R$ 67,90, backend plan_type=oficina_pro", () => {
  const res = resolveSubscription({ plan_key: "carro_pro_monthly" });
  if (!res.ok) throw new Error("expected ok");
  assertEquals(res.entry.unit_price, 67.90);
  assertEquals(res.entry.plan_type, "oficina_pro");
  assertEquals(res.entry.original_plan, "carro_pro");
});

Deno.test("oficina_completa mensal → R$ 97,90", () => {
  const res = resolveSubscription({ plan_key: "oficina_completa_monthly" });
  if (!res.ok) throw new Error("expected ok");
  assertEquals(res.entry.unit_price, 97.90);
  assertEquals(res.entry.original_plan, "oficina_completa");
});

Deno.test("plan_key vence sobre metadata.original_plan divergente", () => {
  const res = resolveSubscription({
    plan_key: "oficina_completa_annual",
    metadata: { original_plan: "moto_pro", billing_cycle: "monthly" },
  });
  if (!res.ok) throw new Error("expected ok");
  assertEquals(res.planKey, "oficina_completa_annual");
  assertEquals(res.entry.unit_price, 979.00);
});

Deno.test("preço igual ao catálogo → priceDivergent=false", () => {
  const res = resolveSubscription({
    plan_key: "moto_pro_monthly",
    items: [{ unit_price: 47.90 }],
  });
  if (!res.ok) throw new Error("expected ok");
  assertEquals(res.priceDivergent, false);
});

Deno.test("sem items → clientUnitPrice=null, priceDivergent=false", () => {
  const res = resolveSubscription({ plan_key: "moto_pro_monthly" });
  if (!res.ok) throw new Error("expected ok");
  assertEquals(res.clientUnitPrice, null);
  assertEquals(res.priceDivergent, false);
});

Deno.test("catálogo possui exatamente 6 entradas (sem inflar enum)", () => {
  assertEquals(Object.keys(SUBSCRIPTION_CATALOG).length, 6);
});
