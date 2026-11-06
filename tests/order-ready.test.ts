import assert from "node:assert/strict";
import test from "node:test";
import { deliverPickupReadyNotice } from "../features/keystone/utils/orderConfirmation.ts";

const SMTP = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD"];
const configure = (on: boolean) => { for (const key of SMTP) { if (on) process.env[key] = "x"; else delete process.env[key]; } };
function fakeContext(overrides: Record<string, unknown> = {}) {
  const audits: any[] = [];
  const cart = { id: "c1", reference: "PU-1", source: "pickup", status: "staged", pickupName: "Ann", pickupWindowStart: "2026-11-03T18:00:00.000Z", pickupWindowEnd: "2026-11-03T18:30:00.000Z",
    organization: { id: "o" }, premises: { id: "p", name: "Shop", timezone: "America/Denver", addressSnapshot: { line1: "1 Main St", city: "Denver" } }, customer: { contact: { email: "a@b.co", name: "Ann" } }, ...overrides };
  const sudo = { query: {
    AuditEvent: { findMany: async ({ where }: any) => audits.filter(a => a.action === where.action.equals && a.resourceId === where.resourceId.equals), createOne: async ({ data }: any) => { audits.push(data); return { id: "a" }; } },
    Cart: { findOne: async () => cart },
  } };
  return { audits, context: { sudo: () => sudo } };
}

test("staged online order emails the customer once", async () => {
  configure(true);
  const { audits, context } = fakeContext();
  const sent: any[] = [];
  const send = async (order: any) => { sent.push(order); return { sent: true, messageId: "<m1>" }; };
  await deliverPickupReadyNotice(context, "c1", send);
  await deliverPickupReadyNotice(context, "c1", send);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "a@b.co");
  assert.equal(sent[0].reference, "PU-1");
  assert.equal(sent[0].address, "1 Main St, Denver");
  assert.equal(audits.length, 1);
  assert.equal(audits[0].reasonCode, "sent");
  assert.equal(audits[0].evidence.messageId, "<m1>");
});

test("counter carts and unstaged carts get no email", async () => {
  configure(true);
  for (const overrides of [{ source: "pos" }, { status: "picking" }]) {
    const { audits, context } = fakeContext(overrides);
    let calls = 0;
    await deliverPickupReadyNotice(context, "c1", async () => { calls++; return { sent: true }; });
    assert.equal(calls, 0); assert.equal(audits.length, 0);
  }
});

test("missing email or mail settings records a skip; a send failure records failed", async () => {
  configure(true);
  let ctx = fakeContext({ customer: { contact: {} } });
  await deliverPickupReadyNotice(ctx.context, "c1", async () => ({ sent: true }));
  assert.equal(ctx.audits[0].reasonCode, "skipped_no_recipient");
  configure(false);
  ctx = fakeContext();
  await deliverPickupReadyNotice(ctx.context, "c1", async () => ({ sent: true }));
  assert.equal(ctx.audits[0].reasonCode, "skipped_not_configured");
  configure(true);
  ctx = fakeContext();
  await deliverPickupReadyNotice(ctx.context, "c1", async () => ({ sent: false, error: "550 rejected" }));
  assert.equal(ctx.audits[0].reasonCode, "failed");
  assert.equal(ctx.audits[0].evidence.error, "550 rejected");
});
