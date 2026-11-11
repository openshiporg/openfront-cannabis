import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { ageAtPremises, calendarDate, endOfLocalDate } from "../features/keystone/domain/premisesTime.ts";

const DENVER = "America/Denver";

test("a birthday starts at local midnight at the store, not UTC midnight", () => {
  // 2026-11-08 18:30 in Denver is 2026-11-09 01:30 UTC: UTC already says it is the 9th.
  const evening = new Date("2026-11-09T01:30:00.000Z");
  assert.equal(ageAtPremises("2005-11-09", evening, DENVER), 20, "not 21 until the 9th in Denver");
  assert.equal(ageAtPremises("2005-11-09", evening, "UTC"), 21);
  // Next morning in Denver the customer is 21.
  assert.equal(ageAtPremises("2005-11-09", new Date("2026-11-09T15:00:00.000Z"), DENVER), 21);
  // Stored timestamps (UTC midnight of the date) read the same as the date text.
  assert.equal(ageAtPremises(new Date("2005-11-09T00:00:00.000Z"), evening, DENVER), 20);
});

test("only real, past calendar dates count as a date of birth", () => {
  const now = new Date("2026-11-08T18:00:00.000Z");
  assert.equal(ageAtPremises("2005-02-30", now, DENVER), null);
  assert.equal(ageAtPremises("11/08/2005", now, DENVER), null);
  assert.equal(ageAtPremises("2030-01-01", now, DENVER), null);
  assert.equal(calendarDate("2005-11-08")?.text, "2005-11-08");
  assert.equal(calendarDate("2005-11-08T12:00"), null);
});

test("an ID that expires today is good until local midnight at the store", () => {
  const until = endOfLocalDate("2026-11-08", DENVER);
  assert.equal(until.toISOString(), "2026-11-09T07:00:00.000Z");
  assert.ok(until > new Date("2026-11-09T05:00:00.000Z"), "still valid at 10 pm Denver");
});

test("age checks use the premises calendar in every path", () => {
  const read = (path: string) => readFileSync(new URL(`../features/keystone/mutations/${path}`, import.meta.url), "utf8");
  for (const file of ["customers.ts", "commerce.ts", "onlineOrders.ts", "public.ts"]) {
    const source = read(file);
    assert.match(source, /ageAtPremises\(/, `${file} uses the premises-calendar age`);
    assert.doesNotMatch(source, /getUTCFullYear\(\) - /, `${file} has no UTC age arithmetic`);
  }
  assert.doesNotMatch(read("public.ts"), /new Date\(assertText\(input\.dateOfBirth/, "no loose date-of-birth parse");
});

test("expired carts are released on the request that reads them, with no timer", () => {
  assert.equal(existsSync(new URL("../instrumentation.ts", import.meta.url)), false);
  const mutations = (file: string) => readFileSync(new URL(`../features/keystone/mutations/${file}`, import.meta.url), "utf8");
  assert.match(mutations("onlineOrders.ts"), /export async function releaseExpiredOrders/);
  for (const file of ["onlineOrders.ts", "public.ts", "workspace.ts"]) assert.match(mutations(file), /releaseExpiredOrders\(context\)/, `${file} releases lapsed carts on read`);
  assert.doesNotMatch(mutations("onlineOrders.ts"), /setInterval|setTimeout/);
});

test("the database refuses records the commands would refuse", () => {
  const sql = readFileSync(new URL("../migrations/20261108120000_cannabis_record_invariants/migration.sql", import.meta.url), "utf8");
  for (const name of ["InventoryPackage_quantities_check", "InventoryEvent_conservation_check", "Cart_totals_check", "CartLine_totals_check", "Sale_totals_check", "Tender_amounts_check", "Refund_amount_check", "RegisterShift_cash_check", "JurisdictionRulePack_policy_check", "JurisdictionRulePack_one_effective_per_premises_key", "RegisterShift_one_unresolved_per_register_key", "Sale_one_per_cart_key"]) assert.match(sql, new RegExp(`"${name}"`));
  assert.match(sql, /"reservedMicrounits" <= "quantityOnHandMicrounits"/);
  assert.match(sql, /"refundedCents" <= "totalCents"/);
});
