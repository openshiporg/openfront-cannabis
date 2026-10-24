import { createHmac, randomUUID } from "node:crypto";
import type { Context } from ".keystone/types";
import { assertEffectiveRulePack, assertEligibility } from "../domain/cannabisPolicy";
import { assertText, requireRulePack, runControlledOperation, stableHash } from "./workflow";

const CAPACITIES = new Set(["adult_use", "patient", "caregiver"]);
const IDENTITY_METHODS = new Set(["drivers_license", "state_id", "passport", "military_id", "tribal_id"]);
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** A calendar date typed at the counter, read as that UTC day. */
function dateOnly(value: unknown, label: string) {
  const text = assertText(value, label, 10, 10);
  const date = new Date(`${text}T00:00:00Z`);
  if (!DATE_ONLY.test(text) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== text) throw new Error(`${label} must be a real date`);
  return date;
}

/**
 * Document numbers are stored only as a keyed hash scoped to the premises, so a returning
 * customer is recognised (their purchase-limit history follows them) without keeping the number.
 */
function documentHash(premisesId: string, kind: string, number: string) {
  const key = process.env.SESSION_SECRET;
  if (!key) throw new Error("Check-in is unavailable on this server");
  return createHmac("sha256", key).update(`${premisesId}:${kind}:${number.replace(/[\s-]/g, "").toUpperCase()}`).digest("hex");
}

/**
 * Staff check a buyer's ID (and registry card for medical) in person, then record the
 * decision. Raw document numbers are hashed before the command is stored.
 */
export async function checkInCannabisCustomer(_root: unknown, args: { input: any }, context: Context) {
  const raw = args.input || {};
  const capacity = assertText(raw.capacity, "Buyer type");
  if (!CAPACITIES.has(capacity)) throw new Error("Buyer type must be adult-use, patient or caregiver");
  const identityMethod = assertText(raw.identityMethod, "ID type");
  if (!IDENTITY_METHODS.has(identityMethod)) throw new Error("Choose the ID type");
  const identityNumber = assertText(raw.identityNumber, "ID number", 4, 60);
  const dateOfBirth = dateOnly(raw.dateOfBirth, "Date of birth");
  const identityExpiresAt = dateOnly(raw.identityExpiresAt, "ID expiry");
  if (raw.identityVerified !== true) throw new Error("Confirm you checked the ID in person");
  const medical = capacity !== "adult_use";
  const registryNumber = medical ? assertText(raw.registryNumber, "Registry card number", 3, 60) : null;
  const registryName = medical ? assertText(raw.registryName, "Registry", 2, 120) : "";
  const registryExpiresAt = medical ? dateOnly(raw.registryExpiresAt, "Registry card expiry") : null;
  if (medical && raw.registryVerified !== true) throw new Error("Confirm you checked the registry card");
  const patientNumber = capacity === "caregiver" ? assertText(raw.representedPatientNumber, "Patient's registry number", 3, 60) : null;
  if (capacity === "caregiver" && raw.representedPatientVerified !== true) throw new Error("Confirm the caregiver is authorised for this patient");
  // The stored command keeps only what is needed to replay it: no document numbers.
  const { identityNumber: _id, registryNumber: _registry, representedPatientNumber: _patient, ...input } = raw;
  return runControlledOperation(context, input, { permission: "canManageSales", activity: "eligibility", scope: "checkInCannabisCustomer", resourceType: "Customer", action: "eligibility.checked_in", emitStateEvent: false }, async (tx, authority) => {
    const sudo = tx.sudo(); const now = new Date();
    const pack = await requireRulePack(tx, authority.organizationId!, authority.premisesId!); assertEffectiveRulePack(pack as any);
    let age = now.getUTCFullYear() - dateOfBirth.getUTCFullYear();
    if (now.getUTCMonth() < dateOfBirth.getUTCMonth() || (now.getUTCMonth() === dateOfBirth.getUTCMonth() && now.getUTCDate() < dateOfBirth.getUTCDate())) age -= 1;
    // An ID that expires today is still good through today.
    const validThrough = (date: Date) => date.getTime() + 86400_000 > now.getTime();
    assertEligibility({ capacity: capacity as any, age, identityValid: validThrough(identityExpiresAt), registryValid: !medical || validThrough(registryExpiresAt!), representedPatientValid: capacity !== "caregiver" || Boolean(patientNumber) }, pack as any);
    const identityReferenceHash = documentHash(authority.premisesId!, identityMethod, identityNumber);
    const prior = await sudo.query.EligibilityEvidence.findMany({ where: { organization: { id: { equals: authority.organizationId } }, premises: { id: { equals: authority.premisesId } }, identityReferenceHash: { equals: identityReferenceHash }, capacity: { equals: capacity as any } }, orderBy: [{ createdAt: "desc" }], take: 1, query: "customer { id reference status }" });
    const known = prior[0]?.customer;
    if (known && known.status === "suspended") throw new Error("This customer is suspended; see a manager");
    const customer = known ?? await sudo.query.Customer.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, reference: `CUS-${randomUUID().slice(0, 8).toUpperCase()}`, capacity: capacity as any, status: "eligible" }, query: "id reference status" });
    if (known && known.status !== "eligible") await sudo.query.Customer.updateOne({ where: { id: known.id }, data: { status: "eligible" }, query: "id" });
    const evidence = await sudo.query.EligibilityEvidence.createOne({ data: {
      organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, customer: { connect: { id: customer.id } }, capacity: capacity as any,
      identityMethod, identityReferenceHash, dateOfBirth, identityExpiresAt: new Date(identityExpiresAt.getTime() + 86400_000),
      registryName, registryReferenceHash: registryNumber ? documentHash(authority.premisesId!, `registry:${registryName}`, registryNumber) : "", registryVerifiedAt: medical ? now : null, registryExpiresAt: registryExpiresAt ? new Date(registryExpiresAt.getTime() + 86400_000) : null,
      representedPatientReferenceHash: patientNumber ? documentHash(authority.premisesId!, "patient", patientNumber) : "",
      result: "eligible", reasonCodes: ["checked_in_person"], evidenceHash: stableHash({ capacity, identityMethod, identityReferenceHash, verifier: authority.actor.id, rulePack: pack.version }), verifiedAt: now,
    }, query: "id" });
    return { id: customer.id, status: "eligible", reference: customer.reference, eligibilityEvidenceId: evidence.id, returning: Boolean(known) };
  });
}
