import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../features/keystone/models/Role.ts", import.meta.url), "utf8");

test("Role CRUD is gated on a current canManageRoles grant, not a session snapshot", () => {
  assert.match(source, /const canManageRolesNow = activePermissions\.canManageRoles/);
  assert.match(source, /create: canManageRolesNow, update: canManageRolesNow, delete: canManageRolesNow/);
  assert.doesNotMatch(source, /create: \(\) => false, update: \(\) => false, delete: \(\) => false/);
});

test("generic role edits are organization-scoped, never touch held roles, and cannot assign people or escalate", () => {
  assert.match(source, /\{ assignedTo: \{ none: \{\} \} \}/);
  assert.match(source, /organization: relationship\(\{ ref: "Organization", access: \{ create: \(\) => false, update: \(\) => false \} \}\)/);
  assert.match(source, /assignedTo: relationship\(\{ ref: "User\.role", many: true, access: \{ create: \(\) => false, update: \(\) => false \} \}\)/);
  assert.match(source, /A role cannot grant \$\{permission\}, which you do not currently hold/);
});

test("in-page links are shown only for pages the role's grants open (same map as the sidebar)", async () => {
  const { canOpenPlatformHref } = await import("../features/platform/lib/navigation.ts");
  const compliance = { canManageCompliance: true };
  const cashier = { canManageFinance: true };
  const auditor = { canViewReports: true };
  assert.equal(canOpenPlatformHref("/dashboard/platform/inventory?filter=held", compliance), false);
  assert.equal(canOpenPlatformHref("/dashboard/platform/authority#sales-rules", cashier), false);
  assert.equal(canOpenPlatformHref("/dashboard/platform/staff", auditor), false);
  assert.equal(canOpenPlatformHref("/dashboard/platform/customers/abc", auditor), false);
  assert.equal(canOpenPlatformHref("/dashboard/platform/sales/abc", auditor), false);
  assert.equal(canOpenPlatformHref("/dashboard/platform/audit", auditor), true);
  assert.equal(canOpenPlatformHref("/dashboard/platform/customers/abc", compliance), true);
  assert.equal(canOpenPlatformHref("/dashboard/platform/sales/abc", { canManageSales: true }), true);
  assert.equal(canOpenPlatformHref("/dashboard/platform", {}), true);
});

test("a budtender opens their own shift under the sales grant; the POS offers it in place of a Cash link", () => {
  const ops = fs.readFileSync(new URL("../features/keystone/mutations/operations.ts", import.meta.url), "utf8");
  const open = ops.slice(ops.indexOf("export async function openRegisterShift"), ops.indexOf("export async function closeRegisterShift"));
  assert.match(open, /requireOperationalAuthority\(context, "canManageFinance", "cash"\)/);
  assert.match(open, /permission: "canManageSales" as const, activity: "sale"/);
  assert.match(open, /operator: \{ connect: \{ id: authority\.actor\.id \} \}/, "the shift is always the caller's own");
  const close = ops.slice(ops.indexOf("export async function closeRegisterShift"));
  assert.match(close.slice(0, 1500), /permission: "canManageFinance", activity: "cash", scope: "closeRegisterShift"/, "closing stays with finance");
  const pos = fs.readFileSync(new URL("../features/platform/operations/screens/PrimaryWorkspaces.tsx", import.meta.url), "utf8");
  const posPage = pos.slice(pos.indexOf("export async function PosFulfillmentWorkspacePage"), pos.indexOf("export async function CashWorkspacePage"));
  assert.doesNotMatch(posPage, /href="\/dashboard\/platform\/cash"/);
  assert.match(posPage, /<OpenShiftForm registers=\{data\.registers\} \/>/);
});
