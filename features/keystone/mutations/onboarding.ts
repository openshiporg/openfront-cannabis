import type { Context, TenderConfigurationTypeType } from ".keystone/types";
import { permissionNames } from "../access";
import { serializableTransaction } from "../domain/transaction";
import { NEUTRAL_STOREFRONT_HUE } from "../domain/storefrontSettings";
import { policyIdentity } from "../domain/policyIdentity";
import { isValidTimeZone } from "../domain/premisesTime";
import { isSupportedCurrencyCode } from "../../lib/money";
import { assertInteger, assertJsonValue, assertText, runControlledOperation, stableHash } from "./workflow";

const REQUIRED_ACTIVITIES = ["authority", "eligibility", "inventory", "sale", "cash", "state_reporting", "incident"];
const TENDER_TYPES = new Set<TenderConfigurationTypeType>(["cash", "debit", "ach", "wallet", "other"]);

type AuthorityPackInput = {
  organizationName: string; legalName: string; jurisdictionCode: string;
  premisesName: string; premisesCode: string; addressSnapshot: unknown; timezone: string; currencyCode: string;
  licenseNumber: string; licenseType: string; regulatorName: string; authorityReference: string; licenseEffectiveAt: string; licenseExpiresAt: string; authorizedActivities: string[];
  credentialType: string; credentialReference: string; credentialEffectiveAt: string; credentialExpiresAt: string; staffAllowedActivities: string[]; staffEvidenceHash: string;
  ruleVersion: string; ruleAuthorityCitations: unknown[]; ruleEffectiveAt: string; ruleExpiresAt: string; adultMinimumAge: number; medicalMinimumAge: number;
  medicalEnabled: boolean; operatingStartMinute: number; operatingEndMinute: number; purchaseLimits: unknown[]; taxRules: unknown[]; discountRules: unknown[]; allowedTenderTypes: string[]; labelRequirements: unknown[]; returnRules: object; outagePolicy: object; privacyRules: object; retentionRules: object;
  pickupEnabled: boolean; traceabilityProviderCode: string; traceabilityAuthorityReference: string; tenderConfigurations: Array<{ code: string; type: TenderConfigurationTypeType; displayName: string; authorityReference: string; effectiveAt: string; expiresAt: string }>;
  idempotencyKey: string;
};

function date(value: string, label: string) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`${label} must be an ISO date-time`);
  return parsed;
}

function validate(input: AuthorityPackInput) {
  const requiredArrays: Array<[unknown, string]> = [[input.authorizedActivities, "license activities"], [input.staffAllowedActivities, "staff activities"], [input.ruleAuthorityCitations, "authority citations"], [input.purchaseLimits, "purchase limits"], [input.taxRules, "tax rules"], [input.allowedTenderTypes, "allowed tenders"], [input.labelRequirements, "label requirements"], [input.tenderConfigurations, "tender configurations"]];
  for (const [value, label] of requiredArrays) if (!Array.isArray(value) || value.length === 0) throw new Error(`Owner-supplied ${label} are required`);
  if (!Array.isArray(input.discountRules)) throw new Error("Owner-supplied discount rules must be an array; use an empty array to prohibit discounts");
  for (const [value, label] of [[input.returnRules, "return"], [input.outagePolicy, "outage"], [input.privacyRules, "privacy"], [input.retentionRules, "retention"]] as const) if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length === 0) throw new Error(`Owner-supplied ${label} rules are required`);
  for (const activity of REQUIRED_ACTIVITIES) if (!input.authorizedActivities.includes(activity) || !input.staffAllowedActivities.includes(activity)) throw new Error(`Authority pack must explicitly include ${activity}`);
  const licenseEffectiveAt = date(input.licenseEffectiveAt, "License effective date"); const licenseExpiresAt = date(input.licenseExpiresAt, "License expiry");
  const credentialEffectiveAt = date(input.credentialEffectiveAt, "Credential effective date"); const credentialExpiresAt = date(input.credentialExpiresAt, "Credential expiry");
  const ruleEffectiveAt = date(input.ruleEffectiveAt, "Rule effective date"); const ruleExpiresAt = date(input.ruleExpiresAt, "Rule expiry");
  if (!isValidTimeZone(input.timezone)) throw new Error("Timezone must be an IANA time zone such as America/Denver");
  if (!isSupportedCurrencyCode(input.currencyCode)) throw new Error("Currency must be a three-letter ISO 4217 code with two decimal places, such as USD or CAD");
  if (licenseEffectiveAt >= licenseExpiresAt || credentialEffectiveAt >= credentialExpiresAt || ruleEffectiveAt >= ruleExpiresAt) throw new Error("Authority effective dates must precede expiry dates");
  assertInteger(input.adultMinimumAge, "Adult minimum age", 0, 120); assertInteger(input.medicalMinimumAge, "Medical minimum age", 0, 120);
  assertInteger(input.operatingStartMinute, "Operating start minute", 0, 1439); assertInteger(input.operatingEndMinute, "Operating end minute", 0, 1439);
  for (const tender of input.tenderConfigurations) {
    if (!TENDER_TYPES.has(tender.type)) throw new Error("Tender configuration type is unsupported");
    if (!input.allowedTenderTypes.includes(tender.type)) throw new Error("Every tender configuration must be allowed by the rule pack");
    date(tender.effectiveAt, "Tender effective date"); date(tender.expiresAt, "Tender expiry");
  }
  return {
    licenseEffectiveAt, licenseExpiresAt, credentialEffectiveAt, credentialExpiresAt, ruleEffectiveAt, ruleExpiresAt,
    addressSnapshot: assertJsonValue(input.addressSnapshot, "Premises address snapshot"),
    ruleAuthorityCitations: assertJsonValue(input.ruleAuthorityCitations, "Rule authority citations"),
    purchaseLimits: assertJsonValue(input.purchaseLimits, "Purchase limits"),
    taxRules: assertJsonValue(input.taxRules, "Tax rules"),
    discountRules: assertJsonValue(input.discountRules, "Discount rules"),
    allowedTenderTypes: assertJsonValue(input.allowedTenderTypes, "Allowed tender types"),
    labelRequirements: assertJsonValue(input.labelRequirements, "Label requirements"),
    returnRules: assertJsonValue(input.returnRules, "Return rules"),
    outagePolicy: assertJsonValue(input.outagePolicy, "Outage policy"),
    privacyRules: assertJsonValue(input.privacyRules, "Privacy rules"),
    retentionRules: assertJsonValue(input.retentionRules, "Retention rules"),
  };
}

/**
 * Delegated staff provisioning. A manager can only delegate what they hold now:
 * permissions, credential activities, approval limit and validity are capped by
 * their own current credential and the premises license.
 */
export async function provisionStaffAuthority(_root: unknown, args: { input: any }, context: Context) {
  const input = args.input;
  return runControlledOperation(context, input, { permission: "canManageAuthority", activity: "authority", scope: "provisionStaffAuthority", resourceType: "StaffCredential", action: "staff.authority.provisioned", emitStateEvent: false, lockKeys: [String(input.email).toLowerCase()] }, async (tx, authority) => {
    const sudo = tx.sudo(); const email = assertText(input.email, "Staff email", 3, 320).toLowerCase();
    if (await sudo.query.User.findOne({ where: { email }, query: "id" })) throw new Error("Staff email already exists");
    const password = assertText(input.temporaryPassword, "Temporary password", 10, 1000);
    const grantor = await sudo.query.User.findOne({ where: { id: authority.actor.id }, query: `role { ${permissionNames.join(" ")} }` });
    const requested = input.permissions && typeof input.permissions === "object" ? input.permissions : {};
    const roleData = Object.fromEntries(permissionNames.map(permission => [permission, requested[permission] === true]));
    roleData.canAccessDashboard = true; roleData.canManageOnboarding = false;
    for (const permission of permissionNames) if (roleData[permission] && grantor?.role?.[permission] !== true) throw new Error("You can only delegate permissions you currently hold");
    const own = authority.actor.staffCredential;
    const activities = input.allowedActivities; if (!Array.isArray(activities) || activities.length === 0 || activities.some((activity: unknown) => typeof activity !== "string")) throw new Error("Staff allowed activities are required");
    if (activities.some((activity: string) => !own?.allowedActivities?.includes(activity) || !authority.license.authorizedActivities?.includes(activity))) throw new Error("Staff activities must be within your own credential and the premises license");
    const effectiveAt = date(input.effectiveAt, "Credential effective date"); const expiresAt = date(input.expiresAt, "Credential expiry"); if (effectiveAt >= expiresAt) throw new Error("Credential effective date must precede expiry");
    const ceiling = Math.min(new Date(own.expiresAt).getTime(), new Date(authority.license.expiresAt).getTime());
    if (expiresAt.getTime() > ceiling) throw new Error("Staff credential cannot outlast your own credential or the premises license");
    const approvalLimitCents = assertInteger(input.approvalLimitCents ?? 0, "Approval limit", 0);
    if (approvalLimitCents > (own.approvalLimitCents ?? 0)) throw new Error("Approval limit cannot exceed your own");
    const role = await sudo.query.Role.createOne({ data: { organization: { connect: { id: authority.organizationId } }, name: assertText(input.roleName, "Role name"), ...roleData }, query: "id" });
    const user = await sudo.query.User.createOne({ data: { name: assertText(input.name, "Staff name"), email, password, status: "active", organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, role: { connect: { id: role.id } }, onboardingStatus: "completed" }, query: "id" });
    // Recorded as attested by the provisioning manager; no external verification is claimed.
    const credential = await sudo.query.StaffCredential.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, user: { connect: { id: user.id } }, credentialType: assertText(input.credentialType, "Credential type"), credentialReference: assertText(input.credentialReference, "Credential reference"), allowedActivities: activities, approvalLimitCents, status: "active", effectiveAt, expiresAt, trainingVerifiedAt: input.trainingVerifiedAt ? date(input.trainingVerifiedAt, "Training date") : null, authorityVerifiedAt: null, evidenceHash: stableHash({ attestedBy: authority.actor.id, credentialReference: input.credentialReference, credentialType: input.credentialType }) }, query: "id status" });
    await sudo.query.User.updateOne({ where: { id: user.id }, data: { staffCredential: { connect: { id: credential.id } } }, query: "id" });
    return { id: credential.id, status: credential.status, reference: user.id };
  });
}

export default async function runCannabisOnboarding(_root: unknown, args: { input: AuthorityPackInput }, context: Context) {
  const input = args.input; const dates = validate(input);
  const session = context.session as any;
  if (!session?.itemId || session.data?.status === "disabled" || session.data?.role?.canManageOnboarding !== true) throw new Error("Only an active human onboarding owner may install an authority pack");
  const actor = await context.sudo().query.User.findOne({ where: { id: session.itemId }, query: "id status onboardingStatus organization { id } role { canManageOnboarding }" });
  if (!actor || actor.status !== "active" || actor.role?.canManageOnboarding !== true) throw new Error("Current onboarding authority is unavailable");
  if (actor.onboardingStatus === "completed" || actor.organization?.id) throw new Error("Onboarding is already completed; authority changes require controlled compliance workflows");
  const digest = stableHash(input); const key = assertText(input.idempotencyKey, "Idempotency key", 8, 200);
  return serializableTransaction(context, async tx => {
    await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "openfront-cannabis-onboarding", session.itemId);
    const sudo = tx.sudo();
    const current = await sudo.query.User.findOne({ where: { id: session.itemId }, query: "id onboardingStatus organization { id }" });
    if (!current || current.onboardingStatus === "completed" || current.organization?.id) throw new Error("Onboarding cannot be replayed over existing authority");
    await sudo.query.User.updateOne({ where: { id: current.id }, data: { onboardingStatus: "in_progress" }, query: "id" });
    const organization = await sudo.query.Organization.createOne({ data: { name: assertText(input.organizationName, "Organization name"), legalName: assertText(input.legalName, "Legal name"), jurisdictionCode: assertText(input.jurisdictionCode, "Jurisdiction code"), status: "pending_authority" }, query: "id" });
    const premises = await sudo.query.Premises.createOne({ data: { organization: { connect: { id: organization.id } }, name: assertText(input.premisesName, "Premises name"), premisesCode: assertText(input.premisesCode, "Premises code"), addressSnapshot: dates.addressSnapshot, timezone: input.timezone, currencyCode: input.currencyCode, status: "pending_authority" }, query: "id" });
    const roleData = Object.fromEntries(permissionNames.map(permission => [permission, true]));
    const ownerRole = await sudo.query.Role.createOne({ data: { organization: { connect: { id: organization.id } }, name: "Owner", ...roleData }, query: "id" });
    await sudo.query.CannabisLicense.createOne({ data: { organization: { connect: { id: organization.id } }, premises: { connect: { id: premises.id } }, licenseNumber: assertText(input.licenseNumber, "License number"), licenseType: assertText(input.licenseType, "License type"), regulatorName: assertText(input.regulatorName, "Regulator"), authorityReference: assertText(input.authorityReference, "License authority reference"), authorizedActivities: input.authorizedActivities, status: "active", effectiveAt: dates.licenseEffectiveAt, expiresAt: dates.licenseExpiresAt, verifiedAt: null }, query: "id" });
    const credential = await sudo.query.StaffCredential.createOne({ data: { organization: { connect: { id: organization.id } }, premises: { connect: { id: premises.id } }, user: { connect: { id: current.id } }, credentialType: assertText(input.credentialType, "Credential type"), credentialReference: assertText(input.credentialReference, "Credential reference"), allowedActivities: input.staffAllowedActivities, status: "active", effectiveAt: dates.credentialEffectiveAt, expiresAt: dates.credentialExpiresAt, trainingVerifiedAt: null, authorityVerifiedAt: null, evidenceHash: assertText(input.staffEvidenceHash, "Credential evidence hash", 16, 500) }, query: "id" });
    const policyHash = stableHash(policyIdentity({ ...input, deliveryEnabled: false, offlineSalesAllowed: false }));
    const rule = await sudo.query.JurisdictionRulePack.createOne({ data: { organization: { connect: { id: organization.id } }, premises: { connect: { id: premises.id } }, version: assertText(input.ruleVersion, "Rule version"), jurisdictionCode: input.jurisdictionCode, authorityCitations: dates.ruleAuthorityCitations, policyHash, status: "effective", effectiveAt: dates.ruleEffectiveAt, expiresAt: dates.ruleExpiresAt, approvedAt: new Date(), approvedBy: { connect: { id: current.id } }, adultMinimumAge: input.adultMinimumAge, medicalMinimumAge: input.medicalMinimumAge, operatingStartMinute: input.operatingStartMinute, operatingEndMinute: input.operatingEndMinute, purchaseLimits: dates.purchaseLimits, taxRules: dates.taxRules, discountRules: dates.discountRules, allowedTenderTypes: dates.allowedTenderTypes, labelRequirements: dates.labelRequirements, returnRules: dates.returnRules, outagePolicy: dates.outagePolicy, privacyRules: dates.privacyRules, retentionRules: dates.retentionRules, medicalEnabled: input.medicalEnabled, pickupEnabled: input.pickupEnabled, deliveryEnabled: false, offlineSalesAllowed: false }, query: "id" });
    for (const tender of input.tenderConfigurations) await sudo.query.TenderConfiguration.createOne({ data: { organization: { connect: { id: organization.id } }, premises: { connect: { id: premises.id } }, code: tender.code, type: tender.type, displayName: tender.displayName, enabled: true, authorityReference: tender.authorityReference, effectiveAt: date(tender.effectiveAt, "Tender effective date"), expiresAt: date(tender.expiresAt, "Tender expiry") }, query: "id" });
    await sudo.query.IntegrationInstallation.createOne({ data: { organization: { connect: { id: organization.id } }, premises: { connect: { id: premises.id } }, providerCode: assertText(input.traceabilityProviderCode, "Traceability provider code"), providerType: "traceability", status: "unconfigured", authorityReference: assertText(input.traceabilityAuthorityReference, "Traceability authority reference"), capabilities: [] }, query: "id" });
    // Public identity starts as the business's own name; staff edit it in Store Settings.
    const storefrontSettings = await sudo.query.StorefrontSettings.createOne({ data: {
      organization: { connect: { id: organization.id } }, premises: { connect: { id: premises.id } },
      businessName: assertText(input.organizationName, "Organization name", 1, 120), brandHue: NEUTRAL_STOREFRONT_HUE,
      publicationStatus: "published", storefrontMode: "configured",
    }, query: "id publicationStatus" });
    await sudo.query.Organization.updateOne({ where: { id: organization.id }, data: { status: "active" }, query: "id" });
    await sudo.query.Premises.updateOne({ where: { id: premises.id }, data: { status: "active" }, query: "id" });
    await sudo.query.User.updateOne({ where: { id: current.id }, data: { organization: { connect: { id: organization.id } }, premises: { connect: { id: premises.id } }, role: { connect: { id: ownerRole.id } }, staffCredential: { connect: { id: credential.id } }, onboardingStatus: "completed" }, query: "id" });
    await sudo.query.AuditEvent.createOne({ data: { organization: { connect: { id: organization.id } }, premises: { connect: { id: premises.id } }, actor: { connect: { id: current.id } }, action: "authority_pack.installed", resourceType: "JurisdictionRulePack", resourceId: rule.id, correlationId: key, reasonCode: "owner_supplied_authority_pack", evidence: { digest, storefrontSettingsId: storefrontSettings.id, provenance: "owner_attested" }, evidenceHash: digest, occurredAt: new Date() }, query: "id" });
    return { id: organization.id, status: "completed", reference: premises.id, authorityPackHash: digest };
  });
}

/** Persist "skip for now" for the current user only; it grants nothing. */
export async function dismissCannabisOnboarding(_root: unknown, _args: unknown, context: Context) {
  const session = context.session as any;
  if (!session?.itemId) throw new Error("Authentication required");
  const user = await context.sudo().query.User.findOne({ where: { id: session.itemId }, query: "id status onboardingStatus" });
  if (!user || user.status !== "active") throw new Error("Authentication required");
  if (user.onboardingStatus === "completed") return { status: "completed" };
  await context.sudo().query.User.updateOne({ where: { id: user.id }, data: { onboardingStatus: "dismissed" }, query: "id" });
  return { status: "dismissed" };
}
