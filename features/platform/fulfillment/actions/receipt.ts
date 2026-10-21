'use server';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';

export type SaleReceipt = {
  id: string; receiptNumber: string; status: string; finalizedAt: string; customerCapacitySnapshot: string; rulePackVersion: string;
  subtotalCents: number; discountCents: number; taxCents: number; totalCents: number; refundedCents: number; currencyCode: string | null; linesHasMore: boolean;
  lines: Array<{ id: string; titleSnapshot: string; skuSnapshot: string; packageUidSnapshot: string; batchSnapshot: string; quantityMicrounits: number; unitPriceCents: number; discountCents: number; taxCents: number; totalCents: number; package?: { unitOfMeasure?: string | null } | null }>;
  tenders: Array<{ id: string; typeSnapshot: string; amountCents: number; changeCents: number | null; status: string }>;
  refunds: Array<{ id: string; amountCents: number; status: string; reasonCode: string; occurredAt: string }>;
};

export async function getSaleReceipt(saleId: string): Promise<{ state: 'ok'; sale: SaleReceipt } | { state: 'forbidden' | 'not_found' | 'unavailable' }> {
  if (typeof saleId !== 'string' || !saleId.trim() || saleId.length > 100) return { state: 'not_found' };
  try {
    const result = await keystoneClient<{ cannabisSaleReceipt: { state?: string; sale?: SaleReceipt } }>('query SaleReceipt($saleId: ID!) { cannabisSaleReceipt(saleId: $saleId) }', { saleId });
    const response = result.success ? result.data.cannabisSaleReceipt : undefined;
    if (response?.state === 'forbidden' || response?.state === 'not_found') return { state: response.state };
    const sale = response?.state === 'ok' ? response.sale : undefined;
    if (!sale || typeof sale.id !== 'string' || typeof sale.receiptNumber !== 'string' || !Array.isArray(sale.lines) || !Array.isArray(sale.tenders) || !Array.isArray(sale.refunds) ||
        ![sale.subtotalCents, sale.discountCents, sale.taxCents, sale.totalCents, sale.refundedCents].every(value => Number.isSafeInteger(value))) return { state: 'unavailable' };
    return { state: 'ok', sale };
  } catch { return { state: 'unavailable' }; }
}
