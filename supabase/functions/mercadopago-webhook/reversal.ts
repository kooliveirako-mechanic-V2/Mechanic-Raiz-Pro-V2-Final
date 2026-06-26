// Pure decision module for Mercado Pago payment reversals.
// No I/O. No Supabase. No fetch. Easy to unit test.

export type MappedStatus =
  | "approved"
  | "pending"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "charged_back"
  | "unknown";

const REVERSED_STATUSES = new Set<MappedStatus>([
  "refunded",
  "charged_back",
  "cancelled",
]);

/**
 * A payment is considered a reversal when its mapped status is one of the
 * reversed statuses, OR when MP keeps the status as `approved` but the
 * status_detail signals a refund / chargeback (defensive net).
 */
export function isReversal(
  mappedStatus: MappedStatus,
  statusDetail?: string | null,
): boolean {
  if (REVERSED_STATUSES.has(mappedStatus)) return true;
  const d = (statusDetail || "").toLowerCase();
  return d.includes("refunded") || d.includes("charged_back");
}

export type ReversalDecision =
  | { action: "cancel_subscription"; reason: "refunded" | "charged_back" | "cancelled" }
  | { action: "noop_not_reversal" }
  | { action: "noop_already_processed" }
  | { action: "noop_never_approved" }
  | { action: "noop_newer_approved_payment_exists" };

export interface ReversalContext {
  mappedStatus: MappedStatus;
  statusDetail?: string | null;
  /** Status of this same mp_payment_id already stored, if any. */
  previousStoredStatus: MappedStatus | null;
  /** True if the same mp_payment_id was previously stored as approved + processed_at. */
  wasPreviouslyApproved: boolean;
  /** True if another approved subscription payment exists for the same oficina, newer than this one. */
  hasNewerApprovedSubscriptionPayment: boolean;
}

export function decideReversal(ctx: ReversalContext): ReversalDecision {
  if (!isReversal(ctx.mappedStatus, ctx.statusDetail)) {
    return { action: "noop_not_reversal" };
  }
  // Idempotency: only short-circuit when we previously stored this same
  // mp_payment_id with the same REVERSED status. We don't short-circuit when
  // previousStoredStatus is "approved" — the status_detail safety net path
  // (approved + status_detail=refunded/charged_back) must still revoke.
  if (
    REVERSED_STATUSES.has(ctx.previousStoredStatus as MappedStatus) &&
    ctx.previousStoredStatus === ctx.mappedStatus
  ) {
    return { action: "noop_already_processed" };
  }
  if (!ctx.wasPreviouslyApproved) {
    return { action: "noop_never_approved" };
  }
  if (ctx.hasNewerApprovedSubscriptionPayment) {
    return { action: "noop_newer_approved_payment_exists" };
  }
  const reason: "refunded" | "charged_back" | "cancelled" =
    ctx.mappedStatus === "refunded" || ctx.mappedStatus === "charged_back"
      ? ctx.mappedStatus
      : ctx.mappedStatus === "cancelled"
        ? "cancelled"
        : (ctx.statusDetail || "").toLowerCase().includes("charged_back")
          ? "charged_back"
          : "refunded";
  return { action: "cancel_subscription", reason };
}

/** Mask UUID / numeric id, keeping just last 4 chars for log correlation. */
export function maskId(id: string | number | null | undefined): string {
  if (id === null || id === undefined) return "∅";
  const s = String(id);
  if (s.length <= 4) return "****";
  return `***${s.slice(-4)}`;
}
