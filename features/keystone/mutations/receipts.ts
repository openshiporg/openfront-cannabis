import type { Context } from ".keystone/types";
import { assertText, requireReadAuthority } from "./workflow";

/**
 * Recover one of your own controlled commands after a lost response or closed tab.
 * Returns the retained original request (credentials and proofs are never retained)
 * and, when it committed, the original result.
 */
export async function cannabisCommandReceipt(_root: unknown, args: { input: any }, context: Context) {
  const authority = await requireReadAuthority(context, "canAccessDashboard");
  const scope = assertText(args.input?.scope, "Command scope", 3, 100);
  const key = assertText(args.input?.idempotencyKey, "Idempotency key", 8, 200);
  const lookupKey = `${authority.organizationId}:${authority.premisesId}:${scope}:${key}`;
  const receipt = await context.sudo().query.IdempotencyKey.findOne({ where: { lookupKey }, query: "id scope status requestSnapshot responseSnapshot startedAt completedAt actor { id }" });
  if (!receipt || receipt.actor?.id !== authority.actor.id) return { state: "not_found" };
  return {
    state: receipt.status, scope: receipt.scope, startedAt: receipt.startedAt, completedAt: receipt.completedAt ?? null,
    request: receipt.requestSnapshot ?? null, result: receipt.status === "succeeded" ? receipt.responseSnapshot : null,
  };
}

/** Read-only receipt detail from the immutable sale snapshot; history is never re-derived from today's catalog. */
export async function cannabisSaleReceipt(_root: unknown, args: { saleId: string }, context: Context) {
  let authority: Awaited<ReturnType<typeof requireReadAuthority>>;
  try { authority = await requireReadAuthority(context, "canManageSales"); } catch { return { state: "forbidden" }; }
  const saleId = assertText(args.saleId, "Sale ID", 1, 100);
  const sale = await context.sudo().query.Sale.findOne({ where: { id: saleId }, query: `id receiptNumber status finalizedAt customerCapacitySnapshot rulePackVersion subtotalCents discountCents taxCents totalCents refundedCents receiptSnapshot organization { id } premises { id }
    lines(orderBy: [{ createdAt: asc }], take: 100) { id titleSnapshot skuSnapshot packageUidSnapshot batchSnapshot quantityMicrounits unitPriceCents discountCents taxCents totalCents package { unitOfMeasure } } linesCount
    tenders(take: 20) { id typeSnapshot amountCents changeCents status } refunds(orderBy: [{ occurredAt: desc }], take: 20) { id amountCents status reasonCode occurredAt }` });
  if (!sale || sale.organization?.id !== authority.organizationId || sale.premises?.id !== authority.premisesId) return { state: "not_found" };
  const snapshot = sale.receiptSnapshot && typeof sale.receiptSnapshot === "object" && !Array.isArray(sale.receiptSnapshot) ? sale.receiptSnapshot as Record<string, unknown> : {};
  const { organization: _organization, premises: _premises, receiptSnapshot: _receiptSnapshot, ...detail } = sale;
  return { state: "ok", sale: { ...detail, currencyCode: typeof snapshot.currencyCode === "string" ? snapshot.currencyCode : null, linesHasMore: Number(sale.linesCount) > 100 } };
}
