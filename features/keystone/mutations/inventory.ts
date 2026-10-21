import type { Context, InventoryEventEventTypeType } from ".keystone/types";
import { PACKAGE_TRANSITIONS, assertInventoryDestructionQuantityDelta, assertInventoryEventQuantityDelta, assertTransition } from "../domain/cannabisPolicy";
import { requireRuntimeCapability } from "../domain/runtimeCapabilities";
import { endOfLocalDate } from "../domain/premisesTime";
import { assertInteger, assertReasonCode, assertText, runControlledOperation, stableHash } from "./workflow";

const EVENT_STATUS = {
  release: ["saleable"], reserve: ["reserved"], release_reservation: ["saleable"], transfer_out: ["transfer_allocated", "in_transit"], transfer_in: ["receiving_hold"],
  count: ["saleable", "quarantined"], adjustment: ["saleable", "quarantined"], waste: ["waste_pending"], destruction: ["destroyed"], recall_hold: ["recalled"], recall_release: ["quarantined"], return_quarantine: ["quarantined"],
} as const satisfies Partial<Record<InventoryEventEventTypeType, readonly string[]>>;
type ManagedInventoryEventType = keyof typeof EVENT_STATUS;
const isManagedInventoryEventType = (value: string): value is ManagedInventoryEventType => value in EVENT_STATUS;
const DUAL_APPROVAL = new Set(["count", "adjustment", "waste", "destruction", "recall_hold", "recall_release"]);

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const optionalText = (value: unknown, label: string, max = 200) => value == null || value === "" ? null : assertText(value, label, 1, max);

export async function receiveCannabisPackage(_root: unknown, args: { input: any }, context: Context) {
  const input = args.input;
  // Shape checks only. Time-dependent admission runs inside the new-command branch,
  // so an already committed receipt can still be acknowledged after the package expires.
  assertInteger(input.quantityMicrounits, "Received quantity", 1);
  const expiresInput = assertText(input.expiresAt, "Expiry", 10, 40);
  if (!DATE_ONLY.test(expiresInput) && !Number.isFinite(new Date(expiresInput).getTime())) throw new Error("Expiry must be a date");
  const manifestNumber = assertText(input.manifestNumber, "Manifest number");
  const reasonCode = assertReasonCode(input.reasonCode);
  return runControlledOperation(context, input, { permission: "canManageInventory", activity: "inventory", scope: "receiveCannabisPackage", resourceType: "InventoryPackage", action: "inventory.package.received", lockKeys: [`package:${String(input.packageUid)}`, `manifest:${manifestNumber}`] }, async (tx, authority, correlationId) => {
    const sudo = tx.sudo();
    const timezone = authority.actor.premises?.timezone;
    const expiry = DATE_ONLY.test(expiresInput) ? endOfLocalDate(expiresInput, timezone) : new Date(expiresInput);
    if (!(expiry.getTime() > Date.now())) throw new Error("Received package expiry must be in the future");
    const manufacturedAt = input.manufacturedAt ? (DATE_ONLY.test(String(input.manufacturedAt)) ? endOfLocalDate(String(input.manufacturedAt), timezone) : new Date(String(input.manufacturedAt))) : null;
    if (manufacturedAt && !Number.isFinite(manufacturedAt.getTime())) throw new Error("Manufactured date is invalid");
    const product = await sudo.query.Product.findOne({ where: { id: assertText(input.productId, "Product ID") }, query: "id organization { id } premises { id } status unitOfMeasure" });
    if (!product || product.organization?.id !== authority.organizationId || product.premises?.id !== authority.premisesId || product.status !== "active") throw new Error("Active product is not available in this premises");
    const existing = await sudo.query.InventoryPackage.findOne({ where: { packageUid: assertText(input.packageUid, "Package UID") }, query: "id" });
    if (existing) throw new Error("Package UID already exists");
    const sourceLicenseNumber = assertText(input.sourceLicenseNumber, "Source license");
    // Recorded as entered by staff; none of these facts are verified by a regulator or lab here.
    const evidence = { origin: "manual_entry_unverified", expiryInput: expiresInput, timezone, ...(input.evidence && typeof input.evidence === "object" ? { submitted: input.evidence } : {}) };
    const evidenceHash = stableHash(evidence);
    // One manifest can carry several packages: attach to the scoped manifest when its transfer facts match.
    const prior = await sudo.query.RegulatedManifest.findOne({ where: { manifestNumber }, query: "id manifestNumber type status sourceLicenseNumber organization { id } premises { id }" });
    if (prior && (prior.organization?.id !== authority.organizationId || prior.premises?.id !== authority.premisesId || prior.type !== "receiving" || prior.sourceLicenseNumber !== sourceLicenseNumber)) throw new Error("This manifest number is already recorded for a different transfer");
    const manifest = prior ?? await sudo.query.RegulatedManifest.createOne({ data: {
      organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, manifestNumber, type: "receiving", status: "receiving_hold",
      sourceLicenseNumber, destinationLicenseNumber: authority.license.licenseNumber, regulatorManifestId: optionalText(input.regulatorManifestId, "Regulator manifest ID") ?? "", occurredAt: new Date(), reasonCode,
      evidence, evidenceHash, actor: { connect: { id: authority.actor.id } },
    }, query: "id manifestNumber" });
    const inventoryPackage = await sudo.query.InventoryPackage.createOne({ data: {
      organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, product: { connect: { id: product.id } }, packageUid: input.packageUid,
      sourcePackageUid: optionalText(input.sourcePackageUid, "Source package UID") ?? "", productionBatchNumber: assertText(input.productionBatchNumber, "Production batch"), lotNumber: assertText(input.lotNumber, "Lot number"),
      quantityReceivedMicrounits: input.quantityMicrounits, quantityOnHandMicrounits: input.quantityMicrounits, reservedMicrounits: 0, unitOfMeasure: product.unitOfMeasure,
      status: "receiving_hold", testStatus: "unknown", labName: optionalText(input.labName, "Lab name") ?? "", labResultReference: optionalText(input.labResultReference, "Lab result reference") ?? "", coaReference: optionalText(input.coaReference, "COA reference") ?? "",
      manufacturedAt, receivedAt: new Date(), expiresAt: expiry, labelVersion: assertText(input.labelVersion, "Label version"), potencySnapshot: {}, lineage: [], version: 1,
    }, query: "id packageUid status testStatus expiresAt" });
    await sudo.query.InventoryEvent.createOne({ data: {
      organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, package: { connect: { id: inventoryPackage.id } }, manifest: { connect: { id: manifest.id } }, eventType: "receive",
      quantityDeltaMicrounits: input.quantityMicrounits, beforeQuantityMicrounits: 0, afterQuantityMicrounits: input.quantityMicrounits, reasonCode, actor: { connect: { id: authority.actor.id } },
      sourceType: "RegulatedManifest", sourceId: manifest.id, idempotencyKey: `${correlationId}:receive`, occurredAt: new Date(), evidenceHash, stateReportStatus: "queued",
    }, query: "id" });
    return { id: inventoryPackage.id, status: inventoryPackage.status, testStatus: inventoryPackage.testStatus, expiresAt: inventoryPackage.expiresAt, reference: manifest.manifestNumber, manifestAttached: Boolean(prior), stateReport: { eventType: "receive", packageUid: inventoryPackage.packageUid, quantityMicrounits: input.quantityMicrounits, unitOfMeasure: product.unitOfMeasure, manifestNumber: manifest.manifestNumber } };
  });
}

export async function releasePackageHold(_root: unknown, args: { input: any }, context: Context) {
  requireRuntimeCapability("inventory.action-bound-approval", "Hold release is disabled until an authenticated, action-bound second-party approval workflow is implemented.");
  const input = args.input;
  if (!input.approvedById || input.approvedById === (context.session as any)?.itemId) throw new Error("Hold release requires an independent compliance approver");
  return runControlledOperation(context, input, { permission: "canManageCompliance", activity: "inventory", scope: "releasePackageHold", resourceType: "PackageHold", action: "inventory.hold.released", lockKeys: [String(input.holdId)] }, async (tx, authority) => {
    const sudo = tx.sudo();
    const hold = await sudo.query.PackageHold.findOne({ where: { id: assertText(input.holdId, "Hold ID") }, query: "id status organization { id } premises { id } package { id packageUid status }" });
    if (!hold || hold.status !== "active" || hold.organization?.id !== authority.organizationId || hold.premises?.id !== authority.premisesId) throw new Error("Active hold is outside this authority scope");
    const approver = await sudo.query.User.findOne({ where: { id: input.approvedById }, query: "id status organization { id } premises { id } role { canManageCompliance }" });
    if (!approver || approver.status !== "active" || !approver.role?.canManageCompliance || approver.organization?.id !== authority.organizationId || approver.premises?.id !== authority.premisesId) throw new Error("Approver lacks current compliance authority");
    await sudo.query.PackageHold.updateOne({ where: { id: hold.id }, data: { status: "released", releasedBy: { connect: { id: approver.id } }, releasedAt: new Date(), releaseAuthorityReference: assertText(input.releaseAuthorityReference, "Release authority reference") }, query: "id" });
    return { id: hold.id, status: "released", reference: hold.package.packageUid };
  });
}

export async function postCannabisInventoryEvent(_root: unknown, args: { input: any }, context: Context) {
  requireRuntimeCapability("inventory.event-specific-custody", "Generic inventory events are disabled until event-specific conservation, approvals, and custody evidence are implemented.");
  const input = args.input; const eventType = assertText(input.eventType, "Event type");
  if (!isManagedInventoryEventType(eventType) || !(EVENT_STATUS[eventType] as readonly string[]).includes(input.nextStatus)) throw new Error("Event type cannot produce the requested package status");
  const delta = assertInteger(Math.abs(input.quantityDeltaMicrounits), "Quantity delta", 0) * (input.quantityDeltaMicrounits < 0 ? -1 : 1);
  assertInventoryEventQuantityDelta(eventType, delta);
  const expectedVersion = assertInteger(input.expectedVersion, "Expected package version", 1);
  if (DUAL_APPROVAL.has(eventType) && (!input.approvedById || input.approvedById === (context.session as any)?.itemId)) throw new Error("This inventory event requires an independent approver");
  return runControlledOperation(context, input, { permission: eventType.startsWith("recall") ? "canManageCompliance" : "canManageInventory", activity: "inventory", scope: `postInventory:${eventType}`, resourceType: "InventoryPackage", action: `inventory.${eventType}`, lockKeys: [String(input.packageId)] }, async (tx, authority, correlationId) => {
    const sudo = tx.sudo();
    const pkg = await sudo.query.InventoryPackage.findOne({ where: { id: assertText(input.packageId, "Package ID") }, query: "id packageUid status testStatus expiresAt coaReference labelVersion quantityOnHandMicrounits reservedMicrounits version organization { id } premises { id } holds(where: { status: { equals: active } }, take: 1) { id }" });
    if (!pkg || pkg.organization?.id !== authority.organizationId || pkg.premises?.id !== authority.premisesId) throw new Error("Package is outside the actor authority scope");
    assertInventoryDestructionQuantityDelta(eventType, pkg.quantityOnHandMicrounits, delta);
    assertTransition(pkg.status, input.nextStatus, PACKAGE_TRANSITIONS);
    if (input.nextStatus === "saleable" && (pkg.testStatus !== "passed" || !pkg.coaReference || !pkg.labelVersion || new Date(pkg.expiresAt) <= new Date() || pkg.holds?.length)) throw new Error("Package cannot be released without passed tests, authoritative COA/label, future expiry, and no active holds");
    const after = pkg.quantityOnHandMicrounits + delta;
    if (!Number.isSafeInteger(after) || after < 0 || after < pkg.reservedMicrounits) throw new Error("Inventory event would violate package quantity or reservations");
    if (pkg.version !== expectedVersion) throw new Error("Package changed; recount and retry with the current version");
    const updated = await tx.prisma.inventoryPackage.updateMany({ where: { id: pkg.id, version: expectedVersion, quantityOnHandMicrounits: pkg.quantityOnHandMicrounits }, data: { quantityOnHandMicrounits: after, status: input.nextStatus, version: { increment: 1 } } });
    if (updated.count !== 1) throw new Error("Concurrent package update detected");
    let approver: any = null;
    if (input.approvedById) {
      approver = await sudo.query.User.findOne({ where: { id: input.approvedById }, query: "id status organization { id } premises { id } role { canManageCompliance canManageInventory }" });
      if (!approver || approver.status !== "active" || approver.organization?.id !== authority.organizationId || approver.premises?.id !== authority.premisesId || (!approver.role?.canManageCompliance && !approver.role?.canManageInventory)) throw new Error("Independent approver lacks current premises authority");
    }
    const evidenceHash = stableHash(input.evidence || {});
    const manifest = await sudo.query.RegulatedManifest.createOne({ data: {
      organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, manifestNumber: assertText(input.manifestNumber, "Manifest number"), type: eventType === "transfer_out" || eventType === "transfer_in" ? eventType : eventType === "recall_hold" || eventType === "recall_release" ? "recall" : eventType === "count" ? "count" : eventType === "waste" ? "waste" : eventType === "destruction" ? "destruction" : "adjustment",
      status: eventType === "transfer_out" ? "dispatched" : input.nextStatus === "destroyed" ? "completed" : "accepted", sourceLicenseNumber: input.sourceLicenseNumber || authority.license.licenseNumber, destinationLicenseNumber: input.destinationLicenseNumber || authority.license.licenseNumber,
      regulatorManifestId: input.regulatorManifestId || "", occurredAt: new Date(), reasonCode: assertText(input.reasonCode, "Reason code"), evidence: input.evidence || {}, evidenceHash, actor: { connect: { id: authority.actor.id } }, ...(approver ? { approvedBy: { connect: { id: approver.id } } } : {}),
    }, query: "id manifestNumber" });
    await sudo.query.InventoryEvent.createOne({ data: {
      organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, package: { connect: { id: pkg.id } }, manifest: { connect: { id: manifest.id } }, eventType,
      quantityDeltaMicrounits: delta, beforeQuantityMicrounits: pkg.quantityOnHandMicrounits, afterQuantityMicrounits: after, reasonCode: input.reasonCode, actor: { connect: { id: authority.actor.id } }, ...(approver ? { approvedBy: { connect: { id: approver.id } } } : {}),
      sourceType: "RegulatedManifest", sourceId: manifest.id, idempotencyKey: `${correlationId}:${eventType}`, occurredAt: new Date(), evidenceHash, stateReportStatus: "queued",
    }, query: "id" });
    if (eventType === "recall_hold") {
      await sudo.query.PackageHold.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, package: { connect: { id: pkg.id } }, type: "recall", status: "active", reasonCode: input.reasonCode, reason: assertText(input.reason, "Recall reason", 4), placedBy: { connect: { id: authority.actor.id } }, placedAt: new Date(), evidenceHash }, query: "id" });
      await sudo.query.RecallCase.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, reference: assertText(input.recallReference, "Recall reference"), status: "active", authorityReference: assertText(input.recallAuthorityReference, "Recall authority reference"), packageUids: [pkg.packageUid], batchNumbers: input.batchNumbers || [], reason: input.reason, openedAt: new Date(), evidenceHash }, query: "id" });
    }
    return { id: pkg.id, status: input.nextStatus, reference: pkg.packageUid, quantityOnHandMicrounits: after, version: expectedVersion + 1, stateReport: { eventType, packageUid: pkg.packageUid, quantityDeltaMicrounits: delta, manifestNumber: manifest.manifestNumber, reasonCode: input.reasonCode } };
  });
}
