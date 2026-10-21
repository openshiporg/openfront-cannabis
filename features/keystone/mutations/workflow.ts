import { createHash, randomUUID } from "node:crypto";
import type { Context } from ".keystone/types";
import type { JSONValue } from "@keystone-6/core/types";
import type { CannabisPermission, Session } from "../access";
import { serializableTransaction } from "../domain/transaction.ts";

function canonicalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => [key, canonicalize(entry)]));
  return value;
}

export function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

export function assertText(value: unknown, label: string, min = 1, max = 500) {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) throw new Error(`${label} must contain ${min}-${max} characters`);
  return value.trim();
}

export function assertInteger(value: unknown, label: string, min = 0, max = 2_147_483_647) {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) throw new Error(`${label} must be an integer between ${min} and ${max}`);
  return value as number;
}

export function assertJsonValue(value: unknown, label: string): JSONValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${label} contains a non-finite number`);
    return value;
  }
  if (Array.isArray(value)) return value.map((entry, index) => assertJsonValue(entry, `${label}[${index}]`));
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, assertJsonValue(entry, `${label}.${key}`)]));
  }
  throw new Error(`${label} must contain only JSON values`);
}

export async function requireActor(context: Context, permission: CannabisPermission) {
  const session = context.session as Session | undefined;
  if (!session?.itemId || session.data.status === "disabled") throw new Error("Authentication required");
  const actor = await context.sudo().query.User.findOne({
    where: { id: session.itemId },
    query: `id status onboardingStatus organization { id jurisdictionCode status } premises { id status timezone currencyCode organization { id } } role { id canAccessDashboard ${permission} } staffCredential { id status effectiveAt expiresAt allowedActivities approvalLimitCents evidenceHash user { id } organization { id } premises { id } }`,
  });
  // Human operator commands need the current dashboard grant as well as the purpose grant.
  if (!actor || actor.status !== "active" || actor.role?.canAccessDashboard !== true || actor.role?.[permission] !== true) throw new Error("Current actor lacks required authority");
  if (actor.organization?.id !== session.data.organization?.id || actor.premises?.id !== session.data.premises?.id) throw new Error("Session authority scope is stale");
  return { session, actor, organizationId: actor.organization?.id, premisesId: actor.premises?.id };
}

/** Read access for diagnosis and history: current actor, grants and site, with
 * license/credential state returned as data rather than required. */
export async function requireReadAuthority(context: Context, permission: CannabisPermission) {
  const scope = await requireActor(context, permission);
  const organizationId = scope.organizationId; const premisesId = scope.premisesId;
  if (!organizationId || !premisesId || scope.actor.premises?.organization?.id !== organizationId) throw new Error("A premises assignment is required");
  return { ...scope, organizationId, premisesId };
}

export async function requireOperationalAuthority(context: Context, permission: CannabisPermission, activity: string) {
  const scope = await requireReadAuthority(context, permission);
  const { organizationId, premisesId } = scope;
  if (scope.actor.organization?.status !== "active" || scope.actor.premises?.status !== "active") throw new Error("Active organization and licensed premises authority are required");
  const now = Date.now();
  const credential = scope.actor.staffCredential;
  if (!credential || credential.status !== "active" || !(new Date(credential.effectiveAt).getTime() <= now) || !(new Date(credential.expiresAt).getTime() > now) || !Array.isArray(credential.allowedActivities) || !credential.allowedActivities.includes(activity) || credential.user?.id !== scope.actor.id || credential.organization?.id !== organizationId || credential.premises?.id !== premisesId) throw new Error("Current staff credential does not authorize this activity");
  const license = await context.sudo().query.CannabisLicense.findMany({
    where: { organization: { id: { equals: organizationId } }, premises: { id: { equals: premisesId } }, status: { equals: "active" }, effectiveAt: { lte: new Date() }, expiresAt: { gt: new Date() } },
    take: 2,
    query: "id licenseNumber authorizedActivities status effectiveAt expiresAt organization { id } premises { id }",
  });
  if (license.length !== 1 || license[0].status !== "active" || !(new Date(license[0].effectiveAt).getTime() <= now) || !(new Date(license[0].expiresAt).getTime() > now) || !Array.isArray(license[0].authorizedActivities) || !license[0].authorizedActivities.includes(activity) || license[0].organization?.id !== organizationId || license[0].premises?.id !== premisesId) throw new Error("Exactly one active license must authorize this premises activity");
  return { ...scope, organizationId, premisesId, license: license[0] };
}

/**
 * Row-level authorization fence. Run inside the command transaction before any
 * private read or effect: FOR SHARE blocks a concurrent revocation (status,
 * role, credential, license or site change) until this transaction ends, and a
 * revocation committed after this transaction's snapshot fails it with a
 * serialization error instead of letting stale authority commit.
 */
export async function fenceAuthority(tx: Context, authority: { actor: Record<string, any>; organizationId: string; premisesId: string; license?: Record<string, any> }) {
  const rows: Array<[string, string | undefined]> = [
    ["User", authority.actor.id], ["Role", authority.actor.role?.id], ["StaffCredential", authority.actor.staffCredential?.id],
    ["Organization", authority.organizationId], ["Premises", authority.premisesId], ["CannabisLicense", authority.license?.id],
  ];
  for (const [table, id] of rows) {
    if (!id) continue;
    await tx.prisma.$queryRawUnsafe(`SELECT id FROM "${table}" WHERE id = $1 FOR SHARE`, id);
  }
}

const REASON_CODE = /^[a-z][a-z0-9_]{2,99}$/;
/** Machine reason codes only; free-text narrative never enters receipts or audit evidence. */
export function assertReasonCode(value: unknown, label = "Reason code") {
  if (typeof value !== "string" || !REASON_CODE.test(value.trim())) throw new Error(`${label} must be a lowercase code such as damaged_packaging`);
  return value.trim();
}

const PRIVATE_INPUT_KEY = /password|proof|secret|token/i;
/** The retained original command, without credentials or proofs. */
export function retainedRequest(value: unknown): JSONValue {
  if (Array.isArray(value)) return value.map(retainedRequest);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([key]) => !PRIVATE_INPUT_KEY.test(key)).map(([key, entry]) => [key, retainedRequest(entry)]));
  }
  if (value instanceof Date) return value.toISOString();
  if (value === undefined || (typeof value === "number" && !Number.isFinite(value))) return null;
  return value as JSONValue;
}

export async function requireRulePack(context: Context, organizationId: string, premisesId: string) {
  const packs = await context.sudo().query.JurisdictionRulePack.findMany({
    where: { organization: { id: { equals: organizationId } }, premises: { id: { equals: premisesId } }, status: { equals: "effective" }, effectiveAt: { lte: new Date() }, expiresAt: { gt: new Date() } },
    orderBy: [{ effectiveAt: "desc" }], take: 2,
    query: "id version status jurisdictionCode effectiveAt expiresAt approvedAt adultMinimumAge medicalMinimumAge medicalEnabled operatingStartMinute operatingEndMinute purchaseLimits taxRules discountRules allowedTenderTypes offlineSalesAllowed pickupEnabled labelRequirements",
  });
  if (packs.length !== 1) throw new Error("Exactly one approved effective jurisdiction rule pack is required");
  return packs[0];
}

type OperationResult = { id: string; status: string; reference?: string | null; [key: string]: unknown };
type OperationalAuthority = Awaited<ReturnType<typeof requireOperationalAuthority>>;
type StoredOperation = {
  requestHash: string; status: string; scope: string; responseSnapshot: unknown;
  actor: { id: string } | null; organization: { id: string } | null; premises: { id: string } | null;
};
const OPERATION_RECEIPT_SELECTION = "id requestHash status scope responseSnapshot actor { id } organization { id } premises { id }";

export async function runControlledOperation(
  context: Context,
  input: { idempotencyKey: string },
  options: { permission: CannabisPermission; activity: string; scope: string; resourceType: keyof Context['query'] & string; action: string; lockKeys?: string[]; emitStateEvent?: boolean;
    authorize?: (context: Context, authority: OperationalAuthority, phase: "execute" | "replay", result?: OperationResult) => Promise<void> },
  work: (tx: Context, authority: Awaited<ReturnType<typeof requireOperationalAuthority>>, correlationId: string) => Promise<OperationResult>,
): Promise<OperationResult & { replayed: boolean }> {
  const authority = await requireOperationalAuthority(context, options.permission, options.activity);
  const key = assertText(input.idempotencyKey, "Idempotency key", 8, 200);
  const lookupKey = `${authority.organizationId}:${authority.premisesId}:${options.scope}:${key}`;
  const requestHash = stableHash(input);
  async function freshAuthority(current: Context) {
    const fresh = await requireOperationalAuthority(current, options.permission, options.activity);
    if (fresh.actor.id !== authority.actor.id || fresh.organizationId !== authority.organizationId || fresh.premisesId !== authority.premisesId) throw new Error("Operational command authority changed");
    return fresh;
  }
  async function acknowledge(current: Context, receipt: StoredOperation) {
    // Receipt acknowledgement is NOT a new transition: do not re-price, check
    // the old expectedVersion, or reject a committed result solely for expiry.
    const fresh = await freshAuthority(current);
    if (receipt.requestHash !== requestHash) throw new Error("Idempotency key was reused with different input");
    if (receipt.scope !== options.scope || receipt.organization?.id !== fresh.organizationId || receipt.premises?.id !== fresh.premisesId || receipt.actor?.id !== fresh.actor.id) {
      throw new Error("Original command authority is unavailable; independent delegation or legacy review is required");
    }
    if (receipt.status !== "succeeded") throw new Error("This operation is already processing or failed and requires review");
    const result = receipt.responseSnapshot;
    if (!result || typeof result !== "object" || Array.isArray(result) || !("id" in result) || typeof result.id !== "string" || !("status" in result) || typeof result.status !== "string") throw new Error("Original command receipt requires review");
    // Always check the persisted result through current normal List access.
    const visible = await current.query[options.resourceType].findOne({ where: { id: result.id }, query: "id" });
    if (!visible || visible.id !== result.id) throw new Error("Original command resource is outside current access");
    // Scope metadata needs Authority-list relationships; do not require sales
    // staff to acquire broad Authority-list read permission merely to acknowledge.
    const resource = await current.sudo().query[options.resourceType].findOne({ where: { id: result.id }, query: "id organization { id } premises { id }" });
    if (!resource || resource.organization?.id !== fresh.organizationId || resource.premises?.id !== fresh.premisesId) throw new Error("Original command resource is outside current authority");
    await options.authorize?.(current, fresh, "replay", result as OperationResult);
    return { ...(result as OperationResult), replayed: true };
  }
  async function acquireLocks(tx: Context) {
    for (const lockKey of [...new Set([lookupKey, ...(options.lockKeys || [])])].sort()) {
      await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "openfront-cannabis", lockKey);
    }
  }
  async function lockedAcknowledgement() {
    return serializableTransaction(context, async tx => {
      await acquireLocks(tx);
      await fenceAuthority(tx, authority);
      const receipt = await tx.sudo().query.IdempotencyKey.findOne({ where: { lookupKey }, query: OPERATION_RECEIPT_SELECTION });
      if (!receipt) throw new Error("Original receipt is unavailable; review is required, not a replacement command");
      return acknowledge(tx, receipt as StoredOperation);
    });
  }
  const existing = await context.sudo().query.IdempotencyKey.findOne({ where: { lookupKey }, query: OPERATION_RECEIPT_SELECTION });
  if (existing) return lockedAcknowledgement();
  const correlationId = randomUUID();
  try {
  return await serializableTransaction(context, async tx => {
    await acquireLocks(tx);
    await fenceAuthority(tx, authority);
    const sudo = tx.sudo();
    const raced = await sudo.query.IdempotencyKey.findOne({ where: { lookupKey }, query: OPERATION_RECEIPT_SELECTION });
    if (raced) return acknowledge(tx, raced as StoredOperation);
    const currentAuthority = await freshAuthority(tx);
    await options.authorize?.(tx, currentAuthority, "execute");
    const idempotency = await sudo.query.IdempotencyKey.createOne({ data: {
      organization: { connect: { id: currentAuthority.organizationId } }, premises: { connect: { id: currentAuthority.premisesId } }, scope: options.scope, lookupKey, requestHash, requestSnapshot: retainedRequest(input), status: "processing",
      startedAt: new Date(), expiresAt: new Date(Date.now() + 300_000), actor: { connect: { id: currentAuthority.actor.id } },
    }, query: "id" });
    const result = await work(tx, currentAuthority, correlationId);
    const responseSnapshot = JSON.parse(JSON.stringify(result));
    await sudo.query.IdempotencyKey.updateOne({ where: { id: idempotency.id }, data: { status: "succeeded", responseSnapshot, completedAt: new Date() }, query: "id" });
    const evidenceHash = stableHash({ action: options.action, result: responseSnapshot, requestHash });
    await sudo.query.AuditEvent.createOne({ data: {
      organization: { connect: { id: currentAuthority.organizationId } }, premises: { connect: { id: currentAuthority.premisesId } }, actor: { connect: { id: currentAuthority.actor.id } }, action: options.action,
      resourceType: options.resourceType, resourceId: result.id, correlationId, reasonCode: "controlled_workflow", evidence: responseSnapshot, evidenceHash, occurredAt: new Date(),
    }, query: "id" });
    if (options.emitStateEvent !== false) await sudo.query.OutboxEvent.createOne({ data: {
      organization: { connect: { id: currentAuthority.organizationId } }, premises: { connect: { id: currentAuthority.premisesId } }, eventKey: `${correlationId}:${options.action}`, topic: options.action,
      aggregateType: options.resourceType, aggregateId: result.id, payload: responseSnapshot, requestHash: evidenceHash, idempotencyKey: key, status: "queued", availableAt: new Date(),
    }, query: "id" });
    return { ...result, replayed: false };
  });
  } catch (error) {
    // A uniqueness race aborts its transaction. Read a committed winner only
    // after fresh authority/resource checks; never retry effects blindly.
    if (!error || typeof error !== "object" || !("code" in error) || error.code !== "P2002") throw error;
    await freshAuthority(context);
    const winner = await context.sudo().query.IdempotencyKey.findOne({ where: { lookupKey }, query: OPERATION_RECEIPT_SELECTION });
    if (!winner) throw error;
    return lockedAcknowledgement();
  }
}
