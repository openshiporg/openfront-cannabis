import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Context } from ".keystone/types";
import { assertEffectiveRulePack, assertEligibility, assertPackageSaleable } from "../domain/cannabisPolicy";
import { NEUTRAL_STOREFRONT_SETTINGS, projectPublicDemoCatalog, projectPublicStorefrontSettings } from "../domain/storefrontSettings";
import { isRuntimeCapabilityEnabled, requireRuntimeCapability } from "../domain/runtimeCapabilities";
import { assertText, requireRulePack, runControlledOperation, stableHash } from "./workflow";

const proofHash = (value: string) => createHash("sha256").update(value).digest("hex");

async function publicAuthority(context: Context) {
  const organizations = await context.sudo().query.Organization.findMany({ where: { status: { equals: "active" } }, take: 2, query: "id jurisdictionCode premises(where: { status: { equals: active } }, take: 2) { id timezone currencyCode }" });
  if (organizations.length !== 1 || organizations[0].premises?.length !== 1) throw new Error("Public service is unavailable until exactly one authority scope is active");
  const organization = organizations[0]; const premises = organization.premises[0];
  const pack = await requireRulePack(context, organization.id, premises.id);
  assertEffectiveRulePack(pack as any);
  return { organization, premises, pack };
}

export async function publicCannabisStorefrontSettings(_root: unknown, _args: unknown, context: Context) {
  let authority: Awaited<ReturnType<typeof publicAuthority>>;
  // No single active premises means the store is not set up yet, not that settings failed to load.
  try { authority = await publicAuthority(context); } catch { return { ...NEUTRAL_STOREFRONT_SETTINGS }; }
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
      query: "businessName tagline description brandHue logoIcon logoColor publicationStatus storefrontMode",
    });
    if (settings.length > 1) return { ...NEUTRAL_STOREFRONT_SETTINGS, unavailable: true };
    if (settings.length !== 1) return { ...NEUTRAL_STOREFRONT_SETTINGS };
    return projectPublicStorefrontSettings(settings[0]);
  } catch {
    return { ...NEUTRAL_STOREFRONT_SETTINGS, unavailable: true };
  }
}

export async function publicCannabisMenu(_root: unknown, _args: unknown, context: Context) {
  let authority: Awaited<ReturnType<typeof publicAuthority>>;
  try { authority = await publicAuthority(context); }
  catch { return { unavailable: true, products: [], demoProducts: [] }; }
  if (!isRuntimeCapabilityEnabled("storefront.public-live-menu")) {
    const demoSettings = await context.sudo().query.StorefrontSettings.findMany({
      where: {
        organization: { id: { equals: authority.organization.id } },
        premises: { id: { equals: authority.premises.id } },
        publicationStatus: { equals: "published" },
        storefrontMode: { equals: "demo" },
      },
      orderBy: [{ createdAt: "asc" }],
      take: 2,
      query: "demoCatalog",
    });
    return {
      jurisdictionCode: authority.organization.jurisdictionCode,
      rulePackVersion: authority.pack.version,
      currencyCode: authority.premises.currencyCode ?? null,
      products: [],
      demoProducts: demoSettings.length === 1 ? projectPublicDemoCatalog(demoSettings[0].demoCatalog) : [],
    };
  }
  const scope = { organization: { id: { equals: authority.organization.id } }, premises: { id: { equals: authority.premises.id } } };
  const [packages, demoSettings] = await Promise.all([
    context.sudo().query.InventoryPackage.findMany({
      where: { ...scope, status: { equals: "saleable" }, testStatus: { equals: "passed" }, expiresAt: { gt: new Date() }, quantityOnHandMicrounits: { gt: 0 } },
      orderBy: [{ expiresAt: "asc" }, { createdAt: "asc" }], take: 201,
      query: "id status testStatus expiresAt quantityOnHandMicrounits reservedMicrounits coaReference labelVersion holds(where: { status: { equals: active } }, take: 1) { id } product { id name sku form categoryCode unitQuantityMicrounits priceCents publicDescription publicImageUrl adultUseEligible medicalEligible status } premises { id }",
    }),
    context.sudo().query.StorefrontSettings.findMany({
      where: { ...scope, publicationStatus: { equals: "published" }, storefrontMode: { equals: "demo" } },
      orderBy: [{ createdAt: "asc" }], take: 2, query: "demoCatalog",
    }),
  ]);
  if (packages.length > 200) throw new Error("Menu projection exceeds its bounded source page and requires operator review");
  const products = new Map<string, any>();
  for (const pkg of packages) {
    const premisesId = pkg.premises?.id;
    if (!premisesId || premisesId !== authority.premises.id || !pkg.product || pkg.product.status !== "active") continue;
    try {
      assertPackageSaleable({ status: pkg.status, testStatus: pkg.testStatus, expiresAt: pkg.expiresAt, premisesId, quantityOnHandMicrounits: pkg.quantityOnHandMicrounits, reservedMicrounits: pkg.reservedMicrounits, activeHoldCount: pkg.holds?.length || 0, coaReference: pkg.coaReference, labelVersion: pkg.labelVersion }, authority.premises.id, pkg.product.unitQuantityMicrounits);
    } catch { continue; }
    if (!products.has(pkg.product.id)) products.set(pkg.product.id, { id: pkg.product.id, name: pkg.product.name, sku: pkg.product.sku, form: pkg.product.form, categoryCode: pkg.product.categoryCode, priceCents: pkg.product.priceCents, description: pkg.product.publicDescription, imageUrl: pkg.product.publicImageUrl, adultUseEligible: pkg.product.adultUseEligible, medicalEligible: pkg.product.medicalEligible, available: true });
  }
  const demoProducts = demoSettings.length === 1 ? projectPublicDemoCatalog(demoSettings[0].demoCatalog) : [];
  return { jurisdictionCode: authority.organization.jurisdictionCode, rulePackVersion: authority.pack.version, currencyCode: authority.premises.currencyCode ?? null, products: [...products.values()], demoProducts };
}

export async function submitCannabisCustomerIntake(_root: unknown, args: { input: any }, context: Context) {
  requireRuntimeCapability("privacy.approved-intake", "Customer identity intake is disabled until owner-approved privacy, retention, abuse-limiting, and atomic-recovery controls are implemented.");
  const input = args.input; const authority = await publicAuthority(context);
  const capacity = input.capacity;
  if (!['adult_use', 'patient', 'caregiver'].includes(capacity)) throw new Error("Unsupported buyer capacity");
  if (capacity !== "adult_use" && !authority.pack.medicalEnabled) throw new Error("Medical intake is not enabled");
  const email = assertText(input.email, "Email", 3, 320).toLowerCase();
  const dateOfBirth = new Date(assertText(input.dateOfBirth, "Date of birth"));
  const identityExpiresAt = new Date(assertText(input.identityExpiresAt, "Identity expiry"));
  if (!Number.isFinite(dateOfBirth.getTime()) || !Number.isFinite(identityExpiresAt.getTime())) throw new Error("Identity dates are invalid");
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
    const dob = new Date(assertText(input.dateOfBirth, "Date of birth")); const identityExpiresAt = new Date(assertText(input.identityExpiresAt, "Identity expiry"));
    const now = new Date(); let age = now.getUTCFullYear() - dob.getUTCFullYear(); if (now.getUTCMonth() < dob.getUTCMonth() || (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate())) age -= 1;
    assertEligibility({ capacity: customer.capacity, age, identityValid: identityExpiresAt > now && input.identityVerified === true, registryValid: input.registryVerified === true && (!input.registryExpiresAt || new Date(input.registryExpiresAt) > now), representedPatientValid: input.representedPatientVerified === true }, pack as any);
    const evidenceHash = stableHash({ ...input, verifier: authority.actor.id, ruleVersion: pack.version });
    const evidence = await sudo.query.EligibilityEvidence.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, customer: { connect: { id: customer.id } }, capacity: customer.capacity, identityMethod: input.identityMethod, identityReferenceHash: input.identityReferenceHash, dateOfBirth: dob, identityExpiresAt, registryName: input.registryName || "", registryReferenceHash: input.registryReferenceHash || "", registryVerifiedAt: input.registryVerified ? now : null, registryExpiresAt: input.registryExpiresAt ? new Date(input.registryExpiresAt) : null, representedPatientReferenceHash: input.representedPatientReferenceHash || "", allotmentRemainingMicrounits: input.allotmentRemainingMicrounits ?? null, result: "eligible", reasonCodes: ["configured_authority_verified"], evidenceHash, verifiedAt: now }, query: "id result" });
    await sudo.query.Customer.updateOne({ where: { id: customer.id }, data: { status: "eligible" }, query: "id" });
    return { id: evidence.id, status: evidence.result, reference: customer.id, rulePackVersion: pack.version };
  });
}
