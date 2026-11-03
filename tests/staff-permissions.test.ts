import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../features/keystone/mutations/staffAccess.ts", import.meta.url), "utf8");
const body = source.slice(source.indexOf("export async function changeStaffPermissions"));

test("changing a staff member's permissions is a receipted, audited people-management command", () => {
  assert.match(body, /runControlledOperation\(context, input, \{ permission: "canManagePeople", activity: "authority", scope: "changeStaffPermissions"/);
  assert.match(body, /action: "staff\.permissions\.changed"/);
});

test("no self-change, no owners, premises-scoped, and no granting what the manager lacks", () => {
  assert.match(body, /userId === authority\.actor\.id\) throw new Error\("You cannot change your own permissions"\)/);
  assert.match(body, /target\.role\?\.canManageOnboarding === true\) throw new Error/);
  assert.match(body, /target\.premises\?\.id !== authority\.premisesId\) throw new Error\("Staff member is outside this premises"\)/);
  assert.match(body, /next\.canManageOnboarding = false/);
  assert.match(body, /You can only grant permissions you currently hold/);
});

test("a fresh role is assigned; a shared role is never edited in place", () => {
  assert.match(body, /sudo\.query\.Role\.createOne/);
  assert.doesNotMatch(body, /Role\.updateOne/);
});
