// Demo-account guard: features/keystone/lib/demo-guard.ts. Offline, no DB.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function load(relative) {
  const filename = path.resolve(root, relative);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, require, process, Symbol }, { filename });
  return module.exports;
}

const guard = load('features/keystone/lib/demo-guard.ts');
const { DEMO_GUARD_MESSAGE, withDemoGuard, DEMO_GUARD_POLICY, rewriteDemoErrors } = guard;
const env = { DEMO_USER_EMAILS: ' Other@example.com , CANNABIS@openship.org ' };

const DEMO = { itemId: 'demo', listKey: 'User', data: { email: 'cannabis@openship.org' } };
const ADMIN = { itemId: 'admin', listKey: 'User', data: { email: 'owner@openship.org' } };

// Lists shaped like the real ones; Product carries an existing hook to prove it still runs.
let productHookRan = 0;
const KEYS = ['User','Role','StorefrontSettings','Organization','Premises','PaymentProvider','IntegrationInstallation','Sale','SaleLine','Tender','Refund','Customer','InventoryPackage','RegulatedManifest','AuditEvent','Cart','Register','CashEvent'];
const base = Object.fromEntries(KEYS.map((k) => [k, { fields: {} }]));
const lists = withDemoGuard({
  ...base,
  Product: { fields: {}, hooks: { beforeOperation: { update: () => { productHookRan++; } } } },
}, DEMO_GUARD_POLICY, env);

function run(listKey, operation, session, { item, inputData } = {}) {
  const context = { session, sudo: () => context };
  const hook = lists[listKey].hooks?.beforeOperation;
  const fn = typeof hook === 'function' ? hook : hook?.[operation];
  if (!fn) return Promise.resolve();
  return fn({ listKey, operation, context, item, inputData, resolvedData: inputData });
}

async function refused(promise) {
  await assert.rejects(promise, (error) => error.message === DEMO_GUARD_MESSAGE);
}

test('the exact copy', () => {
  assert.equal(DEMO_GUARD_MESSAGE, "Demo accounts can't change this.");
});

test('demo user cannot change identity: password, email, role, name, status, MFA', async () => {
  for (const inputData of [{ password: 'x' }, { email: 'a@b.c' }, { role: { connect: { id: 'r' } } }, { name: 'X' }, { status: 'disabled' }, { mfaMethod: 'totp' }]) {
    await refused(run('User', 'update', DEMO, { item: { id: 'demo' }, inputData }));
    await refused(run('User', 'update', DEMO, { item: { id: 'admin' }, inputData }));
  }
  await refused(run('User', 'create', DEMO, { inputData: { name: 'New' } }));
  await refused(run('User', 'delete', DEMO, { item: { id: 'admin' } }));
  await run('User', 'update', DEMO, { item: { id: 'demo' }, inputData: { onboardingStatus: 'dismissed' } });
});

test('Role is locked', async () => {
  await refused(run('Role', 'create', DEMO, { inputData: { name: 'X' } }));
  await refused(run('Role', 'update', DEMO, { item: { id: 'r' }, inputData: { canManageSales: true } }));
  await refused(run('Role', 'delete', DEMO, { item: { id: 'r' } }));
});

test('store name, tagline and logo changes are ALLOWED', async () => {
  const item = { id: 's', businessName: 'Cannabis', tagline: 'a', logoIcon: 'a', logoColor: '#111111' };
  await run('StorefrontSettings', 'update', DEMO, { item, inputData: { businessName: 'Cannabis QA', tagline: 'New line', logoIcon: 'b', logoColor: '#000000', publicationStatus: 'published' } });
  await run('StorefrontSettings', 'update', DEMO, { inputData: { businessName: 'No stored item' } });
  await run('StorefrontSettings', 'create', DEMO, { inputData: { businessName: 'x' } });
  await refused(run('StorefrontSettings', 'delete', DEMO, { item }));
});

test('payment provider keys: changed values refused, unchanged pass, name/isInstalled/metadata editable', async () => {
  const item = { id: 'pp', name: 'Authorize.net', code: 'pp_authorizenet', isInstalled: true, createPaymentFunction: 'create' };
  await refused(run('PaymentProvider', 'update', DEMO, { item, inputData: { credentials: { apiKey: 'k' } } }));
  await refused(run('PaymentProvider', 'update', DEMO, { item, inputData: { code: 'pp_other' } }));
  await refused(run('PaymentProvider', 'create', DEMO, { inputData: { name: 'X', code: 'pp_x' } }));
  await refused(run('PaymentProvider', 'delete', DEMO, { item }));
  for (const field of ['createPaymentFunction', 'capturePaymentFunction', 'refundPaymentFunction', 'getPaymentStatusFunction', 'generatePaymentLinkFunction', 'handleWebhookFunction']) {
    await refused(run('PaymentProvider', 'update', DEMO, { item, inputData: { [field]: 'changed' } }));
  }
  await run('PaymentProvider', 'update', DEMO, { item, inputData: { code: 'pp_authorizenet', createPaymentFunction: 'create', name: 'Card payments', isInstalled: false, metadata: { a: 1 } } });
});

test('integration credentialReference protected; delete refused; status editable', async () => {
  const item = { id: 'i', credentialReference: 'r1' };
  await refused(run('IntegrationInstallation', 'update', DEMO, { item, inputData: { credentialReference: 'r2' } }));
  await refused(run('IntegrationInstallation', 'delete', DEMO, { item }));
  await run('IntegrationInstallation', 'update', DEMO, { item, inputData: { status: 'suspended' } });
  await run('IntegrationInstallation', 'create', DEMO, { inputData: { providerCode: 'x' } });
});

test('delete of business records refused; create and update still work', async () => {
  for (const key of ['Organization', 'Premises', 'Sale', 'SaleLine', 'Tender', 'Refund', 'Customer', 'Product', 'InventoryPackage', 'RegulatedManifest', 'AuditEvent']) {
    await refused(run(key, 'delete', DEMO, { item: { id: 'x' } }));
    await run(key, 'create', DEMO, { inputData: { a: 1 } });
    await run(key, 'update', DEMO, { item: { id: 'x' }, inputData: { a: 1 } });
  }
  assert.equal(productHookRan, 1, 'the existing Product hook still runs');
  await run('Cart', 'delete', DEMO, { item: { id: 'c' } });
  await run('Register', 'delete', DEMO, { item: { id: 'r' } });
});

test('a non-demo admin is unaffected', async () => {
  await run('User', 'update', ADMIN, { item: { id: 'demo' }, inputData: { password: 'x', email: 'a@b.c', role: {} } });
  await run('User', 'create', ADMIN, { inputData: { name: 'New' } });
  await run('Role', 'update', ADMIN, { item: { id: 'r' }, inputData: { name: 'Y' } });
  await run('Sale', 'delete', ADMIN, { item: { id: 'o' } });
  await run('PaymentProvider', 'update', ADMIN, { item: { id: 'pp' }, inputData: { credentials: { a: 1 } } });
  await run('User', 'update', null, { item: { id: 'x' }, inputData: { password: 'x' } });
});

test('a session without data.email is resolved from the user record', async () => {
  const session = { itemId: 'demo', listKey: 'User' };
  const context = { session, sudo: () => ({ db: { User: { findOne: async () => ({ email: 'Cannabis@Openship.org' }) } } }) };
  await refused(lists.User.hooks.beforeOperation({ listKey: 'User', operation: 'update', context, item: { id: 'demo' }, inputData: { password: 'x' } }));
});

test('no DEMO_USER_EMAILS means no guard', async () => {
  const open = withDemoGuard({ Role: { fields: {} } }, DEMO_GUARD_POLICY, {});
  await open.Role.hooks.beforeOperation({ listKey: 'Role', operation: 'delete', context: { session: DEMO }, item: { id: 'r' } });
});

test('Keystone\'s hook wrapper is rewritten to the exact copy', () => {
  const wrapped = { message: `An error occurred while running "beforeOperation".\n  - StorefrontSettings.hooks.beforeOperation: ${DEMO_GUARD_MESSAGE}`, path: ['updateCannabisStorefrontSetting'] };
  const other = { message: 'Something else' };
  const result = rewriteDemoErrors({ data: { updateCannabisStorefrontSetting: null }, errors: [wrapped, other] });
  assert.equal(result.errors[0].message, DEMO_GUARD_MESSAGE);
  assert.equal(result.errors[0].extensions.code, 'KS_ACCESS_DENIED');
  assert.equal(result.errors[1], other);
});

test('the guard is wired into the Keystone config and the GraphQL route', () => {
  const config = fs.readFileSync(path.join(root, 'features/keystone/index.ts'), 'utf8');
  assert.match(config, /lists: withDemoGuard\(models\)/);
  const route = fs.readFileSync(path.join(root, 'pages/api/graphql.ts'), 'utf8');
  assert.match(route, /useDemoGuardErrors\(\)/);
});
