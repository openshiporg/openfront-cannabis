// Admin create buttons follow each list's create access (features/keystone/ui-create-access.ts).
import assert from "node:assert/strict";
import test from "node:test";
import { withCreateAwareUi } from "../features/keystone/ui-create-access.ts";

const manager = { itemId: "u1", data: { role: { canManageSales: true } } };
const clerk = { itemId: "u2", data: { role: { canManageSales: false } } };
const hide = (list: any, session: unknown) => list.ui.hideCreate({ session, context: {} });

const lists: any = withCreateAwareUi({
  Sale: { access: { operation: { query: () => true, create: () => false } }, ui: { listView: { initialColumns: ["id"] } } },
  Product: { access: { operation: { create: ({ session }: any) => session?.data?.role?.canManageSales === true } } },
  Explicit: { access: { operation: { create: () => false } }, ui: { hideCreate: false } },
  NoAccess: { fields: {} },
  Throws: { access: { operation: { create: () => { throw new Error("boom"); } } } },
});

test("always-denied create hides the button for everyone and keeps other ui", async () => {
  assert.equal(await hide(lists.Sale, manager), true);
  assert.deepEqual(lists.Sale.ui.listView, { initialColumns: ["id"] });
});

test("role-based create hides only for sessions without the permission", async () => {
  assert.equal(await hide(lists.Product, manager), false);
  assert.equal(await hide(lists.Product, clerk), true);
});

test("explicit hideCreate, lists without access, and throwing rules", async () => {
  assert.equal(lists.Explicit.ui.hideCreate, false);
  assert.equal(lists.NoAccess.ui, undefined);
  assert.equal(await hide(lists.Throws, manager), true);
});

test("access rules themselves are not changed", () => {
  const create = () => false;
  const wrapped: any = withCreateAwareUi({ X: { access: { operation: { create } } } });
  assert.equal(wrapped.X.access.operation.create, create);
});
