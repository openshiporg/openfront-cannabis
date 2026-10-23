import { list } from "@keystone-6/core";
import { checkbox, integer, json, relationship, select, text, timestamp } from "@keystone-6/core/fields";
import { denyAll } from "@keystone-6/core/access";
import { operationalPermissions, immutableOrganizationAccess, immutablePremisesAccess, immutableTenantAccess } from "../access";
import { trackingFields } from "./trackingFields";
import { sanitizeStoreLogoSvg } from "../../lib/sanitize-store-logo";
import { DEFAULT_STORE_LOGO_ICON, DEFAULT_STORE_LOGO_COLOR, normalizeStoreLogoColor } from "../../lib/store-logo";

const status = (values: string[], defaultValue?: string) => select({
  type: "enum", options: values.map(value => ({ label: value.replaceAll("_", " "), value })),
  ...(defaultValue ? { defaultValue } : {}), validation: { isRequired: true },
});
const org = () => relationship({ ref: "Organization" });
const site = () => relationship({ ref: "Premises" });

export const Organization = list({
  access: immutableOrganizationAccess("canManageAuthority"),
  fields: {
    name: text({ validation: { isRequired: true } }),
    legalName: text({ validation: { isRequired: true } }),
    status: status(["pending_authority", "active", "suspended", "closed"], "pending_authority"),
    jurisdictionCode: text({ validation: { isRequired: true }, isIndexed: true }),
    premises: relationship({ ref: "Premises.organization", many: true }),
    storefrontSettings: relationship({ ref: "StorefrontSettings.organization", many: true }),
    users: relationship({ ref: "User.organization", many: true }),
    ...trackingFields,
  },
});

export const Premises = list({
  graphql: { plural: "CannabisPremises" },
  // The dashboard derives GraphQL names from the UI plural; "Premises" alone would equal the list key and fail every list.
  ui: { plural: "Cannabis Premises" },
  access: immutableTenantAccess("canManageAuthority"),
  fields: {
    organization: relationship({ ref: "Organization.premises" }),
    name: text({ validation: { isRequired: true } }),
    premisesCode: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    addressSnapshot: json({ defaultValue: {} }),
    timezone: text({ validation: { isRequired: true } }),
    // ISO 4217 code for every amount recorded at this premises; null on premises installed before it was captured.
    currencyCode: text({ db: { isNullable: true }, validation: { match: { regex: /^[A-Z]{3}$/, explanation: "Currency must be a three-letter ISO 4217 code" } } }),
    status: status(["pending_authority", "active", "suspended", "closed"], "pending_authority"),
    users: relationship({ ref: "User.premises", many: true }),
    storefrontSettings: relationship({ ref: "StorefrontSettings.premises", many: true }),
    ...trackingFields,
  },
});

export const StorefrontSettings = list({
  graphql: { plural: "CannabisStorefrontSettings" },
  // As for Premises: the UI plural must map to the GraphQL plural, not to the list key.
  ui: { plural: "Cannabis Storefront Settings" },
  access: immutablePremisesAccess("canManageAuthority", "authority"),
  db: {
    extendPrismaSchema(schema) {
      return schema.replace(/\n}/, '\n  @@unique([organizationId, premisesId], map: "StorefrontSettings_authority_scope_key")\n}');
    },
  },
  fields: {
    organization: relationship({
      ref: "Organization.storefrontSettings",
      access: { create: denyAll, update: denyAll },
      graphql: { isNonNull: { read: true } },
      db: { extendPrismaSchema: field => field.replace(/organization Organization\?/g, "organization Organization").replace(/organizationId String\?/g, "organizationId String") },
    }),
    premises: relationship({
      ref: "Premises.storefrontSettings",
      access: { create: denyAll, update: denyAll },
      graphql: { isNonNull: { read: true } },
      db: { extendPrismaSchema: field => field.replace(/premises Premises\?/g, "premises Premises").replace(/premisesId String\?/g, "premisesId String") },
    }),
    businessName: text({ validation: { isRequired: true, length: { min: 1, max: 120 } } }),
    tagline: text({ validation: { length: { max: 180 } } }),
    description: text({ validation: { length: { max: 240 } }, ui: { displayMode: "textarea" } }),
    brandHue: integer({ defaultValue: 215, validation: { isRequired: true, min: 0, max: 359 } }),
    // Restaurant StoreSettings lineage: enforce SVG allowlist even through sudo model writes.
    logoIcon: text({ defaultValue: DEFAULT_STORE_LOGO_ICON, hooks: {
      resolveInput: ({ resolvedData, fieldKey }) => {
        const value = resolvedData[fieldKey];
        return value === undefined || value === null || value === '' ? value : typeof value === 'string' ? sanitizeStoreLogoSvg(value) : '';
      },
      validate: ({ inputData, resolvedData, fieldKey, addValidationError }) => {
        const submitted = inputData?.[fieldKey];
        if (typeof submitted === 'string' && submitted.trim() && !resolvedData?.[fieldKey]) addValidationError('Logo must be a valid, safe SVG document');
      },
    } }),
    logoColor: text({ defaultValue: DEFAULT_STORE_LOGO_COLOR, hooks: {
      resolveInput: ({ resolvedData, fieldKey }) => resolvedData[fieldKey] === undefined ? undefined : normalizeStoreLogoColor(resolvedData[fieldKey]),
    } }),
    publicationStatus: status(["draft", "published"], "draft"),
    storefrontMode: status(["demo", "configured"], "configured"),
    demoCatalog: json({ defaultValue: [] }),
    ...trackingFields,
  },
});

export const CannabisLicense = list({
  access: immutablePremisesAccess("canManageAuthority", "authority"),
  fields: {
    organization: org(), premises: site(),
    licenseNumber: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    licenseType: text({ validation: { isRequired: true } }),
    regulatorName: text({ validation: { isRequired: true } }),
    authorizedActivities: json({ defaultValue: [] }),
    status: status(["draft", "active", "conditioned", "suspended", "expired", "revoked", "surrendered"], "draft"),
    effectiveAt: timestamp({ validation: { isRequired: true } }), expiresAt: timestamp({ validation: { isRequired: true } }),
    verifiedAt: timestamp(), authorityReference: text({ validation: { isRequired: true } }),
    ...trackingFields,
  },
});

export const StaffCredential = list({
  access: immutablePremisesAccess("canManageAuthority", "authority"),
  fields: {
    organization: org(), premises: site(), user: relationship({ ref: "User.staffCredential" }),
    credentialType: text({ validation: { isRequired: true } }), credentialReference: text({ validation: { isRequired: true } }),
    allowedActivities: json({ defaultValue: [] }), approvalLimitCents: integer({ defaultValue: 0, validation: { min: 0 } }),
    status: status(["pending", "active", "suspended", "expired", "terminated"], "pending"),
    effectiveAt: timestamp({ validation: { isRequired: true } }), expiresAt: timestamp({ validation: { isRequired: true } }),
    trainingVerifiedAt: timestamp(), authorityVerifiedAt: timestamp(), evidenceHash: text({ validation: { isRequired: true } }),
    ...trackingFields,
  },
});

export const Customer = list({
  access: immutablePremisesAccess("canManageCompliance"),
  fields: {
    organization: org(), premises: site(), user: relationship({ ref: "User.customerProfile" }),
    reference: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    capacity: status(["adult_use", "patient", "caregiver"]),
    status: status(["pending_verification", "eligible", "ineligible", "suspended"], "pending_verification"),
    marketingConsent: checkbox({ defaultValue: false }),
    intakeProofHash: text({ isFilterable: false, isOrderable: false, access: { read: denyAll, create: denyAll, update: denyAll } }),
    contact: json({ access: { read: operationalPermissions.canManageCompliance, create: denyAll, update: denyAll } }),
    ...trackingFields,
  },
});

export const EligibilityEvidence = list({
  access: immutablePremisesAccess("canManageCompliance"),
  fields: {
    organization: org(), premises: site(), customer: relationship({ ref: "Customer" }),
    capacity: status(["adult_use", "patient", "caregiver"]),
    identityMethod: text({ validation: { isRequired: true } }), identityReferenceHash: text({ validation: { isRequired: true } }),
    dateOfBirth: timestamp({ validation: { isRequired: true } }), identityExpiresAt: timestamp({ validation: { isRequired: true } }),
    registryName: text(), registryReferenceHash: text(), registryVerifiedAt: timestamp(), registryExpiresAt: timestamp(),
    representedPatientReferenceHash: text(), allotmentRemainingMicrounits: integer({ validation: { min: 0 } }),
    result: status(["pending", "eligible", "ineligible", "expired", "revoked"], "pending"),
    reasonCodes: json({ defaultValue: [] }), evidenceHash: text({ validation: { isRequired: true } }), verifiedAt: timestamp(),
    ...trackingFields,
  },
});

export const JurisdictionRulePack = list({
  access: immutablePremisesAccess("canManageCompliance", "authority"),
  fields: {
    organization: org(), premises: site(), version: text({ validation: { isRequired: true } }),
    jurisdictionCode: text({ validation: { isRequired: true } }), authorityCitations: json({ defaultValue: [] }), policyHash: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    status: status(["draft", "approved", "effective", "superseded", "revoked"], "draft"),
    effectiveAt: timestamp({ validation: { isRequired: true } }), expiresAt: timestamp({ validation: { isRequired: true } }), approvedAt: timestamp(), approvedBy: relationship({ ref: "User" }),
    adultMinimumAge: integer({ validation: { min: 0, max: 120, isRequired: true } }), medicalMinimumAge: integer({ validation: { min: 0, max: 120, isRequired: true } }),
    operatingStartMinute: integer({ validation: { min: 0, max: 1439, isRequired: true } }), operatingEndMinute: integer({ validation: { min: 0, max: 1439, isRequired: true } }),
    purchaseLimits: json({ defaultValue: [] }), taxRules: json({ defaultValue: [] }), discountRules: json({ defaultValue: [] }), allowedTenderTypes: json({ defaultValue: [] }),
    labelRequirements: json({ defaultValue: [] }), returnRules: json({ defaultValue: {} }), outagePolicy: json({ defaultValue: {} }), privacyRules: json({ defaultValue: {} }), retentionRules: json({ defaultValue: {} }),
    medicalEnabled: checkbox({ defaultValue: false }), pickupEnabled: checkbox({ defaultValue: false }), deliveryEnabled: checkbox({ defaultValue: false }), offlineSalesAllowed: checkbox({ defaultValue: false }),
    ...trackingFields,
  },
});
