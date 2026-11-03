import { list } from "@keystone-6/core";
import { checkbox, relationship, text } from "@keystone-6/core/fields";
import { activePermissions, permissionNames, roleQueryFilter } from "../access";
import { trackingFields } from "./trackingFields";

const capability = (label: string) => checkbox({ defaultValue: false, label });

// Role definitions are managed by holders of a *current* canManageRoles grant
// (activePermissions re-reads the caller's role, never the session snapshot).
// Assigning people to roles stays in the audited provisionStaffAuthority path.
const canManageRolesNow = activePermissions.canManageRoles;

async function callerOrganizationId(context: any) {
  const userId = context.session?.itemId;
  if (!userId) return null;
  const user = await context.sudo().query.User.findOne({ where: { id: userId }, query: "organization { id } role { " + permissionNames.join(" ") + " }" });
  return user ? { organizationId: user.organization?.id ?? null, role: user.role ?? {} } : null;
}

async function manageableRoleFilter(args: any) {
  const caller = await callerOrganizationId(args.context);
  if (!caller?.organizationId) return false;
  return { AND: [{ organization: { id: { equals: caller.organizationId } } }, { assignedTo: { none: {} } }] };
}

export const Role = list({
  access: {
    operation: { query: activePermissions.canAccessDashboard, create: canManageRolesNow, update: canManageRolesNow, delete: canManageRolesNow },
    filter: { query: roleQueryFilter, update: manageableRoleFilter, delete: manageableRoleFilter },
  },
  hooks: {
    resolveInput: {
      create: async ({ resolvedData, context }) => {
        // Domain commands (sudo) connect their own organization; generic callers
        // cannot send one (field access) and always get their own.
        if (!context.session?.itemId || resolvedData.organization) return resolvedData;
        const caller = await callerOrganizationId(context);
        if (!caller?.organizationId) throw new Error("An organization assignment is required");
        return { ...resolvedData, organization: { connect: { id: caller.organizationId } } };
      },
    },
    validate: {
      create: validateGrants,
      update: validateGrants,
    },
  },
  fields: {
    organization: relationship({ ref: "Organization", access: { create: () => false, update: () => false } }), name: text({ validation: { isRequired: true } }),
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
    assignedTo: relationship({ ref: "User.role", many: true, access: { create: () => false, update: () => false } }), ...trackingFields,
  },
});

/** A role definition can only carry grants its author currently holds (no self-escalation). */
async function validateGrants({ operation, inputData, item, resolvedData, context, addValidationError }: any) {
  // Domain commands (sudo) connect an organization explicitly and enforce
  // delegation themselves (provisionStaffAuthority, onboarding owner role).
  // Generic callers cannot send organization (field access), so this is not spoofable.
  if (!context.session?.itemId || (operation === "create" && inputData?.organization)) return;
  const caller = await callerOrganizationId(context);
  for (const permission of permissionNames) {
    if (resolvedData[permission] === true && caller?.role?.[permission] !== true) {
      addValidationError(`A role cannot grant ${permission}, which you do not currently hold`);
    }
  }
}
