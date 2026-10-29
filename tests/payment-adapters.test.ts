import { test } from "node:test";
import assert from "node:assert/strict";
import { createPaymentFunction as createManual, getPaymentStatusFunction as manualStatus } from "../features/integrations/payment/manual.ts";
import { createPaymentFunction as createAeropay, capturePaymentFunction as captureAeropay, refundPaymentFunction as reverseAeropay, handleWebhookFunction as aeropayWebhook } from "../features/integrations/payment/aeropay.ts";
import { createHmac } from "node:crypto";

test("manual payment remains pending until staff capture", async () => {
  assert.equal((await createManual({ amount: 1234, currency: "USD" })).status, "pending");
  assert.equal((await manualStatus({ paymentId: "terminal-ref" })).status, "pending");
});

test("Aeropay rejects absent credentials and non-USD currency", async () => {
  delete process.env.AEROPAY_API_KEY;
  await assert.rejects(createAeropay({ amount: 123, currency: "USD" }), /not configured/i);
  await assert.rejects(createAeropay({ amount: 123, currency: "CAD" }), /USD/i);
});

test("Aeropay v2 uses the documented token, preauth, capture, and reverse requests", async () => {
  process.env.AEROPAY_API_KEY = "test-key"; process.env.AEROPAY_API_SECRET = "test-secret"; process.env.AEROPAY_MERCHANT_ID = "merchant-1"; process.env.AEROPAY_BANK_ACCOUNT_ID = "bank-9"; process.env.AEROPAY_ENV = "sandbox";
  const originalFetch = globalThis.fetch; const calls: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = (async (input: any, init: RequestInit = {}) => {
    calls.push({ url: String(input), init });
    const payload = calls.length === 1 ? { token: "mock-token", TTL: 1800 } : calls.length === 3 ? { transaction: { id: "preauth-1", amount: { amount: 1234, currency: "USD" }, status: "live" } } : { transaction: { id: "preauth-1", amount: { amount: 1234, currency: "USD" }, status: "reversed" } };
    return new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  try {
    const provider = { id: "p1", code: "pp_aeropay_aeropay", credentials: { bankAccountId: "bank-9" } };
    await createAeropay({ amount: 1234, currency: "USD", idempotencyKey: "key-preauth", provider });
    await captureAeropay({ paymentId: "preauth-1", amount: 1234, currency: "USD", idempotencyKey: "key-capture" });
    await reverseAeropay({ paymentId: "preauth-1", amount: 1234, currency: "USD", idempotencyKey: "key-reverse" });
    assert.deepEqual(calls.map(c => c.url), ["https://api.sandbox-pay.aero.inc/v2/token", "https://api.sandbox-pay.aero.inc/v2/preauthTransaction", "https://api.sandbox-pay.aero.inc/v2/capturePreauthTransaction", "https://api.sandbox-pay.aero.inc/v2/reverseTransaction"]);
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), { apiKey: "test-key", apiSecret: "test-secret", scope: "merchant", id: "merchant-1" });
    assert.deepEqual(JSON.parse(String(calls[1].init.body)), { bankAccountId: "bank-9", merchantId: "merchant-1", amount: { amount: 1234, currency: "USD" }, referenceId: "key-preauth" });
    assert.deepEqual(JSON.parse(String(calls[2].init.body)), { id: "preauth-1" });
    assert.deepEqual(JSON.parse(String(calls[3].init.body)), { id: "preauth-1", amount: { amount: 1234, currency: "USD" } });
    for (const [i, key] of [[1, "key-preauth"], [2, "key-capture"], [3, "key-reverse"]] as const) assert.equal((calls[i].init.headers as Record<string, string>)["Idempotency-Key"], key);
  } finally { globalThis.fetch = originalFetch; }
});

test("Aeropay webhook rejects invalid and accepts valid raw-body signatures", async () => {
  process.env.AEROPAY_WEBHOOK_SECRET = "webhook-secret";
  const rawBody = JSON.stringify({ id: "evt-1", amount: 1234 });
  assert.equal((await aeropayWebhook({ headers: { "x-aeropay-signature": "sha256=00" }, rawBody })).isValid, false);
  const signature = createHmac("sha256", process.env.AEROPAY_WEBHOOK_SECRET).update(rawBody).digest("hex");
  const verified = await aeropayWebhook({ headers: { "x-aeropay-signature": `sha256=${signature}` }, rawBody });
  assert.equal(verified.isValid, true); assert.deepEqual(verified.event, { id: "evt-1", amount: 1234 });
});
