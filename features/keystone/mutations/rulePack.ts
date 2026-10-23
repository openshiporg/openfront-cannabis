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
      allowedTenderTypes: current.allowedTenderTypes, medicalEnabled: current.medicalEnabled, offlineSalesAllowed: current.offlineSalesAllowed,
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
      purchaseLimits: next.purchaseLimits, taxRules: next.taxRules, discountRules: next.discountRules, allowedTenderTypes: current.allowedTenderTypes,
      labelRequirements: current.labelRequirements, returnRules: current.returnRules, outagePolicy: current.outagePolicy, privacyRules: current.privacyRules, retentionRules: current.retentionRules,
      medicalEnabled: current.medicalEnabled, pickupEnabled: current.pickupEnabled, deliveryEnabled: current.deliveryEnabled, offlineSalesAllowed: current.offlineSalesAllowed,
    }, query: "id version" });
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
