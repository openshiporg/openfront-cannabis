import assert from "node:assert/strict";
import test from "node:test";
import { canMoveTender, customerBlocksSale, FINALIZABLE_CART_STATUSES, RELEASABLE_PAYMENT_STATUSES, tenderStatusForWebhook, tenderStatusFromCapture } from "../features/keystone/domain/lifecycles.ts";
import { assertFinalSaleCartFence } from "../features/keystone/domain/saleConservation.ts";

test("tender moves forward only, and failed or reversed are terminal", () => {
  assert.equal(canMoveTender("authorized", "captured"), true);
  assert.equal(canMoveTender("captured", "reversed"), true);
  assert.equal(canMoveTender("captured", "authorized"), false);
  assert.equal(canMoveTender("captured", "failed"), false);
  assert.equal(canMoveTender("reversed", "captured"), false);
  assert.equal(canMoveTender("failed", "captured"), false);
  assert.equal(canMoveTender("nonsense", "captured"), false);
});

test("a provider 'succeeded' capture is stored as the Tender status 'captured'", () => {
  assert.equal(tenderStatusFromCapture("succeeded"), "captured");
  assert.equal(tenderStatusFromCapture("captured"), "captured");
  assert.throws(() => tenderStatusFromCapture("unknown"));
  assert.throws(() => tenderStatusFromCapture(undefined));
});

test("webhook event names, raw or short, map to a tender status", () => {
  assert.equal(tenderStatusForWebhook("net.authorize.payment.priorAuthCapture.created"), "captured");
  assert.equal(tenderStatusForWebhook("net.authorize.payment.authcapture.created"), "captured");
  assert.equal(tenderStatusForWebhook("transaction_completed"), "captured");
  assert.equal(tenderStatusForWebhook("net.authorize.payment.void.created"), "reversed");
  assert.equal(tenderStatusForWebhook("net.authorize.payment.refund.created"), "reversed");
  assert.equal(tenderStatusForWebhook("net.authorize.payment.fraud.declined"), "failed");
  assert.equal(tenderStatusForWebhook("net.authorize.payment.unknown"), null);
});

test("a packed (staged) order can be sold; one still being picked cannot", () => {
  assert.deepEqual([...FINALIZABLE_CART_STATUSES], ["reserved", "staged"]);
  const cart = { id: "c", version: 3 };
  assert.doesNotThrow(() => assertFinalSaleCartFence({ ...cart, status: "staged" }, { ...cart, status: "staged" }));
  assert.doesNotThrow(() => assertFinalSaleCartFence({ ...cart, status: "reserved" }, { ...cart, status: "reserved" }));
  assert.throws(() => assertFinalSaleCartFence({ ...cart, status: "picking" }, { ...cart, status: "picking" }));
  assert.throws(() => assertFinalSaleCartFence({ ...cart, status: "staged" }, { ...cart, status: "cancelled" }));
  assert.throws(() => assertFinalSaleCartFence({ ...cart, status: "staged" }, { ...cart, version: 4, status: "staged" }));
});

test("a failed card release is retried; a captured or voided one is not", () => {
  assert.ok(RELEASABLE_PAYMENT_STATUSES.includes("authorized"));
  assert.ok(RELEASABLE_PAYMENT_STATUSES.includes("void_failed"));
  assert.ok(!RELEASABLE_PAYMENT_STATUSES.includes("voided"));
  assert.ok(!RELEASABLE_PAYMENT_STATUSES.includes("captured"));
});

test("a suspended or ineligible customer is not served from an old pickup order", () => {
  assert.equal(customerBlocksSale("suspended"), true);
  assert.equal(customerBlocksSale("ineligible"), true);
  assert.equal(customerBlocksSale("pending_verification"), false);
  assert.equal(customerBlocksSale("eligible"), false);
});
