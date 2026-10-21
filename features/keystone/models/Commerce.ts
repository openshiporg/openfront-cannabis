import { list } from "@keystone-6/core";
import { checkbox, integer, json, relationship, select, text, timestamp } from "@keystone-6/core/fields";
import { immutablePremisesAccess } from "../access";
import { trackingFields } from "./trackingFields";

const status = (values: string[], defaultValue?: string) => select({ type: "enum", options: values.map(value => ({ label: value.replaceAll("_", " "), value })), ...(defaultValue ? { defaultValue } : {}), validation: { isRequired: true } });
const org = () => relationship({ ref: "Organization" });
const site = () => relationship({ ref: "Premises" });

export const Register = list({
  access: immutablePremisesAccess("canManageFinance"),
  fields: { organization: org(), premises: site(), code: text({ validation: { isRequired: true }, isIndexed: "unique" }), name: text({ validation: { isRequired: true } }), status: status(["active", "inactive", "maintenance"], "active"), ...trackingFields },
});

export const RegisterShift = list({
  access: immutablePremisesAccess("canManageFinance"),
  fields: {
    organization: org(), premises: site(), register: relationship({ ref: "Register" }), operator: relationship({ ref: "User" }),
    status: status(["scheduled", "open", "count_pending", "counted", "variance_review", "closed", "deposited"], "scheduled"),
    openingFloatCents: integer({ validation: { min: 0, isRequired: true } }), expectedCashCents: integer({ validation: { min: 0 } }), actualCashCents: integer({ validation: { min: 0 } }), varianceCents: integer(),
    openedAt: timestamp(), countedAt: timestamp(), closedAt: timestamp(), approvedBy: relationship({ ref: "User" }), evidenceHash: text({ validation: { isRequired: true } }),
    cashEvents: relationship({ ref: "CashEvent.shift", many: true }), sales: relationship({ ref: "Sale.shift", many: true }), ...trackingFields,
  },
});

export const CashEvent = list({
  access: immutablePremisesAccess("canManageFinance"),
  fields: {
    organization: org(), premises: site(), shift: relationship({ ref: "RegisterShift.cashEvents" }), type: status(["opening_float", "sale", "refund", "paid_in", "paid_out", "safe_drop", "count", "deposit"]),
    amountCents: integer({ validation: { isRequired: true } }), reasonCode: text({ validation: { isRequired: true } }), actor: relationship({ ref: "User" }), approvedBy: relationship({ ref: "User" }),
    occurredAt: timestamp({ validation: { isRequired: true } }), idempotencyKey: text({ validation: { isRequired: true }, isIndexed: "unique" }), evidenceHash: text({ validation: { isRequired: true } }), ...trackingFields,
  },
});

export const TenderConfiguration = list({
  access: immutablePremisesAccess("canManageFinance"),
  fields: {
    organization: org(), premises: site(), code: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    type: status(["cash", "debit", "ach", "wallet", "other"]), displayName: text({ validation: { isRequired: true } }), enabled: checkbox({ defaultValue: false }),
    providerCode: text(), authorityReference: text({ validation: { isRequired: true } }), effectiveAt: timestamp({ validation: { isRequired: true } }), expiresAt: timestamp({ validation: { isRequired: true } }),
    ...trackingFields,
  },
});

export const Cart = list({
  access: immutablePremisesAccess("canManageSales"),
  fields: {
    organization: org(), premises: site(), customer: relationship({ ref: "Customer" }), shift: relationship({ ref: "RegisterShift" }),
    reference: text({ validation: { isRequired: true }, isIndexed: "unique" }), source: status(["pos", "pickup", "customer_intake"]), status: status(["draft", "preliminarily_eligible", "reserved", "picking", "staged", "final_verification", "completed", "expired", "cancelled", "rejected"], "draft"),
    guestProofHash: text({ isFilterable: false, isOrderable: false, access: { read: () => false, create: () => false, update: () => false } }), expiresAt: timestamp({ validation: { isRequired: true } }),
    rulePack: relationship({ ref: "JurisdictionRulePack" }), eligibilityEvidence: relationship({ ref: "EligibilityEvidence" }),
    subtotalCents: integer({ defaultValue: 0, validation: { min: 0 } }), discountCents: integer({ defaultValue: 0, validation: { min: 0 } }), taxCents: integer({ defaultValue: 0, validation: { min: 0 } }), totalCents: integer({ defaultValue: 0, validation: { min: 0 } }),
    lines: relationship({ ref: "CartLine.cart", many: true }), version: integer({ defaultValue: 1, validation: { min: 1 } }), ...trackingFields,
  },
});

export const CartLine = list({
  access: immutablePremisesAccess("canManageSales"),
  fields: {
    organization: org(), premises: site(), cart: relationship({ ref: "Cart.lines" }), idempotencyKey: text({ validation: { isRequired: true }, isIndexed: "unique" }), package: relationship({ ref: "InventoryPackage" }), product: relationship({ ref: "Product" }),
    quantityMicrounits: integer({ validation: { min: 1, isRequired: true } }), equivalencyMicrounits: integer({ validation: { min: 1, isRequired: true } }),
    titleSnapshot: text({ validation: { isRequired: true } }), skuSnapshot: text({ validation: { isRequired: true } }), categoryCodeSnapshot: text({ validation: { isRequired: true } }), packageUidSnapshot: text({ validation: { isRequired: true } }), batchSnapshot: text({ validation: { isRequired: true } }), potencySnapshot: json({ defaultValue: {} }),
    unitPriceCents: integer({ validation: { min: 0, isRequired: true } }), subtotalCents: integer({ validation: { min: 0, isRequired: true } }), discountCents: integer({ defaultValue: 0, validation: { min: 0 } }), discountSnapshot: json({ defaultValue: {} }), taxBasisPoints: integer({ validation: { min: 0, max: 100000, isRequired: true } }), taxCents: integer({ validation: { min: 0, isRequired: true } }), totalCents: integer({ validation: { min: 0, isRequired: true } }),
    ...trackingFields,
  },
});

export const Sale = list({
  access: immutablePremisesAccess("canManageSales"),
  fields: {
    organization: org(), premises: site(), shift: relationship({ ref: "RegisterShift.sales" }), customer: relationship({ ref: "Customer" }), cart: relationship({ ref: "Cart" }),
    receiptNumber: text({ validation: { isRequired: true }, isIndexed: "unique" }), status: status(["finalized", "state_queued", "state_accepted", "state_rejected", "reconciled", "reversal_pending", "reversed", "partially_refunded", "refunded"]),
    customerCapacitySnapshot: text({ validation: { isRequired: true } }), rulePackVersion: text({ validation: { isRequired: true } }), eligibilityEvidenceHash: text({ validation: { isRequired: true } }), purchaseLimitEvaluation: json({ defaultValue: {} }),
    subtotalCents: integer({ validation: { min: 0, isRequired: true } }), discountCents: integer({ validation: { min: 0, isRequired: true } }), taxCents: integer({ validation: { min: 0, isRequired: true } }), totalCents: integer({ validation: { min: 0, isRequired: true } }), refundedCents: integer({ defaultValue: 0, validation: { min: 0 } }),
    finalizedAt: timestamp({ validation: { isRequired: true } }), lines: relationship({ ref: "SaleLine.sale", many: true }), tenders: relationship({ ref: "Tender.sale", many: true }), refunds: relationship({ ref: "Refund.sale", many: true }),
    receiptSnapshot: json({ defaultValue: {} }), receiptHash: text({ validation: { isRequired: true } }), labelSnapshot: json({ defaultValue: {} }), labelHash: text({ validation: { isRequired: true } }), ...trackingFields,
  },
});

export const SaleLine = list({
  access: immutablePremisesAccess("canManageSales"),
  fields: {
    organization: org(), premises: site(), sale: relationship({ ref: "Sale.lines" }), package: relationship({ ref: "InventoryPackage" }),
    titleSnapshot: text({ validation: { isRequired: true } }), skuSnapshot: text({ validation: { isRequired: true } }), categoryCodeSnapshot: text({ validation: { isRequired: true } }), packageUidSnapshot: text({ validation: { isRequired: true } }), batchSnapshot: text({ validation: { isRequired: true } }), coaReferenceSnapshot: text(), potencySnapshot: json({ defaultValue: {} }),
    quantityMicrounits: integer({ validation: { min: 1, isRequired: true } }), equivalencyMicrounits: integer({ validation: { min: 1, isRequired: true } }), unitPriceCents: integer({ validation: { min: 0, isRequired: true } }), discountCents: integer({ validation: { min: 0, isRequired: true } }), discountSnapshot: json({ defaultValue: {} }), taxCents: integer({ validation: { min: 0, isRequired: true } }), totalCents: integer({ validation: { min: 0, isRequired: true } }),
    ...trackingFields,
  },
});

export const Tender = list({
  access: immutablePremisesAccess("canManageFinance"),
  fields: {
    organization: org(), premises: site(), sale: relationship({ ref: "Sale.tenders" }), configuration: relationship({ ref: "TenderConfiguration" }), typeSnapshot: text({ validation: { isRequired: true } }),
    amountCents: integer({ validation: { min: 0, isRequired: true } }), tenderedCents: integer({ validation: { min: 0 } }), changeCents: integer({ defaultValue: 0, validation: { min: 0 } }),
    status: status(["received", "authorized", "captured", "reversed", "failed"], "received"), providerReference: text(), idempotencyKey: text({ validation: { isRequired: true }, isIndexed: "unique" }), evidenceHash: text({ validation: { isRequired: true } }), ...trackingFields,
  },
});

export const Refund = list({
  access: immutablePremisesAccess("canManageFinance"),
  fields: {
    organization: org(), premises: site(), sale: relationship({ ref: "Sale.refunds" }), amountCents: integer({ validation: { min: 1, isRequired: true } }),
    reasonCode: text({ validation: { isRequired: true } }), inventoryDisposition: status(["none", "quarantine", "waste", "returned_to_authority"]), status: status(["pending", "completed", "failed", "reconciled"], "pending"),
    actor: relationship({ ref: "User" }), approvedBy: relationship({ ref: "User" }), originalTenderReference: text(), providerReference: text(), occurredAt: timestamp({ validation: { isRequired: true } }), evidenceHash: text({ validation: { isRequired: true } }), ...trackingFields,
  },
});
