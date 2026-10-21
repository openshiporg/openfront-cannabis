const MAX_INT = 2_147_483_647;
export const MAX_FULFILLMENT_LINES = 250;
export const MAX_ALLOCATION_EVIDENCE_LINES = 500;
export const PREPARATION_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  reserved: ['picking'], picking: ['staged', 'reserved'], staged: ['picking'],
};
export const ALLOCATED_CART_STATUSES = ['preliminarily_eligible', 'reserved', 'picking', 'staged', 'final_verification'] as const;

export type FulfillmentScope = { organizationId: string; premisesId: string };
type Scoped = { organization: { id: string } | null; premises: { id: string } | null };
export type FulfillmentLine = Scoped & { id: string; quantityMicrounits: number; cart: { id: string }; package: { id: string } };
export type FulfillmentCart = Scoped & {
  id: string; reference: string; version: number; status: string; expiresAt: string | Date;
  lines: FulfillmentLine[];
};

export function assertFulfillmentScope<T>(value: T, scope: FulfillmentScope): asserts value is T & Scoped {
  const candidate = value as Partial<Scoped> | null;
  if (!candidate || typeof candidate !== 'object' || candidate.organization?.id !== scope.organizationId || candidate.premises?.id !== scope.premisesId) {
    throw new Error('Cart preparation evidence is outside current authority');
  }
}

export function planCartPreparation(cart: FulfillmentCart, expectedVersion: number, nextStatus: string, scope: FulfillmentScope, now = new Date()) {
  assertFulfillmentScope(cart, scope);
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1 || cart.version !== expectedVersion || cart.version >= MAX_INT) {
    throw new Error('Cart preparation version is stale or invalid');
  }
  const expiry = new Date(cart.expiresAt).getTime();
  if (!Number.isFinite(expiry) || expiry <= now.getTime()) throw new Error('Cart reservation expired');
  if (!Object.hasOwn(PREPARATION_TRANSITIONS, cart.status) || !PREPARATION_TRANSITIONS[cart.status].includes(nextStatus)) {
    throw new Error('Unsupported cart preparation transition');
  }
  if (!Array.isArray(cart.lines) || cart.lines.length < 1 || cart.lines.length > MAX_FULFILLMENT_LINES) {
    throw new Error('Cart preparation needs complete bounded reservation lines');
  }
  const ids = new Set<string>();
  const groups = new Map<string, number>();
  for (const line of cart.lines) {
    assertFulfillmentScope(line, scope);
    if (!line.id || ids.has(line.id) || line.cart?.id !== cart.id || !line.package?.id ||
        !Number.isSafeInteger(line.quantityMicrounits) || line.quantityMicrounits < 1 || line.quantityMicrounits > MAX_INT) {
      throw new Error('Cart preparation reservation line is invalid');
    }
    ids.add(line.id);
    const total = (groups.get(line.package.id) || 0) + line.quantityMicrounits;
    if (!Number.isSafeInteger(total) || total > MAX_INT) throw new Error('Package allocation exceeds integer range');
    groups.set(line.package.id, total);
  }
  return [...groups].sort(([left], [right]) => left.localeCompare(right)).map(([packageId, quantityMicrounits]) => ({ packageId, quantityMicrounits }));
}

/** Expired timestamps still occupy allocations until a release commits. No silent reclamation. */
export function assertPreparationAllocationCoverage(
  cart: FulfillmentCart,
  ledger: unknown,
  packages: unknown,
  scope: FulfillmentScope,
) {
  if (!Array.isArray(ledger) || ledger.length > MAX_ALLOCATION_EVIDENCE_LINES || !Array.isArray(packages) || packages.length > MAX_FULFILLMENT_LINES) {
    throw new Error('Allocation evidence is incomplete');
  }
  const expectedIds = new Set(cart.lines.map(line => line.package.id));
  const packageIds = new Set<string>();
  for (const pkg of packages) {
    assertFulfillmentScope(pkg, scope);
    if (packageIds.has(pkg.id) || !expectedIds.has(pkg.id) || !Number.isSafeInteger(pkg.reservedMicrounits) || pkg.reservedMicrounits < 0 || pkg.reservedMicrounits > MAX_INT) {
      throw new Error('Allocation package evidence is invalid');
    }
    packageIds.add(pkg.id);
  }
  if (packageIds.size !== expectedIds.size) throw new Error('Allocation package evidence is incomplete');
  const ids = new Set<string>();
  const totals = new Map<string, number>();
  const targetLines = new Map(cart.lines.map(line => [line.id, line]));
  const covered = new Set<string>();
  for (const line of ledger) {
    assertFulfillmentScope(line, scope);
    assertFulfillmentScope(line.cart, scope);
    if (!line.id || ids.has(line.id) || !line.cart?.id || !ALLOCATED_CART_STATUSES.includes(line.cart.status as typeof ALLOCATED_CART_STATUSES[number]) ||
        !packageIds.has(line.package?.id) || !Number.isSafeInteger(line.quantityMicrounits) || line.quantityMicrounits < 1 || line.quantityMicrounits > MAX_INT) {
      throw new Error('Allocation line evidence is invalid');
    }
    ids.add(line.id);
    const total = (totals.get(line.package.id) || 0) + line.quantityMicrounits;
    if (!Number.isSafeInteger(total) || total > MAX_INT) throw new Error('Allocation ledger exceeds integer range');
    totals.set(line.package.id, total);
    const target = targetLines.get(line.id);
    if (target) {
      if (line.cart.id !== cart.id || line.cart.status !== cart.status || target.package.id !== line.package.id || target.quantityMicrounits !== line.quantityMicrounits) {
        throw new Error('Cart allocation evidence changed');
      }
      covered.add(line.id);
    } else if (line.cart.id === cart.id) throw new Error('Cart reservation read is incomplete');
  }
  if (covered.size !== targetLines.size || packages.some(pkg => (totals.get(pkg.id) || 0) !== pkg.reservedMicrounits)) {
    throw new Error('Reservation counter does not match the complete allocation ledger');
  }
}
