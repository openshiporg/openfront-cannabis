import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Context } from ".keystone/types";
import { assertEffectiveRulePack, assertEligibility, assertPackageSaleable } from "../domain/cannabisPolicy";
import { NEUTRAL_STOREFRONT_SETTINGS, projectPublicStorefrontSettings } from "../domain/storefrontSettings";
import { ageAtPremises, calendarDate, endOfLocalDate } from "../domain/premisesTime";
import { isRuntimeCapabilityEnabled, requireRuntimeCapability } from "../domain/runtimeCapabilities";
import { assertText, requireRulePack, runControlledOperation, stableHash } from "./workflow";
import { isPaymentProviderConfigured } from "../utils/paymentProviderConfig";
import { CARD_PROVIDER_CODE } from "./onlinePayments";

const proofHash = (value: string) => createHash("sha256").update(value).digest("hex");

class PublicScopeMissing extends Error {}

/** The single active organization and premises; no rule-pack check, so identity can show even while sales rules are invalid. */
export async function publicScope(context: Context) {
  const organizations = await context.sudo().query.Organization.findMany({ where: { status: { equals: "active" } }, take: 2, query: "id jurisdictionCode premises(where: { status: { equals: active } }, take: 2) { id timezone currencyCode addressSnapshot }" });
  if (organizations.length !== 1 || organizations[0].premises?.length !== 1) throw new PublicScopeMissing("Public service is unavailable until exactly one authority scope is active");
  return { organization: organizations[0], premises: organizations[0].premises[0] };
}

export async function publicAuthority(context: Context) {
  const { organization, premises } = await publicScope(context);
  const pack = await requireRulePack(context, organization.id, premises.id);
  assertEffectiveRulePack(pack as any);
  return { organization, premises, pack };
}

/** Public visit details: address, today's hours from the rule pack, accepted payment types. */
async function publicVisit(context: Context, scope: Awaited<ReturnType<typeof publicScope>>) {
  const address = scope.premises.addressSnapshot && typeof scope.premises.addressSnapshot === "object" && !Array.isArray(scope.premises.addressSnapshot) ? scope.premises.addressSnapshot as Record<string, unknown> : {};
  const pick = (key: string) => typeof address[key] === "string" && (address[key] as string).trim() ? (address[key] as string).trim().slice(0, 200) : null;
  let hours: { opensMinute: number; closesMinute: number } | null = null; let tenders: string[] = []; let minimumAge: number | null = null; let medicalMinimumAge: number | null = null; let cardOnline = false; let pickupEnabled = false;
  try {
    const pack = await requireRulePack(context, scope.organization.id, scope.premises.id);
    assertEffectiveRulePack(pack as any);
    hours = { opensMinute: pack.operatingStartMinute, closesMinute: pack.operatingEndMinute };
    tenders = Array.isArray(pack.allowedTenderTypes) ? (pack.allowedTenderTypes as unknown[]).filter((type): type is string => typeof type === "string").slice(0, 10) : [];
    minimumAge = pack.adultMinimumAge; medicalMinimumAge = pack.medicalEnabled ? pack.medicalMinimumAge : null;
    // Same test the checkout uses before it offers a card (cannabisPickupOptions).
    pickupEnabled = pack.pickupEnabled === true;
    cardOnline = pack.pickupEnabled === true && tenders.includes("debit") && isPaymentProviderConfigured(CARD_PROVIDER_CODE);
  } catch { /* Sales rules unavailable: show only the address. */ }
  return { address: { line1: pick("line1"), city: pick("city"), region: pick("region"), postalCode: pick("postalCode"), country: pick("country") }, phone: pick("phone"), timezone: scope.premises.timezone ?? null, hours, tenders, minimumAge, medicalMinimumAge, cardOnline, pickupEnabled };
}

export async function publicCannabisStorefrontSettings(_root: unknown, _args: unknown, context: Context) {
  let authority: Awaited<ReturnType<typeof publicScope>>;
  // No single active premises means the store is not set up yet, not that settings failed to load.
  try { authority = await publicScope(context); } catch (error) { return error instanceof PublicScopeMissing ? { ...NEUTRAL_STOREFRONT_SETTINGS } : { ...NEUTRAL_STOREFRONT_SETTINGS, unavailable: true }; }
  try {
    // Published merchant identity is shown whether or not online ordering is available.
    const settings = await context.sudo().query.StorefrontSettings.findMany({
      where: {
        organization: { id: { equals: authority.organization.id } },
        premises: { id: { equals: authority.premises.id } },
        publicationStatus: { equals: "published" },
      },
      orderBy: [{ createdAt: "asc" }],
      take: 2,
      query: "businessName tagline description brandHue logoIcon logoColor heroImage { url } publicationStatus storefrontMode",
    });
    if (settings.length > 1) return { ...NEUTRAL_STOREFRONT_SETTINGS, unavailable: true };
    if (settings.length !== 1) return { ...NEUTRAL_STOREFRONT_SETTINGS };
    const projected = projectPublicStorefrontSettings(settings[0]);
    return projected.isConfigured ? { ...projected, coverUrl: settings[0].heroImage?.url ?? null, visit: await publicVisit(context, authority) } : projected;
  } catch {
    return { ...NEUTRAL_STOREFRONT_SETTINGS, unavailable: true };
  }
}

export async function publicCannabisMenu(_root: unknown, _args: unknown, context: Context) {
  let authority: Awaited<ReturnType<typeof publicAuthority>>;
  try { authority = await publicAuthority(context); }
  catch (error) { return { unavailable: true, reason: error instanceof PublicScopeMissing ? "not_set_up" : "sales_rules", products: [] }; }
  if (!isRuntimeCapabilityEnabled("storefront.public-live-menu")) return { unavailable: true, reason: "sales_rules", products: [] };
  const scope = { organization: { id: { equals: authority.organization.id } }, premises: { id: { equals: authority.premises.id } } };
  const [packages] = await Promise.all([
    context.sudo().query.InventoryPackage.findMany({
      where: { ...scope, status: { equals: "saleable" }, testStatus: { equals: "passed" }, expiresAt: { gt: new Date() }, quantityOnHandMicrounits: { gt: 0 } },
      orderBy: [{ expiresAt: "asc" }, { createdAt: "asc" }], take: 201,
      query: "id status testStatus expiresAt quantityOnHandMicrounits reservedMicrounits coaReference labelVersion holds(where: { status: { equals: active } }, take: 1) { id } product { id name sku form categoryCode unitQuantityMicrounits priceCents publicDescription publicImageUrl photo { url } adultUseEligible medicalEligible status } premises { id }",
    })
  ]);
  if (packages.length > 200) throw new Error("Menu projection exceeds its bounded source page and requires operator review");
  const products = new Map<string, any>();
  for (const pkg of packages) {
    const premisesId = pkg.premises?.id;
    if (!premisesId || premisesId !== authority.premises.id || !pkg.product || pkg.product.status !== "active") continue;
    try {
      assertPackageSaleable({ status: pkg.status, testStatus: pkg.testStatus, expiresAt: pkg.expiresAt, premisesId, quantityOnHandMicrounits: pkg.quantityOnHandMicrounits, reservedMicrounits: pkg.reservedMicrounits, activeHoldCount: pkg.holds?.length || 0, coaReference: pkg.coaReference, labelVersion: pkg.labelVersion }, authority.premises.id, pkg.product.unitQuantityMicrounits);
    } catch { continue; }
    if (!products.has(pkg.product.id)) products.set(pkg.product.id, { id: pkg.product.id, name: pkg.product.name, sku: pkg.product.sku, form: pkg.product.form, categoryCode: pkg.product.categoryCode, priceCents: pkg.product.priceCents, description: pkg.product.publicDescription, imageUrl: pkg.product.photo?.url || pkg.product.publicImageUrl || null, adultUseEligible: pkg.product.adultUseEligible, medicalEligible: pkg.product.medicalEligible, available: true });
  }
  return { jurisdictionCode: authority.organization.jurisdictionCode, rulePackVersion: authority.pack.version, currencyCode: authority.premises.currencyCode ?? null, products: [...products.values()] };
}

export async function submitCannabisCustomerIntake(_root: unknown, args: { input: any }, context: Context) {
  requireRuntimeCapability("privacy.approved-intake", "Customer identity intake is disabled until owner-approved privacy, retention, abuse-limiting, and atomic-recovery controls are implemented.");
  const input = args.input; const authority = await publicAuthority(context);
  const capacity = input.capacity;
  if (!['adult_use', 'patient', 'caregiver'].includes(capacity)) throw new Error("Unsupported buyer capacity");
  if (capacity !== "adult_use" && !authority.pack.medicalEnabled) throw new Error("Medical intake is not enabled");
  const email = assertText(input.email, "Email", 3, 320).toLowerCase();
  const dobDate = calendarDate(input.dateOfBirth); const idExpiry = calendarDate(input.identityExpiresAt);
  if (!dobDate || !idExpiry) throw new Error("Identity dates must be real calendar dates (YYYY-MM-DD)");
  const dateOfBirth = new Date(`${dobDate.text}T00:00:00.000Z`);
  const identityExpiresAt = endOfLocalDate(idExpiry.text, authority.premises.timezone);
  const identityMethod = assertText(input.identityMethod, "Identity method");
  const identityReferenceHash = assertText(input.identityReferenceHash, "Identity reference hash", 16, 500);
  const optionalIntakeText = (value: unknown, label: string) => value == null || value === "" ? null : assertText(value, label, 1, 500);
  const registryName = optionalIntakeText(input.registryName, "Registry name");
  const registryReferenceHash = optionalIntakeText(input.registryReferenceHash, "Registry reference hash");
  const representedPatientReferenceHash = optionalIntakeText(input.representedPatientReferenceHash, "Represented patient reference hash");
  const proof = randomBytes(32).toString("base64url"); const reference = `INTAKE-${randomUUID()}`;
  const sudo = context.sudo();
  const customer = await sudo.query.Customer.createOne({ data: { organization: { connect: { id: authority.organization.id } }, premises: { connect: { id: authority.premises.id } }, reference, capacity, status: "pending_verification", intakeProofHash: proofHash(proof), contact: { email }, marketingConsent: input.marketingConsent === true }, query: "id reference" });
  await sudo.query.EligibilityEvidence.createOne({ data: { organization: { connect: { id: authority.organization.id } }, premises: { connect: { id: authority.premises.id } }, customer: { connect: { id: customer.id } }, capacity, identityMethod, identityReferenceHash, dateOfBirth, identityExpiresAt, registryName, registryReferenceHash, representedPatientReferenceHash, result: "pending", reasonCodes: ["staff_verification_required"], evidenceHash: stableHash({ capacity, identityMethod, identityReferenceHash, dateOfBirth: dateOfBirth.toISOString() }) }, query: "id" });
  return { reference, proof, status: "pending_verification", message: "Intake is not eligibility. Staff must verify current authority before reservation or sale." };
}

export async function recordEligibilityDecision(_root: unknown, args: { input: any }, context: Context) {
  requireRuntimeCapability("identity.verified-eligibility", "Eligibility decisions are disabled until current identity and registry evidence can be independently verified and recorded.");
  const input = args.input;
  return runControlledOperation(context, input, { permission: "canManageCompliance", activity: "eligibility", scope: "recordEligibilityDecision", resourceType: "EligibilityEvidence", action: "eligibility.decided", emitStateEvent: false }, async (tx, authority) => {
    const sudo = tx.sudo(); const pack = await requireRulePack(tx, authority.organizationId!, authority.premisesId!); assertEffectiveRulePack(pack as any);
    const customer = await sudo.query.Customer.findOne({ where: { id: assertText(input.customerId, "Customer ID") }, query: "id capacity status organization { id } premises { id }" });
    if (!customer || customer.organization?.id !== authority.organizationId || customer.premises?.id !== authority.premisesId) throw new Error("Customer is outside this premises authority");
    // Calendar dates only (YYYY-MM-DD), read on the store's calendar: a loose `new Date("11/8/2005")` is local-server time.
    const timezone = authority.actor.premises?.timezone; const now = new Date();
    const dobDate = calendarDate(input.dateOfBirth); const idExpiry = calendarDate(input.identityExpiresAt);
    if (!dobDate || !idExpiry || (input.registryExpiresAt && !calendarDate(input.registryExpiresAt))) throw new Error("Identity dates must be real calendar dates (YYYY-MM-DD)");
    const dob = new Date(`${dobDate.text}T00:00:00.000Z`); const identityExpiresAt = endOfLocalDate(idExpiry.text, timezone);
    const age = ageAtPremises(dobDate.text, now, timezone); if (age === null) throw new Error("Date of birth must not be in the future");
    assertEligibility({ capacity: customer.capacity, age, identityValid: identityExpiresAt > now && input.identityVerified === true, registryValid: input.registryVerified === true && (!input.registryExpiresAt || endOfLocalDate(calendarDate(input.registryExpiresAt)!.text, timezone) > now), representedPatientValid: input.representedPatientVerified === true }, pack as any);
    const evidenceHash = stableHash({ ...input, verifier: authority.actor.id, ruleVersion: pack.version });
    const evidence = await sudo.query.EligibilityEvidence.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, customer: { connect: { id: customer.id } }, capacity: customer.capacity, identityMethod: input.identityMethod, identityReferenceHash: input.identityReferenceHash, dateOfBirth: dob, identityExpiresAt, registryName: input.registryName || "", registryReferenceHash: input.registryReferenceHash || "", registryVerifiedAt: input.registryVerified ? now : null, registryExpiresAt: input.registryExpiresAt ? endOfLocalDate(calendarDate(input.registryExpiresAt)!.text, timezone) : null, representedPatientReferenceHash: input.representedPatientReferenceHash || "", allotmentRemainingMicrounits: input.allotmentRemainingMicrounits ?? null, result: "eligible", reasonCodes: ["configured_authority_verified"], evidenceHash, verifiedAt: now }, query: "id result" });
    await sudo.query.Customer.updateOne({ where: { id: customer.id }, data: { status: "eligible" }, query: "id" });
    return { id: evidence.id, status: evidence.result, reference: customer.id, rulePackVersion: pack.version };
  });
}
