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

test("count correction: only shelf stock, never below zero or below open carts", async () => {
  const { countCorrectionError } = await import("../features/keystone/domain/cannabisPolicy.ts");
  const shelf = { status: "saleable", quantityOnHandMicrounits: 273_000_000, reservedMicrounits: 0 };
  assert.equal(countCorrectionError(shelf, 3_500_000), null);
  assert.equal(countCorrectionError(shelf, -3_500_000), null);
  assert.match(String(countCorrectionError(shelf, 0)), /more or less than zero/);
  assert.match(String(countCorrectionError(shelf, -273_000_001)), /less than zero/);
  assert.match(String(countCorrectionError({ ...shelf, reservedMicrounits: 10_000_000 }, -270_000_000)), /open carts/);
  for (const status of ["recalled", "depleted", "destroyed", "reserved", "in_transit", "waste_pending"]) {
    assert.ok(countCorrectionError({ ...shelf, status }, 1_000_000), status);
  }
});

test("void: only a whole, unrefunded cash sale on an open shift with its packages still shelved", async () => {
  const { saleVoidError } = await import("../features/keystone/domain/lifecycles.ts");
  const sale = { status: "state_queued", refundedCents: 0, shiftStatus: "open", tenderTypes: ["cash"], tenderStatuses: ["received"], packageStatuses: ["saleable"] };
  assert.equal(saleVoidError(sale), null);
  assert.match(String(saleVoidError({ ...sale, status: "reversed" })), /already voided/);
  assert.match(String(saleVoidError({ ...sale, refundedCents: 100, status: "partially_refunded" })), /refund/);
  assert.match(String(saleVoidError({ ...sale, shiftStatus: "closed" })), /still-open shift/);
  assert.match(String(saleVoidError({ ...sale, tenderTypes: ["debit"] })), /card sale/);
  assert.match(String(saleVoidError({ ...sale, packageStatuses: ["depleted"] })), /no longer on the shelf/);
});
