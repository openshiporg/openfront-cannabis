/**
 * Runtime capabilities stay closed until their required, independently verified
 * workflow exists in this repository. This is a code-level launch boundary,
 * not a configurable feature flag: adding a capability requires implementing
 * and registering its complete authority/evidence contract in source.
 */
const enabledCapabilities: ReadonlySet<string> = new Set([
  // Read-only public menu: implemented in mutations/public.ts, listing only released, lab-passed,
  // unexpired, unheld packages with free quantity, each re-checked by assertPackageSaleable.
  "storefront.public-live-menu",
  // Owner sign-off 2026-10-24 for in-store regulated sales. Each command below is
  // permission- and credential-checked, idempotent and audited. Hold release, shift
  // close and refunds keep a second person, who re-enters their own password for
  // that one command (mutations/approval.ts).
  "inventory.action-bound-approval", // hold release (recall holds close through their recall)
  "identity.verified-eligibility", // staff ID check at the counter
  "commerce.pos-cart",
  "commerce.reservation-ledger", // cart lines reserve stock; cancel releases it
  "commerce.sale-finalization",
  "provider.traceability-acceptance", // the sale's state report is queued in the outbox
  "provider.payment-capture", // non-cash tenders carry the card terminal's approval reference
  "finance.action-bound-approval", // blind-count shift close
  "finance.verified-refunds",
]);

export function requireRuntimeCapability(capability: string, reason: string): void {
  if (!enabledCapabilities.has(capability)) throw new Error(reason);
}

export function isRuntimeCapabilityEnabled(capability: string): boolean {
  return enabledCapabilities.has(capability);
}
