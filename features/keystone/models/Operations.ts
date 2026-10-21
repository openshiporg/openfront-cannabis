import { list } from "@keystone-6/core";
import { integer, json, relationship, select, text, timestamp } from "@keystone-6/core/fields";
import { immutablePremisesAccess } from "../access";
import { trackingFields } from "./trackingFields";

const status = (values: string[], defaultValue?: string) => select({ type: "enum", options: values.map(value => ({ label: value.replaceAll("_", " "), value })), ...(defaultValue ? { defaultValue } : {}), validation: { isRequired: true } });
const org = () => relationship({ ref: "Organization" });
const site = () => relationship({ ref: "Premises" });

export const AuditEvent = list({
  access: immutablePremisesAccess("canViewReports"),
  fields: {
    organization: org(), premises: site(), actor: relationship({ ref: "User" }), action: text({ validation: { isRequired: true } }), resourceType: text({ validation: { isRequired: true } }), resourceId: text({ validation: { isRequired: true } }),
    correlationId: text({ validation: { isRequired: true }, isIndexed: true }), reasonCode: text({ validation: { isRequired: true } }), evidence: json({ defaultValue: {} }), evidenceHash: text({ validation: { isRequired: true } }), occurredAt: timestamp({ validation: { isRequired: true } }), ...trackingFields,
  },
});

export const IdempotencyKey = list({
  access: immutablePremisesAccess("canViewReports"),
  fields: {
    organization: org(), premises: site(), scope: text({ validation: { isRequired: true } }), lookupKey: text({ validation: { isRequired: true }, isIndexed: "unique" }), requestHash: text({ validation: { isRequired: true } }),
    status: status(["processing", "succeeded", "failed"], "processing"), responseSnapshot: json(),
    // Original command (credentials/proofs removed), read only by the owning actor's recovery query.
    requestSnapshot: json({ access: { read: () => false, create: () => false, update: () => false } }), startedAt: timestamp({ validation: { isRequired: true } }), completedAt: timestamp(), expiresAt: timestamp({ validation: { isRequired: true } }), actor: relationship({ ref: "User" }), ...trackingFields,
  },
});

export const OutboxEvent = list({
  access: immutablePremisesAccess("canManageIntegrations"),
  fields: {
    organization: org(), premises: site(), eventKey: text({ validation: { isRequired: true }, isIndexed: "unique" }), topic: text({ validation: { isRequired: true } }), aggregateType: text({ validation: { isRequired: true } }), aggregateId: text({ validation: { isRequired: true } }),
    payload: json({ defaultValue: {} }), requestHash: text({ validation: { isRequired: true } }), idempotencyKey: text({ validation: { isRequired: true } }),
    status: status(["queued", "sending", "accepted", "rejected", "retryable", "dead_letter", "reconciled"], "queued"), attempts: integer({ defaultValue: 0, validation: { min: 0 } }), availableAt: timestamp({ validation: { isRequired: true } }), lastAttemptAt: timestamp(), acceptedAt: timestamp(), regulatorReference: text(), lastErrorCode: text(),
    ...trackingFields,
  },
});

export const StateEventInbox = list({
  access: immutablePremisesAccess("canManageIntegrations"),
  fields: {
    organization: org(), premises: site(), providerCode: text({ validation: { isRequired: true } }), providerEventId: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    payloadHash: text({ validation: { isRequired: true } }), signatureEvidence: text({ validation: { isRequired: true } }), status: status(["received", "verified", "processed", "rejected", "needs_review"], "received"),
    receivedAt: timestamp({ validation: { isRequired: true } }), processedAt: timestamp(), rejectionReason: text(), payload: json({ defaultValue: {} }), ...trackingFields,
  },
});

export const IntegrationInstallation = list({
  access: immutablePremisesAccess("canManageIntegrations"),
  fields: {
    organization: org(), premises: site(), providerCode: text({ validation: { isRequired: true } }), providerType: status(["traceability", "patient_registry", "identity", "laboratory", "payment", "tax"]),
    status: status(["unconfigured", "pending_validation", "active", "suspended", "revoked"], "unconfigured"), credentialReference: text({ isFilterable: false, isOrderable: false, access: { read: () => false, create: () => false, update: () => false } }),
    facilityReference: text(), capabilities: json({ defaultValue: [] }), validatedAt: timestamp(), authorityReference: text({ validation: { isRequired: true } }), lastSuccessfulSyncAt: timestamp(), ...trackingFields,
  },
});

export const ReconciliationRun = list({
  access: immutablePremisesAccess("canViewReports"),
  fields: {
    organization: org(), premises: site(), type: status(["inventory_state_physical", "sale_package", "tender_settlement", "tax", "cash", "outbox"]),
    status: status(["pending", "running", "exceptions", "balanced", "approved", "failed"], "pending"), startedAt: timestamp({ validation: { isRequired: true } }), completedAt: timestamp(),
    localSnapshotHash: text({ validation: { isRequired: true } }), externalSnapshotHash: text(), discrepancyCount: integer({ defaultValue: 0, validation: { min: 0 } }), discrepancies: json({ defaultValue: [] }), owner: relationship({ ref: "User" }), approvedBy: relationship({ ref: "User" }), evidenceHash: text({ validation: { isRequired: true } }), ...trackingFields,
  },
});

export const ComplianceIncident = list({
  access: immutablePremisesAccess("canManageCompliance"),
  fields: {
    organization: org(), premises: site(), reference: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    type: status(["refusal_of_sale", "identity", "patient_registry_outage", "traceability_outage", "payment_ambiguity", "inventory_discrepancy", "theft", "loss", "diversion", "recall", "privacy", "security", "system_outage", "offline_attempt"]),
    severity: status(["low", "medium", "high", "critical"]), status: status(["open", "contained", "investigating", "reported", "resolved", "closed"], "open"),
    occurredAt: timestamp({ validation: { isRequired: true } }), detectedAt: timestamp({ validation: { isRequired: true } }), notificationDueAt: timestamp(), reportedAt: timestamp(),
    description: text({ validation: { isRequired: true } }), affectedPackageUids: json({ defaultValue: [] }), customerReferenceHash: text(), outageMode: status(["none", "fail_closed", "approved_degraded"], "none"),
    recoveryQueueReference: text(), authorityReference: text(), actor: relationship({ ref: "User" }), owner: relationship({ ref: "User" }), evidenceHash: text({ validation: { isRequired: true } }), ...trackingFields,
  },
});
