import bcryptjs from "bcryptjs";
import type { Context } from ".keystone/types";
import type { CannabisPermission } from "../access";
import { assertText } from "./workflow";

const APPROVAL_FAILED = "Approver email or password is incorrect";

/**
 * Second-person approval bound to one command: the approver types their own email and
 * password on the actor's screen, and it is checked here for this command only. Nothing
 * is signed in, and the password never reaches the stored request (the caller drops it).
 * Returns the approver's user id; the command re-checks their authority in its transaction.
 */
export async function verifySecondApprover(context: Context, raw: Record<string, unknown> | null | undefined, permission: CannabisPermission) {
  const input = raw || {};
  const email = assertText(input.approverEmail, "Approver email", 3, 320).toLowerCase();
  const password = typeof input.approverPassword === "string" ? input.approverPassword : "";
  if (!password || password.length > 1000) throw new Error(APPROVAL_FAILED);
  const approver = await context.sudo().db.User.findOne({ where: { email } }) as Record<string, any> | null;
  // Compare even when the user is missing, so a wrong email and a wrong password take the same time.
  const matches = await bcryptjs.compare(password, typeof approver?.password === "string" ? approver.password : "$2a$10$gYkqdfuI69EYQnEGtCg/z.NwCTZ5qkedyZ1tQ7LGTrhYPXpI0tcVO");
  if (!approver || !matches) throw new Error(APPROVAL_FAILED);
  if (approver.id === (context.session as any)?.itemId) throw new Error("The second approver must be someone else");
  const current = await context.sudo().query.User.findOne({ where: { id: approver.id }, query: `id status organization { id } premises { id } role { ${permission} } staffCredential { status effectiveAt expiresAt }` });
  const credential = current?.staffCredential; const now = Date.now();
  if (!current || current.status !== "active" || current.role?.[permission] !== true || !credential || credential.status !== "active" || !(new Date(credential.effectiveAt).getTime() <= now) || !(new Date(credential.expiresAt).getTime() > now)) throw new Error("The approver's role or credential does not allow this approval");
  return String(approver.id);
}

/** The command input with the approver's typed credentials replaced by their verified id. */
export function withApprover(input: any, approvedById: string): any {
  const { approverEmail: _email, approverPassword: _password, ...rest } = input || {};
  return { ...rest, approvedById };
}
