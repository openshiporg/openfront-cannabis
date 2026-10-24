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
// Timestamps and cents stay off list columns: the shared cell renders them in the
// viewer's zone (hydration mismatch) and as raw integers. Platform pages show them.
const LIST_VIEWS: Record<string, [labelField: string, columns: string[]]> = {
  User: ["name", ["name", "email", "status", "role", "onboardingStatus"]],
  Role: ["name", ["name", "canManageAuthority", "canManageInventory", "canManageSales"]],
  Organization: ["name", ["name", "legalName", "jurisdictionCode", "status"]],
  Premises: ["name", ["name", "premisesCode", "timezone", "status"]],
  StorefrontSettings: ["businessName", ["businessName", "publicationStatus", "storefrontMode"]],
  CannabisLicense: ["licenseNumber", ["licenseNumber", "licenseType", "status"]],
  StaffCredential: ["credentialReference", ["credentialReference", "user", "credentialType", "status"]],
  Customer: ["reference", ["reference", "capacity", "status"]],
  EligibilityEvidence: ["identityMethod", ["customer", "capacity", "result"]],
  JurisdictionRulePack: ["version", ["version", "status"]],
  Product: ["name", ["name", "sku", "form", "categoryCode", "taxCategoryCode", "status"]],
  InventoryPackage: ["packageUid", ["packageUid", "product", "status", "testStatus"]],
  PackageHold: ["reasonCode", ["package", "type", "reasonCode", "status"]],
  RegulatedManifest: ["manifestNumber", ["manifestNumber", "type", "status"]],
  InventoryEvent: ["eventType", ["package", "eventType", "reasonCode"]],
  RecallCase: ["reference", ["reference", "status", "reason"]],
  Register: ["name", ["name", "code", "status"]],
  RegisterShift: ["status", ["register", "operator", "status"]],
  CashEvent: ["type", ["shift", "type"]],
  TenderConfiguration: ["displayName", ["displayName", "type", "enabled"]],
  Cart: ["reference", ["reference", "status"]],
  CartLine: ["titleSnapshot", ["cart", "titleSnapshot", "quantityMicrounits"]],
  Sale: ["receiptNumber", ["receiptNumber", "status"]],
  SaleLine: ["titleSnapshot", ["sale", "titleSnapshot", "quantityMicrounits"]],
  Tender: ["typeSnapshot", ["sale", "typeSnapshot", "status"]],
  Refund: ["reasonCode", ["sale", "reasonCode", "status"]],
  AuditEvent: ["action", ["action", "resourceType", "actor"]],
  IdempotencyKey: ["scope", ["scope", "status"]],
  OutboxEvent: ["topic", ["topic", "status", "attempts"]],
  StateEventInbox: ["providerEventId", ["providerCode", "providerEventId", "status"]],
  IntegrationInstallation: ["providerCode", ["providerCode", "providerType", "status"]],
  ReconciliationRun: ["type", ["type", "status", "discrepancyCount"]],
  ComplianceIncident: ["reference", ["reference", "type", "severity", "status"]],
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
