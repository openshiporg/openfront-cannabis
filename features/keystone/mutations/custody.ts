import { randomUUID } from "node:crypto";
import type { Context, PackageHoldTypeType } from ".keystone/types";
import { isValidTimeZone } from "../domain/premisesTime";
import { assertReasonCode, assertText, runControlledOperation, stableHash } from "./workflow";

const HOLD_TYPES = new Set<PackageHoldTypeType>(["quarantine", "test_hold", "discrepancy", "authority", "expiry"]);
const MAX_RECALL_PACKAGES = 200;

/**
 * Place a hold on one package. Restrictive only: the package stops being ready to
 * sell while any hold is active, and nothing about its quantity or status changes.
 * Releasing a hold still needs the gated, independently approved release.
 */
export async function placePackageHold(_root: unknown, args: { input: any }, context: Context) {
  const input = args.input || {};
  const packageId = assertText(input.packageId, "Package");
  const type = assertText(input.type, "Hold type") as PackageHoldTypeType;
  if (!HOLD_TYPES.has(type)) throw new Error("Hold type must be quarantine, test hold, discrepancy, authority or expiry");
  const reasonCode = assertReasonCode(input.reasonCode);
  const reason = assertText(input.reason, "Hold reason", 4, 1000);
  return runControlledOperation(context, input, { permission: "canManageCompliance", activity: "inventory", scope: "placePackageHold", resourceType: "PackageHold", action: "inventory.hold.placed", emitStateEvent: false, lockKeys: [`package:${packageId}`] }, async (tx, authority) => {
    const sudo = tx.sudo();
    const pkg = await sudo.query.InventoryPackage.findOne({ where: { id: packageId }, query: "id packageUid status organization { id } premises { id }" });
    if (!pkg || pkg.organization?.id !== authority.organizationId || pkg.premises?.id !== authority.premisesId) throw new Error("Package is outside this premises");
    if (["depleted", "destroyed"].includes(String(pkg.status))) throw new Error(`A ${pkg.status} package can't be held`);
    const hold = await sudo.query.PackageHold.createOne({ data: {
      organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, package: { connect: { id: pkg.id } },
      type, status: "active", reasonCode, reason, placedBy: { connect: { id: authority.actor.id } }, placedAt: new Date(), evidenceHash: stableHash({ packageId: pkg.id, type, reasonCode, reason, actor: authority.actor.id }),
    }, query: "id" });
    return { id: hold.id, status: "active", reference: pkg.packageUid };
  });
}

/**
 * Open a recall case and hold every matching package at this premises (by package UID
 * or production batch). Refused when nothing matches. The case starts in "hold"; later stages and hold release stay
 * with the regulator workflow.
 */
export async function openRecallCase(_root: unknown, args: { input: any }, context: Context) {
  const input = args.input || {};
  const authorityReference = assertText(input.authorityReference, "Recall notice reference", 2, 200);
  const reason = assertText(input.reason, "Recall reason", 4, 1000);
  const list = (value: unknown, label: string) => {
    if (value == null) return [];
    if (!Array.isArray(value) || value.length > MAX_RECALL_PACKAGES || value.some(entry => typeof entry !== "string" || !entry.trim() || entry.length > 200)) throw new Error(`${label} must be a list of up to ${MAX_RECALL_PACKAGES} codes`);
    return [...new Set((value as string[]).map(entry => entry.trim()))];
  };
  const packageUids = list(input.packageUids, "Package UIDs"); const batchNumbers = list(input.batchNumbers, "Batch numbers");
  if (!packageUids.length && !batchNumbers.length) throw new Error("Enter at least one package UID or production batch");
  return runControlledOperation(context, input, { permission: "canManageCompliance", activity: "inventory", scope: "openRecallCase", resourceType: "RecallCase", action: "compliance.recall.opened", lockKeys: [`recall:${authorityReference}`] }, async (tx, authority) => {
    const sudo = tx.sudo();
    const scope = { organization: { id: { equals: authority.organizationId } }, premises: { id: { equals: authority.premisesId } } };
    const matches = await sudo.query.InventoryPackage.findMany({
      where: { ...scope, status: { notIn: ["depleted", "destroyed"] }, OR: [...(packageUids.length ? [{ packageUid: { in: packageUids } }] : []), ...(batchNumbers.length ? [{ productionBatchNumber: { in: batchNumbers } }] : [])] } as any,
      take: MAX_RECALL_PACKAGES + 1, query: "id packageUid",
    });
    if (matches.length > MAX_RECALL_PACKAGES) throw new Error(`More than ${MAX_RECALL_PACKAGES} packages match; split the recall by batch`);
    // A recall that holds nothing would look covered while all stock stays saleable.
    if (!matches.length) {
      const swapped = await sudo.query.InventoryPackage.count({ where: { ...scope, status: { notIn: ["depleted", "destroyed"] }, OR: [...(batchNumbers.length ? [{ packageUid: { in: batchNumbers } }] : []), ...(packageUids.length ? [{ productionBatchNumber: { in: packageUids } }] : [])] } as any });
      throw new Error(swapped ? "No package matches. These codes match the other box: package UIDs go under Package UIDs, batch numbers under Production batches" : "No package at this premises matches these package UIDs or production batches");
    }
    const timeZone = isValidTimeZone(authority.actor.premises?.timezone) ? authority.actor.premises.timezone : "UTC";
    const localDate = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).replaceAll("-", "");
    const reference = `RC-${localDate}-${randomUUID().slice(0, 6).toUpperCase()}`;
    const evidenceHash = stableHash({ authorityReference, reason, packageUids, batchNumbers, matched: matches.map(pkg => pkg.packageUid) });
    const recall = await sudo.query.RecallCase.createOne({ data: {
      organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, reference, status: "hold",
      authorityReference, packageUids: [...new Set([...packageUids, ...matches.map(pkg => pkg.packageUid)])], batchNumbers, reason, openedAt: new Date(), evidenceHash,
    }, query: "id reference" });
    for (const pkg of matches) {
      await sudo.query.PackageHold.createOne({ data: {
        organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, package: { connect: { id: pkg.id } },
        type: "recall", status: "active", reasonCode: "recall_notice", reason: `${recall.reference}: ${reason}`.slice(0, 1000), placedBy: { connect: { id: authority.actor.id } }, placedAt: new Date(), evidenceHash,
      }, query: "id" });
    }
    return { id: recall.id, status: "hold", reference: recall.reference, heldPackages: matches.length };
  });
}
