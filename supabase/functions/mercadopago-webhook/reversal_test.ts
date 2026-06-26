import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  decideReversal,
  isReversal,
  maskId,
  type ReversalContext,
} from "./reversal.ts";

const base: ReversalContext = {
  mappedStatus: "refunded",
  statusDetail: null,
  previousStoredStatus: "approved",
  wasPreviouslyApproved: true,
  hasNewerApprovedSubscriptionPayment: false,
};

Deno.test("isReversal: refunded mapped status is a reversal", () => {
  assertEquals(isReversal("refunded", null), true);
});

Deno.test("isReversal: charged_back mapped status is a reversal", () => {
  assertEquals(isReversal("charged_back", null), true);
});

Deno.test("isReversal: cancelled mapped status is a reversal", () => {
  assertEquals(isReversal("cancelled", null), true);
});

Deno.test("isReversal: approved with status_detail=refunded is a reversal (safety net)", () => {
  assertEquals(isReversal("approved", "refunded"), true);
});

Deno.test("isReversal: approved with status_detail=charged_back is a reversal", () => {
  assertEquals(isReversal("approved", "charged_back"), true);
});

Deno.test("isReversal: pending is NOT a reversal", () => {
  assertEquals(isReversal("pending", null), false);
});

Deno.test("isReversal: approved clean is NOT a reversal", () => {
  assertEquals(isReversal("approved", "accredited"), false);
});

Deno.test("isReversal: rejected is NOT a reversal", () => {
  assertEquals(isReversal("rejected", null), false);
});

Deno.test("decideReversal: refunded after approval cancels subscription", () => {
  const d = decideReversal(base);
  assertEquals(d, { action: "cancel_subscription", reason: "refunded" });
});

Deno.test("decideReversal: charged_back after approval cancels with reason charged_back", () => {
  const d = decideReversal({ ...base, mappedStatus: "charged_back" });
  assertEquals(d, { action: "cancel_subscription", reason: "charged_back" });
});

Deno.test("decideReversal: cancelled after approval cancels with reason cancelled", () => {
  const d = decideReversal({ ...base, mappedStatus: "cancelled" });
  assertEquals(d, { action: "cancel_subscription", reason: "cancelled" });
});

Deno.test("decideReversal: refunded REPEATED is idempotent no-op", () => {
  const d = decideReversal({ ...base, previousStoredStatus: "refunded" });
  assertEquals(d.action, "noop_already_processed");
});

Deno.test("decideReversal: charged_back REPEATED is idempotent no-op", () => {
  const d = decideReversal({
    ...base,
    mappedStatus: "charged_back",
    previousStoredStatus: "charged_back",
  });
  assertEquals(d.action, "noop_already_processed");
});

Deno.test("decideReversal: refund of payment we NEVER approved does NOT touch subscription", () => {
  const d = decideReversal({
    ...base,
    wasPreviouslyApproved: false,
    previousStoredStatus: null,
  });
  assertEquals(d.action, "noop_never_approved");
});

Deno.test("decideReversal: cancelled for never-approved payment does NOT touch subscription", () => {
  const d = decideReversal({
    ...base,
    mappedStatus: "cancelled",
    wasPreviouslyApproved: false,
    previousStoredStatus: "pending",
  });
  assertEquals(d.action, "noop_never_approved");
});

Deno.test("decideReversal: OLD refund when oficina already RENEWED keeps subscription active", () => {
  const d = decideReversal({
    ...base,
    hasNewerApprovedSubscriptionPayment: true,
  });
  assertEquals(d.action, "noop_newer_approved_payment_exists");
});

Deno.test("decideReversal: OLD chargeback when oficina already RENEWED keeps subscription active", () => {
  const d = decideReversal({
    ...base,
    mappedStatus: "charged_back",
    hasNewerApprovedSubscriptionPayment: true,
  });
  assertEquals(d.action, "noop_newer_approved_payment_exists");
});

Deno.test("decideReversal: approved (no reversal) returns noop_not_reversal", () => {
  const d = decideReversal({
    ...base,
    mappedStatus: "approved",
    statusDetail: "accredited",
    previousStoredStatus: null,
    wasPreviouslyApproved: false,
  });
  assertEquals(d.action, "noop_not_reversal");
});

Deno.test("decideReversal: pending returns noop_not_reversal even after prior approval", () => {
  const d = decideReversal({
    ...base,
    mappedStatus: "pending",
    statusDetail: null,
  });
  assertEquals(d.action, "noop_not_reversal");
});

Deno.test("decideReversal: in_process equivalent (mapped pending) returns noop_not_reversal", () => {
  const d = decideReversal({ ...base, mappedStatus: "pending" });
  assertEquals(d.action, "noop_not_reversal");
});

Deno.test("decideReversal: status approved + status_detail charged_back cancels with reason charged_back", () => {
  const d = decideReversal({
    ...base,
    mappedStatus: "approved",
    statusDetail: "charged_back",
  });
  assertEquals(d, { action: "cancel_subscription", reason: "charged_back" });
});

Deno.test("decideReversal: status approved + status_detail refunded cancels with reason refunded", () => {
  const d = decideReversal({
    ...base,
    mappedStatus: "approved",
    statusDetail: "refunded",
  });
  assertEquals(d, { action: "cancel_subscription", reason: "refunded" });
});

Deno.test("decideReversal: rejected after approval is NOT a reversal (not a refund)", () => {
  const d = decideReversal({ ...base, mappedStatus: "rejected" });
  assertEquals(d.action, "noop_not_reversal");
});

Deno.test("maskId: masks uuid keeping last 4", () => {
  assertEquals(maskId("11111111-2222-3333-4444-555566667777"), "***7777");
});

Deno.test("maskId: handles numeric id", () => {
  assertEquals(maskId(123456789), "***6789");
});

Deno.test("maskId: short id is fully masked", () => {
  assertEquals(maskId("ab"), "****");
});

Deno.test("maskId: null returns empty marker", () => {
  assertEquals(maskId(null), "∅");
});
