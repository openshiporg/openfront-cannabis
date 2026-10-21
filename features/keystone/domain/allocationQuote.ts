import { calculateDiscountCents, calculateTaxCents, requireTaxRule, type BuyerCapacity, type EffectiveRulePack } from './cannabisPolicy';

export type AllocationQuotePackage = {
  id: string; version: number; unitOfMeasure: string;
  product: { id: string; status: string; unitOfMeasure: string; unitQuantityMicrounits: number; equivalencyMicrounits: number;
    priceCents: number; categoryCode: string; taxCategoryCode: string; adultUseEligible: boolean; medicalEligible: boolean };
};
export function calculateAllocationQuote(pkg: AllocationQuotePackage, cart: { id: string; version: number; customer: { capacity: BuyerCapacity } },
  pack: EffectiveRulePack, quantity: number, promotionCode: string | null, authority: { actor: { id: string }; organizationId: string; premisesId: string }, now = new Date()) {
  const product = pkg.product;
  for (const value of [pkg.version, cart.version]) {
    if (!Number.isSafeInteger(value) || value < 1 || value >= 2_147_483_647) throw new Error('Allocation quote version is invalid');
  }
  for (const value of [product.unitQuantityMicrounits, product.equivalencyMicrounits, quantity]) {
    if (!Number.isSafeInteger(value) || value < 1 || value > 2_147_483_647) throw new Error('Allocation quote quantity is invalid');
  }
  if (!['adult_use', 'patient', 'caregiver'].includes(cart.customer.capacity) || pkg.unitOfMeasure !== product.unitOfMeasure || quantity % product.unitQuantityMicrounits !== 0 ||
      product.status !== 'active' || (cart.customer.capacity === 'adult_use' ? !product.adultUseEligible : !product.medicalEligible)) throw new Error('Product unit/capacity is not eligible');
  const units = quantity / product.unitQuantityMicrounits;
  const subtotalCents = product.priceCents * units;
  const equivalencyMicrounits = product.equivalencyMicrounits * units;
  if (!Number.isSafeInteger(product.priceCents) || product.priceCents < 0 || !Number.isSafeInteger(subtotalCents) || subtotalCents > 2_147_483_647 || !Number.isSafeInteger(equivalencyMicrounits) || equivalencyMicrounits > 2_147_483_647) throw new Error('Allocation quote exceeds integer storage range');
  const taxRule = requireTaxRule(pack.taxRules, product.taxCategoryCode, cart.customer.capacity);
  let discountCents = 0;
  let discountSnapshot: Record<string, string | number> = {};
  if (promotionCode) {
    const discounts = (pack.discountRules || []).filter(candidate => candidate.code === promotionCode && candidate.categoryCode === product.categoryCode && (candidate.capacity === cart.customer.capacity || candidate.capacity === 'all'));
    if (discounts.length !== 1) throw new Error('Exactly one configured promotion must match');
    discountCents = calculateDiscountCents(subtotalCents, discounts[0], now);
    discountSnapshot = { code: discounts[0].code, type: discounts[0].type, value: discounts[0].value, authorityPackVersion: pack.version };
  }
  const taxCents = calculateTaxCents(subtotalCents, discountCents, taxRule.basisPoints);
  const totalCents = subtotalCents - discountCents + taxCents;
  if (!Number.isSafeInteger(totalCents) || totalCents > 2_147_483_647) throw new Error('Quoted total exceeds integer storage range');
  const policySnapshot: EffectiveRulePack = JSON.parse(JSON.stringify(pack));
  const packageSnapshot: AllocationQuotePackage = JSON.parse(JSON.stringify(pkg));
  return { schemaVersion: 1, policySnapshot, packageSnapshot, actorId: authority.actor.id, organizationId: authority.organizationId, premisesId: authority.premisesId,
    cartId: cart.id, cartVersion: cart.version, buyerCapacity: cart.customer.capacity, packageId: pkg.id, packageVersion: pkg.version, productId: product.id,
    unitOfMeasure: pkg.unitOfMeasure, unitQuantityMicrounits: product.unitQuantityMicrounits, units, quantityMicrounits: quantity,
    equivalencyMicrounits, unitPriceCents: product.priceCents, subtotalCents, discountCents, discountSnapshot,
    taxBasisPoints: taxRule.basisPoints, taxCents, totalCents, promotionCode, rulePackId: pack.id, rulePackVersion: pack.version };
}
