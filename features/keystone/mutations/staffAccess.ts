import type { Context } from ".keystone/types";
import { permissionNames } from "../access";
import { assertText, runControlledOperation } from "./workflow";

/**
 * A manager sets a temporary password for a staff member at this premises. Production has
 * no mail transport, so this is how staff who forget their password get back in. Only the
 * owner may reset another owner's password.
 */
export async function setStaffTemporaryPassword(_root: unknown, args: { input: any }, context: Context) {
  const input = args.input || {};
  const userId = assertText(input.userId, "Staff member");
  const password = assertText(input.temporaryPassword, "Temporary password", 10, 1000);
  return runControlledOperation(context, input, { permission: "canManagePeople", activity: "authority", scope: "setStaffTemporaryPassword", resourceType: "User", action: "staff.password.reset", lockKeys: [userId] }, async (tx, authority) => {
    const sudo = tx.sudo();
    const target = await sudo.query.User.findOne({ where: { id: userId }, query: "id status organization { id } premises { id } role { canManageOnboarding }" });
    if (!target || target.organization?.id !== authority.organizationId || target.premises?.id !== authority.premisesId) throw new Error("Staff member is outside this premises");
    const actor = await sudo.query.User.findOne({ where: { id: authority.actor.id }, query: "role { canManageOnboarding }" });
    if (target.role?.canManageOnboarding === true && target.id !== authority.actor.id && actor?.role?.canManageOnboarding !== true) throw new Error("Only the owner can reset an owner's password");
    await sudo.query.User.updateOne({ where: { id: target.id }, data: { password }, query: "id" });
    return { id: target.id, status: target.status, reference: target.id };
  });
}

/**
 * A manager changes an existing staff member's permissions at this premises.
 * The person gets a fresh role (roles can be shared, so the old one is never
 * edited in place); the change is receipted and audited like every command.
 * Limits: only permissions the manager currently holds; never their own
 * permissions; never an owner's; dashboard access stays on and the onboarding
 * (owner) grant can't be handed out here.
 */
export async function changeStaffPermissions(_root: unknown, args: { input: any }, context: Context) {
  const input = args.input || {};
  const userId = assertText(input.userId, "Staff member");
  const requested = input.permissions && typeof input.permissions === "object" && !Array.isArray(input.permissions) ? input.permissions : null;
  if (!requested) throw new Error("Choose the staff member's permissions");
  return runControlledOperation(context, input, { permission: "canManagePeople", activity: "authority", scope: "changeStaffPermissions", resourceType: "User", action: "staff.permissions.changed", lockKeys: [userId] }, async (tx, authority) => {
    const sudo = tx.sudo();
    if (userId === authority.actor.id) throw new Error("You cannot change your own permissions");
    const target = await sudo.query.User.findOne({ where: { id: userId }, query: `id name status organization { id } premises { id } role { id name ${permissionNames.join(" ")} }` });
    if (!target || target.organization?.id !== authority.organizationId || target.premises?.id !== authority.premisesId) throw new Error("Staff member is outside this premises");
    if (target.role?.canManageOnboarding === true) throw new Error("An owner's permissions cannot be changed here");
    const grantor = await sudo.query.User.findOne({ where: { id: authority.actor.id }, query: `role { ${permissionNames.join(" ")} }` });
    const next: Record<string, boolean> = Object.fromEntries(permissionNames.map(permission => [permission, requested[permission] === true]));
    next.canAccessDashboard = true; next.canManageOnboarding = false;
    for (const permission of permissionNames) {
      // A manager may remove a grant they lack, but never add one.
      if (next[permission] && target.role?.[permission] !== true && grantor?.role?.[permission] !== true) throw new Error("You can only grant permissions you currently hold");
    }
    const name = assertText(target.role?.name || `${target.name} staff`, "Role name");
    const role = await sudo.query.Role.createOne({ data: { organization: { connect: { id: authority.organizationId } }, name, ...next }, query: "id" });
    await sudo.query.User.updateOne({ where: { id: target.id }, data: { role: { connect: { id: role.id } } }, query: "id" });
    return { id: target.id, status: target.status, reference: role.id, beforeRoleId: target.role?.id ?? null };
  });
}
