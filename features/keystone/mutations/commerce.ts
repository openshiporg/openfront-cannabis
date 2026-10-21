import { createHash, randomUUID } from "node:crypto";
import type { Context } from ".keystone/types";
import type { CartStatusType } from '@prisma/client';
import { assertEffectiveRulePack, assertEligibility, assertOperatingWindow, assertPackageSaleable, assertTenderAllowed, evaluatePurchaseLimits, purchaseLimitKey, type EffectiveRulePack } from "../domain/cannabisPolicy";
import { assertCartCancellationFence, assertReservationCanBeReleased, planCartCancellation } from "../domain/cartReservations";
import { assertFinalSaleCartFence, assertReservedPackageForSale, groupSaleLinesByPackage, planSaleLineBalances } from "../domain/saleConservation";
import { requireRuntimeCapability } from "../domain/runtimeCapabilities";
import { assertReservationLedger, choosePackageForProduct, planReservationBalances } from "../domain/packageAllocation";
import { calculateAllocationQuote, type AllocationQuotePackage } from "../domain/allocationQuote";
import { assertInteger, assertText, requireOperationalAuthority, requireRulePack, runControlledOperation, stableHash } from "./workflow";

import { serializableTransaction } from '../domain/transaction.ts';

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

type CancellationPackageSnapshot = {
  id: string;
  version: number;
  quantityOnHandMicrounits: number;
  reservedMicrounits: number;
  organization: { id: string } | null;
  premises: { id: string } | null;
};

type FinalSalePackageSnapshot = CancellationPackageSnapshot & {
  status: string;
  testStatus: string;
  expiresAt: string | Date;
  coaReference: string | null;
  labelVersion: string | null;
  unitOfMeasure: string;
  holds: Array<{ id: string }>;
};

function ageAt(dobValue: string | Date, now: Date) {
  const dob = new Date(dobValue); let age = now.getUTCFullYear() - dob.getUTCFullYear();
  if (now.getUTCMonth() < dob.getUTCMonth() || (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate())) age -= 1;
  return age;
}

function localMinute(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const hour = Number(parts.find(part => part.type === "hour")?.value); const minute = Number(parts.find(part => part.type === "minute")?.value);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) throw new Error("Premises timezone could not be evaluated");
  return hour * 60 + minute;
}

async function validateCustomerProof(context: Context, customerId: string, proof: string) {
  const customer = await context.sudo().query.Customer.findOne({ where: { id: customerId }, query: "id reference capacity status intakeProofHash organization { id } premises { id }" });
  if (!customer || !customer.intakeProofHash || customer.intakeProofHash !== hash(assertText(proof, "Customer proof", 32, 500))) throw new Error("Customer proof is invalid");
  return customer;
}

export async function createCustomerPickupCart(_root: unknown, args: { input: any }, context: Context) {
  requireRuntimeCapability("commerce.customer-cart", "Customer carts are disabled until owned account/intake continuity and server-side allocation are implemented.");
  const input = args.input; const customer = await validateCustomerProof(context, assertText(input.customerId, "Customer ID"), input.proof);
  if (customer.status !== "eligible") throw new Error("Customer is not currently eligible");
  const pack = await requireRulePack(context, customer.organization.id, customer.premises.id); assertEffectiveRulePack(pack as any);
  if (!pack.pickupEnabled) throw new Error("Pickup reservations are not enabled by the active rule pack");
  const evidence = await context.sudo().query.EligibilityEvidence.findMany({ where: { customer: { id: { equals: customer.id } }, result: { equals: "eligible" }, identityExpiresAt: { gt: new Date() } }, orderBy: [{ verifiedAt: "desc" }], take: 1, query: "id result registryExpiresAt capacity" });
  if (evidence.length !== 1 || (customer.capacity !== "adult_use" && (!evidence[0].registryExpiresAt || new Date(evidence[0].registryExpiresAt) <= new Date()))) throw new Error("Exactly one current eligibility decision is required");
  const existing = await context.sudo().query.Cart.findMany({ where: { customer: { id: { equals: customer.id } }, status: { in: ["preliminarily_eligible", "reserved", "picking", "staged"] }, expiresAt: { gt: new Date() } }, orderBy: [{ createdAt: "desc" }], take: 2, query: "id reference status expiresAt" });
  if (existing.length > 1) throw new Error("Multiple active carts require staff reconciliation");
  if (existing.length === 1) return { ...existing[0], proof: input.proof, replayed: true };
  const reference = `CART-${randomUUID()}`; const expiresAt = new Date(Date.now() + 15 * 60_000);
  const cart = await context.sudo().query.Cart.createOne({ data: { organization: { connect: { id: customer.organization.id } }, premises: { connect: { id: customer.premises.id } }, customer: { connect: { id: customer.id } }, reference, source: "pickup", status: "preliminarily_eligible", guestProofHash: hash(input.proof), expiresAt, rulePack: { connect: { id: pack.id } }, eligibilityEvidence: { connect: { id: evidence[0].id } } }, query: "id reference status expiresAt" });
  return { ...cart, proof: input.proof };
}

export async function createPosCannabisCart(_root: unknown, args: { input: any }, context: Context) {
  requireRuntimeCapability("commerce.pos-cart", "POS carts are disabled until the verified customer and register workflow is implemented.");
  const input = args.input;
  return runControlledOperation(context, input, { permission: "canManageSales", activity: "sale", scope: "createPosCannabisCart", resourceType: "Cart", action: "cart.pos.created", emitStateEvent: false }, async (tx, authority) => {
    const sudo = tx.sudo(); const pack = await requireRulePack(tx, authority.organizationId!, authority.premisesId!); assertEffectiveRulePack(pack as any);
    const customer = await sudo.query.Customer.findOne({ where: { id: assertText(input.customerId, "Customer ID") }, query: "id capacity status organization { id } premises { id }" });
    const evidence = await sudo.query.EligibilityEvidence.findOne({ where: { id: assertText(input.eligibilityEvidenceId, "Eligibility evidence ID") }, query: "id customer { id } result identityExpiresAt registryExpiresAt" });
    const shift = await sudo.query.RegisterShift.findOne({ where: { id: assertText(input.shiftId, "Shift ID") }, query: "id status organization { id } premises { id } operator { id }" });
    if (!customer || customer.status !== "eligible" || customer.organization?.id !== authority.organizationId || customer.premises?.id !== authority.premisesId) throw new Error("Customer is not currently eligible in this premises");
    if (!evidence || evidence.customer?.id !== customer.id || evidence.result !== "eligible" || new Date(evidence.identityExpiresAt) <= new Date() || (customer.capacity !== "adult_use" && (!evidence.registryExpiresAt || new Date(evidence.registryExpiresAt) <= new Date()))) throw new Error("Current eligibility evidence is required");
    if (!shift || shift.status !== "open" || shift.organization?.id !== authority.organizationId || shift.premises?.id !== authority.premisesId || shift.operator?.id !== authority.actor.id) throw new Error("Actor must own an open register shift");
    const cart = await sudo.query.Cart.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, customer: { connect: { id: customer.id } }, shift: { connect: { id: shift.id } }, reference: `CART-${randomUUID()}`, source: "pos", status: "preliminarily_eligible", expiresAt: new Date(Date.now() + 30 * 60_000), rulePack: { connect: { id: pack.id } }, eligibilityEvidence: { connect: { id: evidence.id } } }, query: "id reference status" });
    return { id: cart.id, status: cart.status, reference: cart.reference };
  });
}

const ALLOCATION_PACKAGE_SELECTION = "id packageUid productionBatchNumber unitOfMeasure status testStatus expiresAt quantityOnHandMicrounits reservedMicrounits coaReference labName labResultReference labVerifiedAt labelVersion potencySnapshot version organization { id } premises { id } holds(where: { status: { equals: active } }, take: 1) { id } product { id name sku unitOfMeasure categoryCode unitQuantityMicrounits equivalencyMicrounits priceCents taxCategoryCode adultUseEligible medicalEligible status organization { id } premises { id } }";

export async function cannabisCartAllocationQuote(_root: unknown, args: { input: unknown }, context: Context) {
  const authority = await requireOperationalAuthority(context, "canManageSales", "sale");
  if (!args.input || typeof args.input !== "object" || Array.isArray(args.input)) throw new Error("Allocation quote input is invalid");
  const input = args.input as Record<string, unknown>;
  const cartId = assertText(input.cartId, "Cart ID", 1, 100);
  const visible = await context.query.Cart.findOne({ where: { id: cartId }, query: "id" });
  if (!visible || visible.id !== cartId) throw new Error("Cart quote is outside current access");
  const cart = await context.sudo().query.Cart.findOne({ where: { id: cartId }, query: "id version status expiresAt organization { id } premises { id } customer { id capacity organization { id } premises { id } } eligibilityEvidence { id } shift { id } rulePack { id }" });
  if (!cart || cart.organization?.id !== authority.organizationId || cart.premises?.id !== authority.premisesId || cart.customer?.organization?.id !== authority.organizationId || cart.customer?.premises?.id !== authority.premisesId) throw new Error("Cart quote relationships are outside current authority");
  // A quote is only for an open cart that can still take lines.
  if (!["preliminarily_eligible", "reserved"].includes(cart.status) || !(new Date(cart.expiresAt).getTime() > Date.now())) throw new Error("This cart is closed or expired");
  const productId = assertText(input.productId, "Product ID", 1, 100);
  const quantity = assertInteger(input.quantityMicrounits, "Quantity", 1);
  const candidates = await context.sudo().query.InventoryPackage.findMany({ where: { organization: { id: { equals: authority.organizationId } }, premises: { id: { equals: authority.premisesId } }, product: { id: { equals: productId } }, status: { equals: "saleable" } }, orderBy: [{ expiresAt: "asc" }, { id: "asc" }], take: 51, query: ALLOCATION_PACKAGE_SELECTION });
  const id = choosePackageForProduct(candidates, authority, productId, quantity);
  const pkg = candidates.find(candidate => candidate.id === id)!;
  const pack = await requireRulePack(context, authority.organizationId, authority.premisesId);
  assertEffectiveRulePack(pack as EffectiveRulePack);
  if (!(new Date(pack.effectiveAt).getTime() <= Date.now()) || !(new Date(pack.expiresAt).getTime() > Date.now()) || cart.rulePack?.id !== pack.id) throw new Error("Current configured cart policy is unavailable");
  const quote = calculateAllocationQuote(pkg as AllocationQuotePackage, { id: cart.id, version: cart.version, customer: { capacity: cart.customer.capacity } }, pack as EffectiveRulePack, quantity, input.promotionCode ? assertText(input.promotionCode, "Promotion code", 1, 100) : null, { organizationId: authority.organizationId, premisesId: authority.premisesId, actor: { id: authority.actor.id } });
  // Bind the reviewed subject, evidence and shift so a quote for one customer cannot stand in for another.
  const boundQuote = { ...quote, customerId: cart.customer.id, eligibilityEvidenceId: cart.eligibilityEvidence?.id ?? null, shiftId: cart.shift?.id ?? null,
    currencyCode: authority.actor.premises?.currencyCode ?? null, cartExpiresAt: new Date(cart.expiresAt).toISOString(), observedAt: new Date().toISOString() };
  return { quote: boundQuote, quoteHash: stableHash(boundQuote), packagesHasMore: candidates.length > 50,
    reservationReadiness: "Price quote only. It does not reserve stock or confirm eligibility; adding items to a cart is not available yet." };
}

export async function addCannabisCartLine(_root: unknown, args: { input: unknown }, context: Context) {
  requireRuntimeCapability("commerce.reservation-ledger", "Cart reservations remain disabled pending complete ownership/replay semantics and PostgreSQL concurrency verification.");
  // Guest allocation requires the owned identity/purpose/delegation contract,
  // not a cached role bit or an arbitrary customer+proof pair.
  const staffAuthority = await requireOperationalAuthority(context, "canManageSales", "sale");
  if (!args.input || typeof args.input !== "object" || Array.isArray(args.input)) throw new Error("Allocation input is invalid");
  const raw = args.input as Record<string, unknown>;
  if (raw.packageId != null || raw.priceCents != null || raw.actorId != null || raw.proof != null) throw new Error("Allocation authority and package/price choice are server-owned; owned guest/delegation contracts require separate review");
  const input = { cartId: assertText(raw.cartId, "Cart ID", 1, 100), productId: assertText(raw.productId, "Product ID", 1, 100),
    quantityMicrounits: assertInteger(raw.quantityMicrounits, "Quantity", 1),
    expectedCartVersion: assertInteger(raw.expectedCartVersion, "Expected cart version", 1, 2_147_483_646),
    reviewedQuoteHash: assertText(raw.reviewedQuoteHash, "Reviewed quote hash", 64, 64),
    promotionCode: raw.promotionCode ? assertText(raw.promotionCode, "Promotion code", 1, 100) : null,
    idempotencyKey: assertText(raw.idempotencyKey, "Idempotency key", 8, 99) };
  const quantity = input.quantityMicrounits;
  const allowed = await context.query.Cart.findOne({ where: { id: input.cartId }, query: "id" });
  if (!allowed || allowed.id !== input.cartId) throw new Error("Cart is outside current access");
  const cart = await context.sudo().query.Cart.findOne({ where: { id: input.cartId }, query: "id organization { id } premises { id }" });
  if (!cart || staffAuthority.organizationId !== cart.organization?.id || staffAuthority.premisesId !== cart.premises?.id) throw new Error("Cart is outside current staff authority");
  const operationKey = `${cart.id}:${input.idempotencyKey}`;
  return runControlledOperation(context, { ...input, idempotencyKey: operationKey }, {
    permission: "canManageSales", activity: "sale", scope: "addCannabisCartLine", resourceType: "CartLine", action: "cart.line.reserved", emitStateEvent: false,
    authorize: async (current, authority, phase, result) => {
      const readable = await current.query.Cart.findOne({ where: { id: input.cartId }, query: "id" });
      if (!readable || readable.id !== input.cartId) throw new Error("Cart is outside current access");
      const resource = await current.sudo().query.Cart.findOne({ where: { id: input.cartId }, query: "id organization { id } premises { id }" });
      if (!resource || resource.organization?.id !== authority.organizationId || resource.premises?.id !== authority.premisesId) throw new Error("Cart is outside current allocation authority");
      if (phase === "replay") {
        // The acknowledged line must still belong to the requested cart and product.
        const line = result ? await current.sudo().query.CartLine.findOne({ where: { id: String(result.id) }, query: "id cart { id } product { id }" }) : null;
        if (!line || line.cart?.id !== input.cartId || line.product?.id !== input.productId) throw new Error("Original allocation no longer matches this cart");
      }
    },
  }, async (tx, currentAuthority, correlationId) => {
    await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "cannabis-cart", cart.id);
    await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "cannabis-policy", `${currentAuthority.organizationId}:${currentAuthority.premisesId}`);
    const sudo = tx.sudo();
    const currentCart = await sudo.query.Cart.findOne({ where: { id: cart.id }, query: "id status expiresAt guestProofHash version organization { id } premises { id } customer { id capacity } rulePack { id } lines(take: 250) { id categoryCodeSnapshot equivalencyMicrounits }" });
    const legacy = await sudo.query.CartLine.findOne({ where: { idempotencyKey: operationKey }, query: "id" });
    if (legacy) throw new Error("Legacy allocation has no original full command receipt; review is required, not a replacement key");
    if (!currentCart || currentCart.version !== input.expectedCartVersion || !["preliminarily_eligible", "reserved"].includes(currentCart.status) || !(new Date(currentCart.expiresAt).getTime() > Date.now())) throw new Error("Active current-version cart is required");
    if ((currentCart.lines || []).length >= 249) throw new Error("Cart line bound reached");
    if (currentAuthority.organizationId !== currentCart.organization?.id || currentAuthority.premisesId !== currentCart.premises?.id || !currentCart.customer) throw new Error("Cart is outside current staff authority");
    await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "cannabis-customer-purchase-window", `${currentAuthority.organizationId}:${currentAuthority.premisesId}:${currentCart.customer.id}`);
    const pack = await requireRulePack(tx, currentCart.organization.id, currentCart.premises.id);
    assertEffectiveRulePack(pack as EffectiveRulePack);
    if (currentCart.rulePack?.id !== pack.id) throw new Error("Cart rule pack is stale");
    const candidates = await sudo.query.InventoryPackage.findMany({ where: { organization: { id: { equals: currentAuthority.organizationId } }, premises: { id: { equals: currentAuthority.premisesId } }, product: { id: { equals: input.productId } }, status: { equals: "saleable" } }, orderBy: [{ expiresAt: "asc" }, { id: "asc" }], take: 51, query: ALLOCATION_PACKAGE_SELECTION });
    const packageId = choosePackageForProduct(candidates, currentAuthority, input.productId, quantity);
    await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "cannabis-package", packageId);
    const pkg = await sudo.query.InventoryPackage.findOne({ where: { id: packageId }, query: ALLOCATION_PACKAGE_SELECTION });
    if (!pkg || pkg.organization?.id !== currentCart.organization.id || pkg.premises?.id !== currentCart.premises.id || !pkg.product || pkg.product.status !== "active") throw new Error("Package is outside cart authority");
    assertPackageSaleable({ status: pkg.status, testStatus: pkg.testStatus, expiresAt: pkg.expiresAt, premisesId: pkg.premises.id, quantityOnHandMicrounits: pkg.quantityOnHandMicrounits, reservedMicrounits: pkg.reservedMicrounits, activeHoldCount: pkg.holds?.length || 0, coaReference: pkg.coaReference, labelVersion: pkg.labelVersion }, currentCart.premises.id, quantity);
    if (pkg.product.id !== input.productId || pkg.product.organization?.id !== currentAuthority.organizationId || pkg.product.premises?.id !== currentAuthority.premisesId) throw new Error("Product is outside current allocation authority");
    const quote = calculateAllocationQuote(pkg as AllocationQuotePackage, { id: currentCart.id, version: currentCart.version, customer: { capacity: currentCart.customer.capacity } }, pack as EffectiveRulePack, quantity, input.promotionCode, { organizationId: currentAuthority.organizationId, premisesId: currentAuthority.premisesId, actor: { id: currentAuthority.actor.id } });
    const quoteHash = stableHash(quote);
    if (input.reviewedQuoteHash !== quoteHash) throw new Error("Reviewed quote changed; retain the original command and review a separate new intent");
    const { subtotalCents, discountCents, discountSnapshot, taxCents, totalCents, equivalencyMicrounits } = quote;
    const balances = planReservationBalances(pkg.quantityOnHandMicrounits, pkg.reservedMicrounits, quantity);
    const ledger = await sudo.query.CartLine.findMany({ where: { package: { id: { equals: pkg.id } }, cart: { status: { in: ["preliminarily_eligible", "reserved", "picking", "staged", "final_verification"] } } }, take: 501,
      query: "id quantityMicrounits organization { id } premises { id } package { id } cart { id status organization { id } premises { id } }" });
    assertReservationLedger(ledger, pkg.id, pkg.reservedMicrounits, currentAuthority);
    const categoryTotals: Record<string, number> = Object.create(null);
    if (!Array.isArray(currentCart.lines)) throw new Error("Complete cart limit evidence is required");
    for (const line of currentCart.lines) {
      if (!line.categoryCodeSnapshot || !Number.isSafeInteger(line.equivalencyMicrounits) || line.equivalencyMicrounits < 1) throw new Error("Cart equivalency evidence is invalid");
      categoryTotals[line.categoryCodeSnapshot] = (categoryTotals[line.categoryCodeSnapshot] || 0) + line.equivalencyMicrounits;
      if (!Number.isSafeInteger(categoryTotals[line.categoryCodeSnapshot])) throw new Error("Cart equivalency total exceeds safe integer range");
    }
    categoryTotals[pkg.product.categoryCode] = (categoryTotals[pkg.product.categoryCode] || 0) + equivalencyMicrounits;
    // Current schema lacks approved day/allotment subject-window provenance.
    // Never substitute empty history for those contracts or expired reservations.
    if (pack.purchaseLimits.some((rule: { capacity: string; window: string }) => rule.capacity === currentCart.customer.capacity && rule.window !== "transaction")) throw new Error("Configured prior-window consumption and pending-allocation evidence contract is required; no empty history is assumed");
    evaluatePurchaseLimits({ capacity: currentCart.customer.capacity, categoryTotals, priorWindowTotals: Object.create(null) }, pack as EffectiveRulePack);
    const claimed = await tx.prisma.inventoryPackage.updateMany({ where: { id: pkg.id, organizationId: currentAuthority.organizationId, premisesId: currentAuthority.premisesId, status: "saleable", quantityOnHandMicrounits: balances.beforeQuantityMicrounits, version: pkg.version, reservedMicrounits: balances.beforeReservedMicrounits }, data: { reservedMicrounits: balances.afterReservedMicrounits, version: { increment: 1 } } });
    if (claimed.count !== 1) throw new Error("Package reservation changed concurrently");
    const line = await sudo.query.CartLine.createOne({ data: { organization: { connect: { id: currentCart.organization.id } }, premises: { connect: { id: currentCart.premises.id } }, cart: { connect: { id: currentCart.id } }, idempotencyKey: operationKey, package: { connect: { id: pkg.id } }, product: { connect: { id: pkg.product.id } }, quantityMicrounits: quantity, equivalencyMicrounits, titleSnapshot: pkg.product.name, skuSnapshot: pkg.product.sku, categoryCodeSnapshot: pkg.product.categoryCode, packageUidSnapshot: pkg.packageUid, batchSnapshot: pkg.productionBatchNumber, potencySnapshot: pkg.potencySnapshot, unitPriceCents: pkg.product.priceCents, subtotalCents, discountCents, discountSnapshot, taxBasisPoints: quote.taxBasisPoints, taxCents, totalCents }, query: "id totalCents" });
    await sudo.query.InventoryEvent.createOne({ data: {
      organization: { connect: { id: currentAuthority.organizationId } }, premises: { connect: { id: currentAuthority.premisesId } }, package: { connect: { id: pkg.id } },
      eventType: "reserve", quantityDeltaMicrounits: 0, beforeQuantityMicrounits: balances.beforeQuantityMicrounits, afterQuantityMicrounits: balances.afterQuantityMicrounits,
      reasonCode: "cart_reservation", actor: { connect: { id: currentAuthority.actor.id } }, sourceType: "CartLine", sourceId: line.id,
      idempotencyKey: `${operationKey}:reserve`, occurredAt: new Date(), evidenceHash: stableHash({ quote, balances, cartLineId: line.id, correlationId }), stateReportStatus: "local_recorded",
    }, query: "id" });
    const totals = await sudo.query.CartLine.findMany({ where: { cart: { id: { equals: currentCart.id } } }, take: 250, query: "subtotalCents discountCents taxCents totalCents" });
    if (totals.length >= 250) throw new Error("Cart line bound reached");
    const sum = (field: string) => totals.reduce((total, entry) => {
      if (!Number.isSafeInteger(entry[field]) || entry[field] < 0 || !Number.isSafeInteger(total + entry[field]) || total + entry[field] > 2_147_483_647) throw new Error("Cart monetary evidence exceeds integer storage range");
      return total + entry[field];
    }, 0);
    const cartUpdated = await tx.prisma.cart.updateMany({ where: { id: currentCart.id, organizationId: currentAuthority.organizationId, premisesId: currentAuthority.premisesId, version: currentCart.version, status: currentCart.status }, data: { status: "reserved", subtotalCents: sum("subtotalCents"), discountCents: sum("discountCents"), taxCents: sum("taxCents"), totalCents: sum("totalCents"), version: { increment: 1 } } });
    if (cartUpdated.count !== 1) throw new Error("Cart state changed concurrently");
    return { id: line.id, status: "reserved", cartId: currentCart.id, version: currentCart.version + 1, totalCents: line.totalCents, quote, quoteHash, balances };
  });
}

export async function cancelCannabisCart(_root: unknown, args: { input: any }, context: Context) {
  requireRuntimeCapability("commerce.reservation-ledger", "Cart cancellation is disabled until PostgreSQL concurrency, rollback, and replay behavior are verified.");
  const input = args.input;
  const cancellationKey = assertText(input.idempotencyKey, "Idempotency key", 8, 200);
  const cancellationReason = assertText(input.reasonCode || "cart_cancelled", "Cancellation reason");
  const cart = await context.sudo().query.Cart.findOne({
    where: { id: assertText(input.cartId, "Cart ID") },
    query: "id reference status guestProofHash organization { id } premises { id }",
  });
  if (!cart) throw new Error("Cart is not found");
  let actor: any = null;
  const staff = Boolean((context.session as any)?.data?.role?.canManageSales);
  if (staff) {
    const authority = await requireOperationalAuthority(context, "canManageSales", "sale");
    if (authority.organizationId !== cart.organization.id || authority.premisesId !== cart.premises.id) throw new Error("Cart is outside current staff authority");
    actor = authority.actor;
  } else if (!input.proof || cart.guestProofHash !== hash(input.proof)) {
    throw new Error("Cart ownership proof is invalid");
  }
  if (cart.status === "cancelled") return { id: cart.id, status: "cancelled", reference: cart.reference, replayed: true };

  return serializableTransaction(context, async tx => {
    await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "cannabis-cart", cart.id);
    const sudo = tx.sudo();
    const currentCart = await sudo.query.Cart.findOne({
      where: { id: cart.id },
      query: "id reference status guestProofHash version organization { id } premises { id } lines(take: 251) { id quantityMicrounits package { id } }",
    });
    if (!currentCart) throw new Error("Cart is not found");
    if (currentCart.organization?.id !== cart.organization.id || currentCart.premises?.id !== cart.premises.id) throw new Error("Cart authority scope changed concurrently");
    if (staff) {
      if (actor?.organization?.id !== currentCart.organization.id || actor?.premises?.id !== currentCart.premises.id) throw new Error("Cart is outside current staff authority");
    } else if (!input.proof || currentCart.guestProofHash !== hash(input.proof)) {
      throw new Error("Cart ownership proof is invalid");
    }

    const plan = planCartCancellation({ id: currentCart.id, status: currentCart.status, version: currentCart.version, lines: currentCart.lines });
    if (plan.disposition === "replay") return { id: currentCart.id, status: "cancelled", reference: currentCart.reference, replayed: true };
    for (const release of plan.releases) {
      await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "cannabis-package", release.packageId);
    }

    const packageSnapshots = new Map<string, CancellationPackageSnapshot>();
    for (const release of plan.releases) {
      const pkg = await sudo.query.InventoryPackage.findOne({
        where: { id: release.packageId },
        query: "id version quantityOnHandMicrounits reservedMicrounits organization { id } premises { id }",
      });
      if (!pkg || pkg.organization?.id !== currentCart.organization.id || pkg.premises?.id !== currentCart.premises.id) throw new Error("Package is outside cart authority");
      assertReservationCanBeReleased(pkg.reservedMicrounits, release.quantityMicrounits);
      packageSnapshots.set(release.packageId, pkg as CancellationPackageSnapshot);
    }

    for (const release of plan.releases) {
      const pkg = packageSnapshots.get(release.packageId)!;
      const released = await tx.prisma.inventoryPackage.updateMany({
        where: {
          id: release.packageId,
          version: pkg.version,
          quantityOnHandMicrounits: pkg.quantityOnHandMicrounits,
          reservedMicrounits: { equals: pkg.reservedMicrounits, gte: release.quantityMicrounits },
        },
        data: { reservedMicrounits: { decrement: release.quantityMicrounits }, version: { increment: 1 } },
      });
      if (released.count !== 1) throw new Error("Concurrent reservation release detected");
    }

    const cartFence = await sudo.query.Cart.findOne({ where: { id: currentCart.id }, query: "id status version" });
    if (!cartFence) throw new Error("Cart is not found");
    assertCartCancellationFence(plan, { id: cartFence.id, status: cartFence.status, version: cartFence.version });
    const transitioned = await tx.prisma.cart.updateMany({
      where: { id: plan.cartId, version: plan.expectedVersion, status: plan.expectedStatus as CartStatusType },
      data: { status: "cancelled", version: { increment: 1 } },
    });
    if (transitioned.count !== 1) throw new Error("Cart state changed concurrently");

    const occurredAt = new Date();
    for (const release of plan.releases) {
      const pkg = packageSnapshots.get(release.packageId)!;
      const reservedAfter = assertReservationCanBeReleased(pkg.reservedMicrounits, release.quantityMicrounits);
      await sudo.query.InventoryEvent.createOne({
        data: {
          organization: { connect: { id: currentCart.organization.id } },
          premises: { connect: { id: currentCart.premises.id } },
          package: { connect: { id: release.packageId } },
          eventType: "release_reservation",
          quantityDeltaMicrounits: 0,
          beforeQuantityMicrounits: pkg.quantityOnHandMicrounits,
          afterQuantityMicrounits: pkg.quantityOnHandMicrounits,
          reasonCode: cancellationReason,
          ...(actor ? { actor: { connect: { id: actor.id } } } : {}),
          sourceType: "Cart",
          sourceId: currentCart.id,
          idempotencyKey: `cancel:${currentCart.id}:${release.packageId}:${hash(cancellationKey)}`,
          occurredAt,
          evidenceHash: stableHash({ cartId: currentCart.id, packageId: release.packageId, lineIds: release.lineIds, reservedBefore: pkg.reservedMicrounits, releasedMicrounits: release.quantityMicrounits, reservedAfter, cancellationKey }),
          stateReportStatus: "local_recorded",
        },
        query: "id",
      });
    }
    await sudo.query.AuditEvent.createOne({
      data: {
        organization: { connect: { id: currentCart.organization.id } },
        premises: { connect: { id: currentCart.premises.id } },
        ...(actor ? { actor: { connect: { id: actor.id } } } : {}),
        action: "cart.cancelled",
        resourceType: "Cart",
        resourceId: currentCart.id,
        correlationId: cancellationKey,
        reasonCode: cancellationReason,
        evidence: { releasedLines: plan.releasedLines, releasedPackages: plan.releases.length, releasedMicrounits: plan.totalReleasedMicrounits },
        evidenceHash: stableHash({ cartId: currentCart.id, status: "cancelled", cancellationKey, releases: plan.releases }),
        occurredAt,
      },
      query: "id",
    });
    return { id: currentCart.id, status: "cancelled", reference: currentCart.reference };
  }, 20_000);
}

export async function finalizeCannabisSale(_root: unknown, args: { input: any }, context: Context) {
  requireRuntimeCapability("commerce.sale-finalization", "Sale finalization remains disabled pending PostgreSQL conservation/race proof, current eligibility verification, authenticated provider acceptance, and supported tender execution.");
  requireRuntimeCapability("provider.traceability-acceptance", "Traceability acceptance is disabled until an authenticated provider acknowledgment is verified and linked to this premises.");
  const input = args.input;
  const cartId = assertText(input.cartId, "Cart ID");
  return runControlledOperation(context, input, { permission: "canManageSales", activity: "sale", scope: "finalizeCannabisSale", resourceType: "Sale", action: "sale.finalized", lockKeys: [cartId] }, async (tx, authority, correlationId) => {
    await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "cannabis-cart", cartId);
    const sudo = tx.sudo(); const now = new Date(); const pack = await requireRulePack(tx, authority.organizationId!, authority.premisesId!); assertEffectiveRulePack(pack as any, now); assertOperatingWindow(pack as any, localMinute(now, authority.actor.premises.timezone));
    if (pack.offlineSalesAllowed !== false) throw new Error("Bounded launch requires offline regulated sales to remain disabled");
    const traceability = await sudo.query.IntegrationInstallation.findMany({ where: { organization: { id: { equals: authority.organizationId } }, premises: { id: { equals: authority.premisesId } }, providerType: { equals: "traceability" }, status: { equals: "active" } }, take: 2, query: "id providerCode validatedAt authorityReference" });
    if (traceability.length !== 1 || !traceability[0].validatedAt) throw new Error("Exactly one externally validated active traceability installation is required before sale");
    const cart = await sudo.query.Cart.findOne({ where: { id: cartId }, query: "id reference status expiresAt totalCents subtotalCents discountCents taxCents version organization { id } premises { id } shift { id status operator { id } } customer { id capacity status } eligibilityEvidence { id result capacity dateOfBirth identityExpiresAt registryExpiresAt evidenceHash allotmentRemainingMicrounits } rulePack { id version } lines(take: 251) { id package { id version status testStatus expiresAt unitOfMeasure premises { id } quantityOnHandMicrounits reservedMicrounits coaReference labelVersion holds(where: { status: { equals: active } }, take: 1) { id } } product { id categoryCode } titleSnapshot skuSnapshot categoryCodeSnapshot packageUidSnapshot batchSnapshot potencySnapshot quantityMicrounits equivalencyMicrounits unitPriceCents discountCents discountSnapshot taxCents totalCents }" });
    if (!cart || cart.organization?.id !== authority.organizationId || cart.premises?.id !== authority.premisesId || cart.status !== "reserved" || new Date(cart.expiresAt) <= now || cart.rulePack?.id !== pack.id) throw new Error("Reserved cart is stale or outside current authority");
    if (!cart.shift || cart.shift.status !== "open" || cart.shift.operator?.id !== authority.actor.id) throw new Error("Actor must own the cart's open register shift");
    const evidence = cart.eligibilityEvidence; if (!evidence || evidence.result !== "eligible" || evidence.capacity !== cart.customer.capacity || new Date(evidence.identityExpiresAt) <= now) throw new Error("Current eligibility evidence is required at final verification");
    assertEligibility({ capacity: cart.customer.capacity, age: ageAt(evidence.dateOfBirth, now), identityValid: true, registryValid: cart.customer.capacity === "adult_use" || Boolean(evidence.registryExpiresAt && new Date(evidence.registryExpiresAt) > now), representedPatientValid: cart.customer.capacity !== "caregiver" || Boolean(input.representedPatientVerified) }, pack as any);
    const salePackageGroups = groupSaleLinesByPackage(cart.lines);
    const categoryTotals: Record<string, number> = {}; for (const line of cart.lines) categoryTotals[line.categoryCodeSnapshot] = (categoryTotals[line.categoryCodeSnapshot] || 0) + line.equivalencyMicrounits;
    const priorSales = await sudo.query.Sale.findMany({ where: { customer: { id: { equals: cart.customer.id } }, finalizedAt: { gte: new Date(now.getTime() - 366 * 86400_000) }, status: { in: ["finalized", "state_queued", "state_accepted", "state_rejected", "reconciled", "partially_refunded"] } }, orderBy: [{ finalizedAt: "desc" }], take: 1001, query: "finalizedAt lines { categoryCodeSnapshot equivalencyMicrounits }" });
    if (priorSales.length > 1000) throw new Error("Purchase history exceeds bounded automatic evaluation and requires compliance review");
    const priorWindowTotals: Record<string, number> = {};
    for (const rule of pack.purchaseLimits as any[]) {
      const windowMs = rule.window === "day" ? 86400_000 : rule.window === "rolling" ? assertInteger(rule.windowDays, "Rolling limit days", 1, 366) * 86400_000 : rule.window === "allotment" ? 366 * 86400_000 : 0;
      if (!windowMs) continue;
      priorWindowTotals[purchaseLimitKey(rule)] = priorSales.filter(sale => now.getTime() - new Date(sale.finalizedAt).getTime() < windowMs).flatMap(sale => sale.lines || []).filter(line => line.categoryCodeSnapshot === rule.categoryCode).reduce((sum, line) => sum + line.equivalencyMicrounits, 0);
    }
    const limitDecision = evaluatePurchaseLimits({ capacity: cart.customer.capacity, categoryTotals, priorWindowTotals }, pack as any);
    if (cart.customer.capacity !== "adult_use" && evidence.allotmentRemainingMicrounits != null && Object.values(categoryTotals).reduce((a, b) => a + b, 0) > evidence.allotmentRemainingMicrounits) throw new Error("Patient or caregiver allotment is insufficient");
    const tenders = input.tenders; if (!Array.isArray(tenders) || tenders.length < 1 || tenders.length > 10) throw new Error("Sale requires 1-10 tenders");
    let tenderTotal = 0; const tenderConfigs: any[] = [];
    for (const tender of tenders) {
      const amount = assertInteger(tender.amountCents, "Tender amount", 0); assertTenderAllowed(tender.type, amount, cart.totalCents, pack.allowedTenderTypes); tenderTotal += amount;
      if (tender.type !== "cash") requireRuntimeCapability("provider.payment-capture", "Electronic tenders are disabled until a trusted payment adapter confirms capture and settlement.");
      const tenderedCents = assertInteger(tender.tenderedCents ?? amount, "Tendered cents", amount);
      const changeCents = assertInteger(tender.changeCents ?? 0, "Change cents", 0);
      if (tender.type === "cash" && tenderedCents - changeCents !== amount) throw new Error("Cash tendered less change must equal the applied tender amount");
      if (tender.type !== "cash" && (tenderedCents !== amount || changeCents !== 0)) throw new Error("Non-cash tender must match its applied amount exactly");
      const configurations = await sudo.query.TenderConfiguration.findMany({ where: { organization: { id: { equals: authority.organizationId } }, premises: { id: { equals: authority.premisesId } }, type: { equals: tender.type }, enabled: { equals: true }, effectiveAt: { lte: now }, expiresAt: { gt: now } }, take: 2, query: "id code type providerCode" });
      if (configurations.length !== 1) throw new Error("Exactly one current tender configuration is required"); tenderConfigs.push(configurations[0]);
    }
    if (tenderTotal !== cart.totalCents) throw new Error("Tender total must exactly equal sale total in integer cents");
    const salePackageSnapshots = new Map<string, FinalSalePackageSnapshot>();
    const saleLineBalances = new Map<number, { before: number; after: number }>();
    for (const group of salePackageGroups) {
      await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "cannabis-package", group.packageId);
    }
    for (const group of salePackageGroups) {
      const pkg = await sudo.query.InventoryPackage.findOne({
        where: { id: group.packageId },
        query: "id version status testStatus expiresAt unitOfMeasure quantityOnHandMicrounits reservedMicrounits coaReference labelVersion organization { id } premises { id } holds(where: { status: { equals: active } }, take: 1) { id }",
      });
      if (!pkg || pkg.organization?.id !== authority.organizationId || pkg.premises?.id !== authority.premisesId || pkg.premises?.id !== cart.premises?.id) throw new Error("Package is outside current sale authority");
      assertReservedPackageForSale({
        status: pkg.status,
        testStatus: pkg.testStatus,
        expiresAt: pkg.expiresAt,
        premisesId: pkg.premises.id,
        quantityOnHandMicrounits: pkg.quantityOnHandMicrounits,
        reservedMicrounits: pkg.reservedMicrounits,
        activeHoldCount: pkg.holds?.length || 0,
        coaReference: pkg.coaReference,
        labelVersion: pkg.labelVersion,
      }, authority.premisesId!, group.quantityMicrounits, now);
      salePackageSnapshots.set(group.packageId, pkg as FinalSalePackageSnapshot);
      for (const balance of planSaleLineBalances(cart.lines, group, pkg.quantityOnHandMicrounits)) {
        saleLineBalances.set(balance.lineIndex, { before: balance.before, after: balance.after });
      }
    }
    const receiptNumber = `SALE-${randomUUID()}`;
    const receiptSnapshot = { receiptNumber, finalizedAt: now.toISOString(), currencyCode: authority.actor.premises?.currencyCode ?? null, licenseNumber: authority.license.licenseNumber, premisesId: authority.premisesId, customerCapacity: cart.customer.capacity, rulePackVersion: pack.version, lines: cart.lines.map((line: any) => ({ title: line.titleSnapshot, sku: line.skuSnapshot, packageUid: line.packageUidSnapshot, batch: line.batchSnapshot, quantityMicrounits: line.quantityMicrounits, unitPriceCents: line.unitPriceCents, discountCents: line.discountCents, discountSnapshot: line.discountSnapshot, taxCents: line.taxCents, totalCents: line.totalCents })), subtotalCents: cart.subtotalCents, discountCents: cart.discountCents, taxCents: cart.taxCents, totalCents: cart.totalCents, tenders: tenders.map((tender: any) => ({ type: tender.type, amountCents: tender.amountCents, changeCents: tender.changeCents ?? 0 })) };
    const labelSnapshot = { rulePackVersion: pack.version, requirements: pack.labelRequirements, lines: cart.lines.map((line: any) => { const pkg = salePackageSnapshots.get(line.package.id)!; return { packageUid: line.packageUidSnapshot, batch: line.batchSnapshot, potency: line.potencySnapshot, coaReference: pkg.coaReference, labelVersion: pkg.labelVersion }; }) };
    const sale = await sudo.query.Sale.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, shift: { connect: { id: cart.shift.id } }, customer: { connect: { id: cart.customer.id } }, cart: { connect: { id: cart.id } }, receiptNumber, status: "state_queued", customerCapacitySnapshot: cart.customer.capacity, rulePackVersion: pack.version, eligibilityEvidenceHash: evidence.evidenceHash, purchaseLimitEvaluation: limitDecision, subtotalCents: cart.subtotalCents, discountCents: cart.discountCents, taxCents: cart.taxCents, totalCents: cart.totalCents, finalizedAt: now, receiptSnapshot, receiptHash: stableHash(receiptSnapshot), labelSnapshot, labelHash: stableHash(labelSnapshot) }, query: "id receiptNumber status" });
    for (const group of salePackageGroups) {
      const pkg = salePackageSnapshots.get(group.packageId)!;
      const consumed = await tx.prisma.inventoryPackage.updateMany({
        where: {
          id: group.packageId,
          version: pkg.version,
          quantityOnHandMicrounits: pkg.quantityOnHandMicrounits,
          reservedMicrounits: { equals: pkg.reservedMicrounits, gte: group.quantityMicrounits },
        },
        data: {
          quantityOnHandMicrounits: { decrement: group.quantityMicrounits },
          reservedMicrounits: { decrement: group.quantityMicrounits },
          version: { increment: 1 },
          ...(pkg.quantityOnHandMicrounits === group.quantityMicrounits ? { status: "depleted" } : {}),
        },
      });
      if (consumed.count !== 1) throw new Error("Concurrent exact-package sale detected");
    }
    for (const [index, line] of cart.lines.entries()) {
      const pkg = salePackageSnapshots.get(line.package.id)!;
      const balance = saleLineBalances.get(index);
      if (!balance) throw new Error("Sale line quantity conservation is incomplete");
      const saleLine = await sudo.query.SaleLine.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, sale: { connect: { id: sale.id } }, package: { connect: { id: line.package.id } }, titleSnapshot: line.titleSnapshot, skuSnapshot: line.skuSnapshot, categoryCodeSnapshot: line.categoryCodeSnapshot, packageUidSnapshot: line.packageUidSnapshot, batchSnapshot: line.batchSnapshot, coaReferenceSnapshot: pkg.coaReference, potencySnapshot: line.potencySnapshot, quantityMicrounits: line.quantityMicrounits, equivalencyMicrounits: line.equivalencyMicrounits, unitPriceCents: line.unitPriceCents, discountCents: line.discountCents, discountSnapshot: line.discountSnapshot, taxCents: line.taxCents, totalCents: line.totalCents }, query: "id" });
      await sudo.query.InventoryEvent.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, package: { connect: { id: line.package.id } }, eventType: "sale", quantityDeltaMicrounits: -line.quantityMicrounits, beforeQuantityMicrounits: balance.before, afterQuantityMicrounits: balance.after, reasonCode: "sale", actor: { connect: { id: authority.actor.id } }, sourceType: "SaleLine", sourceId: saleLine.id, idempotencyKey: `${correlationId}:line:${index}`, occurredAt: now, evidenceHash: stableHash({ saleId: sale.id, saleLineId: saleLine.id, packageId: line.package.id, before: balance.before, after: balance.after }), stateReportStatus: "queued" }, query: "id" });
    }
    for (const [index, tender] of tenders.entries()) await sudo.query.Tender.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, sale: { connect: { id: sale.id } }, configuration: { connect: { id: tenderConfigs[index].id } }, typeSnapshot: tender.type, amountCents: tender.amountCents, tenderedCents: tender.tenderedCents ?? tender.amountCents, changeCents: tender.changeCents ?? 0, status: "received", providerReference: null, idempotencyKey: `${correlationId}:tender:${index}`, evidenceHash: stableHash(tender) }, query: "id" });
    await sudo.query.CashEvent.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, shift: { connect: { id: cart.shift.id } }, type: "sale", amountCents: tenders.filter((t: any) => t.type === "cash").reduce((sum: number, tender: any) => sum + tender.amountCents, 0), reasonCode: "sale", actor: { connect: { id: authority.actor.id } }, occurredAt: now, idempotencyKey: `${correlationId}:cash`, evidenceHash: stableHash({ saleId: sale.id }) }, query: "id" });
    const cartFence = await sudo.query.Cart.findOne({ where: { id: cart.id }, query: "id status version" });
    if (!cartFence) throw new Error("Reserved cart is missing during finalization");
    assertFinalSaleCartFence({ id: cart.id, status: cart.status, version: cart.version }, { id: cartFence.id, status: cartFence.status, version: cartFence.version });
    const completed = await tx.prisma.cart.updateMany({ where: { id: cart.id, version: cart.version, status: "reserved" }, data: { status: "completed", version: { increment: 1 } } });
    if (completed.count !== 1) throw new Error("Reserved cart state changed concurrently");
    return { id: sale.id, status: sale.status, reference: sale.receiptNumber, totalCents: cart.totalCents, stateReport: { receiptNumber: sale.receiptNumber, finalizedAt: now.toISOString(), customerCapacity: cart.customer.capacity, rulePackVersion: pack.version, packages: cart.lines.map((line: any) => ({ packageUid: line.packageUidSnapshot, quantityMicrounits: line.quantityMicrounits, unitOfMeasure: salePackageSnapshots.get(line.package.id)!.unitOfMeasure })) } };
  });
}
