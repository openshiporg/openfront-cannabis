// Needs DATABASE_URL (a scratch DB with migrations applied) and SESSION_SECRET.
// Run: DATABASE_URL=... SESSION_SECRET=... node --import tsx --test tests/db/relation-filter-access.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { getContext } from "@keystone-6/core/context";
import * as PrismaModule from "@prisma/client";
import config from "../../features/keystone/index.ts";

const ctx: any = getContext(config as any, PrismaModule as any);
const sudo = ctx.sudo();
const tag = Date.now().toString(36);
const day = new Date("2026-01-01T00:00:00.000Z"), later = new Date("2030-01-01T00:00:00.000Z");
const PERMS = ["canManagePeople", "canManageRoles", "canAccessDashboard", "canManageOnboarding", "canManageAuthority", "canManageCompliance", "canManageInventory", "canManageSales", "canManageFinance", "canManageIntegrations", "canViewReports"];

const sessions: Record<string, any> = {};
let org: any, premises: any;

async function actor(name: string, grants: string[]) {
  const role = await sudo.query.Role.createOne({ data: { name: `${name}-${tag}`, organization: { connect: { id: org.id } }, ...Object.fromEntries(grants.map((g) => [g, true])) }, query: "id" });
  const user = await sudo.query.User.createOne({ data: { name, email: `${name}-${tag}@example.com`, password: "a-long-test-password-1", role: { connect: { id: role.id } }, organization: { connect: { id: org.id } }, premises: { connect: { id: premises.id } } }, query: "id" });
  await sudo.query.StaffCredential.createOne({ data: { organization: { connect: { id: org.id } }, premises: { connect: { id: premises.id } }, user: { connect: { id: user.id } }, credentialType: "badge", credentialReference: `cred-${name}-${tag}`, status: "active", effectiveAt: day, expiresAt: later, evidenceHash: "h" }, query: "id" });
  const data = { name, status: "active", organization: { id: org.id }, premises: { id: premises.id }, role: { id: role.id, name: role.name, ...Object.fromEntries(PERMS.map((p) => [p, grants.includes(p)])) } };
  return { itemId: user.id, listKey: "User", data };
}

test("setup", async () => {
  org = await sudo.query.Organization.createOne({ data: { name: `Org ${tag}`, legalName: `Org ${tag} LLC`, jurisdictionCode: `T${tag}`, status: "active" }, query: "id" });
  premises = await sudo.query.Premises.createOne({ data: { name: `Shop ${tag}`, premisesCode: `P-${tag}`, timezone: "America/Denver", organization: { connect: { id: org.id } }, status: "active" }, query: "id" });
  const customerUser = await sudo.query.User.createOne({ data: { name: "Zed Customer", email: `zed-${tag}@example.com`, password: "a-long-test-password-1", organization: { connect: { id: org.id } }, premises: { connect: { id: premises.id } } }, query: "id" });
  const customer = await sudo.query.Customer.createOne({ data: { organization: { connect: { id: org.id } }, premises: { connect: { id: premises.id } }, user: { connect: { id: customerUser.id } }, reference: `alpha-${tag}`, capacity: "adult_use", status: "eligible" }, query: "id" });
  await sudo.query.Cart.createOne({ data: { organization: { connect: { id: org.id } }, premises: { connect: { id: premises.id } }, customer: { connect: { id: customer.id } }, reference: `cart-${tag}`, source: "pos", expiresAt: later }, query: "id" });
  sessions.admin = await actor("admin", PERMS);
  sessions.budtender = await actor("budtender", ["canAccessDashboard", "canManageSales"]);
  sessions.auditor = await actor("auditor", ["canAccessDashboard", "canViewReports"]);
  sessions.cashier = await actor("cashier", ["canAccessDashboard", "canManageFinance"]);
  sessions.stock = await actor("stock", ["canAccessDashboard", "canManageInventory"]);
});

type Probe = { name: string; query: (hit: boolean) => string; allowedFor: string[] };
const swap = (hit: boolean, value: string) => (hit ? value : "q9z-none");
const probes: Probe[] = [
  { name: "cartsCount via customer.reference", query: (h) => `{ n: cartsCount(where: { customer: { reference: { startsWith: "${swap(h, "alpha")}" } } }) }`, allowedFor: ["admin"] },
  { name: "cartsCount via customer.user.name", query: (h) => `{ n: cartsCount(where: { customer: { user: { name: { startsWith: "${swap(h, "Zed")}" } } } }) }`, allowedFor: ["admin"] },
  { name: "salesCount via customer.reference", query: (h) => `{ n: salesCount(where: { customer: { reference: { startsWith: "${swap(h, "alpha")}" } } }) }`, allowedFor: ["admin"] },
  { name: "cartsCount via shift.operator.name", query: (h) => `{ n: cartsCount(where: { shift: { operator: { name: { startsWith: "${swap(h, "admin")}" } } } }) }`, allowedFor: ["admin"] },
  { name: "auditEventsCount via actor.name", query: (h) => `{ n: auditEventsCount(where: { actor: { name: { startsWith: "${swap(h, "admin")}" } } }) }`, allowedFor: ["admin"] },
  { name: "inventoryEventsCount via actor.name", query: (h) => `{ n: inventoryEventsCount(where: { actor: { name: { startsWith: "${swap(h, "admin")}" } } }) }`, allowedFor: ["admin"] },
  { name: "productsCount via packages.some.packageUid", query: (h) => `{ n: productsCount(where: { packages: { some: { packageUid: { startsWith: "${swap(h, "a")}" } } } }) }`, allowedFor: ["admin", "stock"] },
  { name: "cartLinesCount via cart.reference", query: (h) => `{ n: cartLinesCount(where: { cart: { reference: { startsWith: "${swap(h, "cart")}" } } }) }`, allowedFor: ["admin", "budtender"] },
  { name: "cartLinesCount via cart.customer.reference", query: (h) => `{ n: cartLinesCount(where: { cart: { customer: { reference: { startsWith: "${swap(h, "alpha")}" } } } }) }`, allowedFor: ["admin"] },
  { name: "usersCount via customerProfile.reference", query: (h) => `{ n: usersCount(where: { customerProfile: { reference: { startsWith: "${swap(h, "alpha")}" } } }) }`, allowedFor: ["admin"] },
  { name: "usersCount via role.name", query: (h) => `{ n: usersCount(where: { role: { name: { startsWith: "${swap(h, "admin")}" } } }) }`, allowedFor: ["admin", "budtender", "auditor", "cashier", "stock"] },
  { name: "usersCount via staffCredential.credentialReference", query: (h) => `{ n: usersCount(where: { staffCredential: { credentialReference: { startsWith: "${swap(h, "cred")}" } } }) }`, allowedFor: ["admin"] },
  { name: "usersCount via organization.legalName", query: (h) => `{ n: usersCount(where: { organization: { legalName: { startsWith: "${swap(h, "Org")}" } } }) }`, allowedFor: ["admin"] },
  { name: "rolesCount via assignedTo.some.name", query: (h) => `{ n: rolesCount(where: { assignedTo: { some: { name: { startsWith: "${swap(h, "admin")}" } } } }) }`, allowedFor: ["admin"] },
  { name: "usersCount by password", query: (h) => `{ n: usersCount(where: { password: { isSet: ${h} } }) }`, allowedFor: [] },
];

// Signed out and each limited role: a hit and a miss must give the same count, or an access error.
for (const who of ["anonymous", "budtender", "auditor", "cashier", "stock"]) {
  for (const probe of probes) {
    test(`${who}: ${probe.name}`, async () => {
      const c = who === "anonymous" ? ctx : ctx.withSession(sessions[who]);
      const run = async (hit: boolean) => {
        const r = await c.graphql.raw({ query: probe.query(hit) });
        return r.errors?.length ? "error" : r.data?.n;
      };
      const [hit, miss] = [await run(true), await run(false)];
      if (!probe.allowedFor.includes(who)) assert.equal(hit, miss, `${probe.name} leaks for ${who}: hit=${hit} miss=${miss}`);
    });
  }
}

test("admin keeps its real filters", async () => {
  const c = ctx.withSession(sessions.admin);
  const count = async (where: string) => (await c.graphql.raw({ query: `{ n: cartsCount(where: ${where}) }` })).data?.n;
  assert.equal(await count(`{ customer: { reference: { startsWith: "alpha" } } }`), 1);
  assert.equal(await count(`{ customer: { reference: { startsWith: "q9z-none" } } }`), 0);
});

test("password, session keys and secrets are never filterable, even for admin", async () => {
  const c = ctx.withSession(sessions.admin);
  const r = await c.graphql.raw({ query: `{ n: usersCount(where: { password: { isSet: true } }) }` });
  assert.ok(r.errors?.length, "password filter must be refused");
});
