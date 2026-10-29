import { createHmac, timingSafeEqual } from "node:crypto";

type Input = { amount?: number; currency?: string; paymentId?: string; idempotencyKey?: string; provider?: { credentials?: Record<string, string> }; headers?: Record<string, string>; rawBody?: string; event?: unknown };
let tokenCache: { scope: string; token: string; expiresAt: number } | undefined;
const configured = () => Boolean(process.env.AEROPAY_API_KEY && process.env.AEROPAY_API_SECRET && process.env.AEROPAY_MERCHANT_ID);
async function token() {
  if (!configured()) throw new Error("Aeropay is not configured");
  const scope = `${process.env.AEROPAY_ENV || "sandbox"}:${process.env.AEROPAY_MERCHANT_ID}`;
  if (tokenCache?.scope === scope && tokenCache.expiresAt > Date.now() + 30_000) return tokenCache.token;
  const response = await fetch(`${base()}/v2/token`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey: process.env.AEROPAY_API_KEY, apiSecret: process.env.AEROPAY_API_SECRET, merchantId: process.env.AEROPAY_MERCHANT_ID }) });
  if (!response.ok) throw new Error("Aeropay authentication failed");
  const result: any = await response.json();
  if (typeof result.token !== "string" || !result.token) throw new Error("Aeropay returned an invalid token");
  tokenCache = { scope, token: result.token, expiresAt: Date.now() + Number(result.expiresIn || 3600) * 1000 };
  return tokenCache.token;
}
const base = () => process.env.AEROPAY_ENV === "production" ? "https://api.aeropay.com" : "https://api.sandbox-pay.aero.inc";
async function request(path: string, body: unknown, key?: string, method = "POST") {
  const bearer = await token();
  const response = await fetch(`${base()}${path}`, { method, headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json", ...(key ? { "Idempotency-Key": key } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), redirect: "error", signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error("Aeropay request failed; reconcile before retrying");
  return response.json() as Promise<any>;
}
function assertMoney(amount: number, currency: string) {
  if (!Number.isSafeInteger(amount) || amount < 0 || currency.toUpperCase() !== "USD") throw new Error("Aeropay requires non-negative integer cents in USD");
}
export async function createPaymentFunction({ amount = 0, currency = "USD", idempotencyKey }: Input) {
  assertMoney(amount, currency); if (!configured()) throw new Error("Aeropay is not configured"); if (!idempotencyKey) throw new Error("Idempotency key is required");
  return request("/v2/preauthTransaction", { merchantId: process.env.AEROPAY_MERCHANT_ID, amount, currency: "USD" }, idempotencyKey);
}
export async function capturePaymentFunction({ paymentId, amount = 0, currency = "USD", idempotencyKey }: Input) {
  assertMoney(amount, currency); if (!paymentId || !idempotencyKey) throw new Error("Preauthorization and idempotency key are required");
  const result = await request("/v2/capturePreauthTransaction", { transactionId: paymentId, amount, currency: "USD" }, idempotencyKey);
  if (result.amount !== undefined && result.amount !== amount) throw new Error("Aeropay capture amount mismatch");
  return result;
}
export async function refundPaymentFunction({ paymentId, amount = 0, currency = "USD", idempotencyKey }: Input) {
  assertMoney(amount, currency); if (!paymentId || !idempotencyKey) throw new Error("Transaction and idempotency key are required");
  return request("/v2/reverseTransaction", { transactionId: paymentId, amount, currency: "USD" }, idempotencyKey);
}
export async function getPaymentStatusFunction({ paymentId }: Input) { if (!paymentId) throw new Error("Transaction is required"); return request(`/v2/transaction/${encodeURIComponent(paymentId)}`, undefined, undefined, "GET"); }
export async function generatePaymentLinkFunction() { return null; }
export async function handleWebhookFunction({ headers = {}, rawBody = "" }: Input) {
  const supplied = headers["x-aeropay-signature"] || headers["X-Aeropay-Signature"] || "";
  const expected = createHmac("sha256", process.env.AEROPAY_WEBHOOK_SECRET || "").update(rawBody).digest("hex");
  const a = Buffer.from(supplied.replace(/^sha256=/i, "").toLowerCase()); const b = Buffer.from(expected);
  const isValid = Boolean(process.env.AEROPAY_WEBHOOK_SECRET) && a.length === b.length && timingSafeEqual(a, b);
  return { isValid, event: isValid ? JSON.parse(rawBody) : null, type: "aeropay", resource: isValid ? JSON.parse(rawBody) : null };
}
