import { createHash, createHmac, randomUUID } from "node:crypto";
import type { Context } from ".keystone/types";
import { assertEffectiveRulePack, assertPackageSaleable, evaluatePurchaseLimits, type EffectiveRulePack } from "../domain/cannabisPolicy";
import { calculateAllocationQuote, type AllocationQuotePackage } from "../domain/allocationQuote";
import { assertReservationLedger, choosePackageForProduct, planReservationBalances } from "../domain/packageAllocation";
import { ageOnDate, pickupSlots } from "../domain/pickupWindows";
import { serializableTransaction } from "../domain/transaction";
import { createPayment } from "../utils/paymentProviderAdapter";
import { getPublicPaymentProviderConfig } from "../utils/paymentProviderConfig";
import { ALLOCATION_PACKAGE_SELECTION, cancelCannabisCart, purchaseWindowTotals, SYSTEM_CANCEL } from "./commerce";
import { documentHash } from "./customers";
import { CARD_PROVIDER_CODE, onlineCardProvider } from "./onlinePayments";
import { publicAuthority } from "./public";
import { assertInteger, assertText, stableHash } from "./workflow";

const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const MAX_ITEMS = 10;
const MAX_UNITS = 20;
const RESERVED_STATUSES = ["preliminarily_eligible", "reserved", "picking", "staged", "final_verification"];
/** Online orders are held until an hour after the pickup window closes. */
const HOLD_AFTER_WINDOW_MS = 60 * 60_000;

/** The guest's proof for an order is derived from the idempotency key, so a replayed request returns the same proof. */
function guestProof(idempotencyKey: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Online ordering is unavailable on this server");
  return createHmac("sha256", secret).update(`pickup-proof:${idempotencyKey}`).digest("hex");
}

const orderReference = (idempotencyKey: string) => `PU-${sha(`pickup-ref:${idempotencyKey}`).slice(0, 12).toUpperCase()}`;

/** Abandoned online orders give their stock back (and release any card hold) once their hold has run out. */
async function releaseExpiredOrders(context: Context) {
  const expired = await context.sudo().query.Cart.findMany({ where: { source: { equals: "pickup" }, status: { in: ["reserved", "preliminarily_eligible"] }, expiresAt: { lt: new Date() } }, take: 20, query: "id" });
  for (const cart of expired) {
    try { await cancelCannabisCart(null as any, { input: { cartId: cart.id, system: SYSTEM_CANCEL, idempotencyKey: `expire:${cart.id}`, reasonCode: "order_expired" } }, context); } catch { /* retried on the next visit */ }
  }
}

/** What the checkout needs before it renders: pickup windows, whether pickup is on, whether cards can be taken. */
export async function cannabisPickupOptions(_root: unknown, _args: unknown, context: Context) {
  await releaseExpiredOrders(context);
  const authority = await publicAuthority(context);
  const { pack, premises } = authority;
  const timezone = premises.timezone || "UTC";
  const card = pack.pickupEnabled && Array.isArray(pack.allowedTenderTypes) && (pack.allowedTenderTypes as string[]).includes("debit")
    ? getPublicPaymentProviderConfig(CARD_PROVIDER_CODE) : null;
  return {
    pickupEnabled: pack.pickupEnabled === true,
    minimumAge: pack.adultMinimumAge,
    currencyCode: premises.currencyCode ?? "USD",
    timezone,
    slots: pack.pickupEnabled ? pickupSlots(pack.operatingStartMinute, pack.operatingEndMinute, timezone) : [],
    card,
    payAtPickup: ["cash", "debit"].some(type => (pack.allowedTenderTypes as string[]).includes(type)),
  };
}

function parseItems(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_ITEMS) throw new Error(`Add between 1 and ${MAX_ITEMS} items to your bag`);
  const seen = new Set<string>();
  return value.map(entry => {
    if (!entry || typeof entry !== "object") throw new Error("Bag item is invalid");
    const productId = assertText((entry as any).productId, "Product", 1, 100);
    if (seen.has(productId)) throw new Error("Each product can appear once in the bag");
    seen.add(productId);
    return { productId, units: assertInteger((entry as any).units, "Quantity", 1, MAX_UNITS) };
  });
}

/**
 * Place an online pickup order. Everything that matters is decided here, not by the browser: which package,
 * the price and tax, purchase limits and the shopper's age. Stock is reserved before any card is touched and
 * released again if the card is declined. Nothing is charged at checkout: a card is only authorized, and staff
 * capture it after the ID check at pickup.
 */
export async function placeCannabisPickupOrder(_root: unknown, args: { input: any }, context: Context) {
  const raw = args.input;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Order details are required");
  const idempotencyKey = assertText(raw.idempotencyKey, "Order key", 16, 100);
  const reference = orderReference(idempotencyKey);
  const proof = guestProof(idempotencyKey);
  const replay = await context.sudo().query.Cart.findOne({ where: { reference }, query: "id reference status paymentMethod paymentStatus" });
  if (replay) return { reference, proof, status: replay.status, paymentMethod: replay.paymentMethod, replayed: true };

  const name = assertText(raw.name, "Name", 2, 120);
  const email = assertText(raw.email, "Email", 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address");
  const phone = assertText(raw.phone, "Phone", 7, 30);
  if (!/^[+()\d\s.-]{7,30}$/.test(phone)) throw new Error("Enter a valid phone number");
  const dateOfBirth = assertText(raw.dateOfBirth, "Date of birth", 10, 10);
  if (raw.idNotice !== true) throw new Error("Confirm you will bring a valid government ID to pickup");
  const items = parseItems(raw.items);
  const method = raw.paymentMethod === "card" ? "card" : raw.paymentMethod === "pickup" ? "pickup" : null;
  if (!method) throw new Error("Choose how you will pay");

  await releaseExpiredOrders(context);
  const { organization, premises, pack } = await publicAuthority(context);
  assertEffectiveRulePack(pack as unknown as EffectiveRulePack);
  if (pack.pickupEnabled !== true) throw new Error("This store is not taking pickup orders right now");
  const age = ageOnDate(dateOfBirth);
  if (age === null) throw new Error("Enter your date of birth as a real past date");
  if (age < pack.adultMinimumAge) throw new Error(`You must be ${pack.adultMinimumAge} or older to order`);

  const timezone = premises.timezone || "UTC";
  const window = pickupSlots(pack.operatingStartMinute, pack.operatingEndMinute, timezone).find(slot => slot.start === raw.pickupStart);
  if (!window) throw new Error("That pickup time is no longer available. Choose another.");

  const scope = { organizationId: organization.id as string, premisesId: premises.id as string };
  const allowed = pack.allowedTenderTypes as string[];
  let provider: any = null;
  if (method === "card") {
    if (!allowed.includes("debit")) throw new Error("Card payment is not available. Choose pay at pickup.");
    provider = await onlineCardProvider(context, scope, true);
    if (!provider) throw new Error("Card payment is not available. Choose pay at pickup.");
    const opaque = raw.opaqueData;
    if (!opaque || typeof opaque.dataDescriptor !== "string" || typeof opaque.dataValue !== "string") throw new Error("Enter your card to continue");
  } else if (!["cash", "debit"].some(type => allowed.includes(type))) {
    throw new Error("Pay at pickup is not available. Pay by card instead.");
  }

  const holdUntil = new Date(new Date(window.end).getTime() + HOLD_AFTER_WINDOW_MS);
  const identityHash = documentHash(scope.premisesId, "online", `${email}:${dateOfBirth}`);

  const placed = await serializableTransaction(context, async tx => {
    const sudo = tx.sudo();
    await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "cannabis-policy", `${scope.organizationId}:${scope.premisesId}`);
    const prior = await sudo.query.EligibilityEvidence.findMany({ where: { organization: { id: { equals: scope.organizationId } }, premises: { id: { equals: scope.premisesId } }, identityReferenceHash: { equals: identityHash } }, orderBy: [{ createdAt: "desc" }], take: 1, query: "customer { id status }" });
    let customer = prior[0]?.customer ?? null;
    if (customer?.status === "suspended" || customer?.status === "ineligible") throw new Error("We can’t take an online order for this customer. Please visit the store.");
    if (!customer) customer = await sudo.query.Customer.createOne({ data: { organization: { connect: { id: scope.organizationId } }, premises: { connect: { id: scope.premisesId } }, reference: `CUS-${randomUUID().slice(0, 8).toUpperCase()}`, capacity: "adult_use", status: "pending_verification", intakeProofHash: sha(proof), contact: { name, email, phone } }, query: "id status" });
    else await sudo.query.Customer.updateOne({ where: { id: customer.id }, data: { contact: { name, email, phone } }, query: "id" });
    await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "cannabis-customer-purchase-window", `${scope.organizationId}:${scope.premisesId}:${customer.id}`);
    const now = new Date();
    const evidence = await sudo.query.EligibilityEvidence.createOne({ data: { organization: { connect: { id: scope.organizationId } }, premises: { connect: { id: scope.premisesId } }, customer: { connect: { id: customer.id } }, capacity: "adult_use",
      identityMethod: "online_declared", identityReferenceHash: identityHash, dateOfBirth: new Date(`${dateOfBirth}T00:00:00.000Z`), identityExpiresAt: holdUntil, result: "pending", reasonCodes: ["declared_online_id_check_at_pickup"],
      evidenceHash: stableHash({ identityHash, rulePack: pack.version, declaredAt: now.toISOString() }) }, query: "id" });
    const cart = await sudo.query.Cart.createOne({ data: { organization: { connect: { id: scope.organizationId } }, premises: { connect: { id: scope.premisesId } }, customer: { connect: { id: customer.id } }, reference, source: "pickup", status: "reserved",
      guestProofHash: sha(proof), expiresAt: holdUntil, rulePack: { connect: { id: pack.id } }, eligibilityEvidence: { connect: { id: evidence.id } }, pickupWindowStart: new Date(window.start), pickupWindowEnd: new Date(window.end),
      pickupName: name, pickupPhone: phone, paymentMethod: method, paymentStatus: "pending" }, query: "id version" });
    const categoryTotals: Record<string, number> = Object.create(null);
    const totals = { subtotalCents: 0, discountCents: 0, taxCents: 0, totalCents: 0 };
    for (const item of items) {
      const product = await sudo.query.Product.findOne({ where: { id: item.productId }, query: "id unitQuantityMicrounits organization { id } premises { id }" });
      if (!product || product.organization?.id !== scope.organizationId || product.premises?.id !== scope.premisesId) throw new Error("An item in your bag is no longer on the menu");
      const quantity = item.units * product.unitQuantityMicrounits;
      const candidates = await sudo.query.InventoryPackage.findMany({ where: { organization: { id: { equals: scope.organizationId } }, premises: { id: { equals: scope.premisesId } }, product: { id: { equals: product.id } }, status: { equals: "saleable" } }, orderBy: [{ expiresAt: "asc" }, { id: "asc" }], take: 51, query: ALLOCATION_PACKAGE_SELECTION });
      let packageId: string;
      try { packageId = choosePackageForProduct(candidates, scope, product.id, quantity); }
      catch { throw new Error("An item in your bag is no longer available in that quantity"); }
      await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "cannabis-package", packageId);
      const pkg = await sudo.query.InventoryPackage.findOne({ where: { id: packageId }, query: ALLOCATION_PACKAGE_SELECTION });
      if (!pkg || !pkg.product || pkg.product.status !== "active") throw new Error("An item in your bag is no longer available");
      assertPackageSaleable({ status: pkg.status, testStatus: pkg.testStatus, expiresAt: pkg.expiresAt, premisesId: scope.premisesId, quantityOnHandMicrounits: pkg.quantityOnHandMicrounits, reservedMicrounits: pkg.reservedMicrounits, activeHoldCount: pkg.holds?.length || 0, coaReference: pkg.coaReference, labelVersion: pkg.labelVersion }, scope.premisesId, quantity);
      const quote = calculateAllocationQuote(pkg as AllocationQuotePackage, { id: cart.id, version: cart.version, customer: { capacity: "adult_use" } }, pack as unknown as EffectiveRulePack, quantity, null, { actor: { id: "online" }, ...scope });
      const balances = planReservationBalances(pkg.quantityOnHandMicrounits, pkg.reservedMicrounits, quantity);
      const ledger = await sudo.query.CartLine.findMany({ where: { package: { id: { equals: pkg.id } }, cart: { status: { in: RESERVED_STATUSES as any } } }, take: 501, query: "id quantityMicrounits organization { id } premises { id } package { id } cart { id status organization { id } premises { id } }" });
      assertReservationLedger(ledger, pkg.id, pkg.reservedMicrounits, scope);
      categoryTotals[pkg.product.categoryCode] = (categoryTotals[pkg.product.categoryCode] || 0) + quote.equivalencyMicrounits;
      evaluatePurchaseLimits({ capacity: "adult_use", categoryTotals, priorWindowTotals: await purchaseWindowTotals(sudo as any, customer.id, pack, now) }, pack as unknown as EffectiveRulePack);
      const claimed = await tx.prisma.inventoryPackage.updateMany({ where: { id: pkg.id, organizationId: scope.organizationId, premisesId: scope.premisesId, status: "saleable", quantityOnHandMicrounits: balances.beforeQuantityMicrounits, version: pkg.version, reservedMicrounits: balances.beforeReservedMicrounits }, data: { reservedMicrounits: balances.afterReservedMicrounits, version: { increment: 1 } } });
      if (claimed.count !== 1) throw new Error("Stock just changed. Please try again.");
      const lineKey = `${reference}:${product.id}`;
      const line = await sudo.query.CartLine.createOne({ data: { organization: { connect: { id: scope.organizationId } }, premises: { connect: { id: scope.premisesId } }, cart: { connect: { id: cart.id } }, idempotencyKey: lineKey, package: { connect: { id: pkg.id } }, product: { connect: { id: pkg.product.id } },
        quantityMicrounits: quantity, equivalencyMicrounits: quote.equivalencyMicrounits, titleSnapshot: pkg.product.name, skuSnapshot: pkg.product.sku, categoryCodeSnapshot: pkg.product.categoryCode, packageUidSnapshot: pkg.packageUid, batchSnapshot: pkg.productionBatchNumber, potencySnapshot: pkg.potencySnapshot,
        unitPriceCents: pkg.product.priceCents, subtotalCents: quote.subtotalCents, discountCents: quote.discountCents, discountSnapshot: quote.discountSnapshot, taxBasisPoints: quote.taxBasisPoints, taxCents: quote.taxCents, totalCents: quote.totalCents }, query: "id" });
      await sudo.query.InventoryEvent.createOne({ data: { organization: { connect: { id: scope.organizationId } }, premises: { connect: { id: scope.premisesId } }, package: { connect: { id: pkg.id } }, eventType: "reserve", quantityDeltaMicrounits: 0,
        beforeQuantityMicrounits: balances.beforeQuantityMicrounits, afterQuantityMicrounits: balances.afterQuantityMicrounits, reasonCode: "cart_reservation", sourceType: "CartLine", sourceId: line.id, idempotencyKey: `${lineKey}:reserve`, occurredAt: now,
        evidenceHash: stableHash({ quote, balances, cartLineId: line.id }), stateReportStatus: "local_recorded" }, query: "id" });
      totals.subtotalCents += quote.subtotalCents; totals.discountCents += quote.discountCents; totals.taxCents += quote.taxCents; totals.totalCents += quote.totalCents;
    }
    if (!Object.values(totals).every(value => Number.isSafeInteger(value) && value <= 2_147_483_647)) throw new Error("Order total is too large");
    await sudo.query.Cart.updateOne({ where: { id: cart.id }, data: { ...totals, version: 2 }, query: "id" });
    return { cartId: cart.id, ...totals };
  }, 30_000);

  let status = "reserved";
  let paymentStatus = "pending";
  if (method === "card") {
    let result: any = null;
    try {
      result = await createPayment({ provider, amount: placed.totalCents, currency: "USD", opaqueData: raw.opaqueData, cart: { id: reference }, idempotencyKey: reference });
    } catch { result = null; }
    if (!result || result.status !== "authorized" || !result.paymentIntentId) {
      // Nothing was authorized, so put the stock back and tell the shopper.
      await cancelCannabisCart(null as any, { input: { cartId: placed.cartId, proof, idempotencyKey: `${reference}:declined`, reasonCode: "payment_declined" } }, context);
      throw new Error(result?.error ? `Your card was declined: ${String(result.error).slice(0, 120)}` : "We couldn’t authorize your card. Check the details or choose pay at pickup.");
    }
    paymentStatus = "authorized";
    await context.sudo().query.Cart.updateOne({ where: { id: placed.cartId }, data: { paymentStatus, paymentReference: String(result.paymentIntentId) }, query: "id" });
  }
  await context.sudo().query.AuditEvent.createOne({ data: { organization: { connect: { id: scope.organizationId } }, premises: { connect: { id: scope.premisesId } }, action: "cart.pickup_order_placed", resourceType: "Cart", resourceId: placed.cartId, correlationId: reference, reasonCode: "online_pickup_order",
    evidence: { items: items.length, totalCents: placed.totalCents, paymentMethod: method }, evidenceHash: stableHash({ reference, totals: placed, method }), occurredAt: new Date() }, query: "id" });
  return { reference, proof, status, paymentMethod: method, paymentStatus, totalCents: placed.totalCents, replayed: false };
}

/** The shopper's own order, found by its reference plus the proof returned at checkout. */
export async function cannabisPickupOrder(_root: unknown, args: { reference: string; proof: string }, context: Context) {
  const reference = assertText(args.reference, "Order reference", 3, 40);
  const proof = assertText(args.proof, "Order key", 16, 200);
  const cart = await context.sudo().query.Cart.findOne({ where: { reference }, query: "id reference status source guestProofHash subtotalCents taxCents discountCents totalCents pickupWindowStart pickupWindowEnd pickupName paymentMethod paymentStatus premises { timezone currencyCode } lines(take: 50) { titleSnapshot quantityMicrounits totalCents product { unitQuantityMicrounits } }" });
  if (!cart || cart.source !== "pickup" || cart.guestProofHash !== sha(proof)) throw new Error("We couldn’t find that order");
  return {
    reference: cart.reference, status: cart.status, name: cart.pickupName, paymentMethod: cart.paymentMethod, paymentStatus: cart.paymentStatus, currencyCode: cart.premises?.currencyCode ?? "USD", timezone: cart.premises?.timezone ?? "UTC",
    pickupStart: cart.pickupWindowStart, pickupEnd: cart.pickupWindowEnd, subtotalCents: cart.subtotalCents, taxCents: cart.taxCents, discountCents: cart.discountCents, totalCents: cart.totalCents,
    lines: (cart.lines || []).map((line: any) => ({ title: line.titleSnapshot, units: Math.round(line.quantityMicrounits / (line.product?.unitQuantityMicrounits || line.quantityMicrounits)), totalCents: line.totalCents })),
  };
}

/** The shopper cancels their own order: the stock goes back and any card hold is released. */
export async function cancelCannabisPickupOrder(_root: unknown, args: { reference: string; proof: string }, context: Context) {
  const reference = assertText(args.reference, "Order reference", 3, 40);
  const proof = assertText(args.proof, "Order key", 16, 200);
  const cart = await context.sudo().query.Cart.findOne({ where: { reference }, query: "id source guestProofHash status" });
  if (!cart || cart.source !== "pickup" || cart.guestProofHash !== sha(proof)) throw new Error("We couldn’t find that order");
  if (!["reserved", "preliminarily_eligible"].includes(cart.status) && cart.status !== "cancelled") throw new Error("This order can no longer be cancelled online. Please call the store.");
  const result = await cancelCannabisCart(null as any, { input: { cartId: cart.id, proof, idempotencyKey: `${reference}:shopper-cancel`, reasonCode: "customer_cancelled" } }, context);
  return { reference, status: result.status };
}
