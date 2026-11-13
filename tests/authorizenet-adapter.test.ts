import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { afterEach, test } from "node:test";
import {
  capturePaymentFunction,
  createPaymentFunction,
  getPaymentStatusFunction,
  handleWebhookFunction,
  mapTransactionStatus,
  mapWebhookEventType,
  refundPaymentFunction,
} from "../features/integrations/payment/authorizenet";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  for (const key of ["AUTHORIZENET_API_LOGIN_ID", "AUTHORIZENET_TRANSACTION_KEY", "NEXT_PUBLIC_AUTHORIZENET_CLIENT_KEY", "AUTHORIZENET_SIGNATURE_KEY", "AUTHORIZENET_ENV"]) delete process.env[key];
});
const creds = () => { process.env.AUTHORIZENET_API_LOGIN_ID = "login"; process.env.AUTHORIZENET_TRANSACTION_KEY = "secret"; };
const reply = (body: unknown) => new Response("\uFEFF" + JSON.stringify(body));

test("session initiation returns Accept.js config and makes no remote call", async () => {
  process.env.AUTHORIZENET_API_LOGIN_ID = "login";
  process.env.NEXT_PUBLIC_AUTHORIZENET_CLIENT_KEY = "public";
  let calls = 0;
  globalThis.fetch = (async () => { calls++; throw new Error("unexpected"); }) as typeof fetch;
  const result = await createPaymentFunction({ amount: 1250, currency: "USD" });
  assert.equal(result.status, "requires_payment_method");
  assert.deepEqual((result as any).acceptJs, { apiLoginId: "login", clientKey: "public", env: "test" });
  assert.equal(calls, 0);
});

test("authorization request: merchantAuthentication first, opaque data, test endpoint, BOM tolerated", async () => {
  creds();
  globalThis.fetch = (async (url: any, init: any) => {
    assert.equal(String(url), "https://apitest.authorize.net/xml/v1/request.api");
    assert.equal(init.redirect, "error");
    const body = JSON.parse(init.body);
    const op = body.createTransactionRequest;
    assert.deepEqual(Object.keys(op), ["merchantAuthentication", "refId", "transactionRequest"]);
    assert.equal(op.transactionRequest.transactionType, "authOnlyTransaction");
    assert.equal(op.transactionRequest.amount, "12.50");
    assert.equal(op.transactionRequest.payment.opaqueData.dataValue, "opaque");
    assert.ok(op.refId.length <= 20);
    return reply({ messages: { resultCode: "Ok" }, transactionResponse: { responseCode: "1", transId: "123456", authCode: "ABC" } });
  }) as typeof fetch;
  const result = await createPaymentFunction({ amount: 1250, currency: "USD", opaqueData: { dataDescriptor: "COMMON.ACCEPT.INAPP.PAYMENT", dataValue: "opaque" }, idempotencyKey: "cart:abcdefghijklmnopqrstuvwxyz" });
  assert.equal(result.status, "authorized");
  assert.equal((result as any).paymentIntentId, "123456");
  assert.equal(result.amount, 1250);
});

test("declined authorization is a failure, never a success", async () => {
  creds();
  globalThis.fetch = (async () => reply({ messages: { resultCode: "Error", message: [{ text: "declined" }] }, transactionResponse: { responseCode: "2", transId: "0", errors: [{ errorText: "This transaction has been declined." }] } })) as typeof fetch;
  const result = await createPaymentFunction({ amount: 1250, currency: "USD", opaqueData: { dataDescriptor: "d", dataValue: "v" } });
  assert.equal(result.status, "failed");
  assert.match(String((result as any).error), /declined/);
});

test("non-USD and non-integer amounts are rejected", async () => {
  creds();
  await assert.rejects(createPaymentFunction({ amount: 12.5, currency: "USD" }), /amount/);
  await assert.rejects(createPaymentFunction({ amount: 1250, currency: "EUR" }), /USD/);
});

test("status mapping and amounts in minor units", async () => {
  creds();
  globalThis.fetch = (async (_u: any, init: any) => {
    assert.ok(JSON.parse(init.body).getTransactionDetailsRequest);
    return reply({ messages: { resultCode: "Ok" }, transaction: { transId: "1", transactionStatus: "capturedPendingSettlement", authAmount: "12.50", settleAmount: "12.50" } });
  }) as typeof fetch;
  const status = await getPaymentStatusFunction({ paymentId: "1" });
  assert.equal(status.status, "succeeded");
  assert.equal(status.amount, 1250);
  assert.equal(mapTransactionStatus("authorizedPendingCapture"), "authorized");
  assert.equal(mapTransactionStatus("FDSPendingReview"), "unknown");
  assert.equal(mapTransactionStatus("somethingNew"), "unknown");
});

test("unconfirmed capture is unknown, not succeeded", async () => {
  creds();
  globalThis.fetch = (async () => reply({ messages: { resultCode: "Error", message: [{ text: "timeout" }] } })) as typeof fetch;
  const result = await capturePaymentFunction({ paymentId: "1", amount: 1250 });
  assert.equal(result.status, "unknown");
});

test("refund voids an unsettled transaction", async () => {
  creds();
  const seen: string[] = [];
  globalThis.fetch = (async (_u: any, init: any) => {
    const body = JSON.parse(init.body);
    if (body.getTransactionDetailsRequest) return reply({ messages: { resultCode: "Ok" }, transaction: { transactionStatus: "capturedPendingSettlement", authAmount: "12.50" } });
    seen.push(body.createTransactionRequest.transactionRequest.transactionType);
    return reply({ messages: { resultCode: "Ok" }, transactionResponse: { responseCode: "1", transId: "1" } });
  }) as typeof fetch;
  const result = await refundPaymentFunction({ paymentId: "1", amount: 1250, currency: "USD" });
  assert.deepEqual(seen, ["voidTransaction"]);
  assert.equal(result.status, "refunded");
});

test("Authorize.net webhook void and refund events map to terminal states", () => {
  assert.equal(mapWebhookEventType("net.authorize.payment.void.created"), "voided");
  assert.equal(mapWebhookEventType("net.authorize.payment.refund.created"), "refunded");
  assert.equal(mapWebhookEventType("net.authorize.payment.authcapture.created"), "succeeded");
  assert.equal(mapWebhookEventType("net.authorize.payment.priorAuthCapture.created"), "succeeded");
  assert.equal(mapWebhookEventType("net.authorize.payment.unknown"), "unknown");
});

test("webhook HMAC-SHA512 over the raw body is enforced", async () => {
  const key = "A1B2C3";
  process.env.AUTHORIZENET_SIGNATURE_KEY = key;
  const rawBody = JSON.stringify({ notificationId: "n-1", eventType: "net.authorize.payment.authcapture.created", payload: { id: "123", authAmount: 12.5 } });
  const signature = `sha512=${createHmac("sha512", key).update(rawBody).digest("hex").toUpperCase()}`;
  const verified = await handleWebhookFunction({ rawBody, headers: { "x-anet-signature": signature } });
  assert.equal(verified.type, "net.authorize.payment.authcapture.created");
  assert.equal(verified.event.id, "n-1");
  await assert.rejects(handleWebhookFunction({ rawBody: rawBody + " ", headers: { "x-anet-signature": signature } }), /signature/);
  await assert.rejects(handleWebhookFunction({ rawBody, headers: {} }), /signature/);
});
