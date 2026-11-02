import assert from "node:assert/strict";
import test from "node:test";
import { ageOnDate, localInstant, pickupSlots } from "../features/keystone/domain/pickupWindows.ts";

test("local instants honour the premises time zone", () => {
  assert.equal(localInstant(2026, 7, 1, 9 * 60, "America/Denver").toISOString(), "2026-07-01T15:00:00.000Z");
  assert.equal(localInstant(2026, 12, 1, 9 * 60, "America/Denver").toISOString(), "2026-12-01T16:00:00.000Z");
});

test("slots start after the lead time and end by closing", () => {
  const now = new Date("2026-11-02T17:00:00.000Z"); // 10:00 in Denver
  const slots = pickupSlots(540, 1320, "America/Denver", now);
  assert.ok(slots.length > 0 && slots.length <= 24);
  assert.ok(new Date(slots[0].start).getTime() >= now.getTime() + 45 * 60_000);
  assert.equal(slots[0].start, "2026-11-02T18:00:00.000Z");
  for (const slot of slots) assert.equal(new Date(slot.end).getTime() - new Date(slot.start).getTime(), 30 * 60_000);
});

test("age is computed from a real calendar date only", () => {
  const now = new Date("2026-11-02T12:00:00.000Z");
  assert.equal(ageOnDate("2005-11-02", now), 21);
  assert.equal(ageOnDate("2005-11-03", now), 20);
  assert.equal(ageOnDate("2005-02-30", now), null);
  assert.equal(ageOnDate("2030-01-01", now), null);
  assert.equal(ageOnDate("nonsense", now), null);
});
