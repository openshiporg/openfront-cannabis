import { list } from "@keystone-6/core";
import { checkbox, relationship, text } from "@keystone-6/core/fields";
import { activePermissions, roleQueryFilter } from "../access";
import { trackingFields } from "./trackingFields";

const capability = (label: string) => checkbox({ defaultValue: false, label });

export const Role = list({
  access: {
    operation: { query: activePermissions.canAccessDashboard, create: () => false, update: () => false, delete: () => false },
    filter: { query: roleQueryFilter },
  },
  fields: {
    organization: relationship({ ref: "Organization" }), name: text({ validation: { isRequired: true } }),
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
    assignedTo: relationship({ ref: "User.role", many: true }), ...trackingFields,
  },
});
