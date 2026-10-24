import { User } from "./User";
import { Role } from "./Role";
import {
  Organization, Premises, StorefrontSettings, CannabisLicense, StaffCredential, Customer,
  EligibilityEvidence, JurisdictionRulePack,
} from "./Authority";
import {
  Product, InventoryPackage, PackageHold, RegulatedManifest, InventoryEvent, RecallCase,
} from "./Inventory";
import {
  Register, RegisterShift, CashEvent, TenderConfiguration, Cart, CartLine,
  Sale, SaleLine, Tender, Refund,
} from "./Commerce";
import {
  AuditEvent, IdempotencyKey, OutboxEvent, StateEventInbox,
  IntegrationInstallation, ReconciliationRun, ComplianceIncident,
} from "./Operations";

export const models = {
  User, Role,
  Organization, Premises, StorefrontSettings, CannabisLicense, StaffCredential, Customer,
  EligibilityEvidence, JurisdictionRulePack,
  Product, InventoryPackage, PackageHold, RegulatedManifest, InventoryEvent, RecallCase,
  Register, RegisterShift, CashEvent, TenderConfiguration, Cart, CartLine,
  Sale, SaleLine, Tender, Refund,
  AuditEvent, IdempotencyKey, OutboxEvent, StateEventInbox,
  IntegrationInstallation, ReconciliationRun, ComplianceIncident,
};

// Readable labels and columns for the generic model views, so rows and item titles aren't bare IDs.
// User leaves out password: its read access is denied, so a column would always say "not set".
const LIST_VIEWS: Record<string, [labelField: string, columns: string[]]> = {
  User: ["name", ["name", "email", "status", "role", "onboardingStatus"]],
  Role: ["name", ["name", "canManageAuthority", "canManageInventory", "canManageSales"]],
  Organization: ["name", ["name", "legalName", "jurisdictionCode", "status"]],
  Premises: ["name", ["name", "premisesCode", "timezone", "status"]],
  StorefrontSettings: ["businessName", ["businessName", "publicationStatus", "storefrontMode", "updatedAt"]],
  CannabisLicense: ["licenseNumber", ["licenseNumber", "licenseType", "status", "expiresAt"]],
  StaffCredential: ["credentialReference", ["credentialReference", "user", "credentialType", "status", "expiresAt"]],
  Customer: ["reference", ["reference", "capacity", "status", "createdAt"]],
  EligibilityEvidence: ["identityMethod", ["customer", "capacity", "result", "verifiedAt"]],
  JurisdictionRulePack: ["version", ["version", "status", "effectiveAt", "expiresAt"]],
  Product: ["name", ["name", "sku", "form", "categoryCode", "taxCategoryCode", "status"]],
  InventoryPackage: ["packageUid", ["packageUid", "product", "status", "testStatus", "expiresAt"]],
  PackageHold: ["reasonCode", ["package", "type", "reasonCode", "status", "placedAt"]],
  RegulatedManifest: ["manifestNumber", ["manifestNumber", "type", "status", "occurredAt"]],
  InventoryEvent: ["eventType", ["package", "eventType", "reasonCode", "occurredAt"]],
  RecallCase: ["reference", ["reference", "status", "reason", "openedAt"]],
  Register: ["name", ["name", "code", "status"]],
  RegisterShift: ["status", ["register", "operator", "status", "openedAt", "varianceCents"]],
  CashEvent: ["type", ["shift", "type", "amountCents", "occurredAt"]],
  TenderConfiguration: ["displayName", ["displayName", "type", "enabled", "expiresAt"]],
  Cart: ["reference", ["reference", "status", "totalCents", "expiresAt"]],
  CartLine: ["titleSnapshot", ["cart", "titleSnapshot", "quantityMicrounits", "totalCents"]],
  Sale: ["receiptNumber", ["receiptNumber", "status", "totalCents", "finalizedAt"]],
  SaleLine: ["titleSnapshot", ["sale", "titleSnapshot", "quantityMicrounits", "totalCents"]],
  Tender: ["typeSnapshot", ["sale", "typeSnapshot", "status", "amountCents"]],
  Refund: ["reasonCode", ["sale", "reasonCode", "status", "amountCents", "occurredAt"]],
  AuditEvent: ["action", ["action", "resourceType", "actor", "occurredAt"]],
  IdempotencyKey: ["scope", ["scope", "status", "startedAt", "completedAt"]],
  OutboxEvent: ["topic", ["topic", "status", "attempts", "availableAt"]],
  StateEventInbox: ["providerEventId", ["providerCode", "providerEventId", "status", "receivedAt"]],
  IntegrationInstallation: ["providerCode", ["providerCode", "providerType", "status"]],
  ReconciliationRun: ["type", ["type", "status", "discrepancyCount", "startedAt"]],
  ComplianceIncident: ["reference", ["reference", "type", "severity", "status", "occurredAt"]],
};

// Raw creation/deletion is denied for every current List. Keep those dead
// actions out of generic model views; domain commands remain the write surface.
for (const [key, model] of Object.entries(models)) {
  const view = LIST_VIEWS[key];
  model.ui = { ...model.ui, hideCreate: true, hideDelete: true,
    ...(view ? { labelField: view[0], listView: { ...model.ui?.listView, initialColumns: view[1] } } : {}),
    ...(key === 'User' ? {} : { itemView: { ...model.ui?.itemView, defaultFieldMode: 'read' as const } }),
  };
}

export default models;
