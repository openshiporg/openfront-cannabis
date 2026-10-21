import { list } from "@keystone-6/core";
import { denyAll } from "@keystone-6/core/access";
import { password, relationship, select, text, timestamp } from "@keystone-6/core/fields";
import { canManageScopedPeople, isSignedIn, rules } from "../access";
import { trackingFields } from "./trackingFields";

const authorityFieldUI = { createView: { fieldMode: 'hidden' as const }, itemView: { fieldMode: 'read' as const } };
const scopedPeopleUI = { itemView: { fieldMode: async (args: Parameters<typeof canManageScopedPeople>[0]) => await canManageScopedPeople(args) ? 'edit' as const : 'read' as const } };

export const User = list({
  access: {
    operation: { query: isSignedIn, create: () => false, update: isSignedIn, delete: () => false },
    filter: { query: rules.canReadPeople, update: rules.canUpdatePeople },
  },
  fields: {
    name: text({ validation: { isRequired: true } }),
    email: text({ isIndexed: "unique", validation: { isRequired: true }, isFilterable: false, isOrderable: false }),
    password: password({ access: { read: denyAll, update: async (args) => args.session?.itemId === args.item.id || await canManageScopedPeople(args as any) }, validation: { isRequired: true, length: { min: 10, max: 1000 }, rejectCommon: true } }),
    status: select({ ui: scopedPeopleUI, access: { update: canManageScopedPeople }, type: "enum", options: [{ label: "Active", value: "active" }, { label: "Disabled", value: "disabled" }], defaultValue: "active", validation: { isRequired: true } }),
    organization: relationship({ ui: authorityFieldUI, ref: "Organization.users", access: { create: denyAll, update: denyAll } }),
    premises: relationship({ ui: authorityFieldUI, ref: "Premises.users", access: { create: denyAll, update: denyAll } }),
    role: relationship({ ui: authorityFieldUI, ref: "Role.assignedTo", access: { create: denyAll, update: denyAll } }),
    mfaMethod: text({ ui: authorityFieldUI, access: { create: denyAll, update: denyAll } }), mfaVerifiedAt: timestamp({ ui: authorityFieldUI, access: { create: denyAll, update: denyAll } }),
    staffCredential: relationship({ ui: authorityFieldUI, ref: "StaffCredential.user", access: { create: denyAll, update: denyAll } }), customerProfile: relationship({ ui: authorityFieldUI, ref: "Customer.user", access: { create: denyAll, update: denyAll } }),
    onboardingStatus: select({ ui: scopedPeopleUI, access: { update: canManageScopedPeople }, type: "enum", options: [
      { label: "Not Started", value: "not_started" }, { label: "In Progress", value: "in_progress" }, { label: "Completed", value: "completed" }, { label: "Dismissed", value: "dismissed" },
    ], defaultValue: "not_started", validation: { isRequired: true } }),
    ...trackingFields,
  },
});
