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
