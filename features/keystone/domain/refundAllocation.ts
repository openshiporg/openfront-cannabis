export const MAX_REFUND_ALLOCATION_EVIDENCE_ROWS = 500;
const MAX_MONEY_CENTS = 2_147_483_647;
const REFUND_STATUSES = new Set(['pending', 'completed', 'failed', 'reconciled']);
const TENDER_STATUSES = new Set(['received', 'authorized', 'captured', 'reversed', 'failed']);

export type RefundAllocationDecision =
  | { ok: true; originalTender: { id: string; amountCents: number; typeSnapshot: string; status: string } }
  | { ok: false; reason: 'incomplete' | 'limit' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 500 && value.trim() === value;
}

function isMoney(value: unknown, minimum: number): value is number {
  return Number.isSafeInteger(value) && (value as number) >= minimum && (value as number) <= MAX_MONEY_CENTS;
}

/**
 * Returns bounded lookup IDs only when every sale refund has an explicit tender
 * reference. A missing legacy reference is ambiguous and must not be skipped.
 */
export function getRefundEvidenceTenderIds(refunds: unknown, originalTenderId: unknown): string[] | undefined {
  if (!Array.isArray(refunds) || refunds.length > MAX_REFUND_ALLOCATION_EVIDENCE_ROWS || !isText(originalTenderId)) return undefined;

  const ids = new Set<string>([originalTenderId]);
  for (const refund of refunds) {
    if (!isRecord(refund) || !isText(refund.originalTenderReference)) return undefined;
    ids.add(refund.originalTenderReference);
  }
  return [...ids];
}

/**
 * Validates a complete bounded same-sale refund ledger and caps the next refund
 * against its original tender. Every recorded state consumes allocation
 * conservatively; failed/pending outcomes are not assumed to prove no movement.
 */
export function evaluateRefundAllocationEvidence(input: {
  saleId: unknown;
  organizationId: unknown;
  premisesId: unknown;
  originalTenderId: unknown;
  requestedAmountCents: unknown;
  saleRefundedCents: unknown;
  refunds: unknown;
  tenders: unknown;
}): RefundAllocationDecision {
  const { saleId, organizationId, premisesId, originalTenderId, requestedAmountCents, saleRefundedCents, refunds, tenders } = input;
  if (!isText(saleId) || !isText(organizationId) || !isText(premisesId) || !isText(originalTenderId) || !isMoney(requestedAmountCents, 1) ||
      !isMoney(saleRefundedCents, 0) || !Array.isArray(refunds) ||
      refunds.length > MAX_REFUND_ALLOCATION_EVIDENCE_ROWS || !Array.isArray(tenders) ||
      tenders.length > MAX_REFUND_ALLOCATION_EVIDENCE_ROWS + 1) {
    return { ok: false, reason: 'incomplete' };
  }

  const expectedTenderIds = new Set<string>([originalTenderId]);
  const refundIds = new Set<string>();
  let totalRefundedCents = 0;
  let allocatedToOriginalTenderCents = 0;

  for (const refund of refunds) {
    if (!isRecord(refund) || !isText(refund.id) || refundIds.has(refund.id) ||
        !isMoney(refund.amountCents, 1) || !REFUND_STATUSES.has(String(refund.status)) ||
        !isText(refund.originalTenderReference) || !isRecord(refund.sale) || refund.sale.id !== saleId ||
        !isRecord(refund.organization) || refund.organization.id !== organizationId ||
        !isRecord(refund.premises) || refund.premises.id !== premisesId) {
      return { ok: false, reason: 'incomplete' };
    }
    refundIds.add(refund.id);
    expectedTenderIds.add(refund.originalTenderReference);
    totalRefundedCents += refund.amountCents;
    if (!Number.isSafeInteger(totalRefundedCents) || totalRefundedCents > MAX_MONEY_CENTS) return { ok: false, reason: 'incomplete' };
    if (refund.originalTenderReference === originalTenderId) {
      allocatedToOriginalTenderCents += refund.amountCents;
      if (!Number.isSafeInteger(allocatedToOriginalTenderCents) || allocatedToOriginalTenderCents > MAX_MONEY_CENTS) return { ok: false, reason: 'incomplete' };
    }
  }

  if (totalRefundedCents !== saleRefundedCents) return { ok: false, reason: 'incomplete' };

  const tenderById = new Map<string, { id: string; amountCents: number; typeSnapshot: string; status: string }>();
  for (const tender of tenders) {
    if (!isRecord(tender) || !isText(tender.id) || tenderById.has(tender.id) ||
        !isMoney(tender.amountCents, 0) || !isText(tender.typeSnapshot) ||
        !TENDER_STATUSES.has(String(tender.status)) || !isRecord(tender.sale) || tender.sale.id !== saleId ||
        !isRecord(tender.organization) || tender.organization.id !== organizationId ||
        !isRecord(tender.premises) || tender.premises.id !== premisesId) {
      return { ok: false, reason: 'incomplete' };
    }
    tenderById.set(tender.id, {
      id: tender.id,
      amountCents: tender.amountCents,
      typeSnapshot: tender.typeSnapshot,
      status: String(tender.status),
    });
  }

  if (tenderById.size !== expectedTenderIds.size || [...expectedTenderIds].some(id => !tenderById.has(id))) {
    return { ok: false, reason: 'incomplete' };
  }

  const originalTender = tenderById.get(originalTenderId);
  if (!originalTender || originalTender.status === 'reversed') return { ok: false, reason: 'incomplete' };
  if (allocatedToOriginalTenderCents + requestedAmountCents > originalTender.amountCents) {
    return { ok: false, reason: 'limit' };
  }

  return { ok: true, originalTender };
}
