"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// keystone.ts
var keystone_exports = {};
__export(keystone_exports, {
  default: () => keystone_default2
});
module.exports = __toCommonJS(keystone_exports);

// features/keystone/index.ts
var import_auth = require("@keystone-6/auth");
var import_core7 = require("@keystone-6/core");
var import_config = require("dotenv/config");

// features/keystone/models/User.ts
var import_core = require("@keystone-6/core");
var import_access = require("@keystone-6/core/access");
var import_fields2 = require("@keystone-6/core/fields");

// features/keystone/access.ts
function isSignedIn({ session }) {
  return Boolean(session?.itemId) && session?.data.status !== "disabled";
}
var sessionPermission = (session, permission) => session?.data.status !== "disabled" && session?.data.role?.[permission] === true;
async function freshActor({ session, context }) {
  if (!session?.itemId || !context || session.data.status === "disabled") return null;
  const actor = await context.sudo().query.User.findOne({
    where: { id: session.itemId },
    query: `id status onboardingStatus organization { id } premises { id } role {
      canManagePeople canManageRoles canAccessDashboard canManageOnboarding canManageAuthority
      canManageCompliance canManageInventory canManageSales canManageFinance canManageIntegrations canViewReports
    }`
  });
  if (!actor || actor.status !== "active") return null;
  if (actor.organization?.id !== session.data.organization?.id || actor.premises?.id !== session.data.premises?.id) return null;
  for (const permission of permissionNames) {
    if (sessionPermission(session, permission) && actor.role?.[permission] !== true) return null;
  }
  return actor;
}
var permissionNames = [
  "canManagePeople",
  "canManageRoles",
  "canAccessDashboard",
  "canManageOnboarding",
  "canManageAuthority",
  "canManageCompliance",
  "canManageInventory",
  "canManageSales",
  "canManageFinance",
  "canManageIntegrations",
  "canViewReports"
];
var permissions = Object.fromEntries(
  permissionNames.map((permission) => [permission, ({ session }) => sessionPermission(session, permission)])
);
var activePermissions = Object.fromEntries(
  permissionNames.map((permission) => [permission, async (args) => (await freshActor(args))?.role?.[permission] === true])
);
async function canManageScopedPeople(args) {
  const actor = await freshActor(args);
  return Boolean(actor?.organization?.id && actor?.premises?.id && actor.role?.canManagePeople === true);
}
function organizationId(session) {
  return session?.data.organization?.id || null;
}
function premisesId(session) {
  return session?.data.premises?.id || null;
}
function organizationFilter({ session }) {
  const id = organizationId(session);
  return id ? { organization: { id: { equals: id } } } : false;
}
function organizationSelfFilter({ session }) {
  const id = organizationId(session);
  return id ? { id: { equals: id } } : false;
}
function premisesFilter({ session }) {
  const organization = organizationId(session);
  const premises = premisesId(session);
  return organization && premises ? { organization: { id: { equals: organization } }, premises: { id: { equals: premises } } } : false;
}
function immutableTenantAccess(read) {
  return {
    operation: { query: activePermissions[read], create: () => false, update: () => false, delete: () => false },
    filter: { query: organizationFilter }
  };
}
function immutableOrganizationAccess(read) {
  return {
    operation: { query: activePermissions[read], create: () => false, update: () => false, delete: () => false },
    filter: { query: organizationSelfFilter }
  };
}
function immutablePremisesAccess(read) {
  return {
    operation: { query: activePermissions[read], create: () => false, update: () => false, delete: () => false },
    filter: { query: premisesFilter }
  };
}
function isBootstrapActor(actor) {
  return !actor.organization?.id && !actor.premises?.id && actor.onboardingStatus !== "completed" && actor.role?.canAccessDashboard === true && actor.role?.canManageOnboarding === true;
}
function freshOrganizationFilter(actor) {
  return actor.organization?.id ? { organization: { id: { equals: actor.organization.id } } } : false;
}
function freshSelfFilter(actor) {
  const organization = freshOrganizationFilter(actor);
  return organization ? { AND: [{ id: { equals: actor.id } }, organization] } : false;
}
async function peopleFilter(args) {
  const actor = await freshActor(args);
  if (!actor) return false;
  if (isBootstrapActor(actor)) return {
    AND: [
      { id: { equals: actor.id } },
      { status: { equals: "active" } },
      { organization: null },
      { premises: null }
    ]
  };
  return actor.role?.canManagePeople === true ? freshOrganizationFilter(actor) : freshSelfFilter(actor);
}
async function roleQueryFilter(args) {
  const actor = await freshActor(args);
  if (!actor) return false;
  if (isBootstrapActor(actor)) return {
    AND: [
      { organization: null },
      { assignedTo: { some: { id: { equals: actor.id } } } }
    ]
  };
  return freshOrganizationFilter(actor);
}
var rules = {
  canReadPeople: peopleFilter,
  canUpdatePeople: peopleFilter
};

// features/keystone/models/trackingFields.ts
var import_fields = require("@keystone-6/core/fields");
var trackingFields = {
  createdAt: (0, import_fields.timestamp)({
    access: { read: () => true, create: () => false, update: () => false },
    defaultValue: { kind: "now" },
    validation: { isRequired: true },
    ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } }
  }),
  updatedAt: (0, import_fields.timestamp)({
    access: { read: () => true, create: () => false, update: () => false },
    db: { updatedAt: true },
    defaultValue: { kind: "now" },
    validation: { isRequired: true },
    ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } }
  })
};

// features/keystone/models/User.ts
var authorityFieldUI = { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } };
var scopedPeopleUI = { itemView: { fieldMode: async (args) => await canManageScopedPeople(args) ? "edit" : "read" } };
var User = (0, import_core.list)({
  access: {
    operation: { query: isSignedIn, create: () => false, update: isSignedIn, delete: () => false },
    filter: { query: rules.canReadPeople, update: rules.canUpdatePeople }
  },
  fields: {
    name: (0, import_fields2.text)({ validation: { isRequired: true } }),
    email: (0, import_fields2.text)({ isIndexed: "unique", validation: { isRequired: true }, isFilterable: false, isOrderable: false }),
    password: (0, import_fields2.password)({ access: { read: import_access.denyAll, update: ({ session, item }) => permissions.canManagePeople({ session }) || session?.itemId === item.id }, validation: { isRequired: true, length: { min: 10, max: 1e3 }, rejectCommon: true } }),
    status: (0, import_fields2.select)({ ui: scopedPeopleUI, access: { update: canManageScopedPeople }, type: "enum", options: [{ label: "Active", value: "active" }, { label: "Disabled", value: "disabled" }], defaultValue: "active", validation: { isRequired: true } }),
    organization: (0, import_fields2.relationship)({ ui: authorityFieldUI, ref: "Organization.users", access: { create: import_access.denyAll, update: import_access.denyAll } }),
    premises: (0, import_fields2.relationship)({ ui: authorityFieldUI, ref: "Premises.users", access: { create: import_access.denyAll, update: import_access.denyAll } }),
    role: (0, import_fields2.relationship)({ ui: authorityFieldUI, ref: "Role.assignedTo", access: { create: import_access.denyAll, update: import_access.denyAll } }),
    mfaMethod: (0, import_fields2.text)({ ui: authorityFieldUI, access: { create: import_access.denyAll, update: import_access.denyAll } }),
    mfaVerifiedAt: (0, import_fields2.timestamp)({ ui: authorityFieldUI, access: { create: import_access.denyAll, update: import_access.denyAll } }),
    staffCredential: (0, import_fields2.relationship)({ ui: authorityFieldUI, ref: "StaffCredential.user", access: { create: import_access.denyAll, update: import_access.denyAll } }),
    customerProfile: (0, import_fields2.relationship)({ ui: authorityFieldUI, ref: "Customer.user", access: { create: import_access.denyAll, update: import_access.denyAll } }),
    onboardingStatus: (0, import_fields2.select)({ ui: scopedPeopleUI, access: { update: canManageScopedPeople }, type: "enum", options: [
      { label: "Not Started", value: "not_started" },
      { label: "In Progress", value: "in_progress" },
      { label: "Completed", value: "completed" },
      { label: "Dismissed", value: "dismissed" }
    ], defaultValue: "not_started", validation: { isRequired: true } }),
    ...trackingFields
  }
});

// features/keystone/models/Role.ts
var import_core2 = require("@keystone-6/core");
var import_fields3 = require("@keystone-6/core/fields");
var capability = (label) => (0, import_fields3.checkbox)({ defaultValue: false, label });
var Role = (0, import_core2.list)({
  access: {
    operation: { query: activePermissions.canAccessDashboard, create: () => false, update: () => false, delete: () => false },
    filter: { query: roleQueryFilter }
  },
  fields: {
    organization: (0, import_fields3.relationship)({ ref: "Organization" }),
    name: (0, import_fields3.text)({ validation: { isRequired: true } }),
    canManagePeople: capability("Manage staff and customer identities"),
    canManageRoles: capability("Manage roles"),
    canAccessDashboard: capability("Access operator dashboard"),
    canManageOnboarding: capability("Install an owner-approved authority pack"),
    canManageAuthority: capability("Manage license, premises, and staff authority"),
    canManageCompliance: capability("Manage eligibility, rules, holds, recalls, and incidents"),
    canManageInventory: capability("Manage regulated package custody"),
    canManageSales: capability("Operate carts, POS, and fulfillment"),
    canManageFinance: capability("Manage tenders, refunds, shifts, and cash"),
    canManageIntegrations: capability("Manage external provider queues"),
    canViewReports: capability("View audits and reconciliation"),
    assignedTo: (0, import_fields3.relationship)({ ref: "User.role", many: true }),
    ...trackingFields
  }
});

// features/keystone/models/Authority.ts
var import_core3 = require("@keystone-6/core");
var import_fields4 = require("@keystone-6/core/fields");
var import_access4 = require("@keystone-6/core/access");

// features/lib/sanitize-store-logo.ts
var ALLOWED_ELEMENTS = /* @__PURE__ */ new Set([
  "svg",
  "g",
  "path",
  "defs",
  "lineargradient",
  "radialgradient",
  "stop",
  "clippath",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "title",
  "desc"
]);
var ALLOWED_ATTRIBUTES = /* @__PURE__ */ new Set([
  "xmlns",
  "fill",
  "fill-rule",
  "clip-rule",
  "height",
  "width",
  "viewbox",
  "d",
  "clip-path",
  "id",
  "x1",
  "x2",
  "y1",
  "y2",
  "gradientunits",
  "gradienttransform",
  "offset",
  "stop-color",
  "stop-opacity",
  "opacity",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "x",
  "y",
  "transform",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "points",
  "role",
  "aria-hidden",
  "aria-label",
  "preserveaspectratio"
]);
var ATTRIBUTE_PATTERN = /\s+([A-Za-z_:][\w:.-]*)\s*=\s*("[^"]*"|'[^']*')/g;
var TAG_PATTERN = /<\/?\s*([A-Za-z][\w:-]*)([^<>]*)>/g;
function sanitizeStoreLogoSvg(svg) {
  const source = svg.trim();
  if (!source.startsWith("<svg") || !source.endsWith("</svg>") || source.length > 1e5) return "";
  if (/<!|<\?|\b(?:javascript|data|vbscript):|\bon[a-z]+\s*=|\b(?:href|src|style)\s*=/i.test(source)) return "";
  let tagCount = 0;
  let match;
  TAG_PATTERN.lastIndex = 0;
  while (match = TAG_PATTERN.exec(source)) {
    tagCount += 1;
    const element = match[1].toLowerCase();
    if (!ALLOWED_ELEMENTS.has(element)) return "";
    if (match[0].startsWith("</")) continue;
    const attributes = match[2];
    let consumed = "";
    ATTRIBUTE_PATTERN.lastIndex = 0;
    let attributeMatch;
    while (attributeMatch = ATTRIBUTE_PATTERN.exec(attributes)) {
      consumed += attributeMatch[0];
      const attribute = attributeMatch[1].toLowerCase();
      const value = attributeMatch[2].slice(1, -1);
      if (!ALLOWED_ATTRIBUTES.has(attribute)) return "";
      if (attribute === "id" && !/^[A-Za-z_][\w:.-]*$/.test(value)) return "";
      if (/url\(/i.test(value) && !/^url\(#[A-Za-z_][\w:.-]*\)$/.test(value)) return "";
    }
    const remainder = attributes.replace(consumed, "").replace(/\//g, "").trim();
    if (remainder) return "";
  }
  TAG_PATTERN.lastIndex = 0;
  if (tagCount === 0 || source.replace(TAG_PATTERN, "").trim()) return "";
  return source;
}

// features/lib/store-logo.ts
var DEFAULT_STORE_LOGO_ICON = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" height="100%" width="100%" viewBox="0 0 200 200"><g clip-path="url(#restaurant-logo-clip)"><path fill-rule="evenodd" clip-rule="evenodd" d="M107.143 0H92.8571V63.2531L69.1621 4.60582L55.9166 9.95735L80.2255 70.1239L34.3401 24.2385L24.2386 34.3401L68.2177 78.3191L11.2241 53.4181L5.50459 66.5089L65.8105 92.8571H0V107.143H65.8104L5.50461 133.491L11.2241 146.582L68.2176 121.681L24.2386 165.66L34.3401 175.761L80.2255 129.876L55.9166 190.043L69.1621 195.394L92.8571 136.747V200H107.143V136.747L130.838 195.394L144.083 190.043L119.775 129.876L165.66 175.761L175.761 165.66L131.782 121.681L188.776 146.582L194.495 133.491L134.19 107.143H200V92.8571H134.189L194.495 66.5089L188.776 53.4181L131.782 78.3191L175.761 34.34L165.66 24.2385L119.775 70.1238L144.083 9.95735L130.838 4.60582L107.143 63.2531V0Z" fill="url(#restaurant-logo-gradient)"/></g><defs><linearGradient id="restaurant-logo-gradient" x1="14" y1="26" x2="179" y2="179.5" gradientUnits="userSpaceOnUse"><stop stop-color="#5c6bc0"/><stop offset="1" stop-color="#4f39f6"/></linearGradient><clipPath id="restaurant-logo-clip"><rect width="200" height="200" fill="white"/></clipPath></defs></svg>';
var DEFAULT_STORE_LOGO_COLOR = "0";
function normalizeStoreLogoColor(value) {
  const numeric = Number.parseFloat(String(value ?? DEFAULT_STORE_LOGO_COLOR));
  if (!Number.isFinite(numeric)) return DEFAULT_STORE_LOGO_COLOR;
  return String((numeric % 360 + 360) % 360);
}

// features/keystone/models/Authority.ts
var status = (values, defaultValue) => (0, import_fields4.select)({
  type: "enum",
  options: values.map((value) => ({ label: value.replaceAll("_", " "), value })),
  ...defaultValue ? { defaultValue } : {},
  validation: { isRequired: true }
});
var org = () => (0, import_fields4.relationship)({ ref: "Organization" });
var site = () => (0, import_fields4.relationship)({ ref: "Premises" });
var Organization = (0, import_core3.list)({
  access: immutableOrganizationAccess("canManageAuthority"),
  fields: {
    name: (0, import_fields4.text)({ validation: { isRequired: true } }),
    legalName: (0, import_fields4.text)({ validation: { isRequired: true } }),
    status: status(["pending_authority", "active", "suspended", "closed"], "pending_authority"),
    jurisdictionCode: (0, import_fields4.text)({ validation: { isRequired: true }, isIndexed: true }),
    premises: (0, import_fields4.relationship)({ ref: "Premises.organization", many: true }),
    storefrontSettings: (0, import_fields4.relationship)({ ref: "StorefrontSettings.organization", many: true }),
    users: (0, import_fields4.relationship)({ ref: "User.organization", many: true }),
    ...trackingFields
  }
});
var Premises = (0, import_core3.list)({
  graphql: { plural: "CannabisPremises" },
  access: immutableTenantAccess("canManageAuthority"),
  fields: {
    organization: (0, import_fields4.relationship)({ ref: "Organization.premises" }),
    name: (0, import_fields4.text)({ validation: { isRequired: true } }),
    premisesCode: (0, import_fields4.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    addressSnapshot: (0, import_fields4.json)({ defaultValue: {} }),
    timezone: (0, import_fields4.text)({ validation: { isRequired: true } }),
    status: status(["pending_authority", "active", "suspended", "closed"], "pending_authority"),
    users: (0, import_fields4.relationship)({ ref: "User.premises", many: true }),
    storefrontSettings: (0, import_fields4.relationship)({ ref: "StorefrontSettings.premises", many: true }),
    ...trackingFields
  }
});
var StorefrontSettings = (0, import_core3.list)({
  graphql: { plural: "CannabisStorefrontSettings" },
  access: immutablePremisesAccess("canManageAuthority"),
  db: {
    extendPrismaSchema(schema) {
      return schema.replace(/\n}/, '\n  @@unique([organizationId, premisesId], map: "StorefrontSettings_authority_scope_key")\n}');
    }
  },
  fields: {
    organization: (0, import_fields4.relationship)({
      ref: "Organization.storefrontSettings",
      access: { create: import_access4.denyAll, update: import_access4.denyAll },
      graphql: { isNonNull: { read: true } },
      db: { extendPrismaSchema: (field) => field.replace(/organization Organization\?/g, "organization Organization").replace(/organizationId String\?/g, "organizationId String") }
    }),
    premises: (0, import_fields4.relationship)({
      ref: "Premises.storefrontSettings",
      access: { create: import_access4.denyAll, update: import_access4.denyAll },
      graphql: { isNonNull: { read: true } },
      db: { extendPrismaSchema: (field) => field.replace(/premises Premises\?/g, "premises Premises").replace(/premisesId String\?/g, "premisesId String") }
    }),
    businessName: (0, import_fields4.text)({ validation: { isRequired: true, length: { min: 1, max: 120 } } }),
    tagline: (0, import_fields4.text)({ validation: { length: { max: 180 } } }),
    description: (0, import_fields4.text)({ validation: { length: { max: 240 } }, ui: { displayMode: "textarea" } }),
    brandHue: (0, import_fields4.integer)({ defaultValue: 215, validation: { isRequired: true, min: 0, max: 359 } }),
    // Restaurant StoreSettings lineage: enforce SVG allowlist even through sudo model writes.
    logoIcon: (0, import_fields4.text)({ defaultValue: DEFAULT_STORE_LOGO_ICON, hooks: {
      resolveInput: ({ resolvedData, fieldKey }) => {
        const value = resolvedData[fieldKey];
        return value === void 0 || value === null || value === "" ? value : typeof value === "string" ? sanitizeStoreLogoSvg(value) : "";
      },
      validate: ({ inputData, resolvedData, fieldKey, addValidationError }) => {
        const submitted = inputData?.[fieldKey];
        if (typeof submitted === "string" && submitted.trim() && !resolvedData?.[fieldKey]) addValidationError("Logo must be a valid, safe SVG document");
      }
    } }),
    logoColor: (0, import_fields4.text)({ defaultValue: DEFAULT_STORE_LOGO_COLOR, hooks: {
      resolveInput: ({ resolvedData, fieldKey }) => resolvedData[fieldKey] === void 0 ? void 0 : normalizeStoreLogoColor(resolvedData[fieldKey])
    } }),
    publicationStatus: status(["draft", "published"], "draft"),
    storefrontMode: status(["demo", "configured"], "configured"),
    demoCatalog: (0, import_fields4.json)({ defaultValue: [] }),
    ...trackingFields
  }
});
var CannabisLicense = (0, import_core3.list)({
  access: immutablePremisesAccess("canManageAuthority"),
  fields: {
    organization: org(),
    premises: site(),
    licenseNumber: (0, import_fields4.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    licenseType: (0, import_fields4.text)({ validation: { isRequired: true } }),
    regulatorName: (0, import_fields4.text)({ validation: { isRequired: true } }),
    authorizedActivities: (0, import_fields4.json)({ defaultValue: [] }),
    status: status(["draft", "active", "conditioned", "suspended", "expired", "revoked", "surrendered"], "draft"),
    effectiveAt: (0, import_fields4.timestamp)({ validation: { isRequired: true } }),
    expiresAt: (0, import_fields4.timestamp)({ validation: { isRequired: true } }),
    verifiedAt: (0, import_fields4.timestamp)(),
    authorityReference: (0, import_fields4.text)({ validation: { isRequired: true } }),
    ...trackingFields
  }
});
var StaffCredential = (0, import_core3.list)({
  access: immutablePremisesAccess("canManageAuthority"),
  fields: {
    organization: org(),
    premises: site(),
    user: (0, import_fields4.relationship)({ ref: "User.staffCredential" }),
    credentialType: (0, import_fields4.text)({ validation: { isRequired: true } }),
    credentialReference: (0, import_fields4.text)({ validation: { isRequired: true } }),
    allowedActivities: (0, import_fields4.json)({ defaultValue: [] }),
    approvalLimitCents: (0, import_fields4.integer)({ defaultValue: 0, validation: { min: 0 } }),
    status: status(["pending", "active", "suspended", "expired", "terminated"], "pending"),
    effectiveAt: (0, import_fields4.timestamp)({ validation: { isRequired: true } }),
    expiresAt: (0, import_fields4.timestamp)({ validation: { isRequired: true } }),
    trainingVerifiedAt: (0, import_fields4.timestamp)(),
    authorityVerifiedAt: (0, import_fields4.timestamp)(),
    evidenceHash: (0, import_fields4.text)({ validation: { isRequired: true } }),
    ...trackingFields
  }
});
var Customer = (0, import_core3.list)({
  access: immutablePremisesAccess("canManageCompliance"),
  fields: {
    organization: org(),
    premises: site(),
    user: (0, import_fields4.relationship)({ ref: "User.customerProfile" }),
    reference: (0, import_fields4.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    capacity: status(["adult_use", "patient", "caregiver"]),
    status: status(["pending_verification", "eligible", "ineligible", "suspended"], "pending_verification"),
    marketingConsent: (0, import_fields4.checkbox)({ defaultValue: false }),
    intakeProofHash: (0, import_fields4.text)({ access: { read: import_access4.denyAll, create: import_access4.denyAll, update: import_access4.denyAll } }),
    contact: (0, import_fields4.json)({ access: { read: ({ session }) => Boolean(session), create: import_access4.denyAll, update: import_access4.denyAll } }),
    ...trackingFields
  }
});
var EligibilityEvidence = (0, import_core3.list)({
  access: immutablePremisesAccess("canManageCompliance"),
  fields: {
    organization: org(),
    premises: site(),
    customer: (0, import_fields4.relationship)({ ref: "Customer" }),
    capacity: status(["adult_use", "patient", "caregiver"]),
    identityMethod: (0, import_fields4.text)({ validation: { isRequired: true } }),
    identityReferenceHash: (0, import_fields4.text)({ validation: { isRequired: true } }),
    dateOfBirth: (0, import_fields4.timestamp)({ validation: { isRequired: true } }),
    identityExpiresAt: (0, import_fields4.timestamp)({ validation: { isRequired: true } }),
    registryName: (0, import_fields4.text)(),
    registryReferenceHash: (0, import_fields4.text)(),
    registryVerifiedAt: (0, import_fields4.timestamp)(),
    registryExpiresAt: (0, import_fields4.timestamp)(),
    representedPatientReferenceHash: (0, import_fields4.text)(),
    allotmentRemainingMicrounits: (0, import_fields4.integer)({ validation: { min: 0 } }),
    result: status(["pending", "eligible", "ineligible", "expired", "revoked"], "pending"),
    reasonCodes: (0, import_fields4.json)({ defaultValue: [] }),
    evidenceHash: (0, import_fields4.text)({ validation: { isRequired: true } }),
    verifiedAt: (0, import_fields4.timestamp)(),
    ...trackingFields
  }
});
var JurisdictionRulePack = (0, import_core3.list)({
  access: immutablePremisesAccess("canManageCompliance"),
  fields: {
    organization: org(),
    premises: site(),
    version: (0, import_fields4.text)({ validation: { isRequired: true } }),
    jurisdictionCode: (0, import_fields4.text)({ validation: { isRequired: true } }),
    authorityCitations: (0, import_fields4.json)({ defaultValue: [] }),
    policyHash: (0, import_fields4.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    status: status(["draft", "approved", "effective", "superseded", "revoked"], "draft"),
    effectiveAt: (0, import_fields4.timestamp)({ validation: { isRequired: true } }),
    expiresAt: (0, import_fields4.timestamp)({ validation: { isRequired: true } }),
    approvedAt: (0, import_fields4.timestamp)(),
    approvedBy: (0, import_fields4.relationship)({ ref: "User" }),
    adultMinimumAge: (0, import_fields4.integer)({ validation: { min: 0, max: 120, isRequired: true } }),
    medicalMinimumAge: (0, import_fields4.integer)({ validation: { min: 0, max: 120, isRequired: true } }),
    operatingStartMinute: (0, import_fields4.integer)({ validation: { min: 0, max: 1439, isRequired: true } }),
    operatingEndMinute: (0, import_fields4.integer)({ validation: { min: 0, max: 1439, isRequired: true } }),
    purchaseLimits: (0, import_fields4.json)({ defaultValue: [] }),
    taxRules: (0, import_fields4.json)({ defaultValue: [] }),
    discountRules: (0, import_fields4.json)({ defaultValue: [] }),
    allowedTenderTypes: (0, import_fields4.json)({ defaultValue: [] }),
    labelRequirements: (0, import_fields4.json)({ defaultValue: [] }),
    returnRules: (0, import_fields4.json)({ defaultValue: {} }),
    outagePolicy: (0, import_fields4.json)({ defaultValue: {} }),
    privacyRules: (0, import_fields4.json)({ defaultValue: {} }),
    retentionRules: (0, import_fields4.json)({ defaultValue: {} }),
    medicalEnabled: (0, import_fields4.checkbox)({ defaultValue: false }),
    pickupEnabled: (0, import_fields4.checkbox)({ defaultValue: false }),
    deliveryEnabled: (0, import_fields4.checkbox)({ defaultValue: false }),
    offlineSalesAllowed: (0, import_fields4.checkbox)({ defaultValue: false }),
    ...trackingFields
  }
});

// features/keystone/models/Inventory.ts
var import_core4 = require("@keystone-6/core");
var import_fields5 = require("@keystone-6/core/fields");
var status2 = (values, defaultValue) => (0, import_fields5.select)({ type: "enum", options: values.map((value) => ({ label: value.replaceAll("_", " "), value })), ...defaultValue ? { defaultValue } : {}, validation: { isRequired: true } });
var org2 = () => (0, import_fields5.relationship)({ ref: "Organization" });
var site2 = () => (0, import_fields5.relationship)({ ref: "Premises" });
var Product = (0, import_core4.list)({
  access: immutablePremisesAccess("canManageInventory"),
  fields: {
    organization: org2(),
    premises: site2(),
    sku: (0, import_fields5.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    name: (0, import_fields5.text)({ validation: { isRequired: true } }),
    brand: (0, import_fields5.text)(),
    form: (0, import_fields5.text)({ validation: { isRequired: true } }),
    categoryCode: (0, import_fields5.text)({ validation: { isRequired: true } }),
    unitOfMeasure: (0, import_fields5.text)({ validation: { isRequired: true } }),
    unitQuantityMicrounits: (0, import_fields5.integer)({ validation: { min: 1, isRequired: true } }),
    equivalencyMicrounits: (0, import_fields5.integer)({ validation: { min: 1, isRequired: true } }),
    priceCents: (0, import_fields5.integer)({ validation: { min: 0, isRequired: true } }),
    taxCategoryCode: (0, import_fields5.text)({ validation: { isRequired: true } }),
    adultUseEligible: (0, import_fields5.checkbox)({ defaultValue: false }),
    medicalEligible: (0, import_fields5.checkbox)({ defaultValue: false }),
    status: status2(["draft", "active", "inactive"], "draft"),
    publicDescription: (0, import_fields5.text)(),
    publicImageUrl: (0, import_fields5.text)(),
    packages: (0, import_fields5.relationship)({ ref: "InventoryPackage.product", many: true }),
    ...trackingFields
  }
});
var InventoryPackage = (0, import_core4.list)({
  access: immutablePremisesAccess("canManageInventory"),
  fields: {
    organization: org2(),
    premises: site2(),
    product: (0, import_fields5.relationship)({ ref: "Product.packages" }),
    packageUid: (0, import_fields5.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    sourcePackageUid: (0, import_fields5.text)(),
    productionBatchNumber: (0, import_fields5.text)({ validation: { isRequired: true } }),
    lotNumber: (0, import_fields5.text)({ validation: { isRequired: true } }),
    quantityReceivedMicrounits: (0, import_fields5.integer)({ validation: { min: 1, isRequired: true } }),
    quantityOnHandMicrounits: (0, import_fields5.integer)({ validation: { min: 0, isRequired: true } }),
    reservedMicrounits: (0, import_fields5.integer)({ defaultValue: 0, validation: { min: 0 } }),
    unitOfMeasure: (0, import_fields5.text)({ validation: { isRequired: true } }),
    status: status2(["expected_inbound", "receiving_hold", "quarantined", "saleable", "reserved", "staged", "transfer_allocated", "in_transit", "waste_pending", "recalled", "depleted", "destroyed"], "expected_inbound"),
    testStatus: status2(["unknown", "pending", "passed", "failed", "retest"], "unknown"),
    labName: (0, import_fields5.text)(),
    labResultReference: (0, import_fields5.text)(),
    coaReference: (0, import_fields5.text)(),
    labVerifiedAt: (0, import_fields5.timestamp)(),
    manufacturedAt: (0, import_fields5.timestamp)(),
    receivedAt: (0, import_fields5.timestamp)(),
    expiresAt: (0, import_fields5.timestamp)({ validation: { isRequired: true } }),
    releasedAt: (0, import_fields5.timestamp)(),
    labelVersion: (0, import_fields5.text)({ validation: { isRequired: true } }),
    potencySnapshot: (0, import_fields5.json)({ defaultValue: {} }),
    lineage: (0, import_fields5.json)({ defaultValue: [] }),
    version: (0, import_fields5.integer)({ defaultValue: 1, validation: { min: 1 } }),
    holds: (0, import_fields5.relationship)({ ref: "PackageHold.package", many: true }),
    events: (0, import_fields5.relationship)({ ref: "InventoryEvent.package", many: true }),
    ...trackingFields
  }
});
var PackageHold = (0, import_core4.list)({
  access: immutablePremisesAccess("canManageCompliance"),
  fields: {
    organization: org2(),
    premises: site2(),
    package: (0, import_fields5.relationship)({ ref: "InventoryPackage.holds" }),
    type: status2(["quarantine", "test_hold", "recall", "discrepancy", "authority", "expiry"]),
    status: status2(["active", "released", "disposed"], "active"),
    reasonCode: (0, import_fields5.text)({ validation: { isRequired: true } }),
    reason: (0, import_fields5.text)({ validation: { isRequired: true } }),
    placedBy: (0, import_fields5.relationship)({ ref: "User" }),
    placedAt: (0, import_fields5.timestamp)({ validation: { isRequired: true } }),
    releasedBy: (0, import_fields5.relationship)({ ref: "User" }),
    releasedAt: (0, import_fields5.timestamp)(),
    releaseAuthorityReference: (0, import_fields5.text)(),
    evidenceHash: (0, import_fields5.text)({ validation: { isRequired: true } }),
    ...trackingFields
  }
});
var RegulatedManifest = (0, import_core4.list)({
  access: immutablePremisesAccess("canManageInventory"),
  fields: {
    organization: org2(),
    premises: site2(),
    manifestNumber: (0, import_fields5.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    type: status2(["receiving", "transfer_out", "transfer_in", "count", "adjustment", "waste", "destruction", "recall"]),
    status: status2(["proposed", "manifested", "receiving_hold", "accepted", "partially_accepted", "rejected", "dispatched", "in_transit", "completed", "reconciled"], "proposed"),
    sourceLicenseNumber: (0, import_fields5.text)(),
    destinationLicenseNumber: (0, import_fields5.text)(),
    transporterReference: (0, import_fields5.text)(),
    regulatorManifestId: (0, import_fields5.text)(),
    occurredAt: (0, import_fields5.timestamp)({ validation: { isRequired: true } }),
    completedAt: (0, import_fields5.timestamp)(),
    reasonCode: (0, import_fields5.text)({ validation: { isRequired: true } }),
    evidence: (0, import_fields5.json)({ defaultValue: {} }),
    evidenceHash: (0, import_fields5.text)({ validation: { isRequired: true } }),
    actor: (0, import_fields5.relationship)({ ref: "User" }),
    approvedBy: (0, import_fields5.relationship)({ ref: "User" }),
    packageEvents: (0, import_fields5.relationship)({ ref: "InventoryEvent.manifest", many: true }),
    ...trackingFields
  }
});
var InventoryEvent = (0, import_core4.list)({
  access: immutablePremisesAccess("canManageInventory"),
  fields: {
    organization: org2(),
    premises: site2(),
    package: (0, import_fields5.relationship)({ ref: "InventoryPackage.events" }),
    manifest: (0, import_fields5.relationship)({ ref: "RegulatedManifest.packageEvents" }),
    eventType: status2(["receive", "release", "reserve", "release_reservation", "sale", "return_quarantine", "transfer_out", "transfer_in", "count", "adjustment", "waste", "destruction", "recall_hold", "recall_release"]),
    quantityDeltaMicrounits: (0, import_fields5.integer)({ validation: { isRequired: true } }),
    beforeQuantityMicrounits: (0, import_fields5.integer)({ validation: { min: 0, isRequired: true } }),
    afterQuantityMicrounits: (0, import_fields5.integer)({ validation: { min: 0, isRequired: true } }),
    reasonCode: (0, import_fields5.text)({ validation: { isRequired: true } }),
    actor: (0, import_fields5.relationship)({ ref: "User" }),
    approvedBy: (0, import_fields5.relationship)({ ref: "User" }),
    sourceType: (0, import_fields5.text)({ validation: { isRequired: true } }),
    sourceId: (0, import_fields5.text)({ validation: { isRequired: true }, isIndexed: true }),
    idempotencyKey: (0, import_fields5.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    occurredAt: (0, import_fields5.timestamp)({ validation: { isRequired: true } }),
    evidenceHash: (0, import_fields5.text)({ validation: { isRequired: true } }),
    stateReportStatus: status2(["local_recorded", "queued", "accepted", "rejected", "reconciled"], "local_recorded"),
    ...trackingFields
  }
});
var RecallCase = (0, import_core4.list)({
  access: immutablePremisesAccess("canManageCompliance"),
  fields: {
    organization: org2(),
    premises: site2(),
    reference: (0, import_fields5.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    status: status2(["suspected", "hold", "scope_confirmed", "active", "monitoring", "disposition", "regulator_closed"], "suspected"),
    authorityReference: (0, import_fields5.text)({ validation: { isRequired: true } }),
    packageUids: (0, import_fields5.json)({ defaultValue: [] }),
    batchNumbers: (0, import_fields5.json)({ defaultValue: [] }),
    reason: (0, import_fields5.text)({ validation: { isRequired: true } }),
    openedAt: (0, import_fields5.timestamp)({ validation: { isRequired: true } }),
    closedAt: (0, import_fields5.timestamp)(),
    evidenceHash: (0, import_fields5.text)({ validation: { isRequired: true } }),
    ...trackingFields
  }
});

// features/keystone/models/Commerce.ts
var import_core5 = require("@keystone-6/core");
var import_fields6 = require("@keystone-6/core/fields");
var status3 = (values, defaultValue) => (0, import_fields6.select)({ type: "enum", options: values.map((value) => ({ label: value.replaceAll("_", " "), value })), ...defaultValue ? { defaultValue } : {}, validation: { isRequired: true } });
var org3 = () => (0, import_fields6.relationship)({ ref: "Organization" });
var site3 = () => (0, import_fields6.relationship)({ ref: "Premises" });
var Register = (0, import_core5.list)({
  access: immutablePremisesAccess("canManageFinance"),
  fields: { organization: org3(), premises: site3(), code: (0, import_fields6.text)({ validation: { isRequired: true }, isIndexed: "unique" }), name: (0, import_fields6.text)({ validation: { isRequired: true } }), status: status3(["active", "inactive", "maintenance"], "active"), ...trackingFields }
});
var RegisterShift = (0, import_core5.list)({
  access: immutablePremisesAccess("canManageFinance"),
  fields: {
    organization: org3(),
    premises: site3(),
    register: (0, import_fields6.relationship)({ ref: "Register" }),
    operator: (0, import_fields6.relationship)({ ref: "User" }),
    status: status3(["scheduled", "open", "count_pending", "counted", "variance_review", "closed", "deposited"], "scheduled"),
    openingFloatCents: (0, import_fields6.integer)({ validation: { min: 0, isRequired: true } }),
    expectedCashCents: (0, import_fields6.integer)({ validation: { min: 0 } }),
    actualCashCents: (0, import_fields6.integer)({ validation: { min: 0 } }),
    varianceCents: (0, import_fields6.integer)(),
    openedAt: (0, import_fields6.timestamp)(),
    countedAt: (0, import_fields6.timestamp)(),
    closedAt: (0, import_fields6.timestamp)(),
    approvedBy: (0, import_fields6.relationship)({ ref: "User" }),
    evidenceHash: (0, import_fields6.text)({ validation: { isRequired: true } }),
    cashEvents: (0, import_fields6.relationship)({ ref: "CashEvent.shift", many: true }),
    sales: (0, import_fields6.relationship)({ ref: "Sale.shift", many: true }),
    ...trackingFields
  }
});
var CashEvent = (0, import_core5.list)({
  access: immutablePremisesAccess("canManageFinance"),
  fields: {
    organization: org3(),
    premises: site3(),
    shift: (0, import_fields6.relationship)({ ref: "RegisterShift.cashEvents" }),
    type: status3(["opening_float", "sale", "refund", "paid_in", "paid_out", "safe_drop", "count", "deposit"]),
    amountCents: (0, import_fields6.integer)({ validation: { isRequired: true } }),
    reasonCode: (0, import_fields6.text)({ validation: { isRequired: true } }),
    actor: (0, import_fields6.relationship)({ ref: "User" }),
    approvedBy: (0, import_fields6.relationship)({ ref: "User" }),
    occurredAt: (0, import_fields6.timestamp)({ validation: { isRequired: true } }),
    idempotencyKey: (0, import_fields6.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    evidenceHash: (0, import_fields6.text)({ validation: { isRequired: true } }),
    ...trackingFields
  }
});
var TenderConfiguration = (0, import_core5.list)({
  access: immutablePremisesAccess("canManageFinance"),
  fields: {
    organization: org3(),
    premises: site3(),
    code: (0, import_fields6.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    type: status3(["cash", "debit", "ach", "wallet", "other"]),
    displayName: (0, import_fields6.text)({ validation: { isRequired: true } }),
    enabled: (0, import_fields6.checkbox)({ defaultValue: false }),
    providerCode: (0, import_fields6.text)(),
    authorityReference: (0, import_fields6.text)({ validation: { isRequired: true } }),
    effectiveAt: (0, import_fields6.timestamp)({ validation: { isRequired: true } }),
    expiresAt: (0, import_fields6.timestamp)({ validation: { isRequired: true } }),
    ...trackingFields
  }
});
var Cart = (0, import_core5.list)({
  access: immutablePremisesAccess("canManageSales"),
  fields: {
    organization: org3(),
    premises: site3(),
    customer: (0, import_fields6.relationship)({ ref: "Customer" }),
    shift: (0, import_fields6.relationship)({ ref: "RegisterShift" }),
    reference: (0, import_fields6.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    source: status3(["pos", "pickup", "customer_intake"]),
    status: status3(["draft", "preliminarily_eligible", "reserved", "picking", "staged", "final_verification", "completed", "expired", "cancelled", "rejected"], "draft"),
    guestProofHash: (0, import_fields6.text)({ access: { read: () => false, create: () => false, update: () => false } }),
    expiresAt: (0, import_fields6.timestamp)({ validation: { isRequired: true } }),
    rulePack: (0, import_fields6.relationship)({ ref: "JurisdictionRulePack" }),
    eligibilityEvidence: (0, import_fields6.relationship)({ ref: "EligibilityEvidence" }),
    subtotalCents: (0, import_fields6.integer)({ defaultValue: 0, validation: { min: 0 } }),
    discountCents: (0, import_fields6.integer)({ defaultValue: 0, validation: { min: 0 } }),
    taxCents: (0, import_fields6.integer)({ defaultValue: 0, validation: { min: 0 } }),
    totalCents: (0, import_fields6.integer)({ defaultValue: 0, validation: { min: 0 } }),
    lines: (0, import_fields6.relationship)({ ref: "CartLine.cart", many: true }),
    version: (0, import_fields6.integer)({ defaultValue: 1, validation: { min: 1 } }),
    ...trackingFields
  }
});
var CartLine = (0, import_core5.list)({
  access: immutablePremisesAccess("canManageSales"),
  fields: {
    organization: org3(),
    premises: site3(),
    cart: (0, import_fields6.relationship)({ ref: "Cart.lines" }),
    idempotencyKey: (0, import_fields6.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    package: (0, import_fields6.relationship)({ ref: "InventoryPackage" }),
    product: (0, import_fields6.relationship)({ ref: "Product" }),
    quantityMicrounits: (0, import_fields6.integer)({ validation: { min: 1, isRequired: true } }),
    equivalencyMicrounits: (0, import_fields6.integer)({ validation: { min: 1, isRequired: true } }),
    titleSnapshot: (0, import_fields6.text)({ validation: { isRequired: true } }),
    skuSnapshot: (0, import_fields6.text)({ validation: { isRequired: true } }),
    categoryCodeSnapshot: (0, import_fields6.text)({ validation: { isRequired: true } }),
    packageUidSnapshot: (0, import_fields6.text)({ validation: { isRequired: true } }),
    batchSnapshot: (0, import_fields6.text)({ validation: { isRequired: true } }),
    potencySnapshot: (0, import_fields6.json)({ defaultValue: {} }),
    unitPriceCents: (0, import_fields6.integer)({ validation: { min: 0, isRequired: true } }),
    subtotalCents: (0, import_fields6.integer)({ validation: { min: 0, isRequired: true } }),
    discountCents: (0, import_fields6.integer)({ defaultValue: 0, validation: { min: 0 } }),
    discountSnapshot: (0, import_fields6.json)({ defaultValue: {} }),
    taxBasisPoints: (0, import_fields6.integer)({ validation: { min: 0, max: 1e5, isRequired: true } }),
    taxCents: (0, import_fields6.integer)({ validation: { min: 0, isRequired: true } }),
    totalCents: (0, import_fields6.integer)({ validation: { min: 0, isRequired: true } }),
    ...trackingFields
  }
});
var Sale = (0, import_core5.list)({
  access: immutablePremisesAccess("canManageSales"),
  fields: {
    organization: org3(),
    premises: site3(),
    shift: (0, import_fields6.relationship)({ ref: "RegisterShift.sales" }),
    customer: (0, import_fields6.relationship)({ ref: "Customer" }),
    cart: (0, import_fields6.relationship)({ ref: "Cart" }),
    receiptNumber: (0, import_fields6.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    status: status3(["finalized", "state_queued", "state_accepted", "state_rejected", "reconciled", "reversal_pending", "reversed", "partially_refunded", "refunded"]),
    customerCapacitySnapshot: (0, import_fields6.text)({ validation: { isRequired: true } }),
    rulePackVersion: (0, import_fields6.text)({ validation: { isRequired: true } }),
    eligibilityEvidenceHash: (0, import_fields6.text)({ validation: { isRequired: true } }),
    purchaseLimitEvaluation: (0, import_fields6.json)({ defaultValue: {} }),
    subtotalCents: (0, import_fields6.integer)({ validation: { min: 0, isRequired: true } }),
    discountCents: (0, import_fields6.integer)({ validation: { min: 0, isRequired: true } }),
    taxCents: (0, import_fields6.integer)({ validation: { min: 0, isRequired: true } }),
    totalCents: (0, import_fields6.integer)({ validation: { min: 0, isRequired: true } }),
    refundedCents: (0, import_fields6.integer)({ defaultValue: 0, validation: { min: 0 } }),
    finalizedAt: (0, import_fields6.timestamp)({ validation: { isRequired: true } }),
    lines: (0, import_fields6.relationship)({ ref: "SaleLine.sale", many: true }),
    tenders: (0, import_fields6.relationship)({ ref: "Tender.sale", many: true }),
    refunds: (0, import_fields6.relationship)({ ref: "Refund.sale", many: true }),
    receiptSnapshot: (0, import_fields6.json)({ defaultValue: {} }),
    receiptHash: (0, import_fields6.text)({ validation: { isRequired: true } }),
    labelSnapshot: (0, import_fields6.json)({ defaultValue: {} }),
    labelHash: (0, import_fields6.text)({ validation: { isRequired: true } }),
    ...trackingFields
  }
});
var SaleLine = (0, import_core5.list)({
  access: immutablePremisesAccess("canManageSales"),
  fields: {
    organization: org3(),
    premises: site3(),
    sale: (0, import_fields6.relationship)({ ref: "Sale.lines" }),
    package: (0, import_fields6.relationship)({ ref: "InventoryPackage" }),
    titleSnapshot: (0, import_fields6.text)({ validation: { isRequired: true } }),
    skuSnapshot: (0, import_fields6.text)({ validation: { isRequired: true } }),
    categoryCodeSnapshot: (0, import_fields6.text)({ validation: { isRequired: true } }),
    packageUidSnapshot: (0, import_fields6.text)({ validation: { isRequired: true } }),
    batchSnapshot: (0, import_fields6.text)({ validation: { isRequired: true } }),
    coaReferenceSnapshot: (0, import_fields6.text)(),
    potencySnapshot: (0, import_fields6.json)({ defaultValue: {} }),
    quantityMicrounits: (0, import_fields6.integer)({ validation: { min: 1, isRequired: true } }),
    equivalencyMicrounits: (0, import_fields6.integer)({ validation: { min: 1, isRequired: true } }),
    unitPriceCents: (0, import_fields6.integer)({ validation: { min: 0, isRequired: true } }),
    discountCents: (0, import_fields6.integer)({ validation: { min: 0, isRequired: true } }),
    discountSnapshot: (0, import_fields6.json)({ defaultValue: {} }),
    taxCents: (0, import_fields6.integer)({ validation: { min: 0, isRequired: true } }),
    totalCents: (0, import_fields6.integer)({ validation: { min: 0, isRequired: true } }),
    ...trackingFields
  }
});
var Tender = (0, import_core5.list)({
  access: immutablePremisesAccess("canManageFinance"),
  fields: {
    organization: org3(),
    premises: site3(),
    sale: (0, import_fields6.relationship)({ ref: "Sale.tenders" }),
    configuration: (0, import_fields6.relationship)({ ref: "TenderConfiguration" }),
    typeSnapshot: (0, import_fields6.text)({ validation: { isRequired: true } }),
    amountCents: (0, import_fields6.integer)({ validation: { min: 0, isRequired: true } }),
    tenderedCents: (0, import_fields6.integer)({ validation: { min: 0 } }),
    changeCents: (0, import_fields6.integer)({ defaultValue: 0, validation: { min: 0 } }),
    status: status3(["received", "authorized", "captured", "reversed", "failed"], "received"),
    providerReference: (0, import_fields6.text)(),
    idempotencyKey: (0, import_fields6.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    evidenceHash: (0, import_fields6.text)({ validation: { isRequired: true } }),
    ...trackingFields
  }
});
var Refund = (0, import_core5.list)({
  access: immutablePremisesAccess("canManageFinance"),
  fields: {
    organization: org3(),
    premises: site3(),
    sale: (0, import_fields6.relationship)({ ref: "Sale.refunds" }),
    amountCents: (0, import_fields6.integer)({ validation: { min: 1, isRequired: true } }),
    reasonCode: (0, import_fields6.text)({ validation: { isRequired: true } }),
    inventoryDisposition: status3(["none", "quarantine", "waste", "returned_to_authority"]),
    status: status3(["pending", "completed", "failed", "reconciled"], "pending"),
    actor: (0, import_fields6.relationship)({ ref: "User" }),
    approvedBy: (0, import_fields6.relationship)({ ref: "User" }),
    originalTenderReference: (0, import_fields6.text)(),
    providerReference: (0, import_fields6.text)(),
    occurredAt: (0, import_fields6.timestamp)({ validation: { isRequired: true } }),
    evidenceHash: (0, import_fields6.text)({ validation: { isRequired: true } }),
    ...trackingFields
  }
});

// features/keystone/models/Operations.ts
var import_core6 = require("@keystone-6/core");
var import_fields7 = require("@keystone-6/core/fields");
var status4 = (values, defaultValue) => (0, import_fields7.select)({ type: "enum", options: values.map((value) => ({ label: value.replaceAll("_", " "), value })), ...defaultValue ? { defaultValue } : {}, validation: { isRequired: true } });
var org4 = () => (0, import_fields7.relationship)({ ref: "Organization" });
var site4 = () => (0, import_fields7.relationship)({ ref: "Premises" });
var AuditEvent = (0, import_core6.list)({
  access: immutablePremisesAccess("canViewReports"),
  fields: {
    organization: org4(),
    premises: site4(),
    actor: (0, import_fields7.relationship)({ ref: "User" }),
    action: (0, import_fields7.text)({ validation: { isRequired: true } }),
    resourceType: (0, import_fields7.text)({ validation: { isRequired: true } }),
    resourceId: (0, import_fields7.text)({ validation: { isRequired: true } }),
    correlationId: (0, import_fields7.text)({ validation: { isRequired: true }, isIndexed: true }),
    reasonCode: (0, import_fields7.text)({ validation: { isRequired: true } }),
    evidence: (0, import_fields7.json)({ defaultValue: {} }),
    evidenceHash: (0, import_fields7.text)({ validation: { isRequired: true } }),
    occurredAt: (0, import_fields7.timestamp)({ validation: { isRequired: true } }),
    ...trackingFields
  }
});
var IdempotencyKey = (0, import_core6.list)({
  access: immutablePremisesAccess("canViewReports"),
  fields: {
    organization: org4(),
    premises: site4(),
    scope: (0, import_fields7.text)({ validation: { isRequired: true } }),
    lookupKey: (0, import_fields7.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    requestHash: (0, import_fields7.text)({ validation: { isRequired: true } }),
    status: status4(["processing", "succeeded", "failed"], "processing"),
    responseSnapshot: (0, import_fields7.json)(),
    startedAt: (0, import_fields7.timestamp)({ validation: { isRequired: true } }),
    completedAt: (0, import_fields7.timestamp)(),
    expiresAt: (0, import_fields7.timestamp)({ validation: { isRequired: true } }),
    actor: (0, import_fields7.relationship)({ ref: "User" }),
    ...trackingFields
  }
});
var OutboxEvent = (0, import_core6.list)({
  access: immutablePremisesAccess("canManageIntegrations"),
  fields: {
    organization: org4(),
    premises: site4(),
    eventKey: (0, import_fields7.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    topic: (0, import_fields7.text)({ validation: { isRequired: true } }),
    aggregateType: (0, import_fields7.text)({ validation: { isRequired: true } }),
    aggregateId: (0, import_fields7.text)({ validation: { isRequired: true } }),
    payload: (0, import_fields7.json)({ defaultValue: {} }),
    requestHash: (0, import_fields7.text)({ validation: { isRequired: true } }),
    idempotencyKey: (0, import_fields7.text)({ validation: { isRequired: true } }),
    status: status4(["queued", "sending", "accepted", "rejected", "retryable", "dead_letter", "reconciled"], "queued"),
    attempts: (0, import_fields7.integer)({ defaultValue: 0, validation: { min: 0 } }),
    availableAt: (0, import_fields7.timestamp)({ validation: { isRequired: true } }),
    lastAttemptAt: (0, import_fields7.timestamp)(),
    acceptedAt: (0, import_fields7.timestamp)(),
    regulatorReference: (0, import_fields7.text)(),
    lastErrorCode: (0, import_fields7.text)(),
    ...trackingFields
  }
});
var StateEventInbox = (0, import_core6.list)({
  access: immutablePremisesAccess("canManageIntegrations"),
  fields: {
    organization: org4(),
    premises: site4(),
    providerCode: (0, import_fields7.text)({ validation: { isRequired: true } }),
    providerEventId: (0, import_fields7.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    payloadHash: (0, import_fields7.text)({ validation: { isRequired: true } }),
    signatureEvidence: (0, import_fields7.text)({ validation: { isRequired: true } }),
    status: status4(["received", "verified", "processed", "rejected", "needs_review"], "received"),
    receivedAt: (0, import_fields7.timestamp)({ validation: { isRequired: true } }),
    processedAt: (0, import_fields7.timestamp)(),
    rejectionReason: (0, import_fields7.text)(),
    payload: (0, import_fields7.json)({ defaultValue: {} }),
    ...trackingFields
  }
});
var IntegrationInstallation = (0, import_core6.list)({
  access: immutablePremisesAccess("canManageIntegrations"),
  fields: {
    organization: org4(),
    premises: site4(),
    providerCode: (0, import_fields7.text)({ validation: { isRequired: true } }),
    providerType: status4(["traceability", "patient_registry", "identity", "laboratory", "payment", "tax"]),
    status: status4(["unconfigured", "pending_validation", "active", "suspended", "revoked"], "unconfigured"),
    credentialReference: (0, import_fields7.text)({ access: { read: () => false, create: () => false, update: () => false } }),
    facilityReference: (0, import_fields7.text)(),
    capabilities: (0, import_fields7.json)({ defaultValue: [] }),
    validatedAt: (0, import_fields7.timestamp)(),
    authorityReference: (0, import_fields7.text)({ validation: { isRequired: true } }),
    lastSuccessfulSyncAt: (0, import_fields7.timestamp)(),
    ...trackingFields
  }
});
var ReconciliationRun = (0, import_core6.list)({
  access: immutablePremisesAccess("canViewReports"),
  fields: {
    organization: org4(),
    premises: site4(),
    type: status4(["inventory_state_physical", "sale_package", "tender_settlement", "tax", "cash", "outbox"]),
    status: status4(["pending", "running", "exceptions", "balanced", "approved", "failed"], "pending"),
    startedAt: (0, import_fields7.timestamp)({ validation: { isRequired: true } }),
    completedAt: (0, import_fields7.timestamp)(),
    localSnapshotHash: (0, import_fields7.text)({ validation: { isRequired: true } }),
    externalSnapshotHash: (0, import_fields7.text)(),
    discrepancyCount: (0, import_fields7.integer)({ defaultValue: 0, validation: { min: 0 } }),
    discrepancies: (0, import_fields7.json)({ defaultValue: [] }),
    owner: (0, import_fields7.relationship)({ ref: "User" }),
    approvedBy: (0, import_fields7.relationship)({ ref: "User" }),
    evidenceHash: (0, import_fields7.text)({ validation: { isRequired: true } }),
    ...trackingFields
  }
});
var ComplianceIncident = (0, import_core6.list)({
  access: immutablePremisesAccess("canManageCompliance"),
  fields: {
    organization: org4(),
    premises: site4(),
    reference: (0, import_fields7.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    type: status4(["refusal_of_sale", "identity", "patient_registry_outage", "traceability_outage", "payment_ambiguity", "inventory_discrepancy", "theft", "loss", "diversion", "recall", "privacy", "security", "system_outage", "offline_attempt"]),
    severity: status4(["low", "medium", "high", "critical"]),
    status: status4(["open", "contained", "investigating", "reported", "resolved", "closed"], "open"),
    occurredAt: (0, import_fields7.timestamp)({ validation: { isRequired: true } }),
    detectedAt: (0, import_fields7.timestamp)({ validation: { isRequired: true } }),
    notificationDueAt: (0, import_fields7.timestamp)(),
    reportedAt: (0, import_fields7.timestamp)(),
    description: (0, import_fields7.text)({ validation: { isRequired: true } }),
    affectedPackageUids: (0, import_fields7.json)({ defaultValue: [] }),
    customerReferenceHash: (0, import_fields7.text)(),
    outageMode: status4(["none", "fail_closed", "approved_degraded"], "none"),
    recoveryQueueReference: (0, import_fields7.text)(),
    authorityReference: (0, import_fields7.text)(),
    actor: (0, import_fields7.relationship)({ ref: "User" }),
    owner: (0, import_fields7.relationship)({ ref: "User" }),
    evidenceHash: (0, import_fields7.text)({ validation: { isRequired: true } }),
    ...trackingFields
  }
});

// features/keystone/models/index.ts
var models = {
  User,
  Role,
  Organization,
  Premises,
  StorefrontSettings,
  CannabisLicense,
  StaffCredential,
  Customer,
  EligibilityEvidence,
  JurisdictionRulePack,
  Product,
  InventoryPackage,
  PackageHold,
  RegulatedManifest,
  InventoryEvent,
  RecallCase,
  Register,
  RegisterShift,
  CashEvent,
  TenderConfiguration,
  Cart,
  CartLine,
  Sale,
  SaleLine,
  Tender,
  Refund,
  AuditEvent,
  IdempotencyKey,
  OutboxEvent,
  StateEventInbox,
  IntegrationInstallation,
  ReconciliationRun,
  ComplianceIncident
};
for (const [key, model] of Object.entries(models)) {
  model.ui = {
    ...model.ui,
    hideCreate: true,
    hideDelete: true,
    ...key === "User" ? {} : { itemView: { ...model.ui?.itemView, defaultFieldMode: "read" } }
  };
}

// features/keystone/index.ts
var import_session = require("@keystone-6/core/session");

// features/keystone/mutations/index.ts
var import_schema = require("@graphql-tools/schema");

// features/keystone/mutations/redirectToInit.ts
async function redirectToInit(root, args, context) {
  const userCount = await context.sudo().query.User.count({});
  if (userCount === 0) {
    return true;
  }
  return false;
}
var redirectToInit_default = redirectToInit;

// features/keystone/domain/transaction.ts
function serializableTransaction(context, work, timeout = 3e4) {
  const transaction = context.transaction;
  return transaction(work, { isolationLevel: "Serializable", maxWait: 5e3, timeout });
}

// features/keystone/domain/storefrontSettings.ts
var NEUTRAL_STOREFRONT_HUE = 215;
var DEMO_STOREFRONT_HUE = 148;
var DEMO_STOREFRONT_TAGLINE = "Demo storefront \u2014 no cannabis is offered for sale";
var DEMO_STOREFRONT_DESCRIPTION = "Mock catalog preview only. Availability appears only from verified, released package stock and still requires identity, age, authority, and final eligibility checks.";
var DEMO_CATALOG_BLUEPRINT = [
  { id: "demo-moonleaf-flower", name: "Fictional Moonleaf Flower", form: "Flower", categoryCode: "demo_flower", description: "Fictional demonstration item. No inventory, potency, eligibility, or availability is represented." },
  { id: "demo-citrus-drift-gummies", name: "Fictional Citrus Drift Gummies", form: "Edible", categoryCode: "demo_edible", description: "Fictional demonstration item. It cannot be reserved, ordered, purchased, or fulfilled." },
  { id: "demo-quiet-current-balm", name: "Fictional Quiet Current Balm", form: "Topical", categoryCode: "demo_topical", description: "Fictional demonstration item. No medical, therapeutic, package, or provider claim is made." }
];
var NEUTRAL_STOREFRONT_SETTINGS = Object.freeze({
  businessName: null,
  tagline: null,
  description: null,
  brandHue: NEUTRAL_STOREFRONT_HUE,
  logoIcon: DEFAULT_STORE_LOGO_ICON,
  logoColor: "0",
  mode: "neutral",
  isConfigured: false
});
function requiredPublicText(value, label, max) {
  if (typeof value !== "string") throw new Error(`${label} must be text`);
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new Error(`${label} must contain 1-${max} characters`);
  return normalized;
}
function optionalPublicText(value, label, max) {
  if (value === void 0 || value === null || value === "") return null;
  if (typeof value !== "string") throw new Error(`${label} must be text`);
  const normalized = value.trim();
  if (normalized.length > max) throw new Error(`${label} must contain at most ${max} characters`);
  return normalized || null;
}
function assertStorefrontHue(value) {
  if (!Number.isInteger(value) || value < 0 || value > 359) {
    throw new Error("Brand hue must be an integer between 0 and 359");
  }
  return value;
}
function normalizeStorefrontSettingsInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Storefront settings input is required");
  const values = input;
  return {
    businessName: requiredPublicText(values.businessName, "Business name", 120),
    tagline: optionalPublicText(values.tagline, "Tagline", 180),
    description: optionalPublicText(values.description, "Description", 240),
    brandHue: assertStorefrontHue(values.brandHue)
  };
}
function normalizeLogoSettings(input) {
  const value = input.logoIcon;
  const logoIcon = value === void 0 ? DEFAULT_STORE_LOGO_ICON : typeof value === "string" ? sanitizeStoreLogoSvg(value) : "";
  if (value !== void 0 && !logoIcon) throw new Error("Logo must be a valid, safe SVG document");
  return { logoIcon, logoColor: normalizeStoreLogoColor(input.logoColor) };
}
function demoCatalogSeed() {
  return DEMO_CATALOG_BLUEPRINT.map((item) => ({ ...item, demoOnly: true, saleable: false, orderable: false }));
}
function projectPublicDemoCatalog(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 6) return [];
  try {
    return value.map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("Invalid demo catalog entry");
      const item = entry;
      const id = requiredPublicText(item.id, "Demo item ID", 80);
      const name = requiredPublicText(item.name, "Demo item name", 120);
      const form = requiredPublicText(item.form, "Demo item form", 60);
      const categoryCode = requiredPublicText(item.categoryCode, "Demo category", 60);
      const description = requiredPublicText(item.description, "Demo item description", 200);
      if (!/^demo-[a-z0-9-]+$/.test(id) || !name.startsWith("Fictional ") || !categoryCode.startsWith("demo_") || !description.startsWith("Fictional demonstration item.")) {
        throw new Error("Demo catalog labels must remain explicitly fictional");
      }
      return { id, name, form, categoryCode, description, demoOnly: true, saleable: false, orderable: false };
    });
  } catch {
    return [];
  }
}
function demoStorefrontSettingsForPremises(premisesName) {
  const premises = requiredPublicText(premisesName, "Premises name", 500).replace(/\s+/g, " ");
  const suffix = " \u2014 Demo Storefront";
  const boundedPremises = premises.slice(0, 120 - suffix.length).trimEnd();
  return {
    businessName: `${boundedPremises}${suffix}`,
    tagline: DEMO_STOREFRONT_TAGLINE,
    description: DEMO_STOREFRONT_DESCRIPTION,
    brandHue: DEMO_STOREFRONT_HUE,
    publicationStatus: "published",
    storefrontMode: "demo",
    demoCatalog: demoCatalogSeed()
  };
}
function projectPublicStorefrontSettings(value) {
  try {
    if (!value || typeof value !== "object" || value.publicationStatus !== "published") {
      return { ...NEUTRAL_STOREFRONT_SETTINGS };
    }
    const mode = value.storefrontMode;
    if (mode !== "demo" && mode !== "configured") return { ...NEUTRAL_STOREFRONT_SETTINGS };
    const settings = normalizeStorefrontSettingsInput(value);
    const row = value;
    return {
      ...settings,
      logoIcon: sanitizeStoreLogoSvg(String(row.logoIcon || "")) || DEFAULT_STORE_LOGO_ICON,
      logoColor: normalizeStoreLogoColor(row.logoColor),
      mode,
      isConfigured: true
    };
  } catch {
    return { ...NEUTRAL_STOREFRONT_SETTINGS };
  }
}

// features/keystone/domain/policyIdentity.ts
var POLICY_IDENTITY_FIELDS = [
  "jurisdictionCode",
  "ruleVersion",
  "ruleAuthorityCitations",
  "ruleEffectiveAt",
  "ruleExpiresAt",
  "adultMinimumAge",
  "medicalMinimumAge",
  "medicalEnabled",
  "operatingStartMinute",
  "operatingEndMinute",
  "purchaseLimits",
  "taxRules",
  "discountRules",
  "allowedTenderTypes",
  "labelRequirements",
  "returnRules",
  "outagePolicy",
  "privacyRules",
  "retentionRules",
  "pickupEnabled",
  "deliveryEnabled",
  "offlineSalesAllowed"
];
function policyIdentity(value) {
  const input = value;
  const identity = {};
  for (const field of POLICY_IDENTITY_FIELDS) {
    if (!(field in input) || input[field] === void 0) throw new Error(`Policy identity is missing ${field}`);
    identity[field] = input[field];
  }
  return identity;
}

// features/keystone/domain/runtimeCapabilities.ts
var enabledCapabilities = /* @__PURE__ */ new Set();
function requireRuntimeCapability(capability2, reason) {
  if (!enabledCapabilities.has(capability2)) throw new Error(reason);
}
function isRuntimeCapabilityEnabled(capability2) {
  return enabledCapabilities.has(capability2);
}

// features/keystone/mutations/workflow.ts
var import_node_crypto = require("node:crypto");
function canonicalize(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => [key, canonicalize(entry)]));
  return value;
}
function stableHash(value) {
  return (0, import_node_crypto.createHash)("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}
function assertText(value, label, min = 1, max = 500) {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) throw new Error(`${label} must contain ${min}-${max} characters`);
  return value.trim();
}
function assertInteger(value, label, min = 0, max = 2147483647) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${label} must be an integer between ${min} and ${max}`);
  return value;
}
function assertJsonValue(value, label) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${label} contains a non-finite number`);
    return value;
  }
  if (Array.isArray(value)) return value.map((entry, index) => assertJsonValue(entry, `${label}[${index}]`));
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, assertJsonValue(entry, `${label}.${key}`)]));
  }
  throw new Error(`${label} must contain only JSON values`);
}
async function requireActor(context, permission) {
  const session = context.session;
  if (!session?.itemId || session.data.status === "disabled") throw new Error("Authentication required");
  const actor = await context.sudo().query.User.findOne({
    where: { id: session.itemId },
    query: `id status onboardingStatus mfaMethod mfaVerifiedAt organization { id jurisdictionCode status } premises { id status timezone organization { id } } role { ${permission} } staffCredential { id status effectiveAt expiresAt allowedActivities evidenceHash user { id } organization { id } premises { id } }`
  });
  if (!actor || actor.status !== "active" || actor.role?.[permission] !== true) throw new Error("Current actor lacks required authority");
  if (actor.organization?.id !== session.data.organization?.id || actor.premises?.id !== session.data.premises?.id) throw new Error("Session authority scope is stale");
  return { session, actor, organizationId: actor.organization?.id, premisesId: actor.premises?.id };
}
async function requireOperationalAuthority(context, permission, activity) {
  const scope = await requireActor(context, permission);
  const organizationId2 = scope.organizationId;
  const premisesId2 = scope.premisesId;
  if (!organizationId2 || !premisesId2 || scope.actor.organization?.status !== "active" || scope.actor.premises?.status !== "active" || scope.actor.premises?.organization?.id !== organizationId2) throw new Error("Active organization and licensed premises authority are required");
  const now = Date.now();
  const mfaVerifiedAt = scope.actor.mfaVerifiedAt ? new Date(scope.actor.mfaVerifiedAt).getTime() : Number.NaN;
  if (!Number.isFinite(mfaVerifiedAt) || mfaVerifiedAt > now || now - mfaVerifiedAt > 12 * 60 * 60 * 1e3) throw new Error("Current privileged MFA evidence is required");
  const credential = scope.actor.staffCredential;
  if (!credential || credential.status !== "active" || !(new Date(credential.effectiveAt).getTime() <= now) || !(new Date(credential.expiresAt).getTime() > now) || !Array.isArray(credential.allowedActivities) || !credential.allowedActivities.includes(activity) || credential.user?.id !== scope.actor.id || credential.organization?.id !== organizationId2 || credential.premises?.id !== premisesId2) throw new Error("Current staff credential does not authorize this activity");
  const license = await context.sudo().query.CannabisLicense.findMany({
    where: { organization: { id: { equals: organizationId2 } }, premises: { id: { equals: premisesId2 } }, status: { equals: "active" }, effectiveAt: { lte: /* @__PURE__ */ new Date() }, expiresAt: { gt: /* @__PURE__ */ new Date() } },
    take: 2,
    query: "id licenseNumber authorizedActivities status effectiveAt expiresAt organization { id } premises { id }"
  });
  if (license.length !== 1 || license[0].status !== "active" || !(new Date(license[0].effectiveAt).getTime() <= now) || !(new Date(license[0].expiresAt).getTime() > now) || !Array.isArray(license[0].authorizedActivities) || !license[0].authorizedActivities.includes(activity) || license[0].organization?.id !== organizationId2 || license[0].premises?.id !== premisesId2) throw new Error("Exactly one active license must authorize this premises activity");
  return { ...scope, organizationId: organizationId2, premisesId: premisesId2, license: license[0] };
}
async function requireRulePack(context, organizationId2, premisesId2) {
  const packs = await context.sudo().query.JurisdictionRulePack.findMany({
    where: { organization: { id: { equals: organizationId2 } }, premises: { id: { equals: premisesId2 } }, status: { equals: "effective" }, effectiveAt: { lte: /* @__PURE__ */ new Date() }, expiresAt: { gt: /* @__PURE__ */ new Date() } },
    orderBy: [{ effectiveAt: "desc" }],
    take: 2,
    query: "id version status jurisdictionCode effectiveAt expiresAt approvedAt adultMinimumAge medicalMinimumAge medicalEnabled operatingStartMinute operatingEndMinute purchaseLimits taxRules discountRules allowedTenderTypes offlineSalesAllowed pickupEnabled labelRequirements"
  });
  if (packs.length !== 1) throw new Error("Exactly one approved effective jurisdiction rule pack is required");
  return packs[0];
}
var OPERATION_RECEIPT_SELECTION = "id requestHash status scope responseSnapshot actor { id } organization { id } premises { id }";
async function runControlledOperation(context, input, options, work) {
  const authority = await requireOperationalAuthority(context, options.permission, options.activity);
  const key = assertText(input.idempotencyKey, "Idempotency key", 8, 200);
  const lookupKey = `${authority.organizationId}:${authority.premisesId}:${options.scope}:${key}`;
  const requestHash = stableHash(input);
  async function freshAuthority(current) {
    const fresh = await requireOperationalAuthority(current, options.permission, options.activity);
    if (fresh.actor.id !== authority.actor.id || fresh.organizationId !== authority.organizationId || fresh.premisesId !== authority.premisesId) throw new Error("Operational command authority changed");
    return fresh;
  }
  async function acknowledge(current, receipt) {
    const fresh = await freshAuthority(current);
    if (receipt.requestHash !== requestHash) throw new Error("Idempotency key was reused with different input");
    if (receipt.scope !== options.scope || receipt.organization?.id !== fresh.organizationId || receipt.premises?.id !== fresh.premisesId || receipt.actor?.id !== fresh.actor.id) {
      throw new Error("Original command authority is unavailable; independent delegation or legacy review is required");
    }
    if (receipt.status !== "succeeded") throw new Error("This operation is already processing or failed and requires review");
    const result = receipt.responseSnapshot;
    if (!result || typeof result !== "object" || Array.isArray(result) || !("id" in result) || typeof result.id !== "string" || !("status" in result) || typeof result.status !== "string") throw new Error("Original command receipt requires review");
    const visible = await current.query[options.resourceType].findOne({ where: { id: result.id }, query: "id" });
    if (!visible || visible.id !== result.id) throw new Error("Original command resource is outside current access");
    const resource = await current.sudo().query[options.resourceType].findOne({ where: { id: result.id }, query: "id organization { id } premises { id }" });
    if (!resource || resource.organization?.id !== fresh.organizationId || resource.premises?.id !== fresh.premisesId) throw new Error("Original command resource is outside current authority");
    await options.authorize?.(current, fresh, "replay");
    return { ...result, replayed: true };
  }
  async function acquireLocks(tx) {
    for (const lockKey of [.../* @__PURE__ */ new Set([lookupKey, ...options.lockKeys || []])].sort()) {
      await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "openfront-cannabis", lockKey);
    }
  }
  async function lockedAcknowledgement() {
    return serializableTransaction(context, async (tx) => {
      await acquireLocks(tx);
      const receipt = await tx.sudo().query.IdempotencyKey.findOne({ where: { lookupKey }, query: OPERATION_RECEIPT_SELECTION });
      if (!receipt) throw new Error("Original receipt is unavailable; review is required, not a replacement command");
      return acknowledge(tx, receipt);
    });
  }
  const existing = await context.sudo().query.IdempotencyKey.findOne({ where: { lookupKey }, query: OPERATION_RECEIPT_SELECTION });
  if (existing) return lockedAcknowledgement();
  const correlationId = (0, import_node_crypto.randomUUID)();
  try {
    return await serializableTransaction(context, async (tx) => {
      await acquireLocks(tx);
      const sudo = tx.sudo();
      const raced = await sudo.query.IdempotencyKey.findOne({ where: { lookupKey }, query: OPERATION_RECEIPT_SELECTION });
      if (raced) return acknowledge(tx, raced);
      const currentAuthority = await freshAuthority(tx);
      await options.authorize?.(tx, currentAuthority, "execute");
      const idempotency = await sudo.query.IdempotencyKey.createOne({ data: {
        organization: { connect: { id: currentAuthority.organizationId } },
        premises: { connect: { id: currentAuthority.premisesId } },
        scope: options.scope,
        lookupKey,
        requestHash,
        status: "processing",
        startedAt: /* @__PURE__ */ new Date(),
        expiresAt: new Date(Date.now() + 3e5),
        actor: { connect: { id: currentAuthority.actor.id } }
      }, query: "id" });
      const result = await work(tx, currentAuthority, correlationId);
      const responseSnapshot = JSON.parse(JSON.stringify(result));
      await sudo.query.IdempotencyKey.updateOne({ where: { id: idempotency.id }, data: { status: "succeeded", responseSnapshot, completedAt: /* @__PURE__ */ new Date() }, query: "id" });
      const evidenceHash = stableHash({ action: options.action, result: responseSnapshot, requestHash });
      await sudo.query.AuditEvent.createOne({ data: {
        organization: { connect: { id: currentAuthority.organizationId } },
        premises: { connect: { id: currentAuthority.premisesId } },
        actor: { connect: { id: currentAuthority.actor.id } },
        action: options.action,
        resourceType: options.resourceType,
        resourceId: result.id,
        correlationId,
        reasonCode: "controlled_workflow",
        evidence: responseSnapshot,
        evidenceHash,
        occurredAt: /* @__PURE__ */ new Date()
      }, query: "id" });
      if (options.emitStateEvent !== false) await sudo.query.OutboxEvent.createOne({ data: {
        organization: { connect: { id: currentAuthority.organizationId } },
        premises: { connect: { id: currentAuthority.premisesId } },
        eventKey: `${correlationId}:${options.action}`,
        topic: options.action,
        aggregateType: options.resourceType,
        aggregateId: result.id,
        payload: responseSnapshot,
        requestHash: evidenceHash,
        idempotencyKey: key,
        status: "queued",
        availableAt: /* @__PURE__ */ new Date()
      }, query: "id" });
      return { ...result, replayed: false };
    });
  } catch (error) {
    if (!error || typeof error !== "object" || !("code" in error) || error.code !== "P2002") throw error;
    await freshAuthority(context);
    const winner = await context.sudo().query.IdempotencyKey.findOne({ where: { lookupKey }, query: OPERATION_RECEIPT_SELECTION });
    if (!winner) throw error;
    return lockedAcknowledgement();
  }
}

// features/keystone/mutations/onboarding.ts
var REQUIRED_ACTIVITIES = ["authority", "eligibility", "inventory", "sale", "cash", "state_reporting", "incident"];
var TENDER_TYPES = /* @__PURE__ */ new Set(["cash", "debit", "ach", "wallet", "other"]);
function date(value, label) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`${label} must be an ISO date-time`);
  return parsed;
}
function validate(input) {
  const requiredArrays = [[input.authorizedActivities, "license activities"], [input.staffAllowedActivities, "staff activities"], [input.ruleAuthorityCitations, "authority citations"], [input.purchaseLimits, "purchase limits"], [input.taxRules, "tax rules"], [input.allowedTenderTypes, "allowed tenders"], [input.labelRequirements, "label requirements"], [input.tenderConfigurations, "tender configurations"]];
  for (const [value, label] of requiredArrays) if (!Array.isArray(value) || value.length === 0) throw new Error(`Owner-supplied ${label} are required`);
  if (!Array.isArray(input.discountRules)) throw new Error("Owner-supplied discount rules must be an array; use an empty array to prohibit discounts");
  for (const [value, label] of [[input.returnRules, "return"], [input.outagePolicy, "outage"], [input.privacyRules, "privacy"], [input.retentionRules, "retention"]]) if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length === 0) throw new Error(`Owner-supplied ${label} rules are required`);
  for (const activity of REQUIRED_ACTIVITIES) if (!input.authorizedActivities.includes(activity) || !input.staffAllowedActivities.includes(activity)) throw new Error(`Authority pack must explicitly include ${activity}`);
  const licenseEffectiveAt = date(input.licenseEffectiveAt, "License effective date");
  const licenseExpiresAt = date(input.licenseExpiresAt, "License expiry");
  const credentialEffectiveAt = date(input.credentialEffectiveAt, "Credential effective date");
  const credentialExpiresAt = date(input.credentialExpiresAt, "Credential expiry");
  const ruleEffectiveAt = date(input.ruleEffectiveAt, "Rule effective date");
  const ruleExpiresAt = date(input.ruleExpiresAt, "Rule expiry");
  if (licenseEffectiveAt >= licenseExpiresAt || credentialEffectiveAt >= credentialExpiresAt || ruleEffectiveAt >= ruleExpiresAt) throw new Error("Authority effective dates must precede expiry dates");
  assertInteger(input.adultMinimumAge, "Adult minimum age", 0, 120);
  assertInteger(input.medicalMinimumAge, "Medical minimum age", 0, 120);
  assertInteger(input.operatingStartMinute, "Operating start minute", 0, 1439);
  assertInteger(input.operatingEndMinute, "Operating end minute", 0, 1439);
  for (const tender of input.tenderConfigurations) {
    if (!TENDER_TYPES.has(tender.type)) throw new Error("Tender configuration type is unsupported");
    if (!input.allowedTenderTypes.includes(tender.type)) throw new Error("Every tender configuration must be allowed by the rule pack");
    date(tender.effectiveAt, "Tender effective date");
    date(tender.expiresAt, "Tender expiry");
  }
  return {
    licenseEffectiveAt,
    licenseExpiresAt,
    credentialEffectiveAt,
    credentialExpiresAt,
    ruleEffectiveAt,
    ruleExpiresAt,
    addressSnapshot: assertJsonValue(input.addressSnapshot, "Premises address snapshot"),
    ruleAuthorityCitations: assertJsonValue(input.ruleAuthorityCitations, "Rule authority citations"),
    purchaseLimits: assertJsonValue(input.purchaseLimits, "Purchase limits"),
    taxRules: assertJsonValue(input.taxRules, "Tax rules"),
    discountRules: assertJsonValue(input.discountRules, "Discount rules"),
    allowedTenderTypes: assertJsonValue(input.allowedTenderTypes, "Allowed tender types"),
    labelRequirements: assertJsonValue(input.labelRequirements, "Label requirements"),
    returnRules: assertJsonValue(input.returnRules, "Return rules"),
    outagePolicy: assertJsonValue(input.outagePolicy, "Outage policy"),
    privacyRules: assertJsonValue(input.privacyRules, "Privacy rules"),
    retentionRules: assertJsonValue(input.retentionRules, "Retention rules")
  };
}
async function provisionStaffAuthority(_root, args, context) {
  requireRuntimeCapability("authority.delegated-staff-grants", "Staff provisioning is disabled until delegation ceilings, credential verification, and a legitimate MFA enrollment path are implemented.");
  const input = args.input;
  return runControlledOperation(context, input, { permission: "canManageAuthority", activity: "authority", scope: "provisionStaffAuthority", resourceType: "StaffCredential", action: "staff.authority.provisioned", emitStateEvent: false, lockKeys: [String(input.email)] }, async (tx, authority) => {
    const sudo = tx.sudo();
    const email = assertText(input.email, "Staff email", 3, 320).toLowerCase();
    if (await sudo.query.User.findOne({ where: { email }, query: "id" })) throw new Error("Staff email already exists");
    const password2 = assertText(input.temporaryPassword, "Temporary password", 10, 1e3);
    const requested = input.permissions || {};
    const roleData = Object.fromEntries(permissionNames.map((permission) => [permission, requested[permission] === true]));
    roleData.canAccessDashboard = true;
    const role = await sudo.query.Role.createOne({ data: { organization: { connect: { id: authority.organizationId } }, name: assertText(input.roleName, "Role name"), ...roleData }, query: "id" });
    const user = await sudo.query.User.createOne({ data: { name: assertText(input.name, "Staff name"), email, password: password2, status: "active", organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, role: { connect: { id: role.id } }, onboardingStatus: "completed" }, query: "id" });
    const activities = input.allowedActivities;
    if (!Array.isArray(activities) || activities.length === 0) throw new Error("Staff allowed activities are required");
    const effectiveAt = date(input.effectiveAt, "Credential effective date");
    const expiresAt = date(input.expiresAt, "Credential expiry");
    if (effectiveAt >= expiresAt) throw new Error("Credential effective date must precede expiry");
    const credential = await sudo.query.StaffCredential.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, user: { connect: { id: user.id } }, credentialType: assertText(input.credentialType, "Credential type"), credentialReference: assertText(input.credentialReference, "Credential reference"), allowedActivities: activities, approvalLimitCents: assertInteger(input.approvalLimitCents || 0, "Approval limit", 0), status: "active", effectiveAt, expiresAt, trainingVerifiedAt: date(input.trainingVerifiedAt, "Training verification date"), authorityVerifiedAt: /* @__PURE__ */ new Date(), evidenceHash: assertText(input.evidenceHash, "Credential evidence hash", 16, 500) }, query: "id status" });
    await sudo.query.User.updateOne({ where: { id: user.id }, data: { staffCredential: { connect: { id: credential.id } } }, query: "id" });
    return { id: credential.id, status: credential.status, reference: user.id };
  });
}
async function runCannabisOnboarding(_root, args, context) {
  requireRuntimeCapability("authority.owner-approved-installation", "Authority installation is disabled until owner-approved evidence, current MFA enrollment, and externally verified authority review are implemented.");
  const input = args.input;
  const dates = validate(input);
  const session = context.session;
  if (!session?.itemId || session.data?.status === "disabled" || session.data?.role?.canManageOnboarding !== true) throw new Error("Only an active human onboarding owner may install an authority pack");
  const actor = await context.sudo().query.User.findOne({ where: { id: session.itemId }, query: "id status onboardingStatus organization { id } role { canManageOnboarding }" });
  if (!actor || actor.status !== "active" || actor.role?.canManageOnboarding !== true) throw new Error("Current onboarding authority is unavailable");
  if (actor.onboardingStatus === "completed" || actor.organization?.id) throw new Error("Onboarding is already completed; authority changes require controlled compliance workflows");
  const digest = stableHash(input);
  const key = assertText(input.idempotencyKey, "Idempotency key", 8, 200);
  return serializableTransaction(context, async (tx) => {
    await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "openfront-cannabis-onboarding", session.itemId);
    const sudo = tx.sudo();
    const current = await sudo.query.User.findOne({ where: { id: session.itemId }, query: "id onboardingStatus organization { id }" });
    if (!current || current.onboardingStatus === "completed" || current.organization?.id) throw new Error("Onboarding cannot be replayed over existing authority");
    await sudo.query.User.updateOne({ where: { id: current.id }, data: { onboardingStatus: "in_progress" }, query: "id" });
    const organization = await sudo.query.Organization.createOne({ data: { name: assertText(input.organizationName, "Organization name"), legalName: assertText(input.legalName, "Legal name"), jurisdictionCode: assertText(input.jurisdictionCode, "Jurisdiction code"), status: "pending_authority" }, query: "id" });
    const premises = await sudo.query.Premises.createOne({ data: { organization: { connect: { id: organization.id } }, name: assertText(input.premisesName, "Premises name"), premisesCode: assertText(input.premisesCode, "Premises code"), addressSnapshot: dates.addressSnapshot, timezone: assertText(input.timezone, "Timezone"), status: "pending_authority" }, query: "id" });
    const roleData = Object.fromEntries(permissionNames.map((permission) => [permission, true]));
    const ownerRole = await sudo.query.Role.createOne({ data: { organization: { connect: { id: organization.id } }, name: "Owner", ...roleData }, query: "id" });
    await sudo.query.CannabisLicense.createOne({ data: { organization: { connect: { id: organization.id } }, premises: { connect: { id: premises.id } }, licenseNumber: assertText(input.licenseNumber, "License number"), licenseType: assertText(input.licenseType, "License type"), regulatorName: assertText(input.regulatorName, "Regulator"), authorityReference: assertText(input.authorityReference, "License authority reference"), authorizedActivities: input.authorizedActivities, status: "active", effectiveAt: dates.licenseEffectiveAt, expiresAt: dates.licenseExpiresAt, verifiedAt: /* @__PURE__ */ new Date() }, query: "id" });
    const credential = await sudo.query.StaffCredential.createOne({ data: { organization: { connect: { id: organization.id } }, premises: { connect: { id: premises.id } }, user: { connect: { id: current.id } }, credentialType: assertText(input.credentialType, "Credential type"), credentialReference: assertText(input.credentialReference, "Credential reference"), allowedActivities: input.staffAllowedActivities, status: "active", effectiveAt: dates.credentialEffectiveAt, expiresAt: dates.credentialExpiresAt, trainingVerifiedAt: /* @__PURE__ */ new Date(), authorityVerifiedAt: /* @__PURE__ */ new Date(), evidenceHash: assertText(input.staffEvidenceHash, "Credential evidence hash", 16, 500) }, query: "id" });
    const policyHash = stableHash(policyIdentity({ ...input, deliveryEnabled: false, offlineSalesAllowed: false }));
    const rule = await sudo.query.JurisdictionRulePack.createOne({ data: { organization: { connect: { id: organization.id } }, premises: { connect: { id: premises.id } }, version: assertText(input.ruleVersion, "Rule version"), jurisdictionCode: input.jurisdictionCode, authorityCitations: dates.ruleAuthorityCitations, policyHash, status: "effective", effectiveAt: dates.ruleEffectiveAt, expiresAt: dates.ruleExpiresAt, approvedAt: /* @__PURE__ */ new Date(), approvedBy: { connect: { id: current.id } }, adultMinimumAge: input.adultMinimumAge, medicalMinimumAge: input.medicalMinimumAge, operatingStartMinute: input.operatingStartMinute, operatingEndMinute: input.operatingEndMinute, purchaseLimits: dates.purchaseLimits, taxRules: dates.taxRules, discountRules: dates.discountRules, allowedTenderTypes: dates.allowedTenderTypes, labelRequirements: dates.labelRequirements, returnRules: dates.returnRules, outagePolicy: dates.outagePolicy, privacyRules: dates.privacyRules, retentionRules: dates.retentionRules, medicalEnabled: input.medicalEnabled, pickupEnabled: input.pickupEnabled, deliveryEnabled: false, offlineSalesAllowed: false }, query: "id" });
    for (const tender of input.tenderConfigurations) await sudo.query.TenderConfiguration.createOne({ data: { organization: { connect: { id: organization.id } }, premises: { connect: { id: premises.id } }, code: tender.code, type: tender.type, displayName: tender.displayName, enabled: true, authorityReference: tender.authorityReference, effectiveAt: date(tender.effectiveAt, "Tender effective date"), expiresAt: date(tender.expiresAt, "Tender expiry") }, query: "id" });
    await sudo.query.IntegrationInstallation.createOne({ data: { organization: { connect: { id: organization.id } }, premises: { connect: { id: premises.id } }, providerCode: assertText(input.traceabilityProviderCode, "Traceability provider code"), providerType: "traceability", status: "unconfigured", authorityReference: assertText(input.traceabilityAuthorityReference, "Traceability authority reference"), capabilities: [] }, query: "id" });
    const demoStorefront = demoStorefrontSettingsForPremises(input.premisesName);
    const storefrontSettings = await sudo.query.StorefrontSettings.createOne({ data: {
      organization: { connect: { id: organization.id } },
      premises: { connect: { id: premises.id } },
      ...demoStorefront
    }, query: "id publicationStatus" });
    await sudo.query.Organization.updateOne({ where: { id: organization.id }, data: { status: "active" }, query: "id" });
    await sudo.query.Premises.updateOne({ where: { id: premises.id }, data: { status: "active" }, query: "id" });
    await sudo.query.User.updateOne({ where: { id: current.id }, data: { organization: { connect: { id: organization.id } }, premises: { connect: { id: premises.id } }, role: { connect: { id: ownerRole.id } }, staffCredential: { connect: { id: credential.id } }, onboardingStatus: "completed" }, query: "id" });
    await sudo.query.AuditEvent.createOne({ data: { organization: { connect: { id: organization.id } }, premises: { connect: { id: premises.id } }, actor: { connect: { id: current.id } }, action: "authority_pack.installed", resourceType: "JurisdictionRulePack", resourceId: rule.id, correlationId: key, reasonCode: "owner_supplied_authority_pack", evidence: { digest, demoStorefrontSettingsId: storefrontSettings.id, demoStorefront: true }, evidenceHash: digest, occurredAt: /* @__PURE__ */ new Date() }, query: "id" });
    return { id: organization.id, status: "completed", reference: premises.id, authorityPackHash: digest, storefrontMode: "demo" };
  });
}

// features/keystone/domain/cannabisPolicy.ts
var asTime = (value) => new Date(value).getTime();
function assertEffectiveRulePack(pack, now = /* @__PURE__ */ new Date()) {
  if (pack.status !== "effective" || !pack.approvedAt) throw new Error("An approved effective jurisdiction rule pack is required");
  const time = now.getTime();
  if (asTime(pack.effectiveAt) > time || asTime(pack.expiresAt) <= time) throw new Error("Jurisdiction rule pack is outside its effective interval");
  if (!pack.jurisdictionCode.trim() || !pack.version.trim()) throw new Error("Jurisdiction and rule-pack version are required");
  if (!Number.isInteger(pack.adultMinimumAge) || !Number.isInteger(pack.medicalMinimumAge)) throw new Error("Age thresholds must be integer policy data");
  if (!Array.isArray(pack.purchaseLimits) || pack.purchaseLimits.length === 0) throw new Error("At least one configured purchase limit is required");
  const limitKeys = /* @__PURE__ */ new Set();
  for (const rule of pack.purchaseLimits) {
    if (!rule || !["adult_use", "patient", "caregiver"].includes(rule.capacity) || typeof rule.categoryCode !== "string" || !rule.categoryCode.trim()) throw new Error("Purchase-limit rules require a supported capacity and category");
    if (!["transaction", "day", "rolling", "allotment"].includes(rule.window) || !Number.isSafeInteger(rule.maxEquivalencyMicrounits) || rule.maxEquivalencyMicrounits < 0) throw new Error("Purchase-limit rules contain an unsupported window or maximum");
    if (rule.window === "rolling" && (!Number.isSafeInteger(rule.windowDays) || rule.windowDays < 1 || rule.windowDays > 366)) throw new Error("Rolling purchase limits require a supported explicit window in days");
    if (rule.window !== "rolling" && rule.windowDays != null) throw new Error("Only rolling purchase limits may specify windowDays");
    const key = purchaseLimitKey(rule);
    if (limitKeys.has(key)) throw new Error("Duplicate purchase-limit policy for the same capacity, category, and window");
    limitKeys.add(key);
  }
  if (!Array.isArray(pack.taxRules) || pack.taxRules.length === 0) throw new Error("At least one configured tax rule is required");
  const taxKeys = /* @__PURE__ */ new Set();
  for (const rule of pack.taxRules) {
    if (!rule || typeof rule.categoryCode !== "string" || !rule.categoryCode.trim() || !["adult_use", "patient", "caregiver", "all"].includes(rule.capacity) || !Number.isSafeInteger(rule.basisPoints) || rule.basisPoints < 0) throw new Error("Tax rules require a supported capacity/category and non-negative integer rate");
    const key = `${rule.categoryCode}:${rule.capacity}`;
    if (taxKeys.has(key)) throw new Error("Multiple tax rules match the same category and buyer capacity; supported policy is ambiguous");
    taxKeys.add(key);
  }
  if (!Array.isArray(pack.allowedTenderTypes) || pack.allowedTenderTypes.length === 0 || pack.allowedTenderTypes.some((type) => typeof type !== "string" || !type.trim())) throw new Error("At least one supported tender type is required");
  return pack;
}
function assertOperatingWindow(pack, localMinute2) {
  if (!Number.isInteger(localMinute2) || localMinute2 < 0 || localMinute2 > 1439) throw new Error("Local operating minute is invalid");
  const { operatingStartMinute: start, operatingEndMinute: end } = pack;
  const open = start <= end ? localMinute2 >= start && localMinute2 < end : localMinute2 >= start || localMinute2 < end;
  if (!open) throw new Error("The premises is outside its configured operating window");
}
function assertEligibility(input, pack) {
  if (!input.identityValid) throw new Error("Current identity evidence is required");
  const medical = input.capacity !== "adult_use";
  if (medical && !pack.medicalEnabled) throw new Error("Medical sales are not enabled by the active rule pack");
  const minimumAge = medical ? pack.medicalMinimumAge : pack.adultMinimumAge;
  if (!Number.isInteger(input.age) || input.age < minimumAge) throw new Error("Buyer does not meet the configured age requirement");
  if (medical && !input.registryValid) throw new Error("Current medical registry evidence is required");
  if (input.capacity === "caregiver" && !input.representedPatientValid) throw new Error("Current caregiver-to-patient authority is required");
}
function assertPackageSaleable(input, premisesId2, requestedMicrounits, now = /* @__PURE__ */ new Date()) {
  if (input.premisesId !== premisesId2) throw new Error("Package belongs to a different licensed premises");
  if (input.status !== "saleable" || input.testStatus !== "passed") throw new Error("Package is not released and saleable");
  if (input.activeHoldCount > 0) throw new Error("Package has an active hold");
  if (asTime(input.expiresAt) <= now.getTime()) throw new Error("Package is expired");
  if (!input.coaReference || !input.labelVersion) throw new Error("Authoritative COA and label version are required");
  if (!Number.isSafeInteger(requestedMicrounits) || requestedMicrounits <= 0) throw new Error("Requested package quantity must be a positive integer");
  if (input.quantityOnHandMicrounits - input.reservedMicrounits < requestedMicrounits) throw new Error("Insufficient exact-package available quantity");
}
function purchaseLimitKey(rule) {
  return `${rule.capacity ?? "all"}:${rule.window}:${rule.categoryCode}:${rule.window === "rolling" ? rule.windowDays ?? "missing" : ""}`;
}
function evaluatePurchaseLimits(input, pack) {
  const applicableRules = pack.purchaseLimits.filter((rule) => rule.capacity === input.capacity);
  if (applicableRules.length === 0) throw new Error("No purchase-limit policy exists for this buyer capacity");
  const unmatchedCategory = Object.entries(input.categoryTotals).find(([category, quantity]) => quantity > 0 && !applicableRules.some((rule) => rule.categoryCode === category));
  if (unmatchedCategory) throw new Error(`No purchase-limit policy exists for purchased category ${unmatchedCategory[0]}`);
  const decisions = applicableRules.map((rule) => {
    const current = input.categoryTotals[rule.categoryCode] || 0;
    const prior = rule.window === "transaction" ? 0 : input.priorWindowTotals[purchaseLimitKey(rule)] || 0;
    const total = current + prior;
    return { ...rule, current, prior, total, allowed: total <= rule.maxEquivalencyMicrounits };
  });
  if (decisions.length === 0) throw new Error("No purchase-limit policy exists for this buyer capacity");
  const denied = decisions.find((decision) => !decision.allowed);
  if (denied) throw new Error(`Configured ${denied.window} purchase limit exceeded for ${denied.categoryCode}`);
  return decisions;
}
function requireTaxRule(taxRules, categoryCode, capacity) {
  const matches = taxRules.filter((rule) => rule.categoryCode === categoryCode && (rule.capacity === capacity || rule.capacity === "all"));
  if (matches.length !== 1) throw new Error("Exactly one supported tax rule must match the product category and buyer capacity");
  return matches[0];
}
function calculateDiscountCents(subtotalCents, rule, now = /* @__PURE__ */ new Date()) {
  if (!Number.isSafeInteger(subtotalCents) || subtotalCents < 0 || !Number.isSafeInteger(rule.value) || rule.value < 0) throw new Error("Discount inputs must be non-negative safe integers");
  if (asTime(rule.startsAt) > now.getTime() || asTime(rule.expiresAt) <= now.getTime()) throw new Error("Discount rule is outside its effective interval");
  const discount = rule.type === "basis_points" ? Math.round(subtotalCents * rule.value / 1e4) : rule.value;
  if (discount > subtotalCents) throw new Error("Discount cannot exceed subtotal");
  if (rule.minimumLineTotalCents != null && subtotalCents - discount < rule.minimumLineTotalCents) throw new Error("Discount would violate the configured minimum line total");
  return discount;
}
function calculateTaxCents(subtotalCents, discountCents, basisPoints) {
  for (const [label, value] of Object.entries({ subtotalCents, discountCents, basisPoints })) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative safe integer`);
  }
  if (discountCents > subtotalCents) throw new Error("Discount cannot exceed subtotal");
  return Math.round((subtotalCents - discountCents) * basisPoints / 1e4);
}
function assertTenderAllowed(type, amountCents, totalCents, allowed) {
  if (!allowed.includes(type)) throw new Error("Tender type is not enabled by the active authority pack");
  if (!Number.isSafeInteger(amountCents) || !Number.isSafeInteger(totalCents) || amountCents < 0 || totalCents < 0) throw new Error("Tender amounts must be non-negative integer cents");
}
function assertTransition(current, next, transitions) {
  if (!transitions[current]?.includes(next)) throw new Error(`Invalid transition from ${current} to ${next}`);
}
function assertInventoryEventQuantityDelta(eventType, deltaMicrounits) {
  if (["release", "reserve", "release_reservation"].includes(eventType) && deltaMicrounits !== 0) {
    throw new Error(`Inventory ${eventType} cannot change physical package quantity`);
  }
}
function assertInventoryDestructionQuantityDelta(eventType, quantityOnHandMicrounits, deltaMicrounits) {
  if (eventType !== "destruction") return;
  if (!Number.isSafeInteger(quantityOnHandMicrounits) || quantityOnHandMicrounits < 0 || !Number.isSafeInteger(deltaMicrounits) || deltaMicrounits !== -quantityOnHandMicrounits) {
    throw new Error("Destruction must remove all remaining physical package quantity");
  }
}
var PACKAGE_TRANSITIONS = {
  expected_inbound: ["receiving_hold"],
  receiving_hold: ["quarantined", "saleable"],
  quarantined: ["saleable", "recalled", "waste_pending"],
  saleable: ["reserved", "transfer_allocated", "quarantined", "recalled", "waste_pending", "depleted"],
  reserved: ["saleable", "staged"],
  staged: ["saleable", "depleted"],
  transfer_allocated: ["saleable", "in_transit"],
  in_transit: ["receiving_hold"],
  waste_pending: ["destroyed"],
  recalled: ["quarantined", "destroyed"],
  depleted: [],
  destroyed: []
};

// features/keystone/mutations/inventory.ts
var EVENT_STATUS = {
  release: ["saleable"],
  reserve: ["reserved"],
  release_reservation: ["saleable"],
  transfer_out: ["transfer_allocated", "in_transit"],
  transfer_in: ["receiving_hold"],
  count: ["saleable", "quarantined"],
  adjustment: ["saleable", "quarantined"],
  waste: ["waste_pending"],
  destruction: ["destroyed"],
  recall_hold: ["recalled"],
  recall_release: ["quarantined"],
  return_quarantine: ["quarantined"]
};
var isManagedInventoryEventType = (value) => value in EVENT_STATUS;
var DUAL_APPROVAL = /* @__PURE__ */ new Set(["count", "adjustment", "waste", "destruction", "recall_hold", "recall_release"]);
async function receiveCannabisPackage(_root, args, context) {
  const input = args.input;
  assertInteger(input.quantityMicrounits, "Received quantity", 1);
  const expiry = new Date(assertText(input.expiresAt, "Expiry"));
  if (!Number.isFinite(expiry.getTime()) || expiry <= /* @__PURE__ */ new Date()) throw new Error("Received package expiry must be a future date");
  return runControlledOperation(context, input, { permission: "canManageInventory", activity: "inventory", scope: "receiveCannabisPackage", resourceType: "InventoryPackage", action: "inventory.package.received", lockKeys: [String(input.packageUid)] }, async (tx, authority, correlationId) => {
    const sudo = tx.sudo();
    const product = await sudo.query.Product.findOne({ where: { id: assertText(input.productId, "Product ID") }, query: "id organization { id } premises { id } status unitOfMeasure" });
    if (!product || product.organization?.id !== authority.organizationId || product.premises?.id !== authority.premisesId || product.status !== "active") throw new Error("Active product is not available in this premises");
    const existing = await sudo.query.InventoryPackage.findOne({ where: { packageUid: assertText(input.packageUid, "Package UID") }, query: "id" });
    if (existing) throw new Error("Package UID already exists");
    const evidenceHash = stableHash(input.evidence);
    const manifest = await sudo.query.RegulatedManifest.createOne({ data: {
      organization: { connect: { id: authority.organizationId } },
      premises: { connect: { id: authority.premisesId } },
      manifestNumber: assertText(input.manifestNumber, "Manifest number"),
      type: "receiving",
      status: "receiving_hold",
      sourceLicenseNumber: assertText(input.sourceLicenseNumber, "Source license"),
      destinationLicenseNumber: authority.license.licenseNumber,
      regulatorManifestId: input.regulatorManifestId || null,
      occurredAt: /* @__PURE__ */ new Date(),
      reasonCode: assertText(input.reasonCode, "Reason code"),
      evidence: input.evidence || {},
      evidenceHash,
      actor: { connect: { id: authority.actor.id } }
    }, query: "id manifestNumber" });
    const inventoryPackage = await sudo.query.InventoryPackage.createOne({ data: {
      organization: { connect: { id: authority.organizationId } },
      premises: { connect: { id: authority.premisesId } },
      product: { connect: { id: product.id } },
      packageUid: input.packageUid,
      sourcePackageUid: input.sourcePackageUid || null,
      productionBatchNumber: assertText(input.productionBatchNumber, "Production batch"),
      lotNumber: assertText(input.lotNumber, "Lot number"),
      quantityReceivedMicrounits: input.quantityMicrounits,
      quantityOnHandMicrounits: input.quantityMicrounits,
      reservedMicrounits: 0,
      unitOfMeasure: product.unitOfMeasure,
      status: "receiving_hold",
      testStatus: "unknown",
      labName: input.labName || null,
      labResultReference: input.labResultReference || null,
      coaReference: input.coaReference || null,
      manufacturedAt: input.manufacturedAt ? new Date(input.manufacturedAt) : null,
      receivedAt: /* @__PURE__ */ new Date(),
      expiresAt: expiry,
      labelVersion: assertText(input.labelVersion, "Label version"),
      potencySnapshot: input.potencySnapshot || {},
      lineage: input.lineage || [],
      version: 1
    }, query: "id packageUid" });
    await sudo.query.InventoryEvent.createOne({ data: {
      organization: { connect: { id: authority.organizationId } },
      premises: { connect: { id: authority.premisesId } },
      package: { connect: { id: inventoryPackage.id } },
      manifest: { connect: { id: manifest.id } },
      eventType: "receive",
      quantityDeltaMicrounits: input.quantityMicrounits,
      beforeQuantityMicrounits: 0,
      afterQuantityMicrounits: input.quantityMicrounits,
      reasonCode: input.reasonCode,
      actor: { connect: { id: authority.actor.id } },
      sourceType: "RegulatedManifest",
      sourceId: manifest.id,
      idempotencyKey: `${correlationId}:receive`,
      occurredAt: /* @__PURE__ */ new Date(),
      evidenceHash,
      stateReportStatus: "queued"
    }, query: "id" });
    return { id: inventoryPackage.id, status: "receiving_hold", reference: manifest.manifestNumber, stateReport: { eventType: "receive", packageUid: inventoryPackage.packageUid, quantityMicrounits: input.quantityMicrounits, unitOfMeasure: product.unitOfMeasure, manifestNumber: manifest.manifestNumber } };
  });
}
async function releasePackageHold(_root, args, context) {
  requireRuntimeCapability("inventory.action-bound-approval", "Hold release is disabled until an authenticated, action-bound second-party approval workflow is implemented.");
  const input = args.input;
  if (!input.approvedById || input.approvedById === context.session?.itemId) throw new Error("Hold release requires an independent compliance approver");
  return runControlledOperation(context, input, { permission: "canManageCompliance", activity: "inventory", scope: "releasePackageHold", resourceType: "PackageHold", action: "inventory.hold.released", lockKeys: [String(input.holdId)] }, async (tx, authority) => {
    const sudo = tx.sudo();
    const hold = await sudo.query.PackageHold.findOne({ where: { id: assertText(input.holdId, "Hold ID") }, query: "id status organization { id } premises { id } package { id packageUid status }" });
    if (!hold || hold.status !== "active" || hold.organization?.id !== authority.organizationId || hold.premises?.id !== authority.premisesId) throw new Error("Active hold is outside this authority scope");
    const approver = await sudo.query.User.findOne({ where: { id: input.approvedById }, query: "id status organization { id } premises { id } role { canManageCompliance }" });
    if (!approver || approver.status !== "active" || !approver.role?.canManageCompliance || approver.organization?.id !== authority.organizationId || approver.premises?.id !== authority.premisesId) throw new Error("Approver lacks current compliance authority");
    await sudo.query.PackageHold.updateOne({ where: { id: hold.id }, data: { status: "released", releasedBy: { connect: { id: approver.id } }, releasedAt: /* @__PURE__ */ new Date(), releaseAuthorityReference: assertText(input.releaseAuthorityReference, "Release authority reference") }, query: "id" });
    return { id: hold.id, status: "released", reference: hold.package.packageUid };
  });
}
async function postCannabisInventoryEvent(_root, args, context) {
  requireRuntimeCapability("inventory.event-specific-custody", "Generic inventory events are disabled until event-specific conservation, approvals, and custody evidence are implemented.");
  const input = args.input;
  const eventType = assertText(input.eventType, "Event type");
  if (!isManagedInventoryEventType(eventType) || !EVENT_STATUS[eventType].includes(input.nextStatus)) throw new Error("Event type cannot produce the requested package status");
  const delta = assertInteger(Math.abs(input.quantityDeltaMicrounits), "Quantity delta", 0) * (input.quantityDeltaMicrounits < 0 ? -1 : 1);
  assertInventoryEventQuantityDelta(eventType, delta);
  const expectedVersion = assertInteger(input.expectedVersion, "Expected package version", 1);
  if (DUAL_APPROVAL.has(eventType) && (!input.approvedById || input.approvedById === context.session?.itemId)) throw new Error("This inventory event requires an independent approver");
  return runControlledOperation(context, input, { permission: eventType.startsWith("recall") ? "canManageCompliance" : "canManageInventory", activity: "inventory", scope: `postInventory:${eventType}`, resourceType: "InventoryPackage", action: `inventory.${eventType}`, lockKeys: [String(input.packageId)] }, async (tx, authority, correlationId) => {
    const sudo = tx.sudo();
    const pkg = await sudo.query.InventoryPackage.findOne({ where: { id: assertText(input.packageId, "Package ID") }, query: "id packageUid status testStatus expiresAt coaReference labelVersion quantityOnHandMicrounits reservedMicrounits version organization { id } premises { id } holds(where: { status: { equals: active } }, take: 1) { id }" });
    if (!pkg || pkg.organization?.id !== authority.organizationId || pkg.premises?.id !== authority.premisesId) throw new Error("Package is outside the actor authority scope");
    assertInventoryDestructionQuantityDelta(eventType, pkg.quantityOnHandMicrounits, delta);
    assertTransition(pkg.status, input.nextStatus, PACKAGE_TRANSITIONS);
    if (input.nextStatus === "saleable" && (pkg.testStatus !== "passed" || !pkg.coaReference || !pkg.labelVersion || new Date(pkg.expiresAt) <= /* @__PURE__ */ new Date() || pkg.holds?.length)) throw new Error("Package cannot be released without passed tests, authoritative COA/label, future expiry, and no active holds");
    const after = pkg.quantityOnHandMicrounits + delta;
    if (!Number.isSafeInteger(after) || after < 0 || after < pkg.reservedMicrounits) throw new Error("Inventory event would violate package quantity or reservations");
    if (pkg.version !== expectedVersion) throw new Error("Package changed; recount and retry with the current version");
    const updated = await tx.prisma.inventoryPackage.updateMany({ where: { id: pkg.id, version: expectedVersion, quantityOnHandMicrounits: pkg.quantityOnHandMicrounits }, data: { quantityOnHandMicrounits: after, status: input.nextStatus, version: { increment: 1 } } });
    if (updated.count !== 1) throw new Error("Concurrent package update detected");
    let approver = null;
    if (input.approvedById) {
      approver = await sudo.query.User.findOne({ where: { id: input.approvedById }, query: "id status organization { id } premises { id } role { canManageCompliance canManageInventory }" });
      if (!approver || approver.status !== "active" || approver.organization?.id !== authority.organizationId || approver.premises?.id !== authority.premisesId || !approver.role?.canManageCompliance && !approver.role?.canManageInventory) throw new Error("Independent approver lacks current premises authority");
    }
    const evidenceHash = stableHash(input.evidence || {});
    const manifest = await sudo.query.RegulatedManifest.createOne({ data: {
      organization: { connect: { id: authority.organizationId } },
      premises: { connect: { id: authority.premisesId } },
      manifestNumber: assertText(input.manifestNumber, "Manifest number"),
      type: eventType === "transfer_out" || eventType === "transfer_in" ? eventType : eventType === "recall_hold" || eventType === "recall_release" ? "recall" : eventType === "count" ? "count" : eventType === "waste" ? "waste" : eventType === "destruction" ? "destruction" : "adjustment",
      status: eventType === "transfer_out" ? "dispatched" : input.nextStatus === "destroyed" ? "completed" : "accepted",
      sourceLicenseNumber: input.sourceLicenseNumber || authority.license.licenseNumber,
      destinationLicenseNumber: input.destinationLicenseNumber || authority.license.licenseNumber,
      regulatorManifestId: input.regulatorManifestId || null,
      occurredAt: /* @__PURE__ */ new Date(),
      reasonCode: assertText(input.reasonCode, "Reason code"),
      evidence: input.evidence || {},
      evidenceHash,
      actor: { connect: { id: authority.actor.id } },
      ...approver ? { approvedBy: { connect: { id: approver.id } } } : {}
    }, query: "id manifestNumber" });
    await sudo.query.InventoryEvent.createOne({ data: {
      organization: { connect: { id: authority.organizationId } },
      premises: { connect: { id: authority.premisesId } },
      package: { connect: { id: pkg.id } },
      manifest: { connect: { id: manifest.id } },
      eventType,
      quantityDeltaMicrounits: delta,
      beforeQuantityMicrounits: pkg.quantityOnHandMicrounits,
      afterQuantityMicrounits: after,
      reasonCode: input.reasonCode,
      actor: { connect: { id: authority.actor.id } },
      ...approver ? { approvedBy: { connect: { id: approver.id } } } : {},
      sourceType: "RegulatedManifest",
      sourceId: manifest.id,
      idempotencyKey: `${correlationId}:${eventType}`,
      occurredAt: /* @__PURE__ */ new Date(),
      evidenceHash,
      stateReportStatus: "queued"
    }, query: "id" });
    if (eventType === "recall_hold") {
      await sudo.query.PackageHold.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, package: { connect: { id: pkg.id } }, type: "recall", status: "active", reasonCode: input.reasonCode, reason: assertText(input.reason, "Recall reason", 4), placedBy: { connect: { id: authority.actor.id } }, placedAt: /* @__PURE__ */ new Date(), evidenceHash }, query: "id" });
      await sudo.query.RecallCase.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, reference: assertText(input.recallReference, "Recall reference"), status: "active", authorityReference: assertText(input.recallAuthorityReference, "Recall authority reference"), packageUids: [pkg.packageUid], batchNumbers: input.batchNumbers || [], reason: input.reason, openedAt: /* @__PURE__ */ new Date(), evidenceHash }, query: "id" });
    }
    return { id: pkg.id, status: input.nextStatus, reference: pkg.packageUid, quantityOnHandMicrounits: after, version: expectedVersion + 1, stateReport: { eventType, packageUid: pkg.packageUid, quantityDeltaMicrounits: delta, manifestNumber: manifest.manifestNumber, reasonCode: input.reasonCode } };
  });
}

// features/keystone/mutations/public.ts
var import_node_crypto2 = require("node:crypto");
var proofHash = (value) => (0, import_node_crypto2.createHash)("sha256").update(value).digest("hex");
async function publicAuthority(context) {
  const organizations = await context.sudo().query.Organization.findMany({ where: { status: { equals: "active" } }, take: 2, query: "id jurisdictionCode premises(where: { status: { equals: active } }, take: 2) { id timezone }" });
  if (organizations.length !== 1 || organizations[0].premises?.length !== 1) throw new Error("Public service is unavailable until exactly one authority scope is active");
  const organization = organizations[0];
  const premises = organization.premises[0];
  const pack = await requireRulePack(context, organization.id, premises.id);
  assertEffectiveRulePack(pack);
  return { organization, premises, pack };
}
async function publicCannabisStorefrontSettings(_root, _args, context) {
  try {
    const authority = await publicAuthority(context);
    const storefrontModeFilter = isRuntimeCapabilityEnabled("storefront.public-live-menu") ? {} : { storefrontMode: { equals: "demo" } };
    const settings = await context.sudo().query.StorefrontSettings.findMany({
      where: {
        organization: { id: { equals: authority.organization.id } },
        premises: { id: { equals: authority.premises.id } },
        publicationStatus: { equals: "published" },
        ...storefrontModeFilter
      },
      orderBy: [{ createdAt: "asc" }],
      take: 2,
      query: "businessName tagline description brandHue logoIcon logoColor publicationStatus storefrontMode"
    });
    if (settings.length !== 1) return { ...NEUTRAL_STOREFRONT_SETTINGS };
    return projectPublicStorefrontSettings(settings[0]);
  } catch {
    return { ...NEUTRAL_STOREFRONT_SETTINGS };
  }
}
async function publicCannabisMenu(_root, _args, context) {
  let authority;
  try {
    authority = await publicAuthority(context);
  } catch {
    return { unavailable: true, products: [], demoProducts: [] };
  }
  if (!isRuntimeCapabilityEnabled("storefront.public-live-menu")) {
    const demoSettings2 = await context.sudo().query.StorefrontSettings.findMany({
      where: {
        organization: { id: { equals: authority.organization.id } },
        premises: { id: { equals: authority.premises.id } },
        publicationStatus: { equals: "published" },
        storefrontMode: { equals: "demo" }
      },
      orderBy: [{ createdAt: "asc" }],
      take: 2,
      query: "demoCatalog"
    });
    return {
      jurisdictionCode: authority.organization.jurisdictionCode,
      rulePackVersion: authority.pack.version,
      products: [],
      demoProducts: demoSettings2.length === 1 ? projectPublicDemoCatalog(demoSettings2[0].demoCatalog) : []
    };
  }
  const scope = { organization: { id: { equals: authority.organization.id } }, premises: { id: { equals: authority.premises.id } } };
  const [packages, demoSettings] = await Promise.all([
    context.sudo().query.InventoryPackage.findMany({
      where: { ...scope, status: { equals: "saleable" }, testStatus: { equals: "passed" }, expiresAt: { gt: /* @__PURE__ */ new Date() }, quantityOnHandMicrounits: { gt: 0 } },
      orderBy: [{ expiresAt: "asc" }, { createdAt: "asc" }],
      take: 201,
      query: "id status testStatus expiresAt quantityOnHandMicrounits reservedMicrounits coaReference labelVersion holds(where: { status: { equals: active } }, take: 1) { id } product { id name sku form categoryCode unitQuantityMicrounits priceCents publicDescription publicImageUrl adultUseEligible medicalEligible status } premises { id }"
    }),
    context.sudo().query.StorefrontSettings.findMany({
      where: { ...scope, publicationStatus: { equals: "published" }, storefrontMode: { equals: "demo" } },
      orderBy: [{ createdAt: "asc" }],
      take: 2,
      query: "demoCatalog"
    })
  ]);
  if (packages.length > 200) throw new Error("Menu projection exceeds its bounded source page and requires operator review");
  const products = /* @__PURE__ */ new Map();
  for (const pkg of packages) {
    const premisesId2 = pkg.premises?.id;
    if (!premisesId2 || premisesId2 !== authority.premises.id || !pkg.product || pkg.product.status !== "active") continue;
    try {
      assertPackageSaleable({ status: pkg.status, testStatus: pkg.testStatus, expiresAt: pkg.expiresAt, premisesId: premisesId2, quantityOnHandMicrounits: pkg.quantityOnHandMicrounits, reservedMicrounits: pkg.reservedMicrounits, activeHoldCount: pkg.holds?.length || 0, coaReference: pkg.coaReference, labelVersion: pkg.labelVersion }, authority.premises.id, pkg.product.unitQuantityMicrounits);
    } catch {
      continue;
    }
    if (!products.has(pkg.product.id)) products.set(pkg.product.id, { id: pkg.product.id, name: pkg.product.name, sku: pkg.product.sku, form: pkg.product.form, categoryCode: pkg.product.categoryCode, priceCents: pkg.product.priceCents, description: pkg.product.publicDescription, imageUrl: pkg.product.publicImageUrl, adultUseEligible: pkg.product.adultUseEligible, medicalEligible: pkg.product.medicalEligible, available: true });
  }
  const demoProducts = demoSettings.length === 1 ? projectPublicDemoCatalog(demoSettings[0].demoCatalog) : [];
  return { jurisdictionCode: authority.organization.jurisdictionCode, rulePackVersion: authority.pack.version, products: [...products.values()], demoProducts };
}
async function submitCannabisCustomerIntake(_root, args, context) {
  requireRuntimeCapability("privacy.approved-intake", "Customer identity intake is disabled until owner-approved privacy, retention, abuse-limiting, and atomic-recovery controls are implemented.");
  const input = args.input;
  const authority = await publicAuthority(context);
  const capacity = input.capacity;
  if (!["adult_use", "patient", "caregiver"].includes(capacity)) throw new Error("Unsupported buyer capacity");
  if (capacity !== "adult_use" && !authority.pack.medicalEnabled) throw new Error("Medical intake is not enabled");
  const email = assertText(input.email, "Email", 3, 320).toLowerCase();
  const dateOfBirth = new Date(assertText(input.dateOfBirth, "Date of birth"));
  const identityExpiresAt = new Date(assertText(input.identityExpiresAt, "Identity expiry"));
  if (!Number.isFinite(dateOfBirth.getTime()) || !Number.isFinite(identityExpiresAt.getTime())) throw new Error("Identity dates are invalid");
  const identityMethod = assertText(input.identityMethod, "Identity method");
  const identityReferenceHash = assertText(input.identityReferenceHash, "Identity reference hash", 16, 500);
  const optionalIntakeText = (value, label) => value == null || value === "" ? null : assertText(value, label, 1, 500);
  const registryName = optionalIntakeText(input.registryName, "Registry name");
  const registryReferenceHash = optionalIntakeText(input.registryReferenceHash, "Registry reference hash");
  const representedPatientReferenceHash = optionalIntakeText(input.representedPatientReferenceHash, "Represented patient reference hash");
  const proof = (0, import_node_crypto2.randomBytes)(32).toString("base64url");
  const reference = `INTAKE-${(0, import_node_crypto2.randomUUID)()}`;
  const sudo = context.sudo();
  const customer = await sudo.query.Customer.createOne({ data: { organization: { connect: { id: authority.organization.id } }, premises: { connect: { id: authority.premises.id } }, reference, capacity, status: "pending_verification", intakeProofHash: proofHash(proof), contact: { email }, marketingConsent: input.marketingConsent === true }, query: "id reference" });
  await sudo.query.EligibilityEvidence.createOne({ data: { organization: { connect: { id: authority.organization.id } }, premises: { connect: { id: authority.premises.id } }, customer: { connect: { id: customer.id } }, capacity, identityMethod, identityReferenceHash, dateOfBirth, identityExpiresAt, registryName, registryReferenceHash, representedPatientReferenceHash, result: "pending", reasonCodes: ["staff_verification_required"], evidenceHash: stableHash({ capacity, identityMethod, identityReferenceHash, dateOfBirth: dateOfBirth.toISOString() }) }, query: "id" });
  return { reference, proof, status: "pending_verification", message: "Intake is not eligibility. Staff must verify current authority before reservation or sale." };
}
async function recordEligibilityDecision(_root, args, context) {
  requireRuntimeCapability("identity.verified-eligibility", "Eligibility decisions are disabled until current identity and registry evidence can be independently verified and recorded.");
  const input = args.input;
  return runControlledOperation(context, input, { permission: "canManageCompliance", activity: "eligibility", scope: "recordEligibilityDecision", resourceType: "EligibilityEvidence", action: "eligibility.decided", emitStateEvent: false }, async (tx, authority) => {
    const sudo = tx.sudo();
    const pack = await requireRulePack(tx, authority.organizationId, authority.premisesId);
    assertEffectiveRulePack(pack);
    const customer = await sudo.query.Customer.findOne({ where: { id: assertText(input.customerId, "Customer ID") }, query: "id capacity status organization { id } premises { id }" });
    if (!customer || customer.organization?.id !== authority.organizationId || customer.premises?.id !== authority.premisesId) throw new Error("Customer is outside this premises authority");
    const dob = new Date(assertText(input.dateOfBirth, "Date of birth"));
    const identityExpiresAt = new Date(assertText(input.identityExpiresAt, "Identity expiry"));
    const now = /* @__PURE__ */ new Date();
    let age = now.getUTCFullYear() - dob.getUTCFullYear();
    if (now.getUTCMonth() < dob.getUTCMonth() || now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate()) age -= 1;
    assertEligibility({ capacity: customer.capacity, age, identityValid: identityExpiresAt > now && input.identityVerified === true, registryValid: input.registryVerified === true && (!input.registryExpiresAt || new Date(input.registryExpiresAt) > now), representedPatientValid: input.representedPatientVerified === true }, pack);
    const evidenceHash = stableHash({ ...input, verifier: authority.actor.id, ruleVersion: pack.version });
    const evidence = await sudo.query.EligibilityEvidence.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, customer: { connect: { id: customer.id } }, capacity: customer.capacity, identityMethod: input.identityMethod, identityReferenceHash: input.identityReferenceHash, dateOfBirth: dob, identityExpiresAt, registryName: input.registryName || null, registryReferenceHash: input.registryReferenceHash || null, registryVerifiedAt: input.registryVerified ? now : null, registryExpiresAt: input.registryExpiresAt ? new Date(input.registryExpiresAt) : null, representedPatientReferenceHash: input.representedPatientReferenceHash || null, allotmentRemainingMicrounits: input.allotmentRemainingMicrounits ?? null, result: "eligible", reasonCodes: ["configured_authority_verified"], evidenceHash, verifiedAt: now }, query: "id result" });
    await sudo.query.Customer.updateOne({ where: { id: customer.id }, data: { status: "eligible" }, query: "id" });
    return { id: evidence.id, status: evidence.result, reference: customer.id, rulePackVersion: pack.version };
  });
}

// features/keystone/mutations/commerce.ts
var import_node_crypto3 = require("node:crypto");

// features/keystone/domain/cartReservations.ts
var MAX_DATABASE_INT = 2147483647;
var CANCELLABLE_CART_STATUSES = ["preliminarily_eligible", "reserved", "picking", "staged"];
function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function planCartCancellation(snapshot) {
  if (!snapshot || typeof snapshot.id !== "string" || !snapshot.id) throw new Error("Cart snapshot is invalid");
  if (snapshot.status === "cancelled") return { disposition: "replay", cartId: snapshot.id };
  if (!CANCELLABLE_CART_STATUSES.includes(snapshot.status)) throw new Error("Cart is not cancellable");
  if (!Number.isSafeInteger(snapshot.version) || snapshot.version < 1 || snapshot.version > MAX_DATABASE_INT) throw new Error("Cart version is invalid");
  if (!Array.isArray(snapshot.lines) || snapshot.lines.length > 250) throw new Error("Cart reservation lines exceed the bounded cancellation contract");
  const releases = /* @__PURE__ */ new Map();
  let totalReleasedMicrounits = 0;
  for (const [index, value] of snapshot.lines.entries()) {
    if (!isRecord(value) || typeof value.id !== "string" || !value.id || !Number.isSafeInteger(value.quantityMicrounits) || value.quantityMicrounits < 1 || value.quantityMicrounits > MAX_DATABASE_INT || !isRecord(value.package) || typeof value.package.id !== "string" || !value.package.id) {
      throw new Error(`Cart reservation line ${index + 1} is invalid`);
    }
    const quantity = value.quantityMicrounits;
    const packageId = value.package.id;
    const group = releases.get(packageId) ?? { packageId, quantityMicrounits: 0, lineIds: [] };
    const groupedQuantity = group.quantityMicrounits + quantity;
    if (!Number.isSafeInteger(groupedQuantity) || groupedQuantity > MAX_DATABASE_INT) throw new Error("Grouped package release exceeds the database integer range");
    group.quantityMicrounits = groupedQuantity;
    group.lineIds.push(value.id);
    releases.set(packageId, group);
    totalReleasedMicrounits += quantity;
  }
  return {
    disposition: "cancel",
    cartId: snapshot.id,
    expectedStatus: snapshot.status,
    expectedVersion: snapshot.version,
    releases: [...releases.values()].map((group) => ({ ...group, lineIds: [...group.lineIds].sort() })).sort((left, right) => left.packageId.localeCompare(right.packageId)),
    releasedLines: snapshot.lines.length,
    totalReleasedMicrounits
  };
}
function assertCartCancellationFence(plan, current) {
  if (current.id !== plan.cartId || current.version !== plan.expectedVersion || current.status !== plan.expectedStatus || !CANCELLABLE_CART_STATUSES.includes(current.status)) {
    throw new Error("Cart state changed concurrently");
  }
}
function assertReservationCanBeReleased(reservedMicrounits, releaseMicrounits) {
  if (!Number.isSafeInteger(reservedMicrounits) || reservedMicrounits < 0 || reservedMicrounits > MAX_DATABASE_INT || !Number.isSafeInteger(releaseMicrounits) || releaseMicrounits < 1 || releaseMicrounits > MAX_DATABASE_INT) {
    throw new Error("Package reservation quantities are invalid");
  }
  if (reservedMicrounits < releaseMicrounits) throw new Error("Package reservation ledger is inconsistent");
  return reservedMicrounits - releaseMicrounits;
}

// features/keystone/domain/saleConservation.ts
var MAX_DATABASE_INT2 = 2147483647;
function isRecord2(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function groupSaleLinesByPackage(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 250) throw new Error("Sale requires 1-250 exact-package lines");
  const groups = /* @__PURE__ */ new Map();
  for (const [lineIndex, entry] of value.entries()) {
    if (!isRecord2(entry) || !isRecord2(entry.package) || typeof entry.package.id !== "string" || !entry.package.id || !Number.isSafeInteger(entry.quantityMicrounits) || entry.quantityMicrounits < 1 || entry.quantityMicrounits > MAX_DATABASE_INT2) {
      throw new Error(`Sale line ${lineIndex + 1} has an invalid package quantity`);
    }
    const packageId = entry.package.id;
    const quantity = entry.quantityMicrounits;
    const group = groups.get(packageId) ?? { packageId, quantityMicrounits: 0, lineIndexes: [] };
    const groupedQuantity = group.quantityMicrounits + quantity;
    if (!Number.isSafeInteger(groupedQuantity) || groupedQuantity > MAX_DATABASE_INT2) throw new Error("Grouped package sale exceeds the database integer range");
    group.quantityMicrounits = groupedQuantity;
    group.lineIndexes.push(lineIndex);
    groups.set(packageId, group);
  }
  return [...groups.values()].sort((left, right) => left.packageId.localeCompare(right.packageId));
}
function assertReservedPackageForSale(input, premisesId2, requestedMicrounits, now = /* @__PURE__ */ new Date()) {
  if (input.premisesId !== premisesId2) throw new Error("Package belongs to a different licensed premises");
  if (input.status !== "saleable" || input.testStatus !== "passed") throw new Error("Package is not released and saleable");
  if (!Number.isSafeInteger(input.activeHoldCount) || input.activeHoldCount < 0 || input.activeHoldCount > 0) throw new Error("Package has an active hold");
  const expiresAt = new Date(input.expiresAt).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) throw new Error("Package is expired");
  if (!input.coaReference || !input.labelVersion) throw new Error("Authoritative COA and label version are required");
  for (const [label, quantity] of [["on-hand", input.quantityOnHandMicrounits], ["reserved", input.reservedMicrounits], ["requested", requestedMicrounits]]) {
    if (!Number.isSafeInteger(quantity) || quantity < (label === "requested" ? 1 : 0) || quantity > MAX_DATABASE_INT2) throw new Error(`Package ${label} quantity is invalid`);
  }
  if (input.reservedMicrounits > input.quantityOnHandMicrounits) throw new Error("Package reservation exceeds physical on-hand quantity");
  if (input.quantityOnHandMicrounits < requestedMicrounits || input.reservedMicrounits < requestedMicrounits) throw new Error("Exact package reservation is insufficient for sale");
}
function planSaleLineBalances(lines, group, quantityOnHandMicrounits) {
  if (!Number.isSafeInteger(quantityOnHandMicrounits) || quantityOnHandMicrounits < group.quantityMicrounits) throw new Error("Physical on-hand quantity is insufficient for grouped sale");
  let remaining = quantityOnHandMicrounits;
  return group.lineIndexes.map((lineIndex) => {
    const line = lines[lineIndex];
    if (!line || line.package.id !== group.packageId || !Number.isSafeInteger(line.quantityMicrounits) || line.quantityMicrounits < 1) throw new Error("Sale line package grouping is inconsistent");
    const before = remaining;
    remaining -= line.quantityMicrounits;
    if (remaining < 0) throw new Error("Sale line allocation exceeds physical on-hand quantity");
    return { lineIndex, before, after: remaining };
  });
}
function assertFinalSaleCartFence(expected, current) {
  if (expected.status !== "reserved" || current.id !== expected.id || current.status !== expected.status || current.version !== expected.version) {
    throw new Error("Reserved cart state changed concurrently");
  }
}

// features/keystone/domain/packageAllocation.ts
var MAX_INT = 2147483647;
function readAllocationReceipt(value, resourceId, cartId) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const evidence = value;
  if (evidence.id !== resourceId || typeof evidence.quoteHash !== "string" || !/^[a-f0-9]{64}$/.test(evidence.quoteHash) || !evidence.quote || typeof evidence.quote !== "object" || Array.isArray(evidence.quote)) return null;
  const quote = evidence.quote;
  const quantity = quote.quantityMicrounits;
  const totalCents = quote.totalCents;
  if (quote.schemaVersion !== 1 || quote.cartId !== cartId || typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_INT || typeof totalCents !== "number" || !Number.isSafeInteger(totalCents) || totalCents < 0 || totalCents > MAX_INT) return null;
  return { quantityMicrounits: quantity, totalCents, quoteHash: evidence.quoteHash };
}
function choosePackageForProduct(rows, scope, productId, quantity, now = /* @__PURE__ */ new Date()) {
  if (!Array.isArray(rows) || rows.length > 51 || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_INT) throw new Error("Allocation source read is invalid");
  const candidates = rows.slice(0, 50).filter((pkg) => {
    if (!pkg || pkg.organization?.id !== scope.organizationId || pkg.premises?.id !== scope.premisesId || pkg.product?.id !== productId || pkg.product.organization?.id !== scope.organizationId || pkg.product.premises?.id !== scope.premisesId || pkg.product.status !== "active" || pkg.status !== "saleable" || pkg.testStatus !== "passed" || !Array.isArray(pkg.holds) || pkg.holds.length || !pkg.coaReference || !pkg.labelVersion || !(new Date(pkg.expiresAt).getTime() > now.getTime()) || !Number.isSafeInteger(pkg.reservedMicrounits) || !Number.isSafeInteger(pkg.quantityOnHandMicrounits) || pkg.reservedMicrounits < 0 || pkg.quantityOnHandMicrounits < pkg.reservedMicrounits || pkg.quantityOnHandMicrounits > MAX_INT || !Number.isSafeInteger(pkg.product.unitQuantityMicrounits) || pkg.product.unitQuantityMicrounits < 1 || quantity % pkg.product.unitQuantityMicrounits !== 0 || pkg.quantityOnHandMicrounits - pkg.reservedMicrounits < quantity) return false;
    return typeof pkg.id === "string" && Boolean(pkg.id);
  });
  candidates.sort((left, right) => new Date(left.expiresAt).getTime() - new Date(right.expiresAt).getTime() || left.id.localeCompare(right.id));
  if (!candidates.length) throw new Error(rows.length > 50 ? "Allocation source page needs continuation; no stock was allocated" : "No complete saleable unit is available");
  return candidates[0].id;
}
function assertReservationLedger(ledger, packageId, reserved, scope) {
  if (!Array.isArray(ledger) || ledger.length > 500 || !Number.isSafeInteger(reserved) || reserved < 0) throw new Error("Complete package allocation ledger is required");
  const ids = /* @__PURE__ */ new Set();
  let total = 0;
  for (const line of ledger) {
    if (!line || typeof line.id !== "string" || !line.id || ids.has(line.id) || line.package?.id !== packageId || line.organization?.id !== scope.organizationId || line.premises?.id !== scope.premisesId || line.cart?.organization?.id !== scope.organizationId || line.cart?.premises?.id !== scope.premisesId || !line.cart?.id || !["preliminarily_eligible", "reserved", "picking", "staged", "final_verification"].includes(line.cart.status) || !Number.isSafeInteger(line.quantityMicrounits) || line.quantityMicrounits < 1 || line.quantityMicrounits > MAX_INT) throw new Error("Package allocation evidence is ambiguous");
    ids.add(line.id);
    total += line.quantityMicrounits;
    if (!Number.isSafeInteger(total) || total > MAX_INT) throw new Error("Package allocation ledger exceeds integer range");
  }
  if (total !== reserved) throw new Error("Reservation counter does not match complete allocation ledger");
}
function planReservationBalances(onHand, reserved, requested) {
  if (![onHand, reserved, requested].every(Number.isSafeInteger) || onHand < 0 || reserved < 0 || requested < 1 || onHand > MAX_INT || reserved > MAX_INT || requested > MAX_INT || reserved + requested > onHand) {
    throw new Error("Reservation would violate exact-package quantity conservation");
  }
  return {
    beforeReservedMicrounits: reserved,
    afterReservedMicrounits: reserved + requested,
    beforeQuantityMicrounits: onHand,
    afterQuantityMicrounits: onHand,
    quantityDeltaMicrounits: 0
  };
}

// features/keystone/domain/allocationQuote.ts
function calculateAllocationQuote(pkg, cart, pack, quantity, promotionCode, authority, now = /* @__PURE__ */ new Date()) {
  const product = pkg.product;
  for (const value of [pkg.version, cart.version]) {
    if (!Number.isSafeInteger(value) || value < 1 || value >= 2147483647) throw new Error("Allocation quote version is invalid");
  }
  for (const value of [product.unitQuantityMicrounits, product.equivalencyMicrounits, quantity]) {
    if (!Number.isSafeInteger(value) || value < 1 || value > 2147483647) throw new Error("Allocation quote quantity is invalid");
  }
  if (!["adult_use", "patient", "caregiver"].includes(cart.customer.capacity) || pkg.unitOfMeasure !== product.unitOfMeasure || quantity % product.unitQuantityMicrounits !== 0 || product.status !== "active" || (cart.customer.capacity === "adult_use" ? !product.adultUseEligible : !product.medicalEligible)) throw new Error("Product unit/capacity is not eligible");
  const units = quantity / product.unitQuantityMicrounits;
  const subtotalCents = product.priceCents * units;
  const equivalencyMicrounits = product.equivalencyMicrounits * units;
  if (!Number.isSafeInteger(product.priceCents) || product.priceCents < 0 || !Number.isSafeInteger(subtotalCents) || subtotalCents > 2147483647 || !Number.isSafeInteger(equivalencyMicrounits) || equivalencyMicrounits > 2147483647) throw new Error("Allocation quote exceeds integer storage range");
  const taxRule = requireTaxRule(pack.taxRules, product.taxCategoryCode, cart.customer.capacity);
  let discountCents = 0;
  let discountSnapshot = {};
  if (promotionCode) {
    const discounts = (pack.discountRules || []).filter((candidate) => candidate.code === promotionCode && candidate.categoryCode === product.categoryCode && (candidate.capacity === cart.customer.capacity || candidate.capacity === "all"));
    if (discounts.length !== 1) throw new Error("Exactly one configured promotion must match");
    discountCents = calculateDiscountCents(subtotalCents, discounts[0], now);
    discountSnapshot = { code: discounts[0].code, type: discounts[0].type, value: discounts[0].value, authorityPackVersion: pack.version };
  }
  const taxCents = calculateTaxCents(subtotalCents, discountCents, taxRule.basisPoints);
  const totalCents = subtotalCents - discountCents + taxCents;
  if (!Number.isSafeInteger(totalCents) || totalCents > 2147483647) throw new Error("Quoted total exceeds integer storage range");
  const policySnapshot = JSON.parse(JSON.stringify(pack));
  const packageSnapshot = JSON.parse(JSON.stringify(pkg));
  return {
    schemaVersion: 1,
    policySnapshot,
    packageSnapshot,
    actorId: authority.actor.id,
    organizationId: authority.organizationId,
    premisesId: authority.premisesId,
    cartId: cart.id,
    cartVersion: cart.version,
    buyerCapacity: cart.customer.capacity,
    packageId: pkg.id,
    packageVersion: pkg.version,
    productId: product.id,
    unitOfMeasure: pkg.unitOfMeasure,
    unitQuantityMicrounits: product.unitQuantityMicrounits,
    units,
    quantityMicrounits: quantity,
    equivalencyMicrounits,
    unitPriceCents: product.priceCents,
    subtotalCents,
    discountCents,
    discountSnapshot,
    taxBasisPoints: taxRule.basisPoints,
    taxCents,
    totalCents,
    promotionCode,
    rulePackId: pack.id,
    rulePackVersion: pack.version
  };
}

// features/keystone/mutations/commerce.ts
var hash = (value) => (0, import_node_crypto3.createHash)("sha256").update(value).digest("hex");
function ageAt(dobValue, now) {
  const dob = new Date(dobValue);
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  if (now.getUTCMonth() < dob.getUTCMonth() || now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate()) age -= 1;
  return age;
}
function localMinute(now, timezone) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) throw new Error("Premises timezone could not be evaluated");
  return hour * 60 + minute;
}
async function validateCustomerProof(context, customerId, proof) {
  const customer = await context.sudo().query.Customer.findOne({ where: { id: customerId }, query: "id reference capacity status intakeProofHash organization { id } premises { id }" });
  if (!customer || !customer.intakeProofHash || customer.intakeProofHash !== hash(assertText(proof, "Customer proof", 32, 500))) throw new Error("Customer proof is invalid");
  return customer;
}
async function createCustomerPickupCart(_root, args, context) {
  requireRuntimeCapability("commerce.customer-cart", "Customer carts are disabled until owned account/intake continuity and server-side allocation are implemented.");
  const input = args.input;
  const customer = await validateCustomerProof(context, assertText(input.customerId, "Customer ID"), input.proof);
  if (customer.status !== "eligible") throw new Error("Customer is not currently eligible");
  const pack = await requireRulePack(context, customer.organization.id, customer.premises.id);
  assertEffectiveRulePack(pack);
  if (!pack.pickupEnabled) throw new Error("Pickup reservations are not enabled by the active rule pack");
  const evidence = await context.sudo().query.EligibilityEvidence.findMany({ where: { customer: { id: { equals: customer.id } }, result: { equals: "eligible" }, identityExpiresAt: { gt: /* @__PURE__ */ new Date() } }, orderBy: [{ verifiedAt: "desc" }], take: 1, query: "id result registryExpiresAt capacity" });
  if (evidence.length !== 1 || customer.capacity !== "adult_use" && (!evidence[0].registryExpiresAt || new Date(evidence[0].registryExpiresAt) <= /* @__PURE__ */ new Date())) throw new Error("Exactly one current eligibility decision is required");
  const existing = await context.sudo().query.Cart.findMany({ where: { customer: { id: { equals: customer.id } }, status: { in: ["preliminarily_eligible", "reserved", "picking", "staged"] }, expiresAt: { gt: /* @__PURE__ */ new Date() } }, orderBy: [{ createdAt: "desc" }], take: 2, query: "id reference status expiresAt" });
  if (existing.length > 1) throw new Error("Multiple active carts require staff reconciliation");
  if (existing.length === 1) return { ...existing[0], proof: input.proof, replayed: true };
  const reference = `CART-${(0, import_node_crypto3.randomUUID)()}`;
  const expiresAt = new Date(Date.now() + 15 * 6e4);
  const cart = await context.sudo().query.Cart.createOne({ data: { organization: { connect: { id: customer.organization.id } }, premises: { connect: { id: customer.premises.id } }, customer: { connect: { id: customer.id } }, reference, source: "pickup", status: "preliminarily_eligible", guestProofHash: hash(input.proof), expiresAt, rulePack: { connect: { id: pack.id } }, eligibilityEvidence: { connect: { id: evidence[0].id } } }, query: "id reference status expiresAt" });
  return { ...cart, proof: input.proof };
}
async function createPosCannabisCart(_root, args, context) {
  requireRuntimeCapability("commerce.pos-cart", "POS carts are disabled until the verified customer and register workflow is implemented.");
  const input = args.input;
  return runControlledOperation(context, input, { permission: "canManageSales", activity: "sale", scope: "createPosCannabisCart", resourceType: "Cart", action: "cart.pos.created", emitStateEvent: false }, async (tx, authority) => {
    const sudo = tx.sudo();
    const pack = await requireRulePack(tx, authority.organizationId, authority.premisesId);
    assertEffectiveRulePack(pack);
    const customer = await sudo.query.Customer.findOne({ where: { id: assertText(input.customerId, "Customer ID") }, query: "id capacity status organization { id } premises { id }" });
    const evidence = await sudo.query.EligibilityEvidence.findOne({ where: { id: assertText(input.eligibilityEvidenceId, "Eligibility evidence ID") }, query: "id customer { id } result identityExpiresAt registryExpiresAt" });
    const shift = await sudo.query.RegisterShift.findOne({ where: { id: assertText(input.shiftId, "Shift ID") }, query: "id status organization { id } premises { id } operator { id }" });
    if (!customer || customer.status !== "eligible" || customer.organization?.id !== authority.organizationId || customer.premises?.id !== authority.premisesId) throw new Error("Customer is not currently eligible in this premises");
    if (!evidence || evidence.customer?.id !== customer.id || evidence.result !== "eligible" || new Date(evidence.identityExpiresAt) <= /* @__PURE__ */ new Date() || customer.capacity !== "adult_use" && (!evidence.registryExpiresAt || new Date(evidence.registryExpiresAt) <= /* @__PURE__ */ new Date())) throw new Error("Current eligibility evidence is required");
    if (!shift || shift.status !== "open" || shift.organization?.id !== authority.organizationId || shift.premises?.id !== authority.premisesId || shift.operator?.id !== authority.actor.id) throw new Error("Actor must own an open register shift");
    const cart = await sudo.query.Cart.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, customer: { connect: { id: customer.id } }, shift: { connect: { id: shift.id } }, reference: `CART-${(0, import_node_crypto3.randomUUID)()}`, source: "pos", status: "preliminarily_eligible", expiresAt: new Date(Date.now() + 30 * 6e4), rulePack: { connect: { id: pack.id } }, eligibilityEvidence: { connect: { id: evidence.id } } }, query: "id reference status" });
    return { id: cart.id, status: cart.status, reference: cart.reference };
  });
}
var ALLOCATION_PACKAGE_SELECTION = "id packageUid productionBatchNumber unitOfMeasure status testStatus expiresAt quantityOnHandMicrounits reservedMicrounits coaReference labName labResultReference labVerifiedAt labelVersion potencySnapshot version organization { id } premises { id } holds(where: { status: { equals: active } }, take: 1) { id } product { id name sku unitOfMeasure categoryCode unitQuantityMicrounits equivalencyMicrounits priceCents taxCategoryCode adultUseEligible medicalEligible status organization { id } premises { id } }";
async function cannabisCartAllocationQuote(_root, args, context) {
  const authority = await requireOperationalAuthority(context, "canManageSales", "sale");
  if (!args.input || typeof args.input !== "object" || Array.isArray(args.input)) throw new Error("Allocation quote input is invalid");
  const input = args.input;
  const cartId = assertText(input.cartId, "Cart ID", 1, 100);
  const visible = await context.query.Cart.findOne({ where: { id: cartId }, query: "id" });
  if (!visible || visible.id !== cartId) throw new Error("Cart quote is outside current access");
  const cart = await context.sudo().query.Cart.findOne({ where: { id: cartId }, query: "id version organization { id } premises { id } customer { capacity organization { id } premises { id } } rulePack { id }" });
  if (!cart || cart.organization?.id !== authority.organizationId || cart.premises?.id !== authority.premisesId || cart.customer?.organization?.id !== authority.organizationId || cart.customer?.premises?.id !== authority.premisesId) throw new Error("Cart quote relationships are outside current authority");
  const productId = assertText(input.productId, "Product ID", 1, 100);
  const quantity = assertInteger(input.quantityMicrounits, "Quantity", 1);
  const candidates = await context.sudo().query.InventoryPackage.findMany({ where: { organization: { id: { equals: authority.organizationId } }, premises: { id: { equals: authority.premisesId } }, product: { id: { equals: productId } }, status: { equals: "saleable" } }, orderBy: [{ expiresAt: "asc" }, { id: "asc" }], take: 51, query: ALLOCATION_PACKAGE_SELECTION });
  const id = choosePackageForProduct(candidates, authority, productId, quantity);
  const pkg = candidates.find((candidate) => candidate.id === id);
  const pack = await requireRulePack(context, authority.organizationId, authority.premisesId);
  assertEffectiveRulePack(pack);
  if (!(new Date(pack.effectiveAt).getTime() <= Date.now()) || !(new Date(pack.expiresAt).getTime() > Date.now()) || cart.rulePack?.id !== pack.id) throw new Error("Current configured cart policy is unavailable");
  const quote = calculateAllocationQuote(pkg, { id: cart.id, version: cart.version, customer: { capacity: cart.customer.capacity } }, pack, quantity, input.promotionCode ? assertText(input.promotionCode, "Promotion code", 1, 100) : null, { organizationId: authority.organizationId, premisesId: authority.premisesId, actor: { id: authority.actor.id } });
  return {
    quote,
    quoteHash: stableHash(quote),
    packagesHasMore: candidates.length > 50,
    reservationReadiness: "Source reservation is not activated: approved identity/lab/subject-window evidence contracts and isolated database verification remain required. This price quote is not eligibility, allocation, payment or dispensing."
  };
}
async function addCannabisCartLine(_root, args, context) {
  requireRuntimeCapability("commerce.reservation-ledger", "Cart reservations remain disabled pending complete ownership/replay semantics and PostgreSQL concurrency verification.");
  const staffAuthority = await requireOperationalAuthority(context, "canManageSales", "sale");
  if (!args.input || typeof args.input !== "object" || Array.isArray(args.input)) throw new Error("Allocation input is invalid");
  const raw = args.input;
  if (raw.packageId != null || raw.priceCents != null || raw.actorId != null || raw.proof != null) throw new Error("Allocation authority and package/price choice are server-owned; owned guest/delegation contracts require separate review");
  const input = {
    cartId: assertText(raw.cartId, "Cart ID", 1, 100),
    productId: assertText(raw.productId, "Product ID", 1, 100),
    quantityMicrounits: assertInteger(raw.quantityMicrounits, "Quantity", 1),
    expectedCartVersion: assertInteger(raw.expectedCartVersion, "Expected cart version", 1, 2147483646),
    reviewedQuoteHash: assertText(raw.reviewedQuoteHash, "Reviewed quote hash", 64, 64),
    promotionCode: raw.promotionCode ? assertText(raw.promotionCode, "Promotion code", 1, 100) : null,
    idempotencyKey: assertText(raw.idempotencyKey, "Idempotency key", 8, 99)
  };
  const quantity = input.quantityMicrounits;
  const allowed = await context.query.Cart.findOne({ where: { id: input.cartId }, query: "id" });
  if (!allowed || allowed.id !== input.cartId) throw new Error("Cart is outside current access");
  const cart = await context.sudo().query.Cart.findOne({ where: { id: input.cartId }, query: "id organization { id } premises { id }" });
  if (!cart || staffAuthority.organizationId !== cart.organization?.id || staffAuthority.premisesId !== cart.premises?.id) throw new Error("Cart is outside current staff authority");
  const operationKey = `${cart.id}:${input.idempotencyKey}`;
  return runControlledOperation(context, { ...input, idempotencyKey: operationKey }, {
    permission: "canManageSales",
    activity: "sale",
    scope: "addCannabisCartLine",
    resourceType: "CartLine",
    action: "cart.line.reserved",
    emitStateEvent: false,
    authorize: async (current, authority) => {
      const readable = await current.query.Cart.findOne({ where: { id: input.cartId }, query: "id" });
      if (!readable || readable.id !== input.cartId) throw new Error("Cart is outside current access");
      const resource = await current.sudo().query.Cart.findOne({ where: { id: input.cartId }, query: "id organization { id } premises { id }" });
      if (!resource || resource.organization?.id !== authority.organizationId || resource.premises?.id !== authority.premisesId) throw new Error("Cart is outside current allocation authority");
    }
  }, async (tx, currentAuthority, correlationId) => {
    await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "cannabis-cart", cart.id);
    await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "cannabis-policy", `${currentAuthority.organizationId}:${currentAuthority.premisesId}`);
    const sudo = tx.sudo();
    const currentCart = await sudo.query.Cart.findOne({ where: { id: cart.id }, query: "id status expiresAt guestProofHash version organization { id } premises { id } customer { id capacity } rulePack { id } lines(take: 250) { id categoryCodeSnapshot equivalencyMicrounits }" });
    const legacy = await sudo.query.CartLine.findOne({ where: { idempotencyKey: operationKey }, query: "id" });
    if (legacy) throw new Error("Legacy allocation has no original full command receipt; review is required, not a replacement key");
    if (!currentCart || currentCart.version !== input.expectedCartVersion || !["preliminarily_eligible", "reserved"].includes(currentCart.status) || !(new Date(currentCart.expiresAt).getTime() > Date.now())) throw new Error("Active current-version cart is required");
    if ((currentCart.lines || []).length >= 249) throw new Error("Cart line bound reached");
    if (currentAuthority.organizationId !== currentCart.organization?.id || currentAuthority.premisesId !== currentCart.premises?.id || !currentCart.customer) throw new Error("Cart is outside current staff authority");
    await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "cannabis-customer-purchase-window", `${currentAuthority.organizationId}:${currentAuthority.premisesId}:${currentCart.customer.id}`);
    const pack = await requireRulePack(tx, currentCart.organization.id, currentCart.premises.id);
    assertEffectiveRulePack(pack);
    if (currentCart.rulePack?.id !== pack.id) throw new Error("Cart rule pack is stale");
    const candidates = await sudo.query.InventoryPackage.findMany({ where: { organization: { id: { equals: currentAuthority.organizationId } }, premises: { id: { equals: currentAuthority.premisesId } }, product: { id: { equals: input.productId } }, status: { equals: "saleable" } }, orderBy: [{ expiresAt: "asc" }, { id: "asc" }], take: 51, query: ALLOCATION_PACKAGE_SELECTION });
    const packageId = choosePackageForProduct(candidates, currentAuthority, input.productId, quantity);
    await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "cannabis-package", packageId);
    const pkg = await sudo.query.InventoryPackage.findOne({ where: { id: packageId }, query: ALLOCATION_PACKAGE_SELECTION });
    if (!pkg || pkg.organization?.id !== currentCart.organization.id || pkg.premises?.id !== currentCart.premises.id || !pkg.product || pkg.product.status !== "active") throw new Error("Package is outside cart authority");
    assertPackageSaleable({ status: pkg.status, testStatus: pkg.testStatus, expiresAt: pkg.expiresAt, premisesId: pkg.premises.id, quantityOnHandMicrounits: pkg.quantityOnHandMicrounits, reservedMicrounits: pkg.reservedMicrounits, activeHoldCount: pkg.holds?.length || 0, coaReference: pkg.coaReference, labelVersion: pkg.labelVersion }, currentCart.premises.id, quantity);
    if (pkg.product.id !== input.productId || pkg.product.organization?.id !== currentAuthority.organizationId || pkg.product.premises?.id !== currentAuthority.premisesId) throw new Error("Product is outside current allocation authority");
    const quote = calculateAllocationQuote(pkg, { id: currentCart.id, version: currentCart.version, customer: { capacity: currentCart.customer.capacity } }, pack, quantity, input.promotionCode, { organizationId: currentAuthority.organizationId, premisesId: currentAuthority.premisesId, actor: { id: currentAuthority.actor.id } });
    const quoteHash = stableHash(quote);
    if (input.reviewedQuoteHash !== quoteHash) throw new Error("Reviewed quote changed; retain the original command and review a separate new intent");
    const { subtotalCents, discountCents, discountSnapshot, taxCents, totalCents, equivalencyMicrounits } = quote;
    const balances = planReservationBalances(pkg.quantityOnHandMicrounits, pkg.reservedMicrounits, quantity);
    const ledger = await sudo.query.CartLine.findMany({
      where: { package: { id: { equals: pkg.id } }, cart: { status: { in: ["preliminarily_eligible", "reserved", "picking", "staged", "final_verification"] } } },
      take: 501,
      query: "id quantityMicrounits organization { id } premises { id } package { id } cart { id status organization { id } premises { id } }"
    });
    assertReservationLedger(ledger, pkg.id, pkg.reservedMicrounits, currentAuthority);
    const categoryTotals = /* @__PURE__ */ Object.create(null);
    if (!Array.isArray(currentCart.lines)) throw new Error("Complete cart limit evidence is required");
    for (const line2 of currentCart.lines) {
      if (!line2.categoryCodeSnapshot || !Number.isSafeInteger(line2.equivalencyMicrounits) || line2.equivalencyMicrounits < 1) throw new Error("Cart equivalency evidence is invalid");
      categoryTotals[line2.categoryCodeSnapshot] = (categoryTotals[line2.categoryCodeSnapshot] || 0) + line2.equivalencyMicrounits;
      if (!Number.isSafeInteger(categoryTotals[line2.categoryCodeSnapshot])) throw new Error("Cart equivalency total exceeds safe integer range");
    }
    categoryTotals[pkg.product.categoryCode] = (categoryTotals[pkg.product.categoryCode] || 0) + equivalencyMicrounits;
    if (pack.purchaseLimits.some((rule) => rule.capacity === currentCart.customer.capacity && rule.window !== "transaction")) throw new Error("Configured prior-window consumption and pending-allocation evidence contract is required; no empty history is assumed");
    evaluatePurchaseLimits({ capacity: currentCart.customer.capacity, categoryTotals, priorWindowTotals: /* @__PURE__ */ Object.create(null) }, pack);
    const claimed = await tx.prisma.inventoryPackage.updateMany({ where: { id: pkg.id, organizationId: currentAuthority.organizationId, premisesId: currentAuthority.premisesId, status: "saleable", quantityOnHandMicrounits: balances.beforeQuantityMicrounits, version: pkg.version, reservedMicrounits: balances.beforeReservedMicrounits }, data: { reservedMicrounits: balances.afterReservedMicrounits, version: { increment: 1 } } });
    if (claimed.count !== 1) throw new Error("Package reservation changed concurrently");
    const line = await sudo.query.CartLine.createOne({ data: { organization: { connect: { id: currentCart.organization.id } }, premises: { connect: { id: currentCart.premises.id } }, cart: { connect: { id: currentCart.id } }, idempotencyKey: operationKey, package: { connect: { id: pkg.id } }, product: { connect: { id: pkg.product.id } }, quantityMicrounits: quantity, equivalencyMicrounits, titleSnapshot: pkg.product.name, skuSnapshot: pkg.product.sku, categoryCodeSnapshot: pkg.product.categoryCode, packageUidSnapshot: pkg.packageUid, batchSnapshot: pkg.productionBatchNumber, potencySnapshot: pkg.potencySnapshot, unitPriceCents: pkg.product.priceCents, subtotalCents, discountCents, discountSnapshot, taxBasisPoints: quote.taxBasisPoints, taxCents, totalCents }, query: "id totalCents" });
    await sudo.query.InventoryEvent.createOne({ data: {
      organization: { connect: { id: currentAuthority.organizationId } },
      premises: { connect: { id: currentAuthority.premisesId } },
      package: { connect: { id: pkg.id } },
      eventType: "reserve",
      quantityDeltaMicrounits: 0,
      beforeQuantityMicrounits: balances.beforeQuantityMicrounits,
      afterQuantityMicrounits: balances.afterQuantityMicrounits,
      reasonCode: "cart_reservation",
      actor: { connect: { id: currentAuthority.actor.id } },
      sourceType: "CartLine",
      sourceId: line.id,
      idempotencyKey: `${operationKey}:reserve`,
      occurredAt: /* @__PURE__ */ new Date(),
      evidenceHash: stableHash({ quote, balances, cartLineId: line.id, correlationId }),
      stateReportStatus: "local_recorded"
    }, query: "id" });
    const totals = await sudo.query.CartLine.findMany({ where: { cart: { id: { equals: currentCart.id } } }, take: 250, query: "subtotalCents discountCents taxCents totalCents" });
    if (totals.length >= 250) throw new Error("Cart line bound reached");
    const sum = (field) => totals.reduce((total, entry) => {
      if (!Number.isSafeInteger(entry[field]) || entry[field] < 0 || !Number.isSafeInteger(total + entry[field]) || total + entry[field] > 2147483647) throw new Error("Cart monetary evidence exceeds integer storage range");
      return total + entry[field];
    }, 0);
    const cartUpdated = await tx.prisma.cart.updateMany({ where: { id: currentCart.id, organizationId: currentAuthority.organizationId, premisesId: currentAuthority.premisesId, version: currentCart.version, status: currentCart.status }, data: { status: "reserved", subtotalCents: sum("subtotalCents"), discountCents: sum("discountCents"), taxCents: sum("taxCents"), totalCents: sum("totalCents"), version: { increment: 1 } } });
    if (cartUpdated.count !== 1) throw new Error("Cart state changed concurrently");
    return { id: line.id, status: "reserved", cartId: currentCart.id, version: currentCart.version + 1, totalCents: line.totalCents, quote, quoteHash, balances };
  });
}
async function cancelCannabisCart(_root, args, context) {
  requireRuntimeCapability("commerce.reservation-ledger", "Cart cancellation is disabled until PostgreSQL concurrency, rollback, and replay behavior are verified.");
  const input = args.input;
  const cancellationKey = assertText(input.idempotencyKey, "Idempotency key", 8, 200);
  const cancellationReason = assertText(input.reasonCode || "cart_cancelled", "Cancellation reason");
  const cart = await context.sudo().query.Cart.findOne({
    where: { id: assertText(input.cartId, "Cart ID") },
    query: "id reference status guestProofHash organization { id } premises { id }"
  });
  if (!cart) throw new Error("Cart is not found");
  let actor = null;
  const staff = Boolean(context.session?.data?.role?.canManageSales);
  if (staff) {
    const authority = await requireOperationalAuthority(context, "canManageSales", "sale");
    if (authority.organizationId !== cart.organization.id || authority.premisesId !== cart.premises.id) throw new Error("Cart is outside current staff authority");
    actor = authority.actor;
  } else if (!input.proof || cart.guestProofHash !== hash(input.proof)) {
    throw new Error("Cart ownership proof is invalid");
  }
  if (cart.status === "cancelled") return { id: cart.id, status: "cancelled", reference: cart.reference, replayed: true };
  return serializableTransaction(context, async (tx) => {
    await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "cannabis-cart", cart.id);
    const sudo = tx.sudo();
    const currentCart = await sudo.query.Cart.findOne({
      where: { id: cart.id },
      query: "id reference status guestProofHash version organization { id } premises { id } lines(take: 251) { id quantityMicrounits package { id } }"
    });
    if (!currentCart) throw new Error("Cart is not found");
    if (currentCart.organization?.id !== cart.organization.id || currentCart.premises?.id !== cart.premises.id) throw new Error("Cart authority scope changed concurrently");
    if (staff) {
      if (actor?.organization?.id !== currentCart.organization.id || actor?.premises?.id !== currentCart.premises.id) throw new Error("Cart is outside current staff authority");
    } else if (!input.proof || currentCart.guestProofHash !== hash(input.proof)) {
      throw new Error("Cart ownership proof is invalid");
    }
    const plan = planCartCancellation({ id: currentCart.id, status: currentCart.status, version: currentCart.version, lines: currentCart.lines });
    if (plan.disposition === "replay") return { id: currentCart.id, status: "cancelled", reference: currentCart.reference, replayed: true };
    for (const release of plan.releases) {
      await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "cannabis-package", release.packageId);
    }
    const packageSnapshots = /* @__PURE__ */ new Map();
    for (const release of plan.releases) {
      const pkg = await sudo.query.InventoryPackage.findOne({
        where: { id: release.packageId },
        query: "id version quantityOnHandMicrounits reservedMicrounits organization { id } premises { id }"
      });
      if (!pkg || pkg.organization?.id !== currentCart.organization.id || pkg.premises?.id !== currentCart.premises.id) throw new Error("Package is outside cart authority");
      assertReservationCanBeReleased(pkg.reservedMicrounits, release.quantityMicrounits);
      packageSnapshots.set(release.packageId, pkg);
    }
    for (const release of plan.releases) {
      const pkg = packageSnapshots.get(release.packageId);
      const released = await tx.prisma.inventoryPackage.updateMany({
        where: {
          id: release.packageId,
          version: pkg.version,
          quantityOnHandMicrounits: pkg.quantityOnHandMicrounits,
          reservedMicrounits: { equals: pkg.reservedMicrounits, gte: release.quantityMicrounits }
        },
        data: { reservedMicrounits: { decrement: release.quantityMicrounits }, version: { increment: 1 } }
      });
      if (released.count !== 1) throw new Error("Concurrent reservation release detected");
    }
    const cartFence = await sudo.query.Cart.findOne({ where: { id: currentCart.id }, query: "id status version" });
    if (!cartFence) throw new Error("Cart is not found");
    assertCartCancellationFence(plan, { id: cartFence.id, status: cartFence.status, version: cartFence.version });
    const transitioned = await tx.prisma.cart.updateMany({
      where: { id: plan.cartId, version: plan.expectedVersion, status: plan.expectedStatus },
      data: { status: "cancelled", version: { increment: 1 } }
    });
    if (transitioned.count !== 1) throw new Error("Cart state changed concurrently");
    const occurredAt = /* @__PURE__ */ new Date();
    for (const release of plan.releases) {
      const pkg = packageSnapshots.get(release.packageId);
      const reservedAfter = assertReservationCanBeReleased(pkg.reservedMicrounits, release.quantityMicrounits);
      await sudo.query.InventoryEvent.createOne({
        data: {
          organization: { connect: { id: currentCart.organization.id } },
          premises: { connect: { id: currentCart.premises.id } },
          package: { connect: { id: release.packageId } },
          eventType: "release_reservation",
          quantityDeltaMicrounits: 0,
          beforeQuantityMicrounits: pkg.quantityOnHandMicrounits,
          afterQuantityMicrounits: pkg.quantityOnHandMicrounits,
          reasonCode: cancellationReason,
          ...actor ? { actor: { connect: { id: actor.id } } } : {},
          sourceType: "Cart",
          sourceId: currentCart.id,
          idempotencyKey: `cancel:${currentCart.id}:${release.packageId}:${hash(cancellationKey)}`,
          occurredAt,
          evidenceHash: stableHash({ cartId: currentCart.id, packageId: release.packageId, lineIds: release.lineIds, reservedBefore: pkg.reservedMicrounits, releasedMicrounits: release.quantityMicrounits, reservedAfter, cancellationKey }),
          stateReportStatus: "local_recorded"
        },
        query: "id"
      });
    }
    await sudo.query.AuditEvent.createOne({
      data: {
        organization: { connect: { id: currentCart.organization.id } },
        premises: { connect: { id: currentCart.premises.id } },
        ...actor ? { actor: { connect: { id: actor.id } } } : {},
        action: "cart.cancelled",
        resourceType: "Cart",
        resourceId: currentCart.id,
        correlationId: cancellationKey,
        reasonCode: cancellationReason,
        evidence: { releasedLines: plan.releasedLines, releasedPackages: plan.releases.length, releasedMicrounits: plan.totalReleasedMicrounits },
        evidenceHash: stableHash({ cartId: currentCart.id, status: "cancelled", cancellationKey, releases: plan.releases }),
        occurredAt
      },
      query: "id"
    });
    return { id: currentCart.id, status: "cancelled", reference: currentCart.reference };
  }, 2e4);
}
async function finalizeCannabisSale(_root, args, context) {
  requireRuntimeCapability("commerce.sale-finalization", "Sale finalization remains disabled pending PostgreSQL conservation/race proof, current eligibility verification, authenticated provider acceptance, and supported tender execution.");
  requireRuntimeCapability("provider.traceability-acceptance", "Traceability acceptance is disabled until an authenticated provider acknowledgment is verified and linked to this premises.");
  const input = args.input;
  const cartId = assertText(input.cartId, "Cart ID");
  return runControlledOperation(context, input, { permission: "canManageSales", activity: "sale", scope: "finalizeCannabisSale", resourceType: "Sale", action: "sale.finalized", lockKeys: [cartId] }, async (tx, authority, correlationId) => {
    await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "cannabis-cart", cartId);
    const sudo = tx.sudo();
    const now = /* @__PURE__ */ new Date();
    const pack = await requireRulePack(tx, authority.organizationId, authority.premisesId);
    assertEffectiveRulePack(pack, now);
    assertOperatingWindow(pack, localMinute(now, authority.actor.premises.timezone));
    if (pack.offlineSalesAllowed !== false) throw new Error("Bounded launch requires offline regulated sales to remain disabled");
    const traceability = await sudo.query.IntegrationInstallation.findMany({ where: { organization: { id: { equals: authority.organizationId } }, premises: { id: { equals: authority.premisesId } }, providerType: { equals: "traceability" }, status: { equals: "active" } }, take: 2, query: "id providerCode validatedAt authorityReference" });
    if (traceability.length !== 1 || !traceability[0].validatedAt) throw new Error("Exactly one externally validated active traceability installation is required before sale");
    const cart = await sudo.query.Cart.findOne({ where: { id: cartId }, query: "id reference status expiresAt totalCents subtotalCents discountCents taxCents version organization { id } premises { id } shift { id status operator { id } } customer { id capacity status } eligibilityEvidence { id result capacity dateOfBirth identityExpiresAt registryExpiresAt evidenceHash allotmentRemainingMicrounits } rulePack { id version } lines(take: 251) { id package { id version status testStatus expiresAt unitOfMeasure premises { id } quantityOnHandMicrounits reservedMicrounits coaReference labelVersion holds(where: { status: { equals: active } }, take: 1) { id } } product { id categoryCode } titleSnapshot skuSnapshot categoryCodeSnapshot packageUidSnapshot batchSnapshot potencySnapshot quantityMicrounits equivalencyMicrounits unitPriceCents discountCents discountSnapshot taxCents totalCents }" });
    if (!cart || cart.organization?.id !== authority.organizationId || cart.premises?.id !== authority.premisesId || cart.status !== "reserved" || new Date(cart.expiresAt) <= now || cart.rulePack?.id !== pack.id) throw new Error("Reserved cart is stale or outside current authority");
    if (!cart.shift || cart.shift.status !== "open" || cart.shift.operator?.id !== authority.actor.id) throw new Error("Actor must own the cart's open register shift");
    const evidence = cart.eligibilityEvidence;
    if (!evidence || evidence.result !== "eligible" || evidence.capacity !== cart.customer.capacity || new Date(evidence.identityExpiresAt) <= now) throw new Error("Current eligibility evidence is required at final verification");
    assertEligibility({ capacity: cart.customer.capacity, age: ageAt(evidence.dateOfBirth, now), identityValid: true, registryValid: cart.customer.capacity === "adult_use" || Boolean(evidence.registryExpiresAt && new Date(evidence.registryExpiresAt) > now), representedPatientValid: cart.customer.capacity !== "caregiver" || Boolean(input.representedPatientVerified) }, pack);
    const salePackageGroups = groupSaleLinesByPackage(cart.lines);
    const categoryTotals = {};
    for (const line of cart.lines) categoryTotals[line.categoryCodeSnapshot] = (categoryTotals[line.categoryCodeSnapshot] || 0) + line.equivalencyMicrounits;
    const priorSales = await sudo.query.Sale.findMany({ where: { customer: { id: { equals: cart.customer.id } }, finalizedAt: { gte: new Date(now.getTime() - 366 * 864e5) }, status: { in: ["finalized", "state_queued", "state_accepted", "state_rejected", "reconciled", "partially_refunded"] } }, orderBy: [{ finalizedAt: "desc" }], take: 1001, query: "finalizedAt lines { categoryCodeSnapshot equivalencyMicrounits }" });
    if (priorSales.length > 1e3) throw new Error("Purchase history exceeds bounded automatic evaluation and requires compliance review");
    const priorWindowTotals = {};
    for (const rule of pack.purchaseLimits) {
      const windowMs = rule.window === "day" ? 864e5 : rule.window === "rolling" ? assertInteger(rule.windowDays, "Rolling limit days", 1, 366) * 864e5 : rule.window === "allotment" ? 366 * 864e5 : 0;
      if (!windowMs) continue;
      priorWindowTotals[purchaseLimitKey(rule)] = priorSales.filter((sale2) => now.getTime() - new Date(sale2.finalizedAt).getTime() < windowMs).flatMap((sale2) => sale2.lines || []).filter((line) => line.categoryCodeSnapshot === rule.categoryCode).reduce((sum, line) => sum + line.equivalencyMicrounits, 0);
    }
    const limitDecision = evaluatePurchaseLimits({ capacity: cart.customer.capacity, categoryTotals, priorWindowTotals }, pack);
    if (cart.customer.capacity !== "adult_use" && evidence.allotmentRemainingMicrounits != null && Object.values(categoryTotals).reduce((a, b) => a + b, 0) > evidence.allotmentRemainingMicrounits) throw new Error("Patient or caregiver allotment is insufficient");
    const tenders = input.tenders;
    if (!Array.isArray(tenders) || tenders.length < 1 || tenders.length > 10) throw new Error("Sale requires 1-10 tenders");
    let tenderTotal = 0;
    const tenderConfigs = [];
    for (const tender of tenders) {
      const amount = assertInteger(tender.amountCents, "Tender amount", 0);
      assertTenderAllowed(tender.type, amount, cart.totalCents, pack.allowedTenderTypes);
      tenderTotal += amount;
      if (tender.type !== "cash") requireRuntimeCapability("provider.payment-capture", "Electronic tenders are disabled until a trusted payment adapter confirms capture and settlement.");
      const tenderedCents = assertInteger(tender.tenderedCents ?? amount, "Tendered cents", amount);
      const changeCents = assertInteger(tender.changeCents ?? 0, "Change cents", 0);
      if (tender.type === "cash" && tenderedCents - changeCents !== amount) throw new Error("Cash tendered less change must equal the applied tender amount");
      if (tender.type !== "cash" && (tenderedCents !== amount || changeCents !== 0)) throw new Error("Non-cash tender must match its applied amount exactly");
      const configurations = await sudo.query.TenderConfiguration.findMany({ where: { organization: { id: { equals: authority.organizationId } }, premises: { id: { equals: authority.premisesId } }, type: { equals: tender.type }, enabled: { equals: true }, effectiveAt: { lte: now }, expiresAt: { gt: now } }, take: 2, query: "id code type providerCode" });
      if (configurations.length !== 1) throw new Error("Exactly one current tender configuration is required");
      tenderConfigs.push(configurations[0]);
    }
    if (tenderTotal !== cart.totalCents) throw new Error("Tender total must exactly equal sale total in integer cents");
    const salePackageSnapshots = /* @__PURE__ */ new Map();
    const saleLineBalances = /* @__PURE__ */ new Map();
    for (const group of salePackageGroups) {
      await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "cannabis-package", group.packageId);
    }
    for (const group of salePackageGroups) {
      const pkg = await sudo.query.InventoryPackage.findOne({
        where: { id: group.packageId },
        query: "id version status testStatus expiresAt unitOfMeasure quantityOnHandMicrounits reservedMicrounits coaReference labelVersion organization { id } premises { id } holds(where: { status: { equals: active } }, take: 1) { id }"
      });
      if (!pkg || pkg.organization?.id !== authority.organizationId || pkg.premises?.id !== authority.premisesId || pkg.premises?.id !== cart.premises?.id) throw new Error("Package is outside current sale authority");
      assertReservedPackageForSale({
        status: pkg.status,
        testStatus: pkg.testStatus,
        expiresAt: pkg.expiresAt,
        premisesId: pkg.premises.id,
        quantityOnHandMicrounits: pkg.quantityOnHandMicrounits,
        reservedMicrounits: pkg.reservedMicrounits,
        activeHoldCount: pkg.holds?.length || 0,
        coaReference: pkg.coaReference,
        labelVersion: pkg.labelVersion
      }, authority.premisesId, group.quantityMicrounits, now);
      salePackageSnapshots.set(group.packageId, pkg);
      for (const balance of planSaleLineBalances(cart.lines, group, pkg.quantityOnHandMicrounits)) {
        saleLineBalances.set(balance.lineIndex, { before: balance.before, after: balance.after });
      }
    }
    const receiptNumber = `SALE-${(0, import_node_crypto3.randomUUID)()}`;
    const receiptSnapshot = { receiptNumber, finalizedAt: now.toISOString(), licenseNumber: authority.license.licenseNumber, premisesId: authority.premisesId, customerCapacity: cart.customer.capacity, rulePackVersion: pack.version, lines: cart.lines.map((line) => ({ title: line.titleSnapshot, sku: line.skuSnapshot, packageUid: line.packageUidSnapshot, batch: line.batchSnapshot, quantityMicrounits: line.quantityMicrounits, unitPriceCents: line.unitPriceCents, discountCents: line.discountCents, discountSnapshot: line.discountSnapshot, taxCents: line.taxCents, totalCents: line.totalCents })), subtotalCents: cart.subtotalCents, discountCents: cart.discountCents, taxCents: cart.taxCents, totalCents: cart.totalCents, tenders: tenders.map((tender) => ({ type: tender.type, amountCents: tender.amountCents, changeCents: tender.changeCents ?? 0 })) };
    const labelSnapshot = { rulePackVersion: pack.version, requirements: pack.labelRequirements, lines: cart.lines.map((line) => {
      const pkg = salePackageSnapshots.get(line.package.id);
      return { packageUid: line.packageUidSnapshot, batch: line.batchSnapshot, potency: line.potencySnapshot, coaReference: pkg.coaReference, labelVersion: pkg.labelVersion };
    }) };
    const sale = await sudo.query.Sale.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, shift: { connect: { id: cart.shift.id } }, customer: { connect: { id: cart.customer.id } }, cart: { connect: { id: cart.id } }, receiptNumber, status: "state_queued", customerCapacitySnapshot: cart.customer.capacity, rulePackVersion: pack.version, eligibilityEvidenceHash: evidence.evidenceHash, purchaseLimitEvaluation: limitDecision, subtotalCents: cart.subtotalCents, discountCents: cart.discountCents, taxCents: cart.taxCents, totalCents: cart.totalCents, finalizedAt: now, receiptSnapshot, receiptHash: stableHash(receiptSnapshot), labelSnapshot, labelHash: stableHash(labelSnapshot) }, query: "id receiptNumber status" });
    for (const group of salePackageGroups) {
      const pkg = salePackageSnapshots.get(group.packageId);
      const consumed = await tx.prisma.inventoryPackage.updateMany({
        where: {
          id: group.packageId,
          version: pkg.version,
          quantityOnHandMicrounits: pkg.quantityOnHandMicrounits,
          reservedMicrounits: { equals: pkg.reservedMicrounits, gte: group.quantityMicrounits }
        },
        data: {
          quantityOnHandMicrounits: { decrement: group.quantityMicrounits },
          reservedMicrounits: { decrement: group.quantityMicrounits },
          version: { increment: 1 },
          ...pkg.quantityOnHandMicrounits === group.quantityMicrounits ? { status: "depleted" } : {}
        }
      });
      if (consumed.count !== 1) throw new Error("Concurrent exact-package sale detected");
    }
    for (const [index, line] of cart.lines.entries()) {
      const pkg = salePackageSnapshots.get(line.package.id);
      const balance = saleLineBalances.get(index);
      if (!balance) throw new Error("Sale line quantity conservation is incomplete");
      const saleLine = await sudo.query.SaleLine.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, sale: { connect: { id: sale.id } }, package: { connect: { id: line.package.id } }, titleSnapshot: line.titleSnapshot, skuSnapshot: line.skuSnapshot, categoryCodeSnapshot: line.categoryCodeSnapshot, packageUidSnapshot: line.packageUidSnapshot, batchSnapshot: line.batchSnapshot, coaReferenceSnapshot: pkg.coaReference, potencySnapshot: line.potencySnapshot, quantityMicrounits: line.quantityMicrounits, equivalencyMicrounits: line.equivalencyMicrounits, unitPriceCents: line.unitPriceCents, discountCents: line.discountCents, discountSnapshot: line.discountSnapshot, taxCents: line.taxCents, totalCents: line.totalCents }, query: "id" });
      await sudo.query.InventoryEvent.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, package: { connect: { id: line.package.id } }, eventType: "sale", quantityDeltaMicrounits: -line.quantityMicrounits, beforeQuantityMicrounits: balance.before, afterQuantityMicrounits: balance.after, reasonCode: "sale", actor: { connect: { id: authority.actor.id } }, sourceType: "SaleLine", sourceId: saleLine.id, idempotencyKey: `${correlationId}:line:${index}`, occurredAt: now, evidenceHash: stableHash({ saleId: sale.id, saleLineId: saleLine.id, packageId: line.package.id, before: balance.before, after: balance.after }), stateReportStatus: "queued" }, query: "id" });
    }
    for (const [index, tender] of tenders.entries()) await sudo.query.Tender.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, sale: { connect: { id: sale.id } }, configuration: { connect: { id: tenderConfigs[index].id } }, typeSnapshot: tender.type, amountCents: tender.amountCents, tenderedCents: tender.tenderedCents ?? tender.amountCents, changeCents: tender.changeCents ?? 0, status: "received", providerReference: null, idempotencyKey: `${correlationId}:tender:${index}`, evidenceHash: stableHash(tender) }, query: "id" });
    await sudo.query.CashEvent.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, shift: { connect: { id: cart.shift.id } }, type: "sale", amountCents: tenders.filter((t) => t.type === "cash").reduce((sum, tender) => sum + tender.amountCents, 0), reasonCode: "sale", actor: { connect: { id: authority.actor.id } }, occurredAt: now, idempotencyKey: `${correlationId}:cash`, evidenceHash: stableHash({ saleId: sale.id }) }, query: "id" });
    const cartFence = await sudo.query.Cart.findOne({ where: { id: cart.id }, query: "id status version" });
    if (!cartFence) throw new Error("Reserved cart is missing during finalization");
    assertFinalSaleCartFence({ id: cart.id, status: cart.status, version: cart.version }, { id: cartFence.id, status: cartFence.status, version: cartFence.version });
    const completed = await tx.prisma.cart.updateMany({ where: { id: cart.id, version: cart.version, status: "reserved" }, data: { status: "completed", version: { increment: 1 } } });
    if (completed.count !== 1) throw new Error("Reserved cart state changed concurrently");
    return { id: sale.id, status: sale.status, reference: sale.receiptNumber, totalCents: cart.totalCents, stateReport: { receiptNumber: sale.receiptNumber, finalizedAt: now.toISOString(), customerCapacity: cart.customer.capacity, rulePackVersion: pack.version, packages: cart.lines.map((line) => ({ packageUid: line.packageUidSnapshot, quantityMicrounits: line.quantityMicrounits, unitOfMeasure: salePackageSnapshots.get(line.package.id).unitOfMeasure })) } };
  });
}

// features/keystone/domain/reconciliationEvidence.ts
function isPlainRecord(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function isJsonValue(value, ancestors = /* @__PURE__ */ new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object") return false;
  if (!Array.isArray(value) && !isPlainRecord(value)) return false;
  if (ancestors.has(value)) return false;
  ancestors.add(value);
  const valid = Array.isArray(value) ? value.every((child) => isJsonValue(child, ancestors)) : Object.values(value).every((child) => isJsonValue(child, ancestors));
  ancestors.delete(value);
  return valid;
}
function validateReconciliationSubmission(discrepancies) {
  if (!Array.isArray(discrepancies)) throw new Error("Discrepancies must be supplied as an array");
  for (const [index, discrepancy] of discrepancies.entries()) {
    if (!isPlainRecord(discrepancy) || Object.keys(discrepancy).length === 0 || !isJsonValue(discrepancy)) {
      throw new Error(`Discrepancy claim ${index + 1} must be a non-empty JSON object`);
    }
  }
  return {
    discrepancies,
    discrepancyCount: discrepancies.length,
    status: "pending"
  };
}

// features/keystone/domain/providerEventScope.ts
function assertProviderEventScopeMatch(existing, current) {
  if (!existing.providerCode || !existing.organizationId || !existing.premisesId || existing.providerCode !== current.providerCode || existing.organizationId !== current.organizationId || existing.premisesId !== current.premisesId) {
    throw new Error("Provider event ID conflicts with another provider authority scope");
  }
}

// features/keystone/domain/operatorReadBounds.ts
var OPERATOR_WORKSPACE_PAGE_SIZE = 50;
var MAX_SHIFT_CASH_EVENTS = 500;
var CASH_EVENT_TYPES = /* @__PURE__ */ new Set([
  "opening_float",
  "sale",
  "refund",
  "paid_in",
  "paid_out",
  "safe_drop",
  "count",
  "deposit"
]);
function isRecord3(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function splitOperatorWorkspacePage(rows) {
  if (!Array.isArray(rows) || rows.length > OPERATOR_WORKSPACE_PAGE_SIZE + 1) return void 0;
  return {
    items: rows.slice(0, OPERATOR_WORKSPACE_PAGE_SIZE),
    hasMore: rows.length > OPERATOR_WORKSPACE_PAGE_SIZE
  };
}
function isCompleteShiftCashEventRead(value) {
  if (!Array.isArray(value) || value.length >= MAX_SHIFT_CASH_EVENTS) return false;
  for (let index = 0; index < value.length; index += 1) {
    const event = value[index];
    if (!Object.hasOwn(value, index) || !isRecord3(event) || typeof event.type !== "string" || !CASH_EVENT_TYPES.has(event.type) || !Number.isSafeInteger(event.amountCents)) return false;
  }
  return true;
}

// features/keystone/domain/refundAllocation.ts
var MAX_REFUND_ALLOCATION_EVIDENCE_ROWS = 500;
var MAX_MONEY_CENTS = 2147483647;
var REFUND_STATUSES = /* @__PURE__ */ new Set(["pending", "completed", "failed", "reconciled"]);
var TENDER_STATUSES = /* @__PURE__ */ new Set(["received", "authorized", "captured", "reversed", "failed"]);
function isRecord4(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function isText(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 500 && value.trim() === value;
}
function isMoney(value, minimum) {
  return Number.isSafeInteger(value) && value >= minimum && value <= MAX_MONEY_CENTS;
}
function getRefundEvidenceTenderIds(refunds, originalTenderId) {
  if (!Array.isArray(refunds) || refunds.length > MAX_REFUND_ALLOCATION_EVIDENCE_ROWS || !isText(originalTenderId)) return void 0;
  const ids = /* @__PURE__ */ new Set([originalTenderId]);
  for (const refund of refunds) {
    if (!isRecord4(refund) || !isText(refund.originalTenderReference)) return void 0;
    ids.add(refund.originalTenderReference);
  }
  return [...ids];
}
function evaluateRefundAllocationEvidence(input) {
  const { saleId, organizationId: organizationId2, premisesId: premisesId2, originalTenderId, requestedAmountCents, saleRefundedCents, refunds, tenders } = input;
  if (!isText(saleId) || !isText(organizationId2) || !isText(premisesId2) || !isText(originalTenderId) || !isMoney(requestedAmountCents, 1) || !isMoney(saleRefundedCents, 0) || !Array.isArray(refunds) || refunds.length > MAX_REFUND_ALLOCATION_EVIDENCE_ROWS || !Array.isArray(tenders) || tenders.length > MAX_REFUND_ALLOCATION_EVIDENCE_ROWS + 1) {
    return { ok: false, reason: "incomplete" };
  }
  const expectedTenderIds = /* @__PURE__ */ new Set([originalTenderId]);
  const refundIds = /* @__PURE__ */ new Set();
  let totalRefundedCents = 0;
  let allocatedToOriginalTenderCents = 0;
  for (const refund of refunds) {
    if (!isRecord4(refund) || !isText(refund.id) || refundIds.has(refund.id) || !isMoney(refund.amountCents, 1) || !REFUND_STATUSES.has(String(refund.status)) || !isText(refund.originalTenderReference) || !isRecord4(refund.sale) || refund.sale.id !== saleId || !isRecord4(refund.organization) || refund.organization.id !== organizationId2 || !isRecord4(refund.premises) || refund.premises.id !== premisesId2) {
      return { ok: false, reason: "incomplete" };
    }
    refundIds.add(refund.id);
    expectedTenderIds.add(refund.originalTenderReference);
    totalRefundedCents += refund.amountCents;
    if (!Number.isSafeInteger(totalRefundedCents) || totalRefundedCents > MAX_MONEY_CENTS) return { ok: false, reason: "incomplete" };
    if (refund.originalTenderReference === originalTenderId) {
      allocatedToOriginalTenderCents += refund.amountCents;
      if (!Number.isSafeInteger(allocatedToOriginalTenderCents) || allocatedToOriginalTenderCents > MAX_MONEY_CENTS) return { ok: false, reason: "incomplete" };
    }
  }
  if (totalRefundedCents !== saleRefundedCents) return { ok: false, reason: "incomplete" };
  const tenderById = /* @__PURE__ */ new Map();
  for (const tender of tenders) {
    if (!isRecord4(tender) || !isText(tender.id) || tenderById.has(tender.id) || !isMoney(tender.amountCents, 0) || !isText(tender.typeSnapshot) || !TENDER_STATUSES.has(String(tender.status)) || !isRecord4(tender.sale) || tender.sale.id !== saleId || !isRecord4(tender.organization) || tender.organization.id !== organizationId2 || !isRecord4(tender.premises) || tender.premises.id !== premisesId2) {
      return { ok: false, reason: "incomplete" };
    }
    tenderById.set(tender.id, {
      id: tender.id,
      amountCents: tender.amountCents,
      typeSnapshot: tender.typeSnapshot,
      status: String(tender.status)
    });
  }
  if (tenderById.size !== expectedTenderIds.size || [...expectedTenderIds].some((id) => !tenderById.has(id))) {
    return { ok: false, reason: "incomplete" };
  }
  const originalTender = tenderById.get(originalTenderId);
  if (!originalTender || originalTender.status === "reversed") return { ok: false, reason: "incomplete" };
  if (allocatedToOriginalTenderCents + requestedAmountCents > originalTender.amountCents) {
    return { ok: false, reason: "limit" };
  }
  return { ok: true, originalTender };
}

// features/keystone/mutations/operations.ts
async function configureCannabisProduct(_root, args, context) {
  const input = args.input;
  assertInteger(input.unitQuantityMicrounits, "Unit quantity", 1);
  assertInteger(input.equivalencyMicrounits, "Equivalency", 1);
  assertInteger(input.priceCents, "Price", 0);
  if (input.adultUseEligible !== true && input.medicalEligible !== true) throw new Error("Product must be explicitly eligible for at least one configured channel");
  return runControlledOperation(context, input, { permission: "canManageInventory", activity: "inventory", scope: "configureCannabisProduct", resourceType: "Product", action: "catalog.product.configured", emitStateEvent: false, lockKeys: [String(input.sku)] }, async (tx, authority) => {
    const sudo = tx.sudo();
    const existing = await sudo.query.Product.findOne({ where: { sku: assertText(input.sku, "SKU") }, query: "id" });
    if (existing) throw new Error("SKU already exists");
    const product = await sudo.query.Product.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, sku: input.sku, name: assertText(input.name, "Product name"), brand: input.brand || null, form: assertText(input.form, "Product form"), categoryCode: assertText(input.categoryCode, "Category code"), unitOfMeasure: assertText(input.unitOfMeasure, "Unit of measure"), unitQuantityMicrounits: input.unitQuantityMicrounits, equivalencyMicrounits: input.equivalencyMicrounits, priceCents: input.priceCents, taxCategoryCode: assertText(input.taxCategoryCode, "Tax category"), adultUseEligible: input.adultUseEligible === true, medicalEligible: input.medicalEligible === true, status: "active", publicDescription: input.publicDescription || null, publicImageUrl: input.publicImageUrl || null }, query: "id sku status" });
    return { id: product.id, status: product.status, reference: product.sku };
  });
}
async function configureRegister(_root, args, context) {
  const input = args.input;
  return runControlledOperation(context, input, { permission: "canManageFinance", activity: "cash", scope: "configureRegister", resourceType: "Register", action: "register.configured", emitStateEvent: false, lockKeys: [String(input.code)] }, async (tx, authority) => {
    const sudo = tx.sudo();
    const existing = await sudo.query.Register.findOne({ where: { code: assertText(input.code, "Register code") }, query: "id" });
    if (existing) throw new Error("Register code already exists");
    const register = await sudo.query.Register.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, code: input.code, name: assertText(input.name, "Register name"), status: "active" }, query: "id code status" });
    return { id: register.id, status: register.status, reference: register.code };
  });
}
async function openRegisterShift(_root, args, context) {
  const input = args.input;
  const opening = assertInteger(input.openingFloatCents, "Opening float", 0);
  return runControlledOperation(context, input, { permission: "canManageFinance", activity: "cash", scope: "openRegisterShift", resourceType: "RegisterShift", action: "cash.shift.opened", emitStateEvent: false, lockKeys: [String(input.registerId)] }, async (tx, authority, correlationId) => {
    const sudo = tx.sudo();
    const register = await sudo.query.Register.findOne({ where: { id: assertText(input.registerId, "Register ID") }, query: "id code status organization { id } premises { id }" });
    if (!register || register.status !== "active" || register.organization?.id !== authority.organizationId || register.premises?.id !== authority.premisesId) throw new Error("Active register is outside actor authority");
    const existing = await sudo.query.RegisterShift.findMany({ where: { register: { id: { equals: register.id } }, status: { in: ["open", "count_pending", "counted", "variance_review"] } }, take: 2, query: "id" });
    if (existing.length) throw new Error("Register already has an unresolved shift");
    const evidenceHash = stableHash({ opening, denominationEvidence: input.denominationEvidence });
    const shift = await sudo.query.RegisterShift.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, register: { connect: { id: register.id } }, operator: { connect: { id: authority.actor.id } }, status: "open", openingFloatCents: opening, expectedCashCents: opening, openedAt: /* @__PURE__ */ new Date(), evidenceHash }, query: "id status" });
    await sudo.query.CashEvent.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, shift: { connect: { id: shift.id } }, type: "opening_float", amountCents: opening, reasonCode: "opening_float", actor: { connect: { id: authority.actor.id } }, occurredAt: /* @__PURE__ */ new Date(), idempotencyKey: `${correlationId}:open`, evidenceHash }, query: "id" });
    return { id: shift.id, status: shift.status, reference: register.code };
  });
}
async function closeRegisterShift(_root, args, context) {
  requireRuntimeCapability("finance.action-bound-approval", "Shift close is disabled until an authenticated, action-bound second-party approval workflow is implemented.");
  const input = args.input;
  const actual = assertInteger(input.actualCashCents, "Actual cash", 0);
  if (!input.approvedById || input.approvedById === context.session?.itemId) throw new Error("Shift close requires an independent approver");
  return runControlledOperation(context, input, { permission: "canManageFinance", activity: "cash", scope: "closeRegisterShift", resourceType: "RegisterShift", action: "cash.shift.closed", emitStateEvent: false, lockKeys: [String(input.shiftId)] }, async (tx, authority, correlationId) => {
    const sudo = tx.sudo();
    const shift = await sudo.query.RegisterShift.findOne({ where: { id: assertText(input.shiftId, "Shift ID") }, query: "id status openingFloatCents organization { id } premises { id } operator { id } cashEvents(take: 500) { type amountCents }" });
    if (!shift || shift.status !== "open" || shift.organization?.id !== authority.organizationId || shift.premises?.id !== authority.premisesId || shift.operator?.id !== authority.actor.id) throw new Error("Actor does not own this open shift");
    if (!isCompleteShiftCashEventRead(shift.cashEvents)) throw new Error("Shift cash event read is incomplete; reconcile before close");
    const approver = await sudo.query.User.findOne({ where: { id: input.approvedById }, query: "id status organization { id } premises { id } role { canManageFinance }" });
    if (!approver || approver.status !== "active" || !approver.role?.canManageFinance || approver.organization?.id !== authority.organizationId || approver.premises?.id !== authority.premisesId) throw new Error("Approver lacks current finance authority");
    const expected = shift.cashEvents.reduce((sum, event) => sum + event.amountCents, 0);
    const variance = actual - expected;
    const evidenceHash = stableHash({ actual, expected, variance, denominationEvidence: input.denominationEvidence });
    await sudo.query.CashEvent.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, shift: { connect: { id: shift.id } }, type: "count", amountCents: actual, reasonCode: "blind_close_count", actor: { connect: { id: authority.actor.id } }, approvedBy: { connect: { id: approver.id } }, occurredAt: /* @__PURE__ */ new Date(), idempotencyKey: `${correlationId}:count`, evidenceHash }, query: "id" });
    const status5 = variance === 0 ? "closed" : "variance_review";
    await sudo.query.RegisterShift.updateOne({ where: { id: shift.id }, data: { status: status5, expectedCashCents: expected, actualCashCents: actual, varianceCents: variance, countedAt: /* @__PURE__ */ new Date(), ...status5 === "closed" ? { closedAt: /* @__PURE__ */ new Date(), approvedBy: { connect: { id: approver.id } } } : {} }, query: "id" });
    return { id: shift.id, status: status5, reference: String(variance), expectedCashCents: expected, actualCashCents: actual };
  });
}
async function approveCashVariance(_root, args, context) {
  const input = args.input;
  return runControlledOperation(context, input, { permission: "canManageFinance", activity: "cash", scope: "approveCashVariance", resourceType: "RegisterShift", action: "cash.variance.approved", emitStateEvent: false, lockKeys: [String(input.shiftId)] }, async (tx, authority) => {
    const sudo = tx.sudo();
    const shift = await sudo.query.RegisterShift.findOne({ where: { id: assertText(input.shiftId, "Shift ID") }, query: "id status varianceCents organization { id } premises { id } operator { id }" });
    if (!shift || shift.status !== "variance_review" || shift.organization?.id !== authority.organizationId || shift.premises?.id !== authority.premisesId || shift.operator?.id === authority.actor.id) throw new Error("An independent finance actor must approve this variance-review shift");
    const evidenceHash = stableHash({ varianceCents: shift.varianceCents, reason: input.reason, evidence: input.evidence });
    await sudo.query.CashEvent.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, shift: { connect: { id: shift.id } }, type: "count", amountCents: 0, reasonCode: assertText(input.reasonCode, "Variance reason code"), actor: { connect: { id: authority.actor.id } }, approvedBy: { connect: { id: authority.actor.id } }, occurredAt: /* @__PURE__ */ new Date(), idempotencyKey: `${input.idempotencyKey}:variance`, evidenceHash }, query: "id" });
    await sudo.query.RegisterShift.updateOne({ where: { id: shift.id }, data: { status: "closed", approvedBy: { connect: { id: authority.actor.id } }, closedAt: /* @__PURE__ */ new Date() }, query: "id" });
    return { id: shift.id, status: "closed", reference: String(shift.varianceCents) };
  });
}
async function refundCannabisSale(_root, args, context) {
  requireRuntimeCapability("finance.verified-refunds", "Refunds are disabled until trusted payment outcomes, cumulative tender allocations, return custody, and independent approvals are implemented.");
  const input = args.input;
  const amount = assertInteger(input.amountCents, "Refund amount", 1);
  if (!input.approvedById || input.approvedById === context.session?.itemId) throw new Error("Refund requires independent approval");
  return runControlledOperation(context, input, { permission: "canManageFinance", activity: "cash", scope: "refundCannabisSale", resourceType: "Refund", action: "sale.refunded", lockKeys: [String(input.saleId)] }, async (tx, authority, correlationId) => {
    const sudo = tx.sudo();
    const sale = await sudo.query.Sale.findOne({ where: { id: assertText(input.saleId, "Sale ID") }, query: "id receiptNumber status totalCents refundedCents organization { id } premises { id } shift { id status }" });
    if (!sale || sale.organization?.id !== authority.organizationId || sale.premises?.id !== authority.premisesId || ["reversed", "refunded"].includes(sale.status)) throw new Error("Sale cannot be refunded in this authority scope");
    if (sale.refundedCents + amount > sale.totalCents) throw new Error("Refund exceeds the immutable sale total");
    const approver = await sudo.query.User.findOne({ where: { id: input.approvedById }, query: "id status organization { id } premises { id } role { canManageFinance }" });
    if (!approver || approver.status !== "active" || !approver.role?.canManageFinance || approver.organization?.id !== authority.organizationId || approver.premises?.id !== authority.premisesId) throw new Error("Approver lacks current finance authority");
    if (!["none", "quarantine", "waste", "returned_to_authority"].includes(input.inventoryDisposition)) throw new Error("Explicit returned-product disposition is required");
    const originalTenderId = assertText(input.originalTenderId, "Original tender ID");
    const refundRows = await sudo.query.Refund.findMany({
      where: { sale: { id: { equals: sale.id } } },
      take: MAX_REFUND_ALLOCATION_EVIDENCE_ROWS + 1,
      query: "id amountCents status originalTenderReference sale { id } organization { id } premises { id }"
    });
    const tenderIds = getRefundEvidenceTenderIds(refundRows, originalTenderId);
    if (!tenderIds) throw new Error("Refund allocation evidence is incomplete or ambiguous");
    const tenderRows = await sudo.query.Tender.findMany({
      where: { id: { in: tenderIds } },
      take: MAX_REFUND_ALLOCATION_EVIDENCE_ROWS + 1,
      query: "id amountCents typeSnapshot status sale { id } organization { id } premises { id }"
    });
    const allocation = evaluateRefundAllocationEvidence({
      saleId: sale.id,
      organizationId: authority.organizationId,
      premisesId: authority.premisesId,
      originalTenderId,
      requestedAmountCents: amount,
      saleRefundedCents: sale.refundedCents,
      refunds: refundRows,
      tenders: tenderRows
    });
    if (!allocation.ok) throw new Error(allocation.reason === "limit" ? "Refund exceeds the remaining original tender allocation" : "Refund allocation evidence is incomplete or ambiguous");
    const originalTender = allocation.originalTender;
    const evidenceHash = stableHash(input.evidence || {});
    const refund = await sudo.query.Refund.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, sale: { connect: { id: sale.id } }, amountCents: amount, reasonCode: assertText(input.reasonCode, "Refund reason"), inventoryDisposition: input.inventoryDisposition, status: "completed", actor: { connect: { id: authority.actor.id } }, approvedBy: { connect: { id: approver.id } }, originalTenderReference: originalTender.id, providerReference: input.providerReference || null, occurredAt: /* @__PURE__ */ new Date(), evidenceHash }, query: "id status" });
    const refundedCents = sale.refundedCents + amount;
    const saleStatus = refundedCents === sale.totalCents ? "refunded" : "partially_refunded";
    await sudo.query.Sale.updateOne({ where: { id: sale.id }, data: { refundedCents, status: saleStatus }, query: "id" });
    if (originalTender.typeSnapshot === "cash") await sudo.query.CashEvent.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, shift: { connect: { id: sale.shift.id } }, type: "refund", amountCents: -amount, reasonCode: input.reasonCode, actor: { connect: { id: authority.actor.id } }, approvedBy: { connect: { id: approver.id } }, occurredAt: /* @__PURE__ */ new Date(), idempotencyKey: `${correlationId}:refund`, evidenceHash }, query: "id" });
    return { id: refund.id, status: refund.status, reference: sale.receiptNumber, saleStatus };
  });
}
async function recordComplianceIncident(_root, args, context) {
  const input = args.input;
  return runControlledOperation(context, input, { permission: "canManageCompliance", activity: "incident", scope: "recordComplianceIncident", resourceType: "ComplianceIncident", action: "incident.recorded", emitStateEvent: false }, async (tx, authority) => {
    if (!["refusal_of_sale", "identity", "patient_registry_outage", "traceability_outage", "payment_ambiguity", "inventory_discrepancy", "theft", "loss", "diversion", "recall", "privacy", "security", "system_outage", "offline_attempt"].includes(input.type)) throw new Error("Unsupported incident type");
    if (input.type === "offline_attempt" && input.outageMode !== "fail_closed") throw new Error("Offline regulated sale attempts must fail closed");
    const incident = await tx.sudo().query.ComplianceIncident.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, reference: `INC-${Date.now()}-${authority.actor.id.slice(-6)}`, type: input.type, severity: input.severity, status: "open", occurredAt: new Date(input.occurredAt || Date.now()), detectedAt: /* @__PURE__ */ new Date(), notificationDueAt: input.notificationDueAt ? new Date(input.notificationDueAt) : null, description: assertText(input.description, "Incident description", 4, 5e3), affectedPackageUids: input.affectedPackageUids || [], customerReferenceHash: input.customerReferenceHash || null, outageMode: input.outageMode || "none", recoveryQueueReference: input.recoveryQueueReference || null, authorityReference: input.authorityReference || null, actor: { connect: { id: authority.actor.id } }, owner: { connect: { id: authority.actor.id } }, evidenceHash: stableHash(input.evidence || {}) }, query: "id reference status" });
    return { id: incident.id, status: incident.status, reference: incident.reference };
  });
}
async function activateIntegrationInstallation(_root, args, context) {
  requireRuntimeCapability("provider.installation-verification", "Provider installation activation is disabled until a provider adapter verifies capabilities and authority directly.");
  const input = args.input;
  return runControlledOperation(context, input, { permission: "canManageIntegrations", activity: "state_reporting", scope: "activateIntegrationInstallation", resourceType: "IntegrationInstallation", action: "integration.validated", emitStateEvent: false, lockKeys: [String(input.installationId)] }, async (tx, authority) => {
    const sudo = tx.sudo();
    const installation = await sudo.query.IntegrationInstallation.findOne({ where: { id: assertText(input.installationId, "Installation ID") }, query: "id status providerType organization { id } premises { id }" });
    if (!installation || installation.organization?.id !== authority.organizationId || installation.premises?.id !== authority.premisesId || !["unconfigured", "pending_validation", "suspended"].includes(installation.status)) throw new Error("Integration installation is outside this authority scope");
    const credentialReference = assertText(input.credentialReference, "External secret-manager credential reference", 8, 500);
    const authorityReference = assertText(input.authorityReference, "Provider validation authority reference", 4, 500);
    if (input.externallyValidated !== true) throw new Error("External provider validation evidence is required; software cannot self-certify an integration");
    await sudo.query.IntegrationInstallation.updateOne({ where: { id: installation.id }, data: { status: "active", credentialReference, facilityReference: assertText(input.facilityReference, "Facility reference"), capabilities: input.capabilities || [], validatedAt: /* @__PURE__ */ new Date(), authorityReference }, query: "id" });
    return { id: installation.id, status: "active", reference: authorityReference };
  });
}
async function recordStateInboxEvent(_root, args, context) {
  requireRuntimeCapability("provider.authenticated-inbox", "Provider inbox records are disabled until signatures are verified by a trusted adapter.");
  const input = args.input;
  return runControlledOperation(context, input, { permission: "canManageIntegrations", activity: "state_reporting", scope: "recordStateInboxEvent", resourceType: "StateEventInbox", action: "state.inbox.recorded", emitStateEvent: false }, async (tx, authority) => {
    if (!input.signatureEvidence) throw new Error("Provider signature evidence is required for later adapter verification");
    const providerEventId = assertText(input.providerEventId, "Provider event ID");
    const providerCode = assertText(input.providerCode, "Provider code");
    const existing = await tx.sudo().query.StateEventInbox.findOne({ where: { providerEventId }, query: "id payloadHash status providerCode organization { id } premises { id }" });
    const payloadHash = stableHash(input.payload || {});
    if (existing) {
      assertProviderEventScopeMatch(
        { providerCode: existing.providerCode, organizationId: existing.organization?.id, premisesId: existing.premises?.id },
        { providerCode, organizationId: authority.organizationId, premisesId: authority.premisesId }
      );
      if (existing.payloadHash !== payloadHash) throw new Error("Provider event ID was replayed with different payload");
      return { id: existing.id, status: existing.status, reference: providerEventId };
    }
    const event = await tx.sudo().query.StateEventInbox.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, providerCode, providerEventId, payloadHash, signatureEvidence: input.signatureEvidence, status: "received", receivedAt: /* @__PURE__ */ new Date(), payload: input.payload || {} }, query: "id status" });
    return { id: event.id, status: event.status, reference: input.providerEventId };
  });
}
async function retryStateOutboxEvent(_root, args, context) {
  const input = args.input;
  return runControlledOperation(context, input, { permission: "canManageIntegrations", activity: "state_reporting", scope: "retryStateOutboxEvent", resourceType: "OutboxEvent", action: "state.outbox.requeued", emitStateEvent: false, lockKeys: [String(input.outboxEventId)] }, async (tx, authority) => {
    const event = await tx.sudo().query.OutboxEvent.findOne({ where: { id: assertText(input.outboxEventId, "Outbox event ID") }, query: "id status attempts organization { id } premises { id }" });
    if (!event || event.organization?.id !== authority.organizationId || event.premises?.id !== authority.premisesId || !["rejected", "retryable", "dead_letter"].includes(event.status)) throw new Error("Outbox event is not eligible for controlled retry");
    await tx.sudo().query.OutboxEvent.updateOne({ where: { id: event.id }, data: { status: "queued", attempts: event.attempts + 1, availableAt: /* @__PURE__ */ new Date(), lastErrorCode: null }, query: "id" });
    return { id: event.id, status: "queued", reference: String(event.attempts + 1) };
  });
}
async function approveReconciliationRun(_root, args, context) {
  requireRuntimeCapability("provider.computed-reconciliation", "Reconciliation approval is disabled until the comparison is computed from trusted source snapshots.");
  const input = args.input;
  return runControlledOperation(context, input, { permission: "canViewReports", activity: "state_reporting", scope: "approveReconciliationRun", resourceType: "ReconciliationRun", action: "reconciliation.approved", emitStateEvent: false, lockKeys: [String(input.runId)] }, async (tx, authority) => {
    const sudo = tx.sudo();
    const run = await sudo.query.ReconciliationRun.findOne({ where: { id: assertText(input.runId, "Reconciliation run ID") }, query: "id status discrepancyCount owner { id } organization { id } premises { id }" });
    if (!run || run.organization?.id !== authority.organizationId || run.premises?.id !== authority.premisesId || run.owner?.id === authority.actor.id || run.status !== "balanced" || run.discrepancyCount !== 0) throw new Error("Independent approval requires a balanced zero-discrepancy run");
    await sudo.query.ReconciliationRun.updateOne({ where: { id: run.id }, data: { status: "approved", approvedBy: { connect: { id: authority.actor.id } } }, query: "id" });
    return { id: run.id, status: "approved", reference: assertText(input.approvalReference, "Approval reference") };
  });
}
async function recordReconciliationRun(_root, args, context) {
  requireRuntimeCapability("provider.computed-reconciliation", "Reconciliation recording is disabled until local and external snapshots are computed and linked to evidence.");
  const input = args.input;
  return runControlledOperation(context, input, { permission: "canViewReports", activity: "state_reporting", scope: "recordReconciliationRun", resourceType: "ReconciliationRun", action: "reconciliation.recorded", emitStateEvent: false }, async (tx, authority) => {
    const submission = validateReconciliationSubmission(input.discrepancies);
    const run = await tx.sudo().query.ReconciliationRun.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, type: input.type, status: submission.status, startedAt: new Date(input.startedAt || Date.now()), completedAt: null, localSnapshotHash: assertText(input.localSnapshotHash, "Local snapshot hash", 16), externalSnapshotHash: input.externalSnapshotHash || null, discrepancyCount: submission.discrepancyCount, discrepancies: submission.discrepancies, owner: { connect: { id: authority.actor.id } }, evidenceHash: stableHash({ local: input.localSnapshotHash, external: input.externalSnapshotHash, discrepancies: submission.discrepancies }) }, query: "id status" });
    return { id: run.id, status: run.status, reference: String(submission.discrepancyCount) };
  });
}

// features/keystone/mutations/workspace.ts
var sectionAuthority = {
  overview: { permission: "canAccessDashboard", activity: "authority" },
  authority: { permission: "canManageAuthority", activity: "authority" },
  compliance: { permission: "canManageCompliance", activity: "eligibility" },
  inventory: { permission: "canManageInventory", activity: "inventory" },
  receiving: { permission: "canManageInventory", activity: "inventory" },
  menu: { permission: "canManageInventory", activity: "inventory" },
  pos: { permission: "canManageSales", activity: "sale" },
  cash: { permission: "canManageFinance", activity: "cash" },
  reconciliation: { permission: "canViewReports", activity: "state_reporting" },
  incidents: { permission: "canManageCompliance", activity: "incident" }
};
async function cannabisOperationsWorkspace(_root, args, context) {
  const section = String(args.section || "");
  const required = sectionAuthority[section];
  if (!required) throw new Error("Unsupported workspace section");
  const authority = await requireOperationalAuthority(context, required.permission, required.activity);
  const sudo = context.sudo();
  const scope = { organization: { id: { equals: authority.organizationId } }, premises: { id: { equals: authority.premisesId } } };
  const base = { section, authorityFingerprint: stableHash([authority.actor.id, authority.organizationId, authority.premisesId]), jurisdictionCode: authority.actor.organization.jurisdictionCode, premisesId: authority.premisesId, generatedAt: (/* @__PURE__ */ new Date()).toISOString() };
  if (section === "authority") return { ...base, licenses: await sudo.query.CannabisLicense.findMany({ where: scope, orderBy: [{ expiresAt: "asc" }], take: 50, query: "id licenseNumber licenseType status effectiveAt expiresAt regulatorName" }), credentials: await sudo.query.StaffCredential.findMany({ where: scope, orderBy: [{ expiresAt: "asc" }], take: 50, query: "id credentialType status effectiveAt expiresAt user { id name }" }) };
  if (section === "compliance") return { ...base, pendingCustomers: await sudo.query.Customer.findMany({ where: { ...scope, status: { equals: "pending_verification" } }, orderBy: [{ createdAt: "asc" }], take: 50, query: "id reference capacity status createdAt" }), holds: await sudo.query.PackageHold.findMany({ where: { ...scope, status: { equals: "active" } }, orderBy: [{ placedAt: "asc" }], take: 50, query: "id type reasonCode placedAt package { id packageUid }" }), recalls: await sudo.query.RecallCase.findMany({ where: scope, orderBy: [{ openedAt: "desc" }], take: 50, query: "id reference status reason openedAt" }) };
  if (section === "inventory" || section === "receiving") return {
    ...base,
    packages: await sudo.query.InventoryPackage.findMany({ where: scope, orderBy: [{ expiresAt: "asc" }], take: 50, query: "id packageUid sourcePackageUid productionBatchNumber lotNumber status testStatus quantityReceivedMicrounits quantityOnHandMicrounits reservedMicrounits unitOfMeasure expiresAt receivedAt coaReference labelVersion version product { id name sku } holds(where: { status: { equals: active } }, take: 10) { id type reasonCode reason status placedAt } events(orderBy: [{ occurredAt: desc }], take: 12) { id eventType quantityDeltaMicrounits beforeQuantityMicrounits afterQuantityMicrounits reasonCode occurredAt stateReportStatus manifest { manifestNumber status } actor { name } }" }),
    manifests: await sudo.query.RegulatedManifest.findMany({ where: scope, orderBy: [{ occurredAt: "desc" }], take: 50, query: "id manifestNumber type status sourceLicenseNumber destinationLicenseNumber transporterReference occurredAt reasonCode packageEvents(take: 20) { id eventType package { packageUid } }" }),
    products: await sudo.query.Product.findMany({ where: { ...scope, status: { equals: "active" } }, orderBy: [{ name: "asc" }], take: 100, query: "id name sku unitOfMeasure" })
  };
  if (section === "menu") return { ...base, products: await sudo.query.Product.findMany({ where: scope, orderBy: [{ name: "asc" }], take: 50, query: "id name sku form categoryCode priceCents status adultUseEligible medicalEligible packages(where: { status: { equals: saleable } }, take: 10) { id quantityOnHandMicrounits reservedMicrounits }" }) };
  if (section === "pos") {
    const rows = await sudo.query.Cart.findMany({ where: { ...scope, status: { in: ["preliminarily_eligible", "reserved", "picking", "staged", "final_verification"] } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: OPERATOR_WORKSPACE_PAGE_SIZE + 1, query: "id reference source status expiresAt totalCents customer { id reference capacity }" });
    const page = splitOperatorWorkspacePage(rows);
    if (!page) throw new Error("POS workspace read exceeded its bound");
    const productRows = await sudo.query.Product.findMany({ where: { ...scope, status: { equals: "active" } }, take: 51, orderBy: [{ name: "asc" }, { id: "asc" }], query: "id name sku unitQuantityMicrounits unitOfMeasure" });
    const productPage = splitOperatorWorkspacePage(productRows);
    if (!productPage) throw new Error("POS catalogue read exceeded its bound");
    return { ...base, carts: page.items, cartsHasMore: page.hasMore, products: productPage.items, productsHasMore: productPage.hasMore, sales: await sudo.query.Sale.findMany({ where: scope, orderBy: [{ finalizedAt: "desc" }], take: 25, query: "id receiptNumber status totalCents finalizedAt" }) };
  }
  if (section === "cash") {
    const rows = await sudo.query.RegisterShift.findMany({ where: scope, orderBy: [{ createdAt: "desc" }], take: OPERATOR_WORKSPACE_PAGE_SIZE + 1, query: "id status openingFloatCents expectedCashCents actualCashCents varianceCents openedAt closedAt register { id name code } operator { id name }" });
    const page = splitOperatorWorkspacePage(rows);
    if (!page) throw new Error("Cash workspace read exceeded its bound");
    return { ...base, shifts: page.items, shiftsHasMore: page.hasMore };
  }
  if (section === "reconciliation") {
    const runRows = await sudo.query.ReconciliationRun.findMany({ where: scope, orderBy: [{ startedAt: "desc" }], take: OPERATOR_WORKSPACE_PAGE_SIZE + 1, query: "id type status discrepancyCount startedAt completedAt" });
    const outboxRows = await sudo.query.OutboxEvent.findMany({ where: { ...scope, status: { in: ["queued", "rejected", "retryable", "dead_letter"] } }, orderBy: [{ availableAt: "asc" }], take: OPERATOR_WORKSPACE_PAGE_SIZE + 1, query: "id topic status attempts availableAt lastErrorCode" });
    const runPage = splitOperatorWorkspacePage(runRows);
    const outboxPage = splitOperatorWorkspacePage(outboxRows);
    if (!runPage || !outboxPage) throw new Error("Reconciliation workspace read exceeded its bound");
    return { ...base, runs: runPage.items, runsHasMore: runPage.hasMore, outbox: outboxPage.items, outboxHasMore: outboxPage.hasMore };
  }
  if (section === "incidents") return { ...base, incidents: await sudo.query.ComplianceIncident.findMany({ where: scope, orderBy: [{ detectedAt: "desc" }], take: 50, query: "id reference type severity status occurredAt detectedAt notificationDueAt" }) };
  return { ...base, activePackages: await sudo.query.InventoryPackage.findMany({ where: { ...scope, status: { equals: "saleable" } }, take: 25, query: "id packageUid expiresAt product { name }" }), openIncidents: await sudo.query.ComplianceIncident.findMany({ where: { ...scope, status: { in: ["open", "contained", "investigating", "reported"] } }, take: 25, query: "id reference type severity status detectedAt" }) };
}

// features/keystone/domain/cartFulfillment.ts
var MAX_INT2 = 2147483647;
var MAX_FULFILLMENT_LINES = 250;
var MAX_ALLOCATION_EVIDENCE_LINES = 500;
var PREPARATION_TRANSITIONS = {
  reserved: ["picking"],
  picking: ["staged", "reserved"],
  staged: ["picking"]
};
var ALLOCATED_CART_STATUSES = ["preliminarily_eligible", "reserved", "picking", "staged", "final_verification"];
function assertFulfillmentScope(value, scope) {
  const candidate = value;
  if (!candidate || typeof candidate !== "object" || candidate.organization?.id !== scope.organizationId || candidate.premises?.id !== scope.premisesId) {
    throw new Error("Cart preparation evidence is outside current authority");
  }
}
function planCartPreparation(cart, expectedVersion, nextStatus, scope, now = /* @__PURE__ */ new Date()) {
  assertFulfillmentScope(cart, scope);
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1 || cart.version !== expectedVersion || cart.version >= MAX_INT2) {
    throw new Error("Cart preparation version is stale or invalid");
  }
  const expiry = new Date(cart.expiresAt).getTime();
  if (!Number.isFinite(expiry) || expiry <= now.getTime()) throw new Error("Cart reservation expired");
  if (!Object.hasOwn(PREPARATION_TRANSITIONS, cart.status) || !PREPARATION_TRANSITIONS[cart.status].includes(nextStatus)) {
    throw new Error("Unsupported cart preparation transition");
  }
  if (!Array.isArray(cart.lines) || cart.lines.length < 1 || cart.lines.length > MAX_FULFILLMENT_LINES) {
    throw new Error("Cart preparation needs complete bounded reservation lines");
  }
  const ids = /* @__PURE__ */ new Set();
  const groups = /* @__PURE__ */ new Map();
  for (const line of cart.lines) {
    assertFulfillmentScope(line, scope);
    if (!line.id || ids.has(line.id) || line.cart?.id !== cart.id || !line.package?.id || !Number.isSafeInteger(line.quantityMicrounits) || line.quantityMicrounits < 1 || line.quantityMicrounits > MAX_INT2) {
      throw new Error("Cart preparation reservation line is invalid");
    }
    ids.add(line.id);
    const total = (groups.get(line.package.id) || 0) + line.quantityMicrounits;
    if (!Number.isSafeInteger(total) || total > MAX_INT2) throw new Error("Package allocation exceeds integer range");
    groups.set(line.package.id, total);
  }
  return [...groups].sort(([left], [right]) => left.localeCompare(right)).map(([packageId, quantityMicrounits]) => ({ packageId, quantityMicrounits }));
}
function assertPreparationAllocationCoverage(cart, ledger, packages, scope) {
  if (!Array.isArray(ledger) || ledger.length > MAX_ALLOCATION_EVIDENCE_LINES || !Array.isArray(packages) || packages.length > MAX_FULFILLMENT_LINES) {
    throw new Error("Allocation evidence is incomplete");
  }
  const expectedIds = new Set(cart.lines.map((line) => line.package.id));
  const packageIds = /* @__PURE__ */ new Set();
  for (const pkg of packages) {
    assertFulfillmentScope(pkg, scope);
    if (packageIds.has(pkg.id) || !expectedIds.has(pkg.id) || !Number.isSafeInteger(pkg.reservedMicrounits) || pkg.reservedMicrounits < 0 || pkg.reservedMicrounits > MAX_INT2) {
      throw new Error("Allocation package evidence is invalid");
    }
    packageIds.add(pkg.id);
  }
  if (packageIds.size !== expectedIds.size) throw new Error("Allocation package evidence is incomplete");
  const ids = /* @__PURE__ */ new Set();
  const totals = /* @__PURE__ */ new Map();
  const targetLines = new Map(cart.lines.map((line) => [line.id, line]));
  const covered = /* @__PURE__ */ new Set();
  for (const line of ledger) {
    assertFulfillmentScope(line, scope);
    assertFulfillmentScope(line.cart, scope);
    if (!line.id || ids.has(line.id) || !line.cart?.id || !ALLOCATED_CART_STATUSES.includes(line.cart.status) || !packageIds.has(line.package?.id) || !Number.isSafeInteger(line.quantityMicrounits) || line.quantityMicrounits < 1 || line.quantityMicrounits > MAX_INT2) {
      throw new Error("Allocation line evidence is invalid");
    }
    ids.add(line.id);
    const total = (totals.get(line.package.id) || 0) + line.quantityMicrounits;
    if (!Number.isSafeInteger(total) || total > MAX_INT2) throw new Error("Allocation ledger exceeds integer range");
    totals.set(line.package.id, total);
    const target = targetLines.get(line.id);
    if (target) {
      if (line.cart.id !== cart.id || line.cart.status !== cart.status || target.package.id !== line.package.id || target.quantityMicrounits !== line.quantityMicrounits) {
        throw new Error("Cart allocation evidence changed");
      }
      covered.add(line.id);
    } else if (line.cart.id === cart.id) throw new Error("Cart reservation read is incomplete");
  }
  if (covered.size !== targetLines.size || packages.some((pkg) => (totals.get(pkg.id) || 0) !== pkg.reservedMicrounits)) {
    throw new Error("Reservation counter does not match the complete allocation ledger");
  }
}

// features/keystone/mutations/fulfillment.ts
async function cannabisCartPreparation(_root, args, context) {
  const authority = await requireOperationalAuthority(context, "canManageSales", "sale");
  const cartId = assertText(args.cartId, "Cart ID");
  const readable = await context.query.Cart.findOne({ where: { id: cartId }, query: "id" });
  if (!readable || readable.id !== cartId) throw new Error("Cart detail is outside current access");
  const cart = await context.sudo().query.Cart.findOne({ where: { id: cartId }, query: `
    id reference source status version expiresAt totalCents organization { id } premises { id }
    lines(take: ${MAX_FULFILLMENT_LINES + 1}, orderBy: [{ createdAt: asc }, { id: asc }]) {
      id titleSnapshot packageUidSnapshot quantityMicrounits totalCents organization { id } premises { id } cart { id }
    }
  ` });
  assertFulfillmentScope(cart, authority);
  if (!Array.isArray(cart.lines)) throw new Error("Cart preparation detail is incomplete");
  for (const line of cart.lines) {
    assertFulfillmentScope(line, authority);
    if (line.cart?.id !== cart.id) throw new Error("Cart line is outside current detail authority");
  }
  const events = await context.sudo().query.AuditEvent.findMany({
    where: {
      organization: { id: { equals: authority.organizationId } },
      premises: { id: { equals: authority.premisesId } },
      resourceType: { equals: "Cart" },
      resourceId: { equals: cartId },
      action: { equals: "cart.preparation.transitioned" }
    },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: 21,
    query: "id occurredAt actor { name } evidence"
  });
  const allocationEvents = await context.sudo().query.AuditEvent.findMany({
    where: {
      organization: { id: { equals: authority.organizationId } },
      premises: { id: { equals: authority.premisesId } },
      resourceType: { equals: "CartLine" },
      resourceId: { in: cart.lines.slice(0, MAX_FULFILLMENT_LINES).map((line) => line.id) },
      action: { equals: "cart.line.reserved" }
    },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: 21,
    query: "id resourceId occurredAt evidence actor { name }"
  });
  const allocationHistory = allocationEvents.slice(0, 20).map((event) => {
    const fields = readAllocationReceipt(event.evidence, event.resourceId, cart.id);
    return {
      id: event.id,
      occurredAt: event.occurredAt,
      actorName: event.actor?.name || "Operator",
      resourceId: event.resourceId,
      evidenceState: fields ? "recorded_fields" : "unknown_legacy",
      ...fields
    };
  });
  return {
    id: cart.id,
    reference: cart.reference,
    status: cart.status,
    source: cart.source,
    version: cart.version,
    expiresAt: cart.expiresAt,
    totalCents: cart.totalCents,
    authorityFingerprint: stableHash([authority.actor.id, authority.organizationId, authority.premisesId]),
    lines: cart.lines.slice(0, MAX_FULFILLMENT_LINES).map((line) => ({ id: line.id, titleSnapshot: line.titleSnapshot, packageUidSnapshot: line.packageUidSnapshot, quantityMicrounits: line.quantityMicrounits, totalCents: line.totalCents })),
    linesHasMore: cart.lines.length > MAX_FULFILLMENT_LINES,
    historyHasMore: events.length > 20,
    allocationHistory,
    allocationHistoryHasMore: allocationEvents.length > 20,
    history: events.slice(0, 20).map((event) => ({
      id: event.id,
      occurredAt: event.occurredAt,
      actorName: event.actor?.name,
      beforeStatus: typeof event.evidence?.beforeStatus === "string" ? event.evidence.beforeStatus : null,
      status: typeof event.evidence?.status === "string" ? event.evidence.status : null,
      reasonCode: typeof event.evidence?.reasonCode === "string" ? event.evidence.reasonCode : null
    })),
    verification: "preparation_only_not_sale_or_handoff"
  };
}
async function transitionCannabisCartPreparation(_root, args, context) {
  const input = {
    cartId: assertText(args.input.cartId, "Cart ID"),
    expectedVersion: assertInteger(args.input.expectedVersion, "Cart version", 1, 2147483646),
    nextStatus: assertText(args.input.nextStatus, "Preparation status"),
    reasonCode: assertText(args.input.reasonCode, "Preparation reason", 3, 200),
    idempotencyKey: assertText(args.input.idempotencyKey, "Idempotency key", 8, 200)
  };
  const authority = await requireOperationalAuthority(context, "canManageSales", "sale");
  const visible = await context.query.Cart.findOne({ where: { id: input.cartId }, query: "id" });
  if (!visible || visible.id !== input.cartId) throw new Error("Cart is outside current access");
  const scope = await context.sudo().query.Cart.findOne({ where: { id: input.cartId }, query: "id organization { id } premises { id }" });
  assertFulfillmentScope(scope, authority);
  return runControlledOperation(context, input, {
    permission: "canManageSales",
    activity: "sale",
    scope: "transitionCannabisCartPreparation",
    resourceType: "Cart",
    action: "cart.preparation.transitioned",
    emitStateEvent: false,
    authorize: async (current, fresh) => {
      const allowed = await current.query.Cart.findOne({ where: { id: input.cartId }, query: "id" });
      if (!allowed || allowed.id !== input.cartId) throw new Error("Cart is outside current access");
      const resource = await current.sudo().query.Cart.findOne({ where: { id: input.cartId }, query: "id organization { id } premises { id }" });
      assertFulfillmentScope(resource, fresh);
    }
  }, async (tx, operationAuthority) => {
    await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "cannabis-cart", input.cartId);
    const currentAuthority = await requireOperationalAuthority(tx, "canManageSales", "sale");
    if (currentAuthority.organizationId !== operationAuthority.organizationId || currentAuthority.premisesId !== operationAuthority.premisesId) throw new Error("Operational authority changed");
    const sudo = tx.sudo();
    const now = /* @__PURE__ */ new Date();
    const cart = await sudo.query.Cart.findOne({ where: { id: input.cartId }, query: `
      id reference version status expiresAt organization { id } premises { id }
      customer { id status capacity organization { id } premises { id } }
      eligibilityEvidence { id result capacity identityExpiresAt registryExpiresAt customer { id } organization { id } premises { id } }
      lines(take: ${MAX_FULFILLMENT_LINES + 1}) { id quantityMicrounits cart { id } package { id } organization { id } premises { id } }
    ` });
    assertFulfillmentScope(cart, currentAuthority);
    const groups = planCartPreparation(cart, input.expectedVersion, input.nextStatus, currentAuthority, now);
    assertFulfillmentScope(cart.customer, currentAuthority);
    assertFulfillmentScope(cart.eligibilityEvidence, currentAuthority);
    const evidence = cart.eligibilityEvidence;
    if (cart.customer.status !== "eligible" || !["adult_use", "patient", "caregiver"].includes(cart.customer.capacity) || evidence.customer?.id !== cart.customer.id || evidence.capacity !== cart.customer.capacity || evidence.result !== "eligible" || !(new Date(evidence.identityExpiresAt).getTime() > now.getTime()) || cart.customer.capacity !== "adult_use" && !(new Date(evidence.registryExpiresAt).getTime() > now.getTime())) {
      throw new Error("Current customer evidence is required for cart preparation; this is not final eligibility verification");
    }
    for (const group of groups) {
      await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "cannabis-package", group.packageId);
    }
    const packages = await sudo.query.InventoryPackage.findMany({
      where: { id: { in: groups.map((group) => group.packageId) } },
      take: MAX_FULFILLMENT_LINES + 1,
      query: "id version status testStatus expiresAt quantityOnHandMicrounits reservedMicrounits coaReference labelVersion organization { id } premises { id } holds(where: { status: { equals: active } }, take: 1) { id }"
    });
    const ledger = await sudo.query.CartLine.findMany({
      where: { package: { id: { in: groups.map((group) => group.packageId) } }, cart: { status: { notIn: ["completed", "cancelled"] } } },
      take: MAX_ALLOCATION_EVIDENCE_LINES + 1,
      query: "id quantityMicrounits package { id } cart { id status organization { id } premises { id } } organization { id } premises { id }"
    });
    assertPreparationAllocationCoverage(cart, ledger, packages, currentAuthority);
    for (const pkg of packages) {
      const group = groups.find((group2) => group2.packageId === pkg.id);
      if (!Array.isArray(pkg.holds)) throw new Error("Package hold evidence is incomplete");
      assertReservedPackageForSale({
        status: pkg.status,
        testStatus: pkg.testStatus,
        expiresAt: pkg.expiresAt,
        quantityOnHandMicrounits: pkg.quantityOnHandMicrounits,
        reservedMicrounits: pkg.reservedMicrounits,
        coaReference: pkg.coaReference,
        labelVersion: pkg.labelVersion,
        premisesId: pkg.premises.id,
        activeHoldCount: pkg.holds.length
      }, currentAuthority.premisesId, group.quantityMicrounits, now);
    }
    const changed = await tx.prisma.cart.updateMany({
      where: {
        id: cart.id,
        version: input.expectedVersion,
        status: cart.status,
        organizationId: currentAuthority.organizationId,
        premisesId: currentAuthority.premisesId
      },
      data: { status: input.nextStatus, version: { increment: 1 } }
    });
    if (changed.count !== 1) throw new Error("Cart preparation changed concurrently; refresh before retrying");
    return {
      id: cart.id,
      reference: cart.reference,
      status: input.nextStatus,
      version: input.expectedVersion + 1,
      beforeStatus: cart.status,
      beforeVersion: cart.version,
      reasonCode: input.reasonCode,
      packages: groups.map((group) => ({ ...group, version: packages.find((pkg) => pkg.id === group.packageId).version })),
      verification: "preparation_only_not_sale_or_handoff"
    };
  });
}

// features/keystone/mutations/storefrontSettings.ts
var SETTINGS_SELECTION = "id businessName tagline description brandHue logoIcon logoColor publicationStatus storefrontMode";
async function scopedSettings(context, organizationId2, premisesId2) {
  return context.sudo().query.StorefrontSettings.findMany({
    where: {
      organization: { id: { equals: organizationId2 } },
      premises: { id: { equals: premisesId2 } }
    },
    orderBy: [{ createdAt: "asc" }],
    take: 2,
    query: SETTINGS_SELECTION
  });
}
async function cannabisStorefrontSettingsWorkspace(_root, _args, context) {
  const authority = await requireOperationalAuthority(context, "canManageAuthority", "authority");
  const settings = await scopedSettings(context, authority.organizationId, authority.premisesId);
  if (settings.length > 1) throw new Error("Storefront settings scope is inconsistent and requires review");
  return {
    ...projectPublicStorefrontSettings(settings[0]),
    organizationId: authority.organizationId,
    premisesId: authority.premisesId
  };
}
async function configureCannabisStorefrontSettings(_root, args, context) {
  const input = args.input;
  return runControlledOperation(context, input, {
    permission: "canManageAuthority",
    activity: "authority",
    scope: "configureCannabisStorefrontSettings",
    resourceType: "StorefrontSettings",
    action: "storefront.settings.configured",
    emitStateEvent: false
  }, async (tx, authority) => {
    const settings = normalizeStorefrontSettingsInput(input);
    const logo = normalizeLogoSettings(input);
    const existing = await scopedSettings(tx, authority.organizationId, authority.premisesId);
    if (existing.length > 1) throw new Error("Storefront settings scope is inconsistent and requires review");
    const data = {
      businessName: settings.businessName,
      tagline: settings.tagline,
      description: settings.description,
      brandHue: settings.brandHue,
      ...logo,
      publicationStatus: "published",
      storefrontMode: "configured",
      demoCatalog: []
    };
    const saved = existing[0] ? await tx.sudo().query.StorefrontSettings.updateOne({ where: { id: existing[0].id }, data, query: SETTINGS_SELECTION }) : await tx.sudo().query.StorefrontSettings.createOne({ data: {
      ...data,
      organization: { connect: { id: authority.organizationId } },
      premises: { connect: { id: authority.premisesId } }
    }, query: SETTINGS_SELECTION });
    return { id: saved.id, status: "configured", ...projectPublicStorefrontSettings(saved) };
  });
}

// features/keystone/mutations/index.ts
var graphql = String.raw;
function extendGraphqlSchema(baseSchema) {
  return (0, import_schema.mergeSchemas)({
    schemas: [baseSchema],
    typeDefs: graphql`
      type Query {
        redirectToInit: Boolean
        publicCannabisMenu: JSON!
        publicCannabisStorefrontSettings: JSON!
        cannabisOperationsWorkspace(section: String!): JSON!
        cannabisStorefrontSettingsWorkspace: JSON!
        cannabisCartPreparation(cartId: ID!): JSON!
        cannabisCartAllocationQuote(input: JSON!): JSON!
      }
      type Mutation {
        runCannabisOnboarding(input: JSON!): JSON!
        configureCannabisStorefrontSettings(input: JSON!): JSON!
        provisionStaffAuthority(input: JSON!): JSON!
        submitCannabisCustomerIntake(input: JSON!): JSON!
        recordEligibilityDecision(input: JSON!): JSON!
        receiveCannabisPackage(input: JSON!): JSON!
        postCannabisInventoryEvent(input: JSON!): JSON!
        releasePackageHold(input: JSON!): JSON!
        createCustomerPickupCart(input: JSON!): JSON!
        createPosCannabisCart(input: JSON!): JSON!
        transitionCannabisCartPreparation(input: JSON!): JSON!
        addCannabisCartLine(input: JSON!): JSON!
        cancelCannabisCart(input: JSON!): JSON!
        finalizeCannabisSale(input: JSON!): JSON!
        configureCannabisProduct(input: JSON!): JSON!
        configureRegister(input: JSON!): JSON!
        openRegisterShift(input: JSON!): JSON!
        closeRegisterShift(input: JSON!): JSON!
        approveCashVariance(input: JSON!): JSON!
        refundCannabisSale(input: JSON!): JSON!
        recordComplianceIncident(input: JSON!): JSON!
        activateIntegrationInstallation(input: JSON!): JSON!
        recordStateInboxEvent(input: JSON!): JSON!
        retryStateOutboxEvent(input: JSON!): JSON!
        recordReconciliationRun(input: JSON!): JSON!
        approveReconciliationRun(input: JSON!): JSON!
      }
    `,
    resolvers: {
      Query: { redirectToInit: redirectToInit_default, publicCannabisMenu, publicCannabisStorefrontSettings, cannabisOperationsWorkspace, cannabisStorefrontSettingsWorkspace, cannabisCartPreparation, cannabisCartAllocationQuote },
      Mutation: {
        runCannabisOnboarding,
        configureCannabisStorefrontSettings,
        provisionStaffAuthority,
        submitCannabisCustomerIntake,
        recordEligibilityDecision,
        receiveCannabisPackage,
        postCannabisInventoryEvent,
        releasePackageHold,
        createCustomerPickupCart,
        createPosCannabisCart,
        transitionCannabisCartPreparation,
        addCannabisCartLine,
        cancelCannabisCart,
        finalizeCannabisSale,
        configureCannabisProduct,
        configureRegister,
        openRegisterShift,
        closeRegisterShift,
        approveCashVariance,
        refundCannabisSale,
        recordComplianceIncident,
        activateIntegrationInstallation,
        recordStateInboxEvent,
        retryStateOutboxEvent,
        recordReconciliationRun,
        approveReconciliationRun
      }
    }
  });
}

// features/keystone/lib/mail.ts
var import_nodemailer = require("nodemailer");
function getBaseUrlForEmails() {
  if (process.env.SMTP_STORE_LINK) {
    return process.env.SMTP_STORE_LINK;
  }
  console.warn("SMTP_STORE_LINK not set. Please add SMTP_STORE_LINK to your environment variables for email links to work properly.");
  return "";
}
function mailTransport() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_PORT || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    throw new Error("Password reset delivery is not configured");
  }
  const port = Number(process.env.SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Password reset delivery is not configured");
  return (0, import_nodemailer.createTransport)({
    host: process.env.SMTP_HOST,
    port,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
  });
}
function passwordResetEmail({ url }) {
  const backgroundColor = "#f9f9f9";
  const textColor = "#444444";
  const mainBackgroundColor = "#ffffff";
  const buttonBackgroundColor = "#346df1";
  const buttonBorderColor = "#346df1";
  const buttonTextColor = "#ffffff";
  return `
    <body style="background: ${backgroundColor};">
      <table width="100%" border="0" cellspacing="20" cellpadding="0" style="background: ${mainBackgroundColor}; max-width: 600px; margin: auto; border-radius: 10px;">
        <tr>
          <td align="center" style="padding: 10px 0px 0px 0px; font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${textColor};">
            Please click below to reset your password
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 20px 0;">
            <table border="0" cellspacing="0" cellpadding="0">
              <tr>
                <td align="center" style="border-radius: 5px;" bgcolor="${buttonBackgroundColor}"><a href="${url}" target="_blank" style="font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${buttonTextColor}; text-decoration: none; border-radius: 5px; padding: 10px 20px; border: 1px solid ${buttonBorderColor}; display: inline-block; font-weight: bold;">Reset Password</a></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 0px 0px 10px 0px; font-size: 16px; line-height: 22px; font-family: Helvetica, Arial, sans-serif; color: ${textColor};">
            If you did not request this email you can safely ignore it.
          </td>
        </tr>
      </table>
    </body>
  `;
}
async function sendPasswordResetEmail(resetToken, to, baseUrl) {
  const frontendUrl = baseUrl || getBaseUrlForEmails();
  await mailTransport().sendMail({
    to,
    from: process.env.SMTP_FROM,
    subject: "Your password reset token!",
    html: passwordResetEmail({
      url: `${frontendUrl}/dashboard/reset?token=${resetToken}`
    })
  });
}

// lib/security.ts
var OPERATOR_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

// features/keystone/config/environment.ts
function requireValue(env, name) {
  const value = env[name]?.trim();
  if (value) return value;
  throw new Error(`${name} is required`);
}
function readRuntimeEnvironment(env = process.env) {
  const databaseUrl = requireValue(env, "DATABASE_URL");
  if (!/^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
    throw new Error("DATABASE_URL must use PostgreSQL");
  }
  const sessionSecret = requireValue(env, "SESSION_SECRET");
  if (sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters");
  }
  const endpoint = requireValue(env, "S3_ENDPOINT");
  let storageEndpoint;
  try {
    storageEndpoint = new URL(endpoint);
  } catch {
    throw new Error("S3_ENDPOINT must be a valid absolute URL");
  }
  if (env.NODE_ENV === "production" && storageEndpoint.protocol !== "https:") {
    throw new Error("S3_ENDPOINT must use HTTPS in production");
  }
  return {
    databaseUrl,
    sessionSecret,
    storage: {
      bucketName: requireValue(env, "S3_BUCKET_NAME"),
      region: requireValue(env, "S3_REGION"),
      accessKeyId: requireValue(env, "S3_ACCESS_KEY_ID"),
      secretAccessKey: requireValue(env, "S3_SECRET_ACCESS_KEY"),
      endpoint: storageEndpoint.toString().replace(/\/$/, "")
    }
  };
}

// features/keystone/index.ts
var runtimeEnvironment = readRuntimeEnvironment();
var sessionConfig = {
  maxAge: OPERATOR_SESSION_MAX_AGE_SECONDS,
  secret: runtimeEnvironment.sessionSecret
};
var { withAuth } = (0, import_auth.createAuth)({
  listKey: "User",
  identityField: "email",
  secretField: "password",
  initFirstItem: {
    fields: ["name", "email", "password"],
    itemData: {
      role: {
        create: {
          name: "Admin",
          canManagePeople: true,
          canManageRoles: true,
          canAccessDashboard: true,
          canManageOnboarding: true,
          canManageAuthority: true,
          canManageCompliance: true,
          canManageInventory: true,
          canManageSales: true,
          canManageFinance: true,
          canManageIntegrations: true,
          canViewReports: true
        }
      }
    }
  },
  passwordResetLink: {
    async sendToken(args) {
      await sendPasswordResetEmail(args.token, args.identity);
    }
  },
  sessionData: `
    name
    email
    status
    onboardingStatus
    organization { id }
    premises { id }
    staffCredential { id status effectiveAt expiresAt allowedActivities evidenceHash }
    role {
      id
      name
      canManagePeople
      canManageRoles
      canAccessDashboard
      canManageOnboarding
      canManageAuthority
      canManageCompliance
      canManageInventory
      canManageSales
      canManageFinance
      canManageIntegrations
      canViewReports
    }
  `
});
var keystone_default = withAuth(
  (0, import_core7.config)({
    db: {
      provider: "postgresql",
      url: runtimeEnvironment.databaseUrl
    },
    lists: models,
    storage: {
      my_images: {
        kind: "s3",
        type: "image",
        bucketName: runtimeEnvironment.storage.bucketName,
        region: runtimeEnvironment.storage.region,
        accessKeyId: runtimeEnvironment.storage.accessKeyId,
        secretAccessKey: runtimeEnvironment.storage.secretAccessKey,
        endpoint: runtimeEnvironment.storage.endpoint,
        signed: { expiry: 300 },
        forcePathStyle: true
      }
    },
    ui: {
      isAccessAllowed: ({ session }) => session?.data.role?.canAccessDashboard ?? false
    },
    session: (0, import_session.statelessSessions)(sessionConfig),
    graphql: {
      extendGraphqlSchema
    }
  })
);

// keystone.ts
var keystone_default2 = keystone_default;
//# sourceMappingURL=config.js.map
