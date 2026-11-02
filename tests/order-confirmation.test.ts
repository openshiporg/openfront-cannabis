import assert from "node:assert/strict";
import test from "node:test";
import { deliverPickupConfirmation } from "../features/keystone/utils/orderConfirmation.ts";

const SMTP = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_STORE_LINK"];
function configure(on: boolean) {
  for (const key of SMTP) { if (on) process.env[key] = key === "SMTP_STORE_LINK" ? "https://shop.test" : "x"; else delete process.env[key]; }
}
function fakeContext() {
  const audits: any[] = [];
  const cart = { pickupWindowStart: "2026-11-03T18:00:00.000Z", pickupWindowEnd: "2026-11-03T18:30:00.000Z", totalCents: 5000, premises: { name: "Shop", timezone: "America/Denver", currencyCode: "USD" }, lines: [{ titleSnapshot: "Flower", quantityMicrounits: 2, totalCents: 5000, product: { unitQuantityMicrounits: 1 } }] };
  const sudo = { query: {
    AuditEvent: { findMany: async ({ where }: any) => audits.filter(a => a.action === where.action.equals && a.resourceId === where.resourceId.equals), createOne: async ({ data }: any) => { audits.push(data); return { id: "a" }; } },
    Cart: { findOne: async () => cart },
  } };
  return { audits, context: { sudo: () => sudo } };
}
const args = { cartId: "c1", reference: "PU-1", proof: "secretproof", scope: { organizationId: "o", premisesId: "p" }, email: "a@b.co", name: "Ann" };

test("sends once on success and records sent with a guest link", async () => {
  configure(true);
  const { audits, context } = fakeContext();
  const sent: any[] = [];
  await deliverPickupConfirmation(context, args, async order => { sent.push(order); return { sent: true }; });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].link, "https://shop.test/order/PU-1#secretproof");
  assert.equal(audits[0].reasonCode, "sent");
  assert.ok(!JSON.stringify(audits[0]).includes("secretproof"));
});

test("a replay does not resend", async () => {
  configure(true);
  const { context } = fakeContext();
  let count = 0;
  const send = async () => { count++; return { sent: true }; };
  await deliverPickupConfirmation(context, args, send);
  await deliverPickupConfirmation(context, args, send);
  assert.equal(count, 1);
});

test("a mail throw never fails the order and is recorded", async () => {
  configure(true);
  const { audits, context } = fakeContext();
  await deliverPickupConfirmation(context, args, async () => { throw new Error("boom"); });
  assert.equal(audits[0].reasonCode, "failed");
});

test("unconfigured mail is recorded as skipped and nothing is sent", async () => {
  configure(false);
  const { audits, context } = fakeContext();
  let count = 0;
  await deliverPickupConfirmation(context, args, async () => { count++; return { sent: true }; });
  assert.equal(count, 0);
  assert.equal(audits[0].reasonCode, "skipped_not_configured");
});

test("bookkeeping failure never throws", async () => {
  configure(false);
  await deliverPickupConfirmation({ sudo: () => { throw new Error("db down"); } }, args);
});
