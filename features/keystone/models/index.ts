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

// Raw creation/deletion is denied for every current List. Keep those dead
// actions out of generic model views; domain commands remain the write surface.
for (const [key, model] of Object.entries(models)) {
  model.ui = { ...model.ui, hideCreate: true, hideDelete: true,
    ...(key === 'User' ? {} : { itemView: { ...model.ui?.itemView, defaultFieldMode: 'read' as const } }),
  };
}

export default models;
