const MAX_INT = 2_147_483_647;

/** Read recorded fields, not an identity/lab/provider certification. */
export function readAllocationReceipt(value: unknown, resourceId: string, cartId: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const evidence = value as Record<string, unknown>;
  if (evidence.id !== resourceId || typeof evidence.quoteHash !== 'string' || !/^[a-f0-9]{64}$/.test(evidence.quoteHash) || !evidence.quote || typeof evidence.quote !== 'object' || Array.isArray(evidence.quote)) return null;
  const quote = evidence.quote as Record<string, unknown>;
  const quantity = quote.quantityMicrounits; const totalCents = quote.totalCents;
  if (quote.schemaVersion !== 1 || quote.cartId !== cartId || typeof quantity !== 'number' || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_INT ||
      typeof totalCents !== 'number' || !Number.isSafeInteger(totalCents) || totalCents < 0 || totalCents > MAX_INT) return null;
  return { quantityMicrounits: quantity, totalCents, quoteHash: evidence.quoteHash };
}

/** Server-owned candidate choice. Input rows are a bounded scoped source read,
 * not a caller's stock/price assertion. Final allocation must reread after lock.
 */
export function choosePackageForProduct(rows: unknown, scope: { organizationId: string; premisesId: string }, productId: string, quantity: number, now = new Date()): string {
  if (!Array.isArray(rows) || rows.length > 51 || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_INT) throw new Error('Allocation source read is invalid');
  const candidates = rows.slice(0, 50).filter(pkg => {
    if (!pkg || pkg.organization?.id !== scope.organizationId || pkg.premises?.id !== scope.premisesId ||
        pkg.product?.id !== productId || pkg.product.organization?.id !== scope.organizationId || pkg.product.premises?.id !== scope.premisesId ||
        pkg.product.status !== 'active' || pkg.status !== 'saleable' || pkg.testStatus !== 'passed' ||
        !Array.isArray(pkg.holds) || pkg.holds.length || !pkg.coaReference || !pkg.labelVersion ||
        !(new Date(pkg.expiresAt).getTime() > now.getTime()) || !Number.isSafeInteger(pkg.reservedMicrounits) ||
        !Number.isSafeInteger(pkg.quantityOnHandMicrounits) || pkg.reservedMicrounits < 0 || pkg.quantityOnHandMicrounits < pkg.reservedMicrounits || pkg.quantityOnHandMicrounits > MAX_INT ||
        !Number.isSafeInteger(pkg.product.unitQuantityMicrounits) || pkg.product.unitQuantityMicrounits < 1 ||
        quantity % pkg.product.unitQuantityMicrounits !== 0 || pkg.quantityOnHandMicrounits - pkg.reservedMicrounits < quantity) return false;
    return typeof pkg.id === 'string' && Boolean(pkg.id);
  });
  candidates.sort((left, right) => new Date(left.expiresAt).getTime() - new Date(right.expiresAt).getTime() || left.id.localeCompare(right.id));
  if (!candidates.length) throw new Error(rows.length > 50 ? 'Allocation source page needs continuation; no stock was allocated' : 'No complete saleable unit is available');
  return candidates[0].id;
}

export function assertReservationLedger(ledger: unknown, packageId: string, reserved: number, scope: { organizationId: string; premisesId: string }) {
  if (!Array.isArray(ledger) || ledger.length > 500 || !Number.isSafeInteger(reserved) || reserved < 0) throw new Error('Complete package allocation ledger is required');
  const ids = new Set<string>();
  let total = 0;
  for (const line of ledger) {
    if (!line || typeof line.id !== 'string' || !line.id || ids.has(line.id) || line.package?.id !== packageId ||
        line.organization?.id !== scope.organizationId || line.premises?.id !== scope.premisesId ||
        line.cart?.organization?.id !== scope.organizationId || line.cart?.premises?.id !== scope.premisesId ||
        !line.cart?.id || !['preliminarily_eligible', 'reserved', 'picking', 'staged', 'final_verification'].includes(line.cart.status) ||
        !Number.isSafeInteger(line.quantityMicrounits) || line.quantityMicrounits < 1 || line.quantityMicrounits > MAX_INT) throw new Error('Package allocation evidence is ambiguous');
    ids.add(line.id); total += line.quantityMicrounits;
    if (!Number.isSafeInteger(total) || total > MAX_INT) throw new Error('Package allocation ledger exceeds integer range');
  }
  if (total !== reserved) throw new Error('Reservation counter does not match complete allocation ledger');
}

export function planReservationBalances(onHand: number, reserved: number, requested: number) {
  if (![onHand, reserved, requested].every(Number.isSafeInteger) || onHand < 0 || reserved < 0 || requested < 1 || onHand > MAX_INT || reserved > MAX_INT || requested > MAX_INT || reserved + requested > onHand) {
    throw new Error('Reservation would violate exact-package quantity conservation');
  }
  return { beforeReservedMicrounits: reserved, afterReservedMicrounits: reserved + requested,
    beforeQuantityMicrounits: onHand, afterQuantityMicrounits: onHand, quantityDeltaMicrounits: 0 };
}
