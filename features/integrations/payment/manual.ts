type Input = { amount?: number; currency?: string; paymentId?: string; idempotencyKey?: string };
export async function createPaymentFunction({ amount = 0, currency = "USD" }: Input) {
  return { status: "pending", amount, currency: currency.toUpperCase() };
}
export async function capturePaymentFunction({ amount = 0, paymentId }: Input) {
  if (!paymentId) throw new Error("Staff receipt evidence is required to capture manual payment");
  return { status: "captured", paymentIntentId: paymentId, amount };
}
export async function refundPaymentFunction({ amount = 0, paymentId }: Input) {
  if (!paymentId) throw new Error("Original manual tender is required");
  return { status: "refunded", paymentIntentId: paymentId, amount };
}
export async function getPaymentStatusFunction({ paymentId }: Input) {
  return { status: "pending", paymentIntentId: paymentId };
}
export async function generatePaymentLinkFunction() { return null; }
export async function handleWebhookFunction() { throw new Error("Manual payment providers do not accept webhooks"); }
