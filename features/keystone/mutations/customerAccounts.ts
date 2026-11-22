import { createHash, randomUUID } from "node:crypto";
import bcryptjs from "bcryptjs";
import type { Context } from ".keystone/types";
import { ageAtPremises } from "../domain/premisesTime";
import { publicAuthority } from "./public";
import { assertText } from "./workflow";

const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[+()\d\s.-]{7,30}$/;
const SIGN_IN_FIRST = "Sign in to see your account";

type AccountCustomer = { id: string; reference: string; status: string; contact: Record<string, unknown> };

/**
 * The shopper account behind the current session, or null. A shopper is a User with no role (so no dashboard,
 * no staff list, no staff command) linked to one Customer at this store. Staff sessions have no such link.
 */
export async function accountCustomer(context: Context, scope: { organizationId: string; premisesId: string }): Promise<(AccountCustomer & { userId: string; name: string; email: string }) | null> {
  const session = context.session as { itemId?: string; data?: { status?: string } } | undefined;
  if (!session?.itemId || session.data?.status === "disabled") return null;
  const user = await context.sudo().query.User.findOne({ where: { id: session.itemId },
    query: "id name email status customerProfile { id reference status contact organization { id } premises { id } }" });
  const customer = user?.customerProfile;
  if (!user || user.status !== "active" || !customer || customer.organization?.id !== scope.organizationId || customer.premises?.id !== scope.premisesId) return null;
  const contact = customer.contact && typeof customer.contact === "object" && !Array.isArray(customer.contact) ? customer.contact as Record<string, unknown> : {};
  return { id: customer.id, reference: customer.reference, status: customer.status, contact, userId: user.id, name: user.name, email: user.email };
}

const storeScope = async (context: Context) => {
  const authority = await publicAuthority(context);
  return { authority, scope: { organizationId: authority.organization.id as string, premisesId: authority.premises.id as string } };
};

/** Open a shopper account. Adults only, by the store's own calendar; staff still check ID at pickup. */
export async function registerCannabisCustomer(_root: unknown, args: { input: any }, context: Context) {
  const raw = args.input;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Account details are required");
  const name = assertText(raw.name, "Name", 2, 120);
  const email = assertText(raw.email, "Email", 3, 254).toLowerCase();
  if (!EMAIL.test(email)) throw new Error("Enter a valid email address");
  const phone = assertText(raw.phone, "Phone", 7, 30);
  if (!PHONE.test(phone)) throw new Error("Enter a valid phone number");
  if (typeof raw.password !== "string" || raw.password.length < 10 || raw.password.length > 200) throw new Error("Choose a password of at least 10 characters");
  const dateOfBirth = assertText(raw.dateOfBirth, "Date of birth", 10, 10);
  const { authority, scope } = await storeScope(context);
  const timezone = typeof authority.premises.timezone === "string" ? authority.premises.timezone.trim() : "";
  if (!timezone) throw new Error("Accounts are not available at this store yet");
  const age = ageAtPremises(dateOfBirth, new Date(), timezone);
  if (age === null) throw new Error("Enter your date of birth as a real past date");
  if (age < authority.pack.adultMinimumAge) throw new Error(`You must be ${authority.pack.adultMinimumAge} or older to open an account`);

  const sudo = context.sudo();
  if (await sudo.db.User.findOne({ where: { email } })) throw new Error("An account with this email already exists. Sign in instead.");
  let user: { id: unknown };
  try { user = await sudo.db.User.createOne({ data: { name, email, password: raw.password } }); }
  catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/common|too short|password/i.test(message)) throw new Error("That password is too easy to guess. Choose a longer or less common one.");
    if (/unique/i.test(message)) throw new Error("An account with this email already exists. Sign in instead.");
    throw error;
  }
  // A new customer record of its own: an account never adopts a guest's earlier orders, since the email is not yet proven.
  await sudo.query.Customer.createOne({ data: { organization: { connect: { id: scope.organizationId } }, premises: { connect: { id: scope.premisesId } }, user: { connect: { id: String(user.id) } },
    reference: `CUS-${randomUUID().slice(0, 8).toUpperCase()}`, capacity: "adult_use", status: "pending_verification", intakeProofHash: sha(randomUUID()), contact: { name, email, phone, dateOfBirth } }, query: "id" });
  await sudo.query.AuditEvent.createOne({ data: { organization: { connect: { id: scope.organizationId } }, premises: { connect: { id: scope.premisesId } }, action: "customer.account_opened", resourceType: "User", resourceId: String(user.id),
    correlationId: String(user.id), reasonCode: "storefront_sign_up", evidence: {}, evidenceHash: sha(`account:${user.id}`), occurredAt: new Date() }, query: "id" });
  return { created: true };
}

const orderSummary = (cart: any) => ({
  reference: cart.reference, status: cart.status, totalCents: cart.totalCents, placedAt: cart.createdAt, pickupStart: cart.pickupWindowStart, pickupEnd: cart.pickupWindowEnd,
  paymentMethod: cart.paymentMethod, paymentStatus: cart.paymentStatus,
  lines: (cart.lines || []).map((line: any) => ({ productId: line.product?.id ?? null, title: line.titleSnapshot, units: Math.round(line.quantityMicrounits / (line.product?.unitQuantityMicrounits || line.quantityMicrounits)), unitPriceCents: line.unitPriceCents })),
});

/** The signed-in shopper's own details and orders; null for a guest or a staff session. */
export async function cannabisCustomerAccount(_root: unknown, _args: unknown, context: Context) {
  if (!(context.session as any)?.itemId) return null;
  let located: Awaited<ReturnType<typeof storeScope>>;
  try { located = await storeScope(context); } catch { return null; }
  const account = await accountCustomer(context, located.scope);
  if (!account) return null;
  const carts = await context.sudo().query.Cart.findMany({ where: { customer: { id: { equals: account.id } }, source: { equals: "pickup" } }, orderBy: [{ createdAt: "desc" }], take: 50,
    query: "reference status totalCents createdAt pickupWindowStart pickupWindowEnd paymentMethod paymentStatus lines(take: 20) { titleSnapshot quantityMicrounits unitPriceCents product { id unitQuantityMicrounits } }" });
  const text = (key: string) => typeof account.contact[key] === "string" ? account.contact[key] as string : "";
  return { name: account.name, email: account.email, phone: text("phone"), dateOfBirth: text("dateOfBirth"), customerReference: account.reference,
    timezone: located.authority.premises.timezone ?? "", currencyCode: located.authority.premises.currencyCode ?? "USD", orders: carts.map(orderSummary) };
}

/** Change the name and phone the store sees on the shopper's orders. */
export async function updateCannabisCustomerProfile(_root: unknown, args: { input: any }, context: Context) {
  const { scope } = await storeScope(context);
  const account = await accountCustomer(context, scope);
  if (!account) throw new Error(SIGN_IN_FIRST);
  const name = assertText(args.input?.name, "Name", 2, 120);
  const phone = assertText(args.input?.phone, "Phone", 7, 30);
  if (!PHONE.test(phone)) throw new Error("Enter a valid phone number");
  const sudo = context.sudo();
  await sudo.db.User.updateOne({ where: { id: account.userId }, data: { name } });
  await sudo.query.Customer.updateOne({ where: { id: account.id }, data: { contact: { ...account.contact, name, phone, email: account.email } }, query: "id" });
  return { name, phone };
}

/** Change the password from inside the account: the current one is checked first. */
export async function changeCannabisCustomerPassword(_root: unknown, args: { currentPassword: string; newPassword: string }, context: Context) {
  const { scope } = await storeScope(context);
  const account = await accountCustomer(context, scope);
  if (!account) throw new Error(SIGN_IN_FIRST);
  if (typeof args.newPassword !== "string" || args.newPassword.length < 10 || args.newPassword.length > 200) throw new Error("Choose a password of at least 10 characters");
  const sudo = context.sudo();
  const user = await sudo.db.User.findOne({ where: { id: account.userId } }) as Record<string, any> | null;
  const matches = await bcryptjs.compare(String(args.currentPassword ?? ""), typeof user?.password === "string" ? user.password : "$2a$10$gYkqdfuI69EYQnEGtCg/z.NwCTZ5qkedyZ1tQ7LGTrhYPXpI0tcVO");
  if (!user || !matches) throw new Error("Your current password is incorrect");
  try { await sudo.db.User.updateOne({ where: { id: account.userId }, data: { password: args.newPassword } }); }
  catch { throw new Error("That password is too easy to guess. Choose a longer or less common one."); }
  return { changed: true };
}
