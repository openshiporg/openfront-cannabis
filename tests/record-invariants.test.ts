import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { ageAtPremises, calendarDate, endOfLocalDate } from "../features/keystone/domain/premisesTime.ts";
import { assertEligibility } from "../features/keystone/domain/cannabisPolicy.ts";

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

test("sale finalization reads the stored date of birth (GraphQL ISO timestamp) on the premises calendar", () => {
  // finalizeCannabisSale gets eligibilityEvidence.dateOfBirth from GraphQL as "YYYY-MM-DDT00:00:00.000Z".
  assert.equal(calendarDate("1991-04-17T00:00:00.000Z")?.text, "1991-04-17");
  assert.equal(ageAtPremises("1991-04-17T00:00:00.000Z", new Date("2026-11-12T18:00:00.000Z"), DENVER), 35, "over the age");
  // 2026-11-12 18:30 Denver = 2026-11-13 01:30 UTC; minimum age 21.
  const evening = new Date("2026-11-13T01:30:00.000Z");
  const morning = new Date("2026-11-13T15:00:00.000Z");
  assert.equal(ageAtPremises("2005-11-13T00:00:00.000Z", evening, DENVER), 20, "under: turns 21 tomorrow in Denver though UTC already says the 13th");
  assert.equal(ageAtPremises("2005-11-13T00:00:00.000Z", morning, DENVER), 21, "exactly at: 21 on the birthday at the store");
  assert.equal(ageAtPremises("2005-11-12T00:00:00.000Z", evening, DENVER), 21, "exactly at: birthday today in Denver");
  assert.equal(ageAtPremises("2005-11-14T00:00:00.000Z", morning, DENVER), 20, "under by one day");
  assert.equal(ageAtPremises("2004-11-13T00:00:00.000Z", morning, DENVER), 22, "over");
  // Only a UTC-midnight stored date is read as a date; any other time of day stays invalid.
  assert.equal(calendarDate("1991-04-17T06:00:00.000Z"), null);
  assert.equal(calendarDate("1991-02-30T00:00:00.000Z"), null);
});

test("the sale age gate refuses under-age and admits exactly-at and over", () => {
  const pack = { adultMinimumAge: 21, medicalMinimumAge: 18, medicalEnabled: true } as unknown as Parameters<typeof assertEligibility>[1];
  const morning = new Date("2026-11-13T15:00:00.000Z");
  const gate = (dob: string, now: Date) => assertEligibility({ capacity: "adult_use", age: ageAtPremises(dob, now, DENVER) ?? -1, identityValid: true }, pack);
  assert.throws(() => gate("2005-11-14T00:00:00.000Z", morning), /age requirement/);
  assert.throws(() => gate("2005-11-13T00:00:00.000Z", new Date("2026-11-13T01:30:00.000Z")), /age requirement/);
  assert.doesNotThrow(() => gate("2005-11-13T00:00:00.000Z", morning));
  assert.doesNotThrow(() => gate("1991-04-17T00:00:00.000Z", morning));
  assert.throws(() => gate("not a date", morning), /age requirement/);
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
