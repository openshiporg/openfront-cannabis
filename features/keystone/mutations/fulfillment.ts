import type { Context } from '.keystone/types';
import { assertFulfillmentScope, assertPreparationAllocationCoverage, MAX_ALLOCATION_EVIDENCE_LINES, MAX_FULFILLMENT_LINES, planCartPreparation, type FulfillmentCart } from '../domain/cartFulfillment';
import { assertReservedPackageForSale } from '../domain/saleConservation';
import { readAllocationReceipt } from '../domain/packageAllocation';
import { assertInteger, assertReasonCode, assertText, requireOperationalAuthority, runControlledOperation, stableHash } from './workflow';

export async function cannabisCartPreparation(_root: unknown, args: { cartId: string }, context: Context) {
  const authority = await requireOperationalAuthority(context, 'canManageSales', 'sale');
  const cartId = assertText(args.cartId, 'Cart ID');
  const readable = await context.query.Cart.findOne({ where: { id: cartId }, query: 'id' });
  if (!readable || readable.id !== cartId) throw new Error('Cart detail is outside current access');
  const cart = await context.sudo().query.Cart.findOne({ where: { id: cartId }, query: `
    id reference source status version expiresAt totalCents organization { id } premises { id }
    lines(take: ${MAX_FULFILLMENT_LINES + 1}, orderBy: [{ createdAt: asc }, { id: asc }]) {
      id titleSnapshot packageUidSnapshot quantityMicrounits totalCents organization { id } premises { id } cart { id }
    }
  ` });
  assertFulfillmentScope(cart, authority);
  if (!Array.isArray(cart.lines)) throw new Error('Cart preparation detail is incomplete');
  for (const line of cart.lines) {
    assertFulfillmentScope(line, authority);
    if (line.cart?.id !== cart.id) throw new Error('Cart line is outside current detail authority');
  }
  const events = await context.sudo().query.AuditEvent.findMany({
    where: { organization: { id: { equals: authority.organizationId } }, premises: { id: { equals: authority.premisesId } },
      resourceType: { equals: 'Cart' }, resourceId: { equals: cartId }, action: { equals: 'cart.preparation.transitioned' } },
    orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], take: 21,
    query: 'id occurredAt actor { name } evidence',
  });
  const allocationEvents = await context.sudo().query.AuditEvent.findMany({
    where: { organization: { id: { equals: authority.organizationId } }, premises: { id: { equals: authority.premisesId } },
      resourceType: { equals: 'CartLine' }, resourceId: { in: cart.lines.slice(0, MAX_FULFILLMENT_LINES).map(line => line.id) }, action: { equals: 'cart.line.reserved' } },
    orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], take: 21, query: 'id resourceId occurredAt evidence actor { name }',
  });
  const allocationHistory = allocationEvents.slice(0, 20).map(event => {
    const fields = readAllocationReceipt(event.evidence, event.resourceId, cart.id);
    return { id: event.id, occurredAt: event.occurredAt, actorName: event.actor?.name || 'Operator', resourceId: event.resourceId,
      evidenceState: fields ? 'recorded_fields' : 'unknown_legacy', ...fields };
  });
  return { id: cart.id, reference: cart.reference, status: cart.status, source: cart.source, version: cart.version,
    expiresAt: cart.expiresAt, totalCents: cart.totalCents, authorityFingerprint: stableHash([authority.actor.id, authority.organizationId, authority.premisesId]), lines: cart.lines.slice(0, MAX_FULFILLMENT_LINES).map(line => ({ id: line.id, titleSnapshot: line.titleSnapshot, packageUidSnapshot: line.packageUidSnapshot, quantityMicrounits: line.quantityMicrounits, totalCents: line.totalCents })),
    linesHasMore: cart.lines.length > MAX_FULFILLMENT_LINES, historyHasMore: events.length > 20,
    allocationHistory, allocationHistoryHasMore: allocationEvents.length > 20,
    history: events.slice(0, 20).map(event => ({ id: event.id, occurredAt: event.occurredAt, actorName: event.actor?.name,
      beforeStatus: typeof event.evidence?.beforeStatus === 'string' ? event.evidence.beforeStatus : null,
      status: typeof event.evidence?.status === 'string' ? event.evidence.status : null,
      reasonCode: typeof event.evidence?.reasonCode === 'string' ? event.evidence.reasonCode : null,
    })), verification: 'preparation_only_not_sale_or_handoff' };
}

export async function transitionCannabisCartPreparation(_root: unknown, args: { input: {
  cartId: string; expectedVersion: number; nextStatus: string; reasonCode: string; idempotencyKey: string;
} }, context: Context) {
  const input = {
    cartId: assertText(args.input.cartId, 'Cart ID'),
    expectedVersion: assertInteger(args.input.expectedVersion, 'Cart version', 1, 2_147_483_646),
    nextStatus: assertText(args.input.nextStatus, 'Preparation status'),
    reasonCode: assertReasonCode(args.input.reasonCode, 'Preparation reason'),
    idempotencyKey: assertText(args.input.idempotencyKey, 'Idempotency key', 8, 200),
  };
  // Before replay too: guessed/moved cart IDs must not retrieve an old response.
  const authority = await requireOperationalAuthority(context, 'canManageSales', 'sale');
  const visible = await context.query.Cart.findOne({ where: { id: input.cartId }, query: 'id' });
  if (!visible || visible.id !== input.cartId) throw new Error('Cart is outside current access');
  const scope = await context.sudo().query.Cart.findOne({ where: { id: input.cartId }, query: 'id organization { id } premises { id }' });
  assertFulfillmentScope(scope, authority);
  return runControlledOperation(context, input, {
    permission: 'canManageSales', activity: 'sale', scope: 'transitionCannabisCartPreparation',
    resourceType: 'Cart', action: 'cart.preparation.transitioned', emitStateEvent: false,
    authorize: async (current, fresh) => {
      // Acknowledging original preparation never reruns its expiry/version edge.
      const allowed = await current.query.Cart.findOne({ where: { id: input.cartId }, query: 'id' });
      if (!allowed || allowed.id !== input.cartId) throw new Error('Cart is outside current access');
      const resource = await current.sudo().query.Cart.findOne({ where: { id: input.cartId }, query: 'id organization { id } premises { id }' });
      assertFulfillmentScope(resource, fresh);
    },
  }, async (tx, operationAuthority) => {
    // Same namespaces/order as add/cancel/finalize; no provider call in this transaction.
    await tx.prisma.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'cannabis-cart', input.cartId);
    const currentAuthority = await requireOperationalAuthority(tx, 'canManageSales', 'sale');
    if (currentAuthority.organizationId !== operationAuthority.organizationId || currentAuthority.premisesId !== operationAuthority.premisesId) throw new Error('Operational authority changed');
    const sudo = tx.sudo();
    const now = new Date();
    const cart = await sudo.query.Cart.findOne({ where: { id: input.cartId }, query: `
      id reference version status expiresAt organization { id } premises { id }
      customer { id status capacity organization { id } premises { id } }
      eligibilityEvidence { id result capacity identityExpiresAt registryExpiresAt customer { id } organization { id } premises { id } }
      lines(take: ${MAX_FULFILLMENT_LINES + 1}) { id quantityMicrounits cart { id } package { id } organization { id } premises { id } }
    ` });
    assertFulfillmentScope(cart, currentAuthority);
    const groups = planCartPreparation(cart as FulfillmentCart, input.expectedVersion, input.nextStatus, currentAuthority, now);
    assertFulfillmentScope(cart.customer, currentAuthority);
    assertFulfillmentScope(cart.eligibilityEvidence, currentAuthority);
    const evidence = cart.eligibilityEvidence;
    if (cart.customer.status !== 'eligible' || !['adult_use', 'patient', 'caregiver'].includes(cart.customer.capacity) ||
        evidence.customer?.id !== cart.customer.id || evidence.capacity !== cart.customer.capacity || evidence.result !== 'eligible' ||
        !(new Date(evidence.identityExpiresAt).getTime() > now.getTime()) ||
        (cart.customer.capacity !== 'adult_use' && !(new Date(evidence.registryExpiresAt).getTime() > now.getTime()))) {
      throw new Error('Current customer evidence is required for cart preparation; this is not final eligibility verification');
    }
    for (const group of groups) {
      await tx.prisma.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'cannabis-package', group.packageId);
    }
    const packages = await sudo.query.InventoryPackage.findMany({
      where: { id: { in: groups.map(group => group.packageId) } }, take: MAX_FULFILLMENT_LINES + 1,
      query: 'id version status testStatus expiresAt quantityOnHandMicrounits reservedMicrounits coaReference labelVersion organization { id } premises { id } holds(where: { status: { equals: active } }, take: 1) { id }',
    });
    // Do not filter by scope or expiry here: that could hide conflicting allocations.
    const ledger = await sudo.query.CartLine.findMany({
      where: { package: { id: { in: groups.map(group => group.packageId) } }, cart: { status: { notIn: ['completed', 'cancelled'] } } },
      take: MAX_ALLOCATION_EVIDENCE_LINES + 1,
      query: 'id quantityMicrounits package { id } cart { id status organization { id } premises { id } } organization { id } premises { id }',
    });
    assertPreparationAllocationCoverage(cart as FulfillmentCart, ledger, packages, currentAuthority);
    for (const pkg of packages) {
      const group = groups.find(group => group.packageId === pkg.id)!;
      if (!Array.isArray(pkg.holds)) throw new Error('Package hold evidence is incomplete');
      assertReservedPackageForSale({ status: pkg.status, testStatus: pkg.testStatus, expiresAt: pkg.expiresAt,
        quantityOnHandMicrounits: pkg.quantityOnHandMicrounits, reservedMicrounits: pkg.reservedMicrounits,
        coaReference: pkg.coaReference, labelVersion: pkg.labelVersion,
        premisesId: pkg.premises.id, activeHoldCount: pkg.holds.length }, currentAuthority.premisesId, group.quantityMicrounits, now);
    }
    const changed = await tx.prisma.cart.updateMany({
      where: { id: cart.id, version: input.expectedVersion, status: cart.status,
        organizationId: currentAuthority.organizationId, premisesId: currentAuthority.premisesId },
      data: { status: input.nextStatus as 'reserved' | 'picking' | 'staged', version: { increment: 1 } },
    });
    if (changed.count !== 1) throw new Error('Cart preparation changed concurrently; refresh before retrying');
    // Controlled-operation helper persists this evidence and replay response atomically.
    return { id: cart.id, reference: cart.reference, status: input.nextStatus, version: input.expectedVersion + 1,
      beforeStatus: cart.status, beforeVersion: cart.version, reasonCode: input.reasonCode,
      packages: groups.map(group => ({ ...group, version: packages.find(pkg => pkg.id === group.packageId)!.version })),
      verification: 'preparation_only_not_sale_or_handoff' };
  });
}
