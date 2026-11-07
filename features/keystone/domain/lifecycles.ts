/**
 * State machines that were implicit in command code. Kept as plain data so the commands,
 * the webhook and the tests read the same rules.
 */

/** Tender: received (cash) / authorized (card hold) -> captured -> reversed; failed is terminal. */
export const TENDER_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  received: ["authorized", "captured", "failed", "reversed"],
  authorized: ["captured", "failed", "reversed"],
  captured: ["reversed"],
  reversed: [],
  failed: [],
};

export function canMoveTender(from: string, to: string) {
  return Object.hasOwn(TENDER_TRANSITIONS, from) && TENDER_TRANSITIONS[from].includes(to);
}

/** A payment provider reports a settled capture as "succeeded"; the Tender list only knows "captured". */
export function tenderStatusFromCapture(providerStatus: unknown): "captured" {
  if (providerStatus === "captured" || providerStatus === "succeeded") return "captured";
  throw new Error("Payment capture is ambiguous");
}

/** The tender status a provider webhook event asks for, or null when the event is not one we act on. */
export function tenderStatusForWebhook(rawType: string): "captured" | "reversed" | "failed" | null {
  // The Authorize.net adapter reports its raw event name; other adapters already use the short form.
  const eventType = ({
    "net.authorize.payment.authcapture.created": "succeeded", "net.authorize.payment.priorAuthCapture.created": "succeeded", "net.authorize.payment.capture.created": "succeeded",
    "net.authorize.payment.void.created": "voided", "net.authorize.payment.refund.created": "refunded", "net.authorize.payment.fraud.declined": "declined",
  } as Record<string, string>)[rawType] ?? rawType;
  if (["transaction_completed", "captured", "succeeded"].includes(eventType)) return "captured";
  if (["voided", "canceled", "refunded"].includes(eventType)) return "reversed";
  if (["failed", "declined"].includes(eventType)) return "failed";
  return null;
}

/**
 * A packed (staged) online order is the normal state when the customer arrives, so it must be
 * completable. Picking is mid-pack and has to be finished (or sent back to reserved) first.
 */
export const FINALIZABLE_CART_STATUSES: readonly string[] = ["reserved", "staged"];

/** Online-order card hold: authorized -> voided | captured. A failed void is retried, never abandoned. */
export const RELEASABLE_PAYMENT_STATUSES: readonly string[] = ["authorized", "void_failed"];

/** Customers whose standing was withdrawn after an order was placed must not be re-qualified by a pickup check. */
export function customerBlocksSale(status: string | null | undefined) {
  return status === "suspended" || status === "ineligible";
}

/** Carts that hold stock and can be swept once their hold has run out. */
export const EXPIRABLE_CART_STATUSES = ["preliminarily_eligible", "reserved", "picking", "staged"] as const;

/**
 * Why a sale cannot be voided at the counter, or null. A void undoes the whole sale on the shift that
 * took it: nothing refunded yet, the shift still open, cash only (a card sale is refunded through its terminal),
 * and every package still on the shelf so its stock can go back.
 */
export function saleVoidError(sale: { status: string; refundedCents: number; shiftStatus: string | null | undefined; tenderTypes: string[]; tenderStatuses: string[]; packageStatuses: string[] }): string | null {
  if (["reversed", "reversal_pending"].includes(sale.status)) return "This sale is already voided";
  if (["refunded", "partially_refunded"].includes(sale.status) || sale.refundedCents > 0) return "A sale with a refund can't be voided; refund the rest instead";
  if (sale.shiftStatus !== "open") return "Only a sale on a still-open shift can be voided; refund it instead";
  if (sale.tenderTypes.some(type => type !== "cash")) return "A card sale is refunded through its terminal, not voided";
  if (sale.tenderStatuses.some(status => status !== "received")) return "A tender on this sale has already moved; refund it instead";
  if (sale.packageStatuses.some(status => !["saleable", "quarantined"].includes(status))) return "A package on this sale is no longer on the shelf; refund the sale and correct the count instead";
  return null;
}
