import { list } from "@keystone-6/core";
import { checkbox, integer, json, relationship, select, text, timestamp } from "@keystone-6/core/fields";
import { immutablePremisesAccess } from "../access";
import { trackingFields } from "./trackingFields";

const status = (values: string[], defaultValue?: string) => select({ type: "enum", options: values.map(value => ({ label: value.replaceAll("_", " "), value })), ...(defaultValue ? { defaultValue } : {}), validation: { isRequired: true } });
const org = () => relationship({ ref: "Organization" });
const site = () => relationship({ ref: "Premises" });

export const Product = list({
  access: immutablePremisesAccess("canManageInventory"),
  fields: {
    organization: org(), premises: site(), sku: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    name: text({ validation: { isRequired: true } }), brand: text(), form: text({ validation: { isRequired: true } }), categoryCode: text({ validation: { isRequired: true } }),
    unitOfMeasure: text({ validation: { isRequired: true } }), unitQuantityMicrounits: integer({ validation: { min: 1, isRequired: true } }),
    equivalencyMicrounits: integer({ validation: { min: 1, isRequired: true } }), priceCents: integer({ validation: { min: 0, isRequired: true } }),
    taxCategoryCode: text({ validation: { isRequired: true } }), adultUseEligible: checkbox({ defaultValue: false }), medicalEligible: checkbox({ defaultValue: false }),
    status: status(["draft", "active", "inactive"], "draft"), publicDescription: text(), publicImageUrl: text(),
    packages: relationship({ ref: "InventoryPackage.product", many: true }), ...trackingFields,
  },
});

export const InventoryPackage = list({
  access: immutablePremisesAccess("canManageInventory"),
  fields: {
    organization: org(), premises: site(), product: relationship({ ref: "Product.packages" }),
    packageUid: text({ validation: { isRequired: true }, isIndexed: "unique" }), sourcePackageUid: text(), productionBatchNumber: text({ validation: { isRequired: true } }), lotNumber: text({ validation: { isRequired: true } }),
    quantityReceivedMicrounits: integer({ validation: { min: 1, isRequired: true } }), quantityOnHandMicrounits: integer({ validation: { min: 0, isRequired: true } }), reservedMicrounits: integer({ defaultValue: 0, validation: { min: 0 } }),
    unitOfMeasure: text({ validation: { isRequired: true } }), status: status(["expected_inbound", "receiving_hold", "quarantined", "saleable", "reserved", "staged", "transfer_allocated", "in_transit", "waste_pending", "recalled", "depleted", "destroyed"], "expected_inbound"),
    testStatus: status(["unknown", "pending", "passed", "failed", "retest"], "unknown"), labName: text(), labResultReference: text(), coaReference: text(), labVerifiedAt: timestamp(),
    manufacturedAt: timestamp(), receivedAt: timestamp(), expiresAt: timestamp({ validation: { isRequired: true } }), releasedAt: timestamp(),
    labelVersion: text({ validation: { isRequired: true } }), potencySnapshot: json({ defaultValue: {} }), lineage: json({ defaultValue: [] }),
    version: integer({ defaultValue: 1, validation: { min: 1 } }), holds: relationship({ ref: "PackageHold.package", many: true }),
    events: relationship({ ref: "InventoryEvent.package", many: true }), ...trackingFields,
  },
});

export const PackageHold = list({
  access: immutablePremisesAccess("canManageCompliance"),
  fields: {
    organization: org(), premises: site(), package: relationship({ ref: "InventoryPackage.holds" }),
    type: status(["quarantine", "test_hold", "recall", "discrepancy", "authority", "expiry"]), status: status(["active", "released", "disposed"], "active"),
    reasonCode: text({ validation: { isRequired: true } }), reason: text({ validation: { isRequired: true } }), placedBy: relationship({ ref: "User" }), placedAt: timestamp({ validation: { isRequired: true } }),
    releasedBy: relationship({ ref: "User" }), releasedAt: timestamp(), releaseAuthorityReference: text(), evidenceHash: text({ validation: { isRequired: true } }), ...trackingFields,
  },
});

export const RegulatedManifest = list({
  access: immutablePremisesAccess("canManageInventory"),
  fields: {
    organization: org(), premises: site(), manifestNumber: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    type: status(["receiving", "transfer_out", "transfer_in", "count", "adjustment", "waste", "destruction", "recall"]),
    status: status(["proposed", "manifested", "receiving_hold", "accepted", "partially_accepted", "rejected", "dispatched", "in_transit", "completed", "reconciled"], "proposed"),
    sourceLicenseNumber: text(), destinationLicenseNumber: text(), transporterReference: text(), regulatorManifestId: text(),
    occurredAt: timestamp({ validation: { isRequired: true } }), completedAt: timestamp(), reasonCode: text({ validation: { isRequired: true } }), evidence: json({ defaultValue: {} }), evidenceHash: text({ validation: { isRequired: true } }),
    actor: relationship({ ref: "User" }), approvedBy: relationship({ ref: "User" }), packageEvents: relationship({ ref: "InventoryEvent.manifest", many: true }), ...trackingFields,
  },
});

export const InventoryEvent = list({
  access: immutablePremisesAccess("canManageInventory"),
  fields: {
    organization: org(), premises: site(), package: relationship({ ref: "InventoryPackage.events" }), manifest: relationship({ ref: "RegulatedManifest.packageEvents" }),
    eventType: status(["receive", "release", "reserve", "release_reservation", "sale", "return_quarantine", "transfer_out", "transfer_in", "count", "adjustment", "waste", "destruction", "recall_hold", "recall_release"]),
    quantityDeltaMicrounits: integer({ validation: { isRequired: true } }), beforeQuantityMicrounits: integer({ validation: { min: 0, isRequired: true } }), afterQuantityMicrounits: integer({ validation: { min: 0, isRequired: true } }),
    reasonCode: text({ validation: { isRequired: true } }), actor: relationship({ ref: "User" }), approvedBy: relationship({ ref: "User" }),
    sourceType: text({ validation: { isRequired: true } }), sourceId: text({ validation: { isRequired: true }, isIndexed: true }), idempotencyKey: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    occurredAt: timestamp({ validation: { isRequired: true } }), evidenceHash: text({ validation: { isRequired: true } }), stateReportStatus: status(["local_recorded", "queued", "accepted", "rejected", "reconciled"], "local_recorded"),
    ...trackingFields,
  },
});

export const RecallCase = list({
  access: immutablePremisesAccess("canManageCompliance"),
  fields: {
    organization: org(), premises: site(), reference: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    status: status(["suspected", "hold", "scope_confirmed", "active", "monitoring", "disposition", "regulator_closed"], "suspected"),
    authorityReference: text({ validation: { isRequired: true } }), packageUids: json({ defaultValue: [] }), batchNumbers: json({ defaultValue: [] }),
    reason: text({ validation: { isRequired: true } }), openedAt: timestamp({ validation: { isRequired: true } }), closedAt: timestamp(), evidenceHash: text({ validation: { isRequired: true } }),
    ...trackingFields,
  },
});
