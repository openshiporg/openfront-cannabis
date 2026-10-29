import { test } from "node:test";
import assert from "node:assert/strict";
import { createPaymentFunction as createManual, getPaymentStatusFunction as manualStatus } from "../features/integrations/payment/manual.ts";
import { createPaymentFunction as createAeropay } from "../features/integrations/payment/aeropay.ts";

test("manual payment remains pending until staff capture", async () => {
  assert.equal((await createManual({ amount: 1234, currency: "USD" })).status, "pending");
  assert.equal((await manualStatus({ paymentId: "terminal-ref" })).status, "pending");
});

test("Aeropay rejects absent credentials and non-USD currency", async () => {
  delete process.env.AEROPAY_API_KEY;
  await assert.rejects(createAeropay({ amount: 123, currency: "USD" }), /not configured/i);
  await assert.rejects(createAeropay({ amount: 123, currency: "CAD" }), /USD/i);
});
