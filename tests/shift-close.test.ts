import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import test from "node:test";

// The mutation modules import siblings without file extensions (Next/Keystone resolution); let Node find the .ts files.
register("data:text/javascript," + encodeURIComponent(`export async function resolve(s, c, n) {
  try { return await n(s, c); } catch (error) {
    if ((s.startsWith(".") || s.startsWith("/")) && !/\\.[cm]?[jt]sx?$/.test(s)) for (const ext of [".ts", ".tsx", "/index.ts"]) { try { return await n(s + ext, c); } catch {} }
    throw error;
  }
}`));

const { openRegisterShift, closeRegisterShift } = await import("../features/keystone/mutations/operations.ts");

const PASSWORD = "correct horse battery";
const HASH = "$2a$04$RGGZsg.qsTpORVJnlL/Im.NLCQDtG22qtTb5Yjc7qdzP9nKKq9pra"; // bcrypt of PASSWORD, cost 4
const past = new Date(Date.now() - 86_400_000).toISOString();
const future = new Date(Date.now() + 86_400_000 * 365).toISOString();

function user(id: string, premisesId: string, grants: { finance?: boolean; sales?: boolean }) {
  return {
    id, email: `${id}@example.com`, password: HASH, status: "active", onboardingStatus: "completed",
    organization: { id: "org", jurisdictionCode: "CO", status: "active" },
    premises: { id: premisesId, status: "active", timezone: "America/Denver", currencyCode: "USD", organization: { id: "org" } },
    role: { id: `role-${id}`, canAccessDashboard: true, canManageFinance: grants.finance === true, canManageSales: grants.sales === true },
    staffCredential: { id: `cred-${id}`, status: "active", effectiveAt: past, expiresAt: future, allowedActivities: [grants.finance ? "cash" : "", grants.sales ? "sale" : ""].filter(Boolean), approvalLimitCents: 10_000, evidenceHash: "x", user: { id }, organization: { id: "org" }, premises: { id: premisesId } },
  };
}

/** An in-memory Keystone context: enough of the List API for the shift commands, every relation resolved by id. */
function store() {
  const users = [
    user("budtender", "front", { sales: true }), user("cashier", "front", { finance: true }), user("owner", "front", { finance: true, sales: true }),
    user("remote", "other", { finance: true }), user("remote2", "other", { finance: true }),
  ];
  const rows: Record<string, any[]> = { RegisterShift: [], CashEvent: [], IdempotencyKey: [], AuditEvent: [], Register: [{ id: "front-1", code: "front-1", status: "active", organization: { id: "org" }, premises: { id: "front" } }] };
  let next = 0;
  const flatten = (data: Record<string, any>) => Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value && typeof value === "object" && "connect" in value ? { id: value.connect.id } : value]));
  const list = (name: string) => ({
    findOne: async ({ where }: any) => {
      const row = rows[name].find(entry => Object.entries(where).every(([key, value]) => entry[key] === value));
      if (!row) return null;
      return name === "RegisterShift" ? { ...row, cashEvents: rows.CashEvent.filter(event => event.shift.id === row.id) } : row;
    },
    findMany: async ({ where }: any) => rows[name].filter(row => (!where?.register || row.register.id === where.register.id.equals) && (!where?.status || where.status.in.includes(row.status))),
    createOne: async ({ data }: any) => { const row = { id: `${name}-${++next}`, ...flatten(data) }; rows[name].push(row); return row; },
    updateOne: async ({ where, data }: any) => { const row = rows[name].find(entry => entry.id === where.id); Object.assign(row, flatten(data)); return row; },
  });
  const query: Record<string, any> = Object.fromEntries(Object.keys(rows).map(name => [name, list(name)]));
  query.User = { findOne: async ({ where }: any) => users.find(entry => entry.id === where.id) ?? null };
  query.CannabisLicense = { findMany: async ({ where }: any) => [{ id: `lic-${where.premises.id.equals}`, status: "active", effectiveAt: past, expiresAt: future, authorizedActivities: ["cash", "sale"], organization: { id: "org" }, premises: { id: where.premises.id.equals } }] };
  const db = { User: { findOne: async ({ where }: any) => users.find(entry => entry.email === where.email) ?? null } };
  const prisma = { $executeRawUnsafe: async () => 0, $queryRawUnsafe: async () => [] };
  function as(id: string): any {
    const actor = users.find(entry => entry.id === id)!;
    const context: any = { session: { itemId: id, data: { status: "active", organization: { id: "org" }, premises: { id: actor.premises.id } } }, query, db, prisma };
    context.sudo = () => context;
    context.transaction = (work: (tx: any) => Promise<unknown>) => work(context);
    return context;
  }
  return { rows, as };
}

let keys = 0;
const open = (s: ReturnType<typeof store>, actor: string) => openRegisterShift(null, { input: { registerId: "front-1", openingFloatCents: 20_000, idempotencyKey: `open-key-${++keys}` } }, s.as(actor));
const close = (s: ReturnType<typeof store>, actor: string, shiftId: string, actualCashCents: number, approver?: string) =>
  closeRegisterShift(null, { input: { shiftId, actualCashCents, idempotencyKey: `close-key-${++keys}`, ...(approver ? { approverEmail: `${approver}@example.com`, approverPassword: PASSWORD } : {}) } }, s.as(actor));

test("a shift a budtender opens is counted and closed by a finance user, and the register is free again", async () => {
  const s = store();
  const shift = await open(s, "budtender");
  assert.equal(s.rows.RegisterShift[0].operator.id, "budtender");
  await assert.rejects(close(s, "budtender", shift.id, 20_000, "cashier"), /lacks required authority/, "the budtender still cannot close");
  const closed = await close(s, "cashier", shift.id, 20_000, "owner");
  assert.equal(closed.status, "closed");
  const row = s.rows.RegisterShift[0];
  assert.deepEqual([row.status, row.actualCashCents, row.varianceCents, row.approvedBy.id], ["closed", 20_000, 0, "owner"]);
  const count = s.rows.CashEvent.find(event => event.type === "count");
  assert.deepEqual([count.amountCents, count.actor.id, count.approvedBy.id], [20_000, "cashier", "owner"], "the drawer is counted by the closer and approved by someone else");
  assert.equal((await open(s, "budtender")).status, "open", "the next person can open the register");
});

test("closing someone else's shift still needs an independent finance second approver; a short drawer goes to variance review", async () => {
  const s = store();
  const shift = await open(s, "budtender");
  await assert.rejects(close(s, "cashier", shift.id, 20_000), /Approver email/);
  await assert.rejects(close(s, "cashier", shift.id, 20_000, "cashier"), /must be someone else/);
  await assert.rejects(close(s, "cashier", shift.id, 20_000, "budtender"), /does not allow this approval/, "a budtender cannot approve");
  assert.equal(s.rows.RegisterShift[0].status, "open");
  const closed = await close(s, "cashier", shift.id, 19_500, "owner");
  assert.equal(closed.status, "variance_review");
  assert.equal(s.rows.RegisterShift[0].varianceCents, -500);
});

test("a finance user at another premises cannot close the shift; one at its premises can", async () => {
  const s = store();
  const shift = await open(s, "budtender");
  await assert.rejects(close(s, "remote", shift.id, 20_000, "remote2"), /No open shift at your premises/);
  assert.equal(s.rows.RegisterShift[0].status, "open");
  assert.equal(s.rows.CashEvent.filter(event => event.type === "count").length, 0);
  assert.equal((await close(s, "owner", shift.id, 20_000, "cashier")).status, "closed");
});

test("Cash shows the Close form on every open shift, not only the viewer's own", () => {
  const screen = readFileSync(new URL("../features/platform/operations/screens/PrimaryWorkspaces.tsx", import.meta.url), "utf8");
  const cash = screen.slice(screen.indexOf("export async function CashWorkspacePage"), screen.indexOf("export async function ReconciliationWorkspacePage"));
  assert.match(cash, /shift\.status === 'open' && data\.operating\.open && <div className="mt-2"><CloseShiftForm shiftId=\{shift\.id\} \/>/);
});
