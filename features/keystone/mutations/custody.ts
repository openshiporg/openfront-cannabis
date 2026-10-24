import { randomUUID } from "node:crypto";
import type { Context, PackageHoldTypeType } from ".keystone/types";
import { isValidTimeZone } from "../domain/premisesTime";
import { verifySecondApprover, withApprover } from "./approval";
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

const LAB_RESULTS = new Set(["passed", "failed"]);
const RELEASABLE = new Set(["receiving_hold", "quarantined"]);

/**
 * Record the lab result for a received package, as written on its certificate of analysis.
 * A failed result quarantines the package behind a test hold.
 */
export async function recordPackageLabResult(_root: unknown, args: { input: any }, context: Context) {
  const input = args.input || {};
  const packageId = assertText(input.packageId, "Package");
  const result = assertText(input.result, "Lab result");
  if (!LAB_RESULTS.has(result)) throw new Error("Lab result must be passed or failed");
  const labName = assertText(input.labName, "Lab name", 2, 200);
  const labResultReference = assertText(input.labResultReference, "Lab result reference", 2, 200);
  const coaReference = assertText(input.coaReference, "COA reference", 2, 200);
  return runControlledOperation(context, input, { permission: "canManageInventory", activity: "inventory", scope: "recordPackageLabResult", resourceType: "InventoryPackage", action: "inventory.lab_result.recorded", emitStateEvent: false, lockKeys: [`package:${packageId}`] }, async (tx, authority) => {
    const sudo = tx.sudo();
    const pkg = await sudo.query.InventoryPackage.findOne({ where: { id: packageId }, query: "id packageUid status version organization { id } premises { id }" });
    if (!pkg || pkg.organization?.id !== authority.organizationId || pkg.premises?.id !== authority.premisesId) throw new Error("Package is outside this premises");
    if (!RELEASABLE.has(String(pkg.status))) throw new Error(`A lab result can't be recorded on a ${String(pkg.status).replaceAll("_", " ")} package`);
    const changed = await tx.prisma.inventoryPackage.updateMany({ where: { id: pkg.id, version: pkg.version }, data: { testStatus: result as any, labName, labResultReference, coaReference, labVerifiedAt: new Date(), version: { increment: 1 }, ...(result === "failed" ? { status: "quarantined" } : {}) } });
    if (changed.count !== 1) throw new Error("This package changed since you opened it. Refresh and try again.");
    if (result === "failed") await sudo.query.PackageHold.createOne({ data: {
      organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, package: { connect: { id: pkg.id } },
      type: "test_hold", status: "active", reasonCode: "failed_lab_result", reason: `Failed lab result ${labResultReference} (${labName})`, placedBy: { connect: { id: authority.actor.id } }, placedAt: new Date(), evidenceHash: stableHash({ packageId: pkg.id, result, labName, labResultReference, coaReference }),
    }, query: "id" });
    return { id: pkg.id, status: result === "failed" ? "quarantined" : String(pkg.status), testStatus: result, reference: pkg.packageUid };
  });
}

/** Release a received or quarantined package for sale once its lab result has passed. */
export async function releaseCannabisPackage(_root: unknown, args: { input: any }, context: Context) {
  const input = args.input || {};
  const packageId = assertText(input.packageId, "Package");
  return runControlledOperation(context, input, { permission: "canManageInventory", activity: "inventory", scope: "releaseCannabisPackage", resourceType: "InventoryPackage", action: "inventory.release", lockKeys: [`package:${packageId}`] }, async (tx, authority, correlationId) => {
    const sudo = tx.sudo();
    const pkg = await sudo.query.InventoryPackage.findOne({ where: { id: packageId }, query: "id packageUid status testStatus expiresAt coaReference labelVersion quantityOnHandMicrounits version organization { id } premises { id } holds(where: { status: { equals: active } }, take: 1) { id }" });
    if (!pkg || pkg.organization?.id !== authority.organizationId || pkg.premises?.id !== authority.premisesId) throw new Error("Package is outside this premises");
    if (!RELEASABLE.has(String(pkg.status))) throw new Error(`A ${String(pkg.status).replaceAll("_", " ")} package can't be released`);
    if (pkg.testStatus !== "passed") throw new Error("Record a passed lab result first");
    if (!pkg.coaReference || !pkg.labelVersion) throw new Error("COA reference and label version are required");
    if (!(new Date(pkg.expiresAt).getTime() > Date.now())) throw new Error("This package has expired");
    if (pkg.holds?.length) throw new Error("Release its active holds first");
    if (!(pkg.quantityOnHandMicrounits > 0)) throw new Error("This package has no stock");
    const changed = await tx.prisma.inventoryPackage.updateMany({ where: { id: pkg.id, version: pkg.version, status: pkg.status as any }, data: { status: "saleable", releasedAt: new Date(), version: { increment: 1 } } });
    if (changed.count !== 1) throw new Error("This package changed since you opened it. Refresh and try again.");
    await sudo.query.InventoryEvent.createOne({ data: {
      organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, package: { connect: { id: pkg.id } }, eventType: "release",
      quantityDeltaMicrounits: 0, beforeQuantityMicrounits: pkg.quantityOnHandMicrounits, afterQuantityMicrounits: pkg.quantityOnHandMicrounits, reasonCode: "lab_passed_release", actor: { connect: { id: authority.actor.id } },
      sourceType: "InventoryPackage", sourceId: pkg.id, idempotencyKey: `${correlationId}:release`, occurredAt: new Date(), evidenceHash: stableHash({ packageId: pkg.id, coaReference: pkg.coaReference, labelVersion: pkg.labelVersion }), stateReportStatus: "queued",
    }, query: "id" });
    return { id: pkg.id, status: "saleable", reference: pkg.packageUid, stateReport: { eventType: "release", packageUid: pkg.packageUid } };
  });
}

const RECALL_STAGES = ["hold", "scope_confirmed", "active", "monitoring", "disposition", "regulator_closed"] as const;
const RECALL_DISPOSITIONS = new Set(["release", "destroy"]);

/**
 * Move a recall forward a stage. Closing it records the regulator's closure reference and
 * settles every package it holds: released back to stock, or destroyed (quantity to zero).
 * Closing needs a second compliance approver (mutations/approval.ts).
 */
export async function advanceRecallCase(_root: unknown, args: { input: any }, context: Context) {
  const nextStatus = assertText(args.input?.nextStatus, "Recall stage") as (typeof RECALL_STAGES)[number];
  if (!RECALL_STAGES.includes(nextStatus) || nextStatus === "hold") throw new Error("Recall stage must be scope confirmed, active, monitoring, disposition or regulator closed");
  const closing = nextStatus === "regulator_closed";
  const input = closing ? withApprover(args.input, await verifySecondApprover(context, args.input, "canManageCompliance")) : (args.input || {});
  const recallId = assertText(input.recallId, "Recall");
  const disposition = closing ? assertText(input.disposition, "Disposition") : null;
  if (closing && !RECALL_DISPOSITIONS.has(disposition!)) throw new Error("Disposition must be release or destroy");
  const closureReference = closing ? assertText(input.closureReference, "Regulator closure reference", 2, 200) : null;
  return runControlledOperation(context, input, { permission: "canManageCompliance", activity: "inventory", scope: "advanceRecallCase", resourceType: "RecallCase", action: closing ? "compliance.recall.closed" : "compliance.recall.advanced", lockKeys: [`recall:${recallId}`] }, async (tx, authority, correlationId) => {
    const sudo = tx.sudo();
    const recall = await sudo.query.RecallCase.findOne({ where: { id: recallId }, query: "id reference status organization { id } premises { id }" });
    if (!recall || recall.organization?.id !== authority.organizationId || recall.premises?.id !== authority.premisesId) throw new Error("Recall is outside this premises");
    const from = RECALL_STAGES.indexOf(recall.status as any); const to = RECALL_STAGES.indexOf(nextStatus);
    if (from < 0 || to <= from) throw new Error(`A ${String(recall.status).replaceAll("_", " ")} recall can't move to ${nextStatus.replaceAll("_", " ")}`);
    let settled = 0;
    if (closing) {
      if (input.approvedById === authority.actor.id) throw new Error("The second approver must be someone else");
      const approver = await sudo.query.User.findOne({ where: { id: String(input.approvedById) }, query: "id status organization { id } premises { id } role { canManageCompliance }" });
      if (!approver || approver.status !== "active" || !approver.role?.canManageCompliance || approver.organization?.id !== authority.organizationId || approver.premises?.id !== authority.premisesId) throw new Error("Approver lacks current compliance authority");
      const holds = await sudo.query.PackageHold.findMany({ where: { organization: { id: { equals: authority.organizationId } }, premises: { id: { equals: authority.premisesId } }, type: { equals: "recall" }, status: { equals: "active" }, reason: { startsWith: `${recall.reference}:` } }, take: MAX_RECALL_PACKAGES + 1, query: "id package { id packageUid status quantityOnHandMicrounits reservedMicrounits version }" });
      if (holds.length > MAX_RECALL_PACKAGES) throw new Error(`More than ${MAX_RECALL_PACKAGES} packages are held; settle them with the state system first`);
      for (const hold of holds) {
        const pkg = hold.package;
        if (disposition === "destroy" && pkg && !["depleted", "destroyed"].includes(String(pkg.status))) {
          if (pkg.reservedMicrounits) throw new Error(`Package ${pkg.packageUid} is in an open cart; cancel that cart first`);
          const changed = await tx.prisma.inventoryPackage.updateMany({ where: { id: pkg.id, version: pkg.version, quantityOnHandMicrounits: pkg.quantityOnHandMicrounits }, data: { quantityOnHandMicrounits: 0, status: "destroyed", version: { increment: 1 } } });
          if (changed.count !== 1) throw new Error(`Package ${pkg.packageUid} changed; refresh and try again`);
          await sudo.query.InventoryEvent.createOne({ data: {
            organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, package: { connect: { id: pkg.id } }, eventType: "destruction",
            quantityDeltaMicrounits: -pkg.quantityOnHandMicrounits, beforeQuantityMicrounits: pkg.quantityOnHandMicrounits, afterQuantityMicrounits: 0, reasonCode: "recall_destruction", actor: { connect: { id: authority.actor.id } }, approvedBy: { connect: { id: approver.id } },
            sourceType: "RecallCase", sourceId: recall.id, idempotencyKey: `${correlationId}:destroy:${pkg.id}`, occurredAt: new Date(), evidenceHash: stableHash({ recallId: recall.id, packageId: pkg.id, closureReference }), stateReportStatus: "queued",
          }, query: "id" });
        }
        await sudo.query.PackageHold.updateOne({ where: { id: hold.id }, data: { status: disposition === "destroy" ? "disposed" : "released", releasedBy: { connect: { id: approver.id } }, releasedAt: new Date(), releaseAuthorityReference: closureReference! }, query: "id" });
        settled += 1;
      }
    }
    await sudo.query.RecallCase.updateOne({ where: { id: recall.id }, data: { status: nextStatus, ...(closing ? { closedAt: new Date() } : {}) }, query: "id" });
    return { id: recall.id, status: nextStatus, reference: recall.reference, ...(closing ? { disposition, settledPackages: settled } : {}) };
  });
}
