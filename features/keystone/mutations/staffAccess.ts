import type { Context } from ".keystone/types";
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
  return runControlledOperation(context, input, { permission: "canManagePeople", activity: "authority", scope: "setStaffTemporaryPassword", resourceType: "User", action: "staff.password.reset", emitStateEvent: false, lockKeys: [userId] }, async (tx, authority) => {
    const sudo = tx.sudo();
    const target = await sudo.query.User.findOne({ where: { id: userId }, query: "id status organization { id } premises { id } role { canManageOnboarding }" });
    if (!target || target.organization?.id !== authority.organizationId || target.premises?.id !== authority.premisesId) throw new Error("Staff member is outside this premises");
    const actor = await sudo.query.User.findOne({ where: { id: authority.actor.id }, query: "role { canManageOnboarding }" });
    if (target.role?.canManageOnboarding === true && target.id !== authority.actor.id && actor?.role?.canManageOnboarding !== true) throw new Error("Only the owner can reset an owner's password");
    await sudo.query.User.updateOne({ where: { id: target.id }, data: { password }, query: "id" });
    return { id: target.id, status: target.status, reference: target.id };
  });
}
