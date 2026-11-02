import { createHmac, timingSafeEqual } from "node:crypto";

// Authorize.net adapter (shared six-function shape). Card data never reaches this server:
// the browser tokenizes with Accept.js and we receive opaqueData.
// Authorize.net's JSON API mirrors its XML schema, so key order matters:
// merchantAuthentication first, then refId, then the operation body.

type OpaqueData = { dataDescriptor: string; dataValue: string };
type Input = {
  provider?: { credentials?: Record<string, string> };
  amount?: number;
  currency?: string;
  paymentId?: string;
  idempotencyKey?: string;
  cart?: { id?: string };
  order?: { id?: string; orderNumber?: string; displayId?: string | number };
  opaqueData?: OpaqueData;
  captureNow?: boolean;
  rawBody?: string;
  headers?: Record<string, string>;
};

const isProduction = () => process.env.AUTHORIZENET_ENV === "production";
const endpoint = () =>
  isProduction() ? "https://api.authorize.net/xml/v1/request.api" : "https://apitest.authorize.net/xml/v1/request.api";

function merchantAuthentication() {
  const name = process.env.AUTHORIZENET_API_LOGIN_ID;
  const transactionKey = process.env.AUTHORIZENET_TRANSACTION_KEY;
  if (!name || !transactionKey) throw new Error("Authorize.net credentials are not configured");
  return { name, transactionKey };
}

const ref = (value: string) => value.replace(/[^A-Za-z0-9-]/g, "").slice(-20);
const dollars = (minor: number) => (minor / 100).toFixed(2);
const cents = (value: unknown) => Math.round(Number(value) * 100);

async function call(operation: string, body: Record<string, unknown>, refId?: string): Promise<any> {
  const payload = { [operation]: { merchantAuthentication: merchantAuthentication(), ...(refId ? { refId: ref(refId) } : {}), ...body } };
  const response = await fetch(endpoint(), {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Authorize.net HTTP ${response.status}`);
  const result = JSON.parse((await response.text()).replace(/^\uFEFF/, ""));
  return result;
}

function transactionError(result: any) {
  const tx = result?.transactionResponse;
  return tx?.errors?.[0]?.errorText || result?.messages?.message?.[0]?.text || "Authorize.net rejected the transaction";
}

const STATUS: Record<string, string> = {
  authorizedPendingCapture: "authorized",
  capturedPendingSettlement: "succeeded",
  settledSuccessfully: "succeeded",
  refundPendingSettlement: "refunded",
  refundSettledSuccessfully: "refunded",
  voided: "canceled",
  declined: "failed",
  expired: "failed",
  failedReview: "failed",
  generalError: "failed",
  settlementError: "failed",
  communicationError: "unknown",
  underReview: "unknown",
  FDSPendingReview: "unknown",
  FDSAuthorizedPendingReview: "unknown",
};

export function mapTransactionStatus(status: string) {
  return STATUS[status] || "unknown";
}

export function mapWebhookEventType(type: string) {
  if (type === "net.authorize.payment.void.created") return "voided";
  if (type === "net.authorize.payment.refund.created") return "refunded";
  if (type === "net.authorize.payment.authcapture.created" || type === "net.authorize.payment.priorAuthCapture.created") return "succeeded";
  return "unknown";
}

export async function createPaymentFunction({ amount, currency, opaqueData, cart, order, idempotencyKey, captureNow }: Input) {
  if (!Number.isSafeInteger(amount) || (amount as number) <= 0) throw new Error("Invalid payment amount");
  if (String(currency || "").toUpperCase() !== "USD") throw new Error("Authorize.net adapter supports USD only");
  if (!opaqueData) {
    // Session initiation: nothing is created remotely until the browser returns a payment nonce.
    return {
      status: "requires_payment_method",
      amount,
      currency: "USD",
      acceptJs: {
        apiLoginId: process.env.AUTHORIZENET_API_LOGIN_ID || "",
        clientKey: process.env.NEXT_PUBLIC_AUTHORIZENET_CLIENT_KEY || "",
        env: isProduction() ? "production" : "sandbox",
      },
    };
  }
  const invoiceNumber = ref(String(order?.displayId || order?.orderNumber || order?.id || cart?.id || "order"));
  const result = await call(
    "createTransactionRequest",
    {
      transactionRequest: {
        transactionType: captureNow ? "authCaptureTransaction" : "authOnlyTransaction",
        amount: dollars(amount as number),
        payment: { opaqueData },
        order: { invoiceNumber },
      },
    },
    idempotencyKey || cart?.id || order?.id,
  );
  const tx = result.transactionResponse;
  if (result.messages?.resultCode !== "Ok" || tx?.responseCode !== "1" || !tx?.transId || tx.transId === "0") {
    return { status: "failed", amount, currency: "USD", error: transactionError(result) };
  }
  return {
    status: captureNow ? "succeeded" : "authorized",
    paymentIntentId: String(tx.transId),
    amount,
    currency: "USD",
    data: { transId: tx.transId, authCode: tx.authCode, accountNumber: tx.accountNumber, accountType: tx.accountType },
  };
}

export async function capturePaymentFunction({ paymentId, amount, idempotencyKey }: Input) {
  if (!paymentId) throw new Error("Payment reference is required");
  const result = await call(
    "createTransactionRequest",
    { transactionRequest: { transactionType: "priorAuthCaptureTransaction", ...(amount ? { amount: dollars(amount) } : {}), refTransId: paymentId } },
    idempotencyKey || paymentId,
  );
  const tx = result.transactionResponse;
  if (result.messages?.resultCode === "Ok" && tx?.responseCode === "1") {
    return getPaymentStatusFunction({ paymentId });
  }
  // A capture we cannot confirm stays unknown; the caller reconciles via getPaymentStatus.
  return { status: "unknown", error: transactionError(result) };
}

export async function cancelPaymentFunction({ paymentId, idempotencyKey }: Input) {
  if (!paymentId) throw new Error("Payment reference is required");
  const result = await call(
    "createTransactionRequest",
    { transactionRequest: { transactionType: "voidTransaction", refTransId: paymentId } },
    idempotencyKey || `void${paymentId}`,
  );
  const ok = result.messages?.resultCode === "Ok" && result.transactionResponse?.responseCode === "1";
  return { status: ok ? "canceled" : "unknown", error: ok ? undefined : transactionError(result) };
}

export async function refundPaymentFunction({ paymentId, amount, currency, idempotencyKey }: Input) {
  if (!paymentId) throw new Error("Payment reference is required");
  const details = await call("getTransactionDetailsRequest", { transId: paymentId });
  const transaction = details.transaction;
  if (!transaction) throw new Error(transactionError(details));
  const settled = transaction.transactionStatus === "settledSuccessfully";
  if (!settled) {
    // Unsettled transactions cannot be refunded, only voided (full amount).
    const voided = await cancelPaymentFunction({ paymentId, idempotencyKey });
    return { ...voided, status: voided.status === "canceled" ? "refunded" : voided.status, amount: cents(transaction.authAmount), currency: "USD", method: "void" };
  }
  const refundAmount = amount ?? cents(transaction.settleAmount);
  const result = await call(
    "createTransactionRequest",
    {
      transactionRequest: {
        transactionType: "refundTransaction",
        amount: dollars(refundAmount),
        payment: { creditCard: { cardNumber: String(transaction.payment?.creditCard?.cardNumber || "").slice(-4), expirationDate: "XXXX" } },
        refTransId: paymentId,
      },
    },
    idempotencyKey || `refund${paymentId}`,
  );
  const tx = result.transactionResponse;
  const ok = result.messages?.resultCode === "Ok" && tx?.responseCode === "1";
  return { status: ok ? "refunded" : "unknown", amount: refundAmount, currency: currency || "USD", data: tx, error: ok ? undefined : transactionError(result), method: "refund" };
}

export async function getPaymentStatusFunction({ paymentId }: Input) {
  if (!paymentId) throw new Error("Payment reference is required");
  const result = await call("getTransactionDetailsRequest", { transId: paymentId });
  const transaction = result.transaction;
  if (!transaction) return { status: "unknown", error: transactionError(result) };
  const status = mapTransactionStatus(transaction.transactionStatus);
  const amount = status === "authorized" ? cents(transaction.authAmount) : cents(transaction.settleAmount || transaction.authAmount);
  return {
    status,
    amount,
    currency: "USD",
    data: { transId: transaction.transId, transactionStatus: transaction.transactionStatus, authAmount: transaction.authAmount, settleAmount: transaction.settleAmount },
  };
}

export async function generatePaymentLinkFunction({ paymentId }: Input) {
  const host = isProduction() ? "https://account.authorize.net" : "https://sandbox.authorize.net";
  return `${host}/ui/themes/sandbox/Transaction/TransactionReceipt.aspx?transid=${encodeURIComponent(paymentId || "")}`;
}

export async function handleWebhookFunction({ rawBody, headers = {} }: Input) {
  const signatureKey = process.env.AUTHORIZENET_SIGNATURE_KEY;
  if (!signatureKey) throw new Error("Authorize.net webhook signature key is not configured");
  if (!rawBody) throw new Error("Raw webhook body is required");
  const supplied = String(headers["x-anet-signature"] || "").toLowerCase();
  const expected = `sha512=${createHmac("sha512", signatureKey).update(rawBody).digest("hex")}`;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("Webhook signature verification failed");
  const event = JSON.parse(rawBody);
  return { isValid: true, event: { ...event, id: event.notificationId }, type: String(event.eventType || ""), resource: event.payload || {} };
}
