'use server';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';

export type AllocationQuoteReadback = {
  quoteHash: string; packageId: string; cartVersion: number; quantityMicrounits: number; unitOfMeasure: string;
  subtotalCents: number; discountCents: number; taxCents: number; totalCents: number; rulePackVersion: string;
  currencyCode: string | null; observedAt: string; cartExpiresAt: string;
  reservationReadiness: string; packagesHasMore: boolean;
};

const isInt = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 2_147_483_647;
const isDate = (value: unknown) => typeof value === 'string' && Number.isFinite(new Date(value).getTime());

export async function getAllocationQuote(form: FormData): Promise<{ data: AllocationQuoteReadback } | { error: string }> {
  const cartId = String(form.get('cartId') || '').trim();
  const productId = String(form.get('productId') || '').trim();
  const quantityMicrounits = Number(form.get('quantityMicrounits'));
  const promotionCode = String(form.get('promotionCode') || '').trim();
  if (!cartId || cartId.length > 100 || !productId || productId.length > 100 || !Number.isSafeInteger(quantityMicrounits) || quantityMicrounits < 1 || quantityMicrounits > 2_147_483_647 || promotionCode.length > 100) return { error: 'Select a product and a quantity.' };
  try {
    const result = await keystoneClient('query CartAllocationQuote($input: JSON!) { cannabisCartAllocationQuote(input: $input) }', {
      input: { cartId, productId, quantityMicrounits, ...(promotionCode ? { promotionCode } : {}) },
    });
    const response = result.success && result.data?.cannabisCartAllocationQuote;
    const quote = response?.quote;
    if (!quote || quote.cartId !== cartId || quote.productId !== productId || quote.quantityMicrounits !== quantityMicrounits ||
        typeof response.quoteHash !== 'string' || !/^[a-f0-9]{64}$/.test(response.quoteHash) || typeof quote.packageId !== 'string' ||
        typeof quote.rulePackVersion !== 'string' || typeof quote.unitOfMeasure !== 'string' || typeof response.reservationReadiness !== 'string' ||
        !(quote.currencyCode === null || typeof quote.currencyCode === 'string') || !isDate(quote.observedAt) || !isDate(quote.cartExpiresAt) ||
        ![quote.cartVersion, quote.subtotalCents, quote.discountCents, quote.taxCents, quote.totalCents].every(isInt)) {
      return { error: 'A quote is not available for this cart and quantity. The cart may be closed or expired, or no stock is ready.' };
    }
    return { data: { quoteHash: response.quoteHash, packageId: quote.packageId, cartVersion: quote.cartVersion,
      quantityMicrounits, unitOfMeasure: quote.unitOfMeasure, subtotalCents: quote.subtotalCents, discountCents: quote.discountCents,
      taxCents: quote.taxCents, totalCents: quote.totalCents, rulePackVersion: quote.rulePackVersion,
      currencyCode: quote.currencyCode, observedAt: quote.observedAt, cartExpiresAt: quote.cartExpiresAt,
      reservationReadiness: response.reservationReadiness, packagesHasMore: response.packagesHasMore === true } };
  } catch { return { error: 'Quote is unavailable. Nothing was reserved.' }; }
}
