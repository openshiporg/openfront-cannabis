import { randomUUID } from "node:crypto";
import type { Context } from ".keystone/types";
import { assertEffectiveRulePack, type EffectiveRulePack } from "../domain/cannabisPolicy";
import { policyIdentity } from "../domain/policyIdentity";
import { serializableTransaction } from "../domain/transaction";
import { assertInteger, assertJsonValue, assertText, fenceAuthority, requireReadAuthority, retainedRequest, stableHash } from "./workflow";

const PACK_FIELDS = "id version status jurisdictionCode authorityCitations effectiveAt expiresAt approvedAt adultMinimumAge medicalMinimumAge medicalEnabled operatingStartMinute operatingEndMinute purchaseLimits taxRules discountRules allowedTenderTypes labelRequirements returnRules outagePolicy privacyRules retentionRules pickupEnabled deliveryEnabled offlineSalesAllowed organization { id } premises { id }";

/** The premises' latest effective pack, whether or not it currently passes its own checks. */
export async function latestRulePack(context: Context, organizationId: string, premisesId: string) {
  const packs = await context.sudo().query.JurisdictionRulePack.findMany({
    where: { organization: { id: { equals: organizationId } }, premises: { id: { equals: premisesId } }, status: { equals: "effective" } },
    orderBy: [{ effectiveAt: "desc" }], take: 2, query: PACK_FIELDS,
  });
  return { pack: packs[0] ?? null, count: packs.length };
}

/** The reason a stored pack would be refused by sales and the public menu, or null when it is usable. */
export function rulePackProblem(pack: Record<string, any> | null) {
  if (!pack) return "No effective sales rules are installed";
  try { assertEffectiveRulePack(pack as EffectiveRulePack); return null; } catch (error) { return error instanceof Error ? error.message : "Sales rules are invalid"; }
}

const TENDER_TYPES = ["cash", "debit", "ach", "wallet", "other"] as const;
const TENDER_LABEL: Record<string, string> = { cash: "Cash", debit: "Debit", ach: "ACH", wallet: "Wallet", other: "Other" };

function tenderTypes(value: unknown) {
  if (!Array.isArray(value) || !value.length || value.some(type => !TENDER_TYPES.includes(type))) throw new Error("Choose at least one payment type: cash, debit, ach, wallet or other");
  return [...new Set(value as string[])];
}

/** Each allowed payment type needs one enabled tender configuration; types no longer allowed are disabled, never deleted. */
async function syncTenderConfigurations(tx: Context, authority: { organizationId: string; premisesId: string }, allowed: string[], now: Date, expiresAt: Date, reference: unknown) {
  const sudo = tx.sudo();
  const configs = await sudo.query.TenderConfiguration.findMany({ where: { organization: { id: { equals: authority.organizationId } }, premises: { id: { equals: authority.premisesId } } }, take: 50, query: "id type enabled authorityReference" });
  const fallbackReference = typeof reference === "string" && reference.trim() ? reference.trim().slice(0, 200) : configs.find(config => config.authorityReference)?.authorityReference || "owner_attested";
  for (const config of configs) {
    const wanted = allowed.includes(String(config.type));
    if (config.enabled !== wanted) await sudo.query.TenderConfiguration.updateOne({ where: { id: config.id }, data: { enabled: wanted, ...(wanted ? { effectiveAt: now, expiresAt } : {}) }, query: "id" });
  }
  for (const type of allowed) {
    if (configs.some(config => config.type === type)) continue;
    await sudo.query.TenderConfiguration.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, code: `${type.toUpperCase()}-${randomUUID().slice(0, 8)}`, type: type as any, displayName: TENDER_LABEL[type] ?? type, enabled: true, authorityReference: fallbackReference, effectiveAt: now, expiresAt }, query: "id" });
  }
}

const optionalInteger = (value: unknown, fallback: number, label: string, min: number, max: number) => value === undefined || value === null || value === "" ? fallback : assertInteger(value, label, min, max);

/**
 * Owner-only amendment of the premises sales rules. The current pack is
 * superseded and a new effective pack starts now, so carts and sales always
 * point at the exact version that applied to them. The owner may also set
 * their own variance-approval ceiling here, which staff limits are capped by.
 */
export async function amendCannabisRulePack(_root: unknown, args: { input: any }, context: Context) {
  const input = args.input || {};
  const authority = await requireReadAuthority(context, "canManageAuthority");
  const owner = await context.sudo().query.User.findOne({ where: { id: authority.actor.id }, query: "role { canManageOnboarding } staffCredential { id }" });
  if (owner?.role?.canManageOnboarding !== true) throw new Error("Only the business owner can amend sales rules");
  const key = assertText(input.idempotencyKey, "Idempotency key", 8, 200);
  const version = assertText(input.version, "Rule version", 1, 100);
  const lookupKey = `${authority.organizationId}:${authority.premisesId}:amendCannabisRulePack:${key}`;
  const requestHash = stableHash(input);
  return serializableTransaction(context, async tx => {
    await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "openfront-cannabis", `${authority.organizationId}:${authority.premisesId}:rule-pack`);
    await fenceAuthority(tx, authority);
    const sudo = tx.sudo();
    const prior = await sudo.query.IdempotencyKey.findOne({ where: { lookupKey }, query: "requestHash status responseSnapshot actor { id }" });
    if (prior) {
      if (prior.requestHash !== requestHash || prior.actor?.id !== authority.actor.id) throw new Error("Idempotency key was reused with different input");
      return { ...(prior.responseSnapshot as object), replayed: true };
    }
    const { pack: current } = await latestRulePack(tx, authority.organizationId, authority.premisesId);
    if (!current) throw new Error("No effective sales rules are installed; complete onboarding first");
    if (current.version === version) throw new Error("Use a new rule version for the amendment");
    const now = new Date();
    const expiresAt = input.expiresAt ? new Date(assertText(input.expiresAt, "Rule expiry")) : new Date(current.expiresAt);
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= now) throw new Error("Rule expiry must be in the future");
    const next = {
      jurisdictionCode: current.jurisdictionCode, version, status: "effective", approvedAt: now, effectiveAt: now, expiresAt,
      adultMinimumAge: optionalInteger(input.adultMinimumAge, current.adultMinimumAge, "Adult minimum age", 0, 120),
      medicalMinimumAge: optionalInteger(input.medicalMinimumAge, current.medicalMinimumAge, "Medical minimum age", 0, 120),
      operatingStartMinute: optionalInteger(input.operatingStartMinute, current.operatingStartMinute, "Opening time", 0, 1439),
      operatingEndMinute: optionalInteger(input.operatingEndMinute, current.operatingEndMinute, "Closing time", 0, 1439),
      purchaseLimits: input.purchaseLimits === undefined ? current.purchaseLimits : assertJsonValue(input.purchaseLimits, "Purchase limits"),
      taxRules: input.taxRules === undefined ? current.taxRules : assertJsonValue(input.taxRules, "Tax rules"),
      discountRules: input.discountRules === undefined ? current.discountRules : assertJsonValue(input.discountRules, "Discount rules"),
      allowedTenderTypes: input.allowedTenderTypes === undefined ? current.allowedTenderTypes : tenderTypes(input.allowedTenderTypes),
      medicalEnabled: input.medicalEnabled === undefined ? current.medicalEnabled : input.medicalEnabled === true,
      offlineSalesAllowed: current.offlineSalesAllowed,
    };
    if (!Array.isArray(next.discountRules)) throw new Error("Discount rules must be a list; leave it empty to prohibit discounts");
    assertEffectiveRulePack({ id: "amendment", ...next } as unknown as EffectiveRulePack, now);
    const policyHash = stableHash(policyIdentity({
      jurisdictionCode: next.jurisdictionCode, ruleVersion: version, ruleAuthorityCitations: current.authorityCitations, ruleEffectiveAt: now.toISOString(), ruleExpiresAt: expiresAt.toISOString(),
      adultMinimumAge: next.adultMinimumAge, medicalMinimumAge: next.medicalMinimumAge, medicalEnabled: next.medicalEnabled, operatingStartMinute: next.operatingStartMinute, operatingEndMinute: next.operatingEndMinute,
      purchaseLimits: next.purchaseLimits, taxRules: next.taxRules, discountRules: next.discountRules, allowedTenderTypes: next.allowedTenderTypes, labelRequirements: current.labelRequirements,
      returnRules: current.returnRules, outagePolicy: current.outagePolicy, privacyRules: current.privacyRules, retentionRules: current.retentionRules,
      pickupEnabled: current.pickupEnabled, deliveryEnabled: current.deliveryEnabled, offlineSalesAllowed: current.offlineSalesAllowed,
    }));
    await sudo.query.JurisdictionRulePack.updateOne({ where: { id: current.id }, data: { status: "superseded" }, query: "id" });
    const created = await sudo.query.JurisdictionRulePack.createOne({ data: {
      organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } },
      version, jurisdictionCode: next.jurisdictionCode, authorityCitations: current.authorityCitations, policyHash, status: "effective",
      effectiveAt: now, expiresAt, approvedAt: now, approvedBy: { connect: { id: authority.actor.id } },
      adultMinimumAge: next.adultMinimumAge, medicalMinimumAge: next.medicalMinimumAge, operatingStartMinute: next.operatingStartMinute, operatingEndMinute: next.operatingEndMinute,
      purchaseLimits: next.purchaseLimits, taxRules: next.taxRules, discountRules: next.discountRules, allowedTenderTypes: next.allowedTenderTypes,
      labelRequirements: current.labelRequirements, returnRules: current.returnRules, outagePolicy: current.outagePolicy, privacyRules: current.privacyRules, retentionRules: current.retentionRules,
      medicalEnabled: next.medicalEnabled, pickupEnabled: current.pickupEnabled, deliveryEnabled: current.deliveryEnabled, offlineSalesAllowed: current.offlineSalesAllowed,
    }, query: "id version" });
    await syncTenderConfigurations(tx, authority, next.allowedTenderTypes as string[], now, expiresAt, input.tenderReference);
    let approvalLimitCents: number | null = null;
    if (input.ownerApprovalLimitCents !== undefined && input.ownerApprovalLimitCents !== null && input.ownerApprovalLimitCents !== "") {
      approvalLimitCents = assertInteger(input.ownerApprovalLimitCents, "Your approval limit", 0);
      if (!owner.staffCredential?.id) throw new Error("Your staff credential is unavailable");
      await sudo.query.StaffCredential.updateOne({ where: { id: owner.staffCredential.id }, data: { approvalLimitCents }, query: "id" });
    }
    const result = { id: created.id, status: "effective", reference: created.version, supersededId: current.id, approvalLimitCents };
    await sudo.query.IdempotencyKey.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, scope: "amendCannabisRulePack", lookupKey, requestHash, requestSnapshot: retainedRequest(input), status: "succeeded", responseSnapshot: JSON.parse(JSON.stringify(result)), startedAt: now, completedAt: new Date(), expiresAt: new Date(Date.now() + 300_000), actor: { connect: { id: authority.actor.id } } }, query: "id" });
    await sudo.query.AuditEvent.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, actor: { connect: { id: authority.actor.id } }, action: "authority.rule_pack.amended", resourceType: "JurisdictionRulePack", resourceId: created.id, correlationId: key, reasonCode: "owner_amendment", evidence: { supersededId: current.id, supersededVersion: current.version, version, approvalLimitCents, provenance: "owner_attested" }, evidenceHash: policyHash, occurredAt: now }, query: "id" });
    return result;
  });
}

const optionalText = (value: unknown, label: string, max = 200) => value === undefined || value === null ? null : typeof value === "string" ? value.trim().slice(0, max) : (() => { throw new Error(`${label} must be text`); })();

/** Owner edit of the public visit details kept on the premises: street address and phone. */
export async function amendCannabisPremisesDetails(_root: unknown, args: { input: any }, context: Context) {
  const input = args.input || {};
  const authority = await requireReadAuthority(context, "canManageAuthority");
  const owner = await context.sudo().query.User.findOne({ where: { id: authority.actor.id }, query: "role { canManageOnboarding }" });
  if (owner?.role?.canManageOnboarding !== true) throw new Error("Only the business owner can change the premises address and phone");
  const key = assertText(input.idempotencyKey, "Idempotency key", 8, 200);
  const lookupKey = `${authority.organizationId}:${authority.premisesId}:amendCannabisPremisesDetails:${key}`;
  const requestHash = stableHash(input);
  const fields = { line1: optionalText(input.line1, "Street address"), city: optionalText(input.city, "City"), region: optionalText(input.region, "State or province"), postalCode: optionalText(input.postalCode, "Postal code", 20), country: optionalText(input.country, "Country", 60), phone: optionalText(input.phone, "Phone", 40) };
  if (!fields.line1 || !fields.city || !fields.region) throw new Error("Street address, city and state or province are required");
  if (fields.phone && !/^[+()\d\s.-]{7,40}$/.test(fields.phone)) throw new Error("Phone may contain digits, spaces, +, -, . and parentheses only");
  return serializableTransaction(context, async tx => {
    await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "openfront-cannabis", lookupKey);
    await fenceAuthority(tx, authority);
    const sudo = tx.sudo();
    const prior = await sudo.query.IdempotencyKey.findOne({ where: { lookupKey }, query: "requestHash responseSnapshot actor { id }" });
    if (prior) {
      if (prior.requestHash !== requestHash || prior.actor?.id !== authority.actor.id) throw new Error("Idempotency key was reused with different input");
      return { ...(prior.responseSnapshot as object), replayed: true };
    }
    const premises = await sudo.query.Premises.findOne({ where: { id: authority.premisesId }, query: "id addressSnapshot" });
    if (!premises) throw new Error("Premises is unavailable");
    const before = premises.addressSnapshot && typeof premises.addressSnapshot === "object" && !Array.isArray(premises.addressSnapshot) ? premises.addressSnapshot as Record<string, unknown> : {};
    const after = { ...before, ...Object.fromEntries(Object.entries(fields).map(([name, value]) => [name, value || null])) };
    await sudo.query.Premises.updateOne({ where: { id: premises.id }, data: { addressSnapshot: JSON.parse(JSON.stringify(after)) }, query: "id" });
    const now = new Date();
    const result = { id: premises.id, status: "updated", reference: premises.id };
    await sudo.query.IdempotencyKey.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, scope: "amendCannabisPremisesDetails", lookupKey, requestHash, requestSnapshot: retainedRequest(input), status: "succeeded", responseSnapshot: result, startedAt: now, completedAt: now, expiresAt: new Date(Date.now() + 300_000), actor: { connect: { id: authority.actor.id } } }, query: "id" });
    await sudo.query.AuditEvent.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, actor: { connect: { id: authority.actor.id } }, action: "authority.premises.details_amended", resourceType: "Premises", resourceId: premises.id, correlationId: key, reasonCode: "owner_amendment", evidence: JSON.parse(JSON.stringify({ before, after })), evidenceHash: stableHash({ before, after }), occurredAt: now }, query: "id" });
    return result;
  });
}
