"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// features/integrations/payment/manual.ts
var manual_exports = {};
__export(manual_exports, {
  capturePaymentFunction: () => capturePaymentFunction,
  createPaymentFunction: () => createPaymentFunction,
  generatePaymentLinkFunction: () => generatePaymentLinkFunction,
  getPaymentStatusFunction: () => getPaymentStatusFunction,
  handleWebhookFunction: () => handleWebhookFunction,
  refundPaymentFunction: () => refundPaymentFunction
});
async function createPaymentFunction({ amount = 0, currency = "USD" }) {
  return { status: "pending", amount, currency: currency.toUpperCase() };
}
async function capturePaymentFunction({ amount = 0, paymentId }) {
  if (!paymentId) throw new Error("Staff receipt evidence is required to capture manual payment");
  return { status: "captured", paymentIntentId: paymentId, amount, currency: "USD" };
}
async function refundPaymentFunction({ amount = 0, paymentId }) {
  if (!paymentId) throw new Error("Original manual tender is required");
  return { status: "refunded", paymentIntentId: paymentId, amount, currency: "USD" };
}
async function getPaymentStatusFunction({ paymentId }) {
  return { status: "pending", paymentIntentId: paymentId };
}
async function generatePaymentLinkFunction() {
  return null;
}
async function handleWebhookFunction() {
  throw new Error("Manual payment providers do not accept webhooks");
}
var init_manual = __esm({
  "features/integrations/payment/manual.ts"() {
    "use strict";
  }
});

// features/integrations/payment/aeropay.ts
var aeropay_exports = {};
__export(aeropay_exports, {
  capturePaymentFunction: () => capturePaymentFunction2,
  createPaymentFunction: () => createPaymentFunction2,
  generatePaymentLinkFunction: () => generatePaymentLinkFunction2,
  getPaymentStatusFunction: () => getPaymentStatusFunction2,
  handleWebhookFunction: () => handleWebhookFunction2,
  refundPaymentFunction: () => refundPaymentFunction2
});
async function token() {
  if (!configured()) throw new Error("Aeropay is not configured");
  const scope = `${process.env.AEROPAY_ENV || "sandbox"}:merchant:${process.env.AEROPAY_MERCHANT_ID}`;
  if (tokenCache?.scope === scope && tokenCache.expiresAt > Date.now() + 3e4) return tokenCache.token;
  const response = await fetch(`${base()}/v2/token`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey: process.env.AEROPAY_API_KEY, apiSecret: process.env.AEROPAY_API_SECRET, scope: "merchant", id: process.env.AEROPAY_MERCHANT_ID }) });
  if (!response.ok) throw new Error("Aeropay authentication failed");
  const result = await response.json();
  if (typeof result.token !== "string" || !result.token) throw new Error("Aeropay returned an invalid token");
  tokenCache = { scope, token: result.token, expiresAt: Date.now() + Number(result.TTL || 1800) * 1e3 };
  return tokenCache.token;
}
async function request(path, body, key, method = "POST") {
  const bearer = await token();
  const response = await fetch(`${base()}${path}`, { method, headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json", ...key ? { "Idempotency-Key": key } : {} }, ...body === void 0 ? {} : { body: JSON.stringify(body) }, redirect: "error", signal: AbortSignal.timeout(3e4) });
  if (!response.ok) throw new Error("Aeropay request failed; reconcile before retrying");
  return response.json();
}
function assertMoney(amount, currency) {
  if (!Number.isSafeInteger(amount) || amount < 0 || currency.toUpperCase() !== "USD") throw new Error("Aeropay requires non-negative integer cents in USD");
}
async function createPaymentFunction2({ amount = 0, currency = "USD", idempotencyKey, provider }) {
  assertMoney(amount, currency);
  if (!configured()) throw new Error("Aeropay is not configured");
  if (!idempotencyKey) throw new Error("Idempotency key is required");
  const bankAccountId = provider?.credentials?.bankAccountId || process.env.AEROPAY_BANK_ACCOUNT_ID;
  if (!bankAccountId) throw new Error("Aeropay bank account is not configured");
  return request("/v2/preauthTransaction", { bankAccountId, merchantId: process.env.AEROPAY_MERCHANT_ID, amount: { amount, currency: "USD" }, referenceId: idempotencyKey }, idempotencyKey);
}
async function capturePaymentFunction2({ paymentId, amount = 0, currency = "USD", idempotencyKey }) {
  assertMoney(amount, currency);
  if (!paymentId || !idempotencyKey) throw new Error("Preauthorization and idempotency key are required");
  const result = await request("/v2/capturePreauthTransaction", { id: paymentId }, idempotencyKey);
  const capturedAmount = result?.transaction?.amount?.amount ?? result?.amount?.amount ?? result?.amount;
  if (capturedAmount !== void 0 && capturedAmount !== amount) throw new Error("Aeropay capture amount mismatch");
  return { ...result, paymentIntentId: result?.transaction?.id || paymentId, amount: capturedAmount, currency: result?.transaction?.amount?.currency || "USD", status: result?.transaction?.status === "live" ? "captured" : result?.status };
}
async function refundPaymentFunction2({ paymentId, amount = 0, currency = "USD", idempotencyKey }) {
  assertMoney(amount, currency);
  if (!paymentId || !idempotencyKey) throw new Error("Transaction and idempotency key are required");
  const result = await request("/v2/reverseTransaction", { id: paymentId, amount: { amount, currency: "USD" } }, idempotencyKey);
  return { ...result, paymentIntentId: result?.transaction?.id || paymentId, amount: result?.transaction?.amount?.amount ?? amount, currency: result?.transaction?.amount?.currency || "USD", status: result?.transaction?.status === "reversed" ? "refunded" : result?.status };
}
async function getPaymentStatusFunction2({ paymentId }) {
  if (!paymentId) throw new Error("Transaction is required");
  return request(`/v2/transaction/${encodeURIComponent(paymentId)}`, void 0, void 0, "GET");
}
async function generatePaymentLinkFunction2() {
  return null;
}
async function handleWebhookFunction2({ headers = {}, rawBody = "" }) {
  const supplied = headers["x-aeropay-signature"] || headers["X-Aeropay-Signature"] || "";
  const expected = (0, import_node_crypto2.createHmac)("sha256", process.env.AEROPAY_WEBHOOK_SECRET || "").update(rawBody).digest("hex");
  const a = Buffer.from(supplied.replace(/^sha256=/i, "").toLowerCase());
  const b = Buffer.from(expected);
  const isValid = Boolean(process.env.AEROPAY_WEBHOOK_SECRET) && a.length === b.length && (0, import_node_crypto2.timingSafeEqual)(a, b);
  return { isValid, event: isValid ? JSON.parse(rawBody) : null, type: "aeropay", resource: isValid ? JSON.parse(rawBody) : null };
}
var import_node_crypto2, tokenCache, configured, base;
var init_aeropay = __esm({
  "features/integrations/payment/aeropay.ts"() {
    "use strict";
    import_node_crypto2 = require("node:crypto");
    configured = () => Boolean(process.env.AEROPAY_API_KEY && process.env.AEROPAY_API_SECRET && process.env.AEROPAY_MERCHANT_ID);
    base = () => process.env.AEROPAY_ENV === "production" ? "https://api.aeropay.com" : "https://api.sandbox-pay.aero.inc";
  }
});

// features/integrations/payment/authorizenet.ts
var authorizenet_exports = {};
__export(authorizenet_exports, {
  cancelPaymentFunction: () => cancelPaymentFunction,
  capturePaymentFunction: () => capturePaymentFunction3,
  createPaymentFunction: () => createPaymentFunction3,
  generatePaymentLinkFunction: () => generatePaymentLinkFunction3,
  getPaymentStatusFunction: () => getPaymentStatusFunction3,
  handleWebhookFunction: () => handleWebhookFunction3,
  mapTransactionStatus: () => mapTransactionStatus,
  mapWebhookEventType: () => mapWebhookEventType,
  refundPaymentFunction: () => refundPaymentFunction3
});
function merchantAuthentication() {
  const name = process.env.AUTHORIZENET_API_LOGIN_ID;
  const transactionKey = process.env.AUTHORIZENET_TRANSACTION_KEY;
  if (!name || !transactionKey) throw new Error("Authorize.net credentials are not configured");
  return { name, transactionKey };
}
async function call(operation, body, refId) {
  const payload = { [operation]: { merchantAuthentication: merchantAuthentication(), ...refId ? { refId: ref(refId) } : {}, ...body } };
  const response = await fetch(endpoint(), {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(3e4),
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`Authorize.net HTTP ${response.status}`);
  const result = JSON.parse((await response.text()).replace(/^\uFEFF/, ""));
  return result;
}
function transactionError(result) {
  const tx = result?.transactionResponse;
  return tx?.errors?.[0]?.errorText || result?.messages?.message?.[0]?.text || "Authorize.net rejected the transaction";
}
function mapTransactionStatus(status5) {
  return STATUS[status5] || "unknown";
}
function mapWebhookEventType(type) {
  if (type === "net.authorize.payment.void.created") return "voided";
  if (type === "net.authorize.payment.refund.created") return "refunded";
  if (type === "net.authorize.payment.authcapture.created" || type === "net.authorize.payment.priorAuthCapture.created") return "succeeded";
  return "unknown";
}
async function createPaymentFunction3({ amount, currency, opaqueData, cart, order, idempotencyKey, captureNow }) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Invalid payment amount");
  if (String(currency || "").toUpperCase() !== "USD") throw new Error("Authorize.net adapter supports USD only");
  if (!opaqueData) {
    return {
      status: "requires_payment_method",
      amount,
      currency: "USD",
      acceptJs: {
        apiLoginId: process.env.AUTHORIZENET_API_LOGIN_ID || "",
        clientKey: process.env.NEXT_PUBLIC_AUTHORIZENET_CLIENT_KEY || "",
        env: isProduction() ? "production" : "sandbox"
      }
    };
  }
  const invoiceNumber = ref(String(order?.displayId || order?.orderNumber || order?.id || cart?.id || "order"));
  const result = await call(
    "createTransactionRequest",
    {
      transactionRequest: {
        transactionType: captureNow ? "authCaptureTransaction" : "authOnlyTransaction",
        amount: dollars(amount),
        payment: { opaqueData },
        order: { invoiceNumber }
      }
    },
    idempotencyKey || cart?.id || order?.id
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
    data: { transId: tx.transId, authCode: tx.authCode, accountNumber: tx.accountNumber, accountType: tx.accountType }
  };
}
async function capturePaymentFunction3({ paymentId, amount, idempotencyKey }) {
  if (!paymentId) throw new Error("Payment reference is required");
  const result = await call(
    "createTransactionRequest",
    { transactionRequest: { transactionType: "priorAuthCaptureTransaction", ...amount ? { amount: dollars(amount) } : {}, refTransId: paymentId } },
    idempotencyKey || paymentId
  );
  const tx = result.transactionResponse;
  if (result.messages?.resultCode === "Ok" && tx?.responseCode === "1") {
    return getPaymentStatusFunction3({ paymentId });
  }
  return { status: "unknown", error: transactionError(result) };
}
async function cancelPaymentFunction({ paymentId, idempotencyKey }) {
  if (!paymentId) throw new Error("Payment reference is required");
  const result = await call(
    "createTransactionRequest",
    { transactionRequest: { transactionType: "voidTransaction", refTransId: paymentId } },
    idempotencyKey || `void${paymentId}`
  );
  const ok = result.messages?.resultCode === "Ok" && result.transactionResponse?.responseCode === "1";
  return { status: ok ? "canceled" : "unknown", error: ok ? void 0 : transactionError(result) };
}
async function refundPaymentFunction3({ paymentId, amount, currency, idempotencyKey }) {
  if (!paymentId) throw new Error("Payment reference is required");
  const details = await call("getTransactionDetailsRequest", { transId: paymentId });
  const transaction = details.transaction;
  if (!transaction) throw new Error(transactionError(details));
  const settled = transaction.transactionStatus === "settledSuccessfully";
  if (!settled) {
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
        refTransId: paymentId
      }
    },
    idempotencyKey || `refund${paymentId}`
  );
  const tx = result.transactionResponse;
  const ok = result.messages?.resultCode === "Ok" && tx?.responseCode === "1";
  return { status: ok ? "refunded" : "unknown", amount: refundAmount, currency: currency || "USD", data: tx, error: ok ? void 0 : transactionError(result), method: "refund" };
}
async function getPaymentStatusFunction3({ paymentId }) {
  if (!paymentId) throw new Error("Payment reference is required");
  const result = await call("getTransactionDetailsRequest", { transId: paymentId });
  const transaction = result.transaction;
  if (!transaction) return { status: "unknown", error: transactionError(result) };
  const status5 = mapTransactionStatus(transaction.transactionStatus);
  const amount = status5 === "authorized" ? cents(transaction.authAmount) : cents(transaction.settleAmount || transaction.authAmount);
  return {
    status: status5,
    amount,
    currency: "USD",
    data: { transId: transaction.transId, transactionStatus: transaction.transactionStatus, authAmount: transaction.authAmount, settleAmount: transaction.settleAmount }
  };
}
async function generatePaymentLinkFunction3({ paymentId }) {
  const host = isProduction() ? "https://account.authorize.net" : "https://sandbox.authorize.net";
  return `${host}/ui/themes/sandbox/Transaction/TransactionReceipt.aspx?transid=${encodeURIComponent(paymentId || "")}`;
}
async function handleWebhookFunction3({ rawBody, headers = {} }) {
  const signatureKey = process.env.AUTHORIZENET_SIGNATURE_KEY;
  if (!signatureKey) throw new Error("Authorize.net webhook signature key is not configured");
  if (!rawBody) throw new Error("Raw webhook body is required");
  const supplied = String(headers["x-anet-signature"] || "").toLowerCase();
  const expected = `sha512=${(0, import_node_crypto3.createHmac)("sha512", signatureKey).update(rawBody).digest("hex")}`;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !(0, import_node_crypto3.timingSafeEqual)(a, b)) throw new Error("Webhook signature verification failed");
  const event = JSON.parse(rawBody);
  return { isValid: true, event: { ...event, id: event.notificationId }, type: String(event.eventType || ""), resource: event.payload || {} };
}
var import_node_crypto3, isProduction, endpoint, ref, dollars, cents, STATUS;
var init_authorizenet = __esm({
  "features/integrations/payment/authorizenet.ts"() {
    "use strict";
    import_node_crypto3 = require("node:crypto");
    isProduction = () => process.env.AUTHORIZENET_ENV === "production";
    endpoint = () => isProduction() ? "https://api.authorize.net/xml/v1/request.api" : "https://apitest.authorize.net/xml/v1/request.api";
    ref = (value) => value.replace(/[^A-Za-z0-9-]/g, "").slice(-20);
    dollars = (minor) => (minor / 100).toFixed(2);
    cents = (value) => Math.round(Number(value) * 100);
    STATUS = {
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
      FDSAuthorizedPendingReview: "unknown"
    };
  }
});

// features/keystone/lib/email-layout.ts
function storeNameFromEnv(fallback = "Cannabis") {
  const match = /^\s*"?([^"<]+?)"?\s*</.exec(process.env.SMTP_FROM || "");
  return match?.[1]?.trim() || fallback;
}
function emailButton(label, href) {
  return `<table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin:8px 0 24px;">
<tr><td class="em-btn" align="center" bgcolor="${C.button}" style="border-radius:8px;background:${C.button};">
<a class="em-btn-a" href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:16px;font-weight:600;line-height:20px;color:${C.buttonText};text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a>
</td></tr></table>`;
}
function emailPanel(html, align = "left") {
  return `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:0 0 20px;">
<tr><td class="em-panel" align="${align}" bgcolor="${C.panel}" style="padding:16px 18px;background:${C.panel};border:1px solid ${C.line};border-radius:8px;font-family:${FONT};font-size:15px;line-height:22px;color:${C.text};">${html}</td></tr></table>`;
}
function emailItems(items) {
  const rows = items.map(
    (item) => `<tr>
<td class="em-line" style="padding:14px 0;border-bottom:1px solid ${C.line};font-family:${FONT};vertical-align:top;">
<div class="em-text" style="font-size:15px;line-height:21px;font-weight:600;color:${C.text};">${escapeHtml(item.title)}</div>
<div class="em-muted" style="font-size:13px;line-height:19px;color:${C.muted};">${[item.detail, `Qty ${item.quantity}`].filter(Boolean).map(escapeHtml).join(" \xB7 ")}</div>
</td>
<td class="em-line em-text" align="right" style="padding:14px 0 14px 12px;border-bottom:1px solid ${C.line};font-family:${FONT};font-size:15px;line-height:21px;color:${C.text};vertical-align:top;white-space:nowrap;">${escapeHtml(item.amount || "")}</td>
</tr>`
  ).join("");
  return `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:0 0 8px;border-top:1px solid ${C.line};" class="em-line">${rows}</table>`;
}
function emailTotals(rows) {
  const last = rows.length - 1;
  const body = rows.map((row, i) => {
    const strong = i === last;
    const style = strong ? `padding:12px 0 0;border-top:1px solid ${C.line};font-size:17px;line-height:24px;font-weight:700;color:${C.text};` : `padding:4px 0;font-size:14px;line-height:20px;color:${C.muted};`;
    const cls = strong ? "em-line em-text" : "em-muted";
    return `<tr><td class="${cls}" style="font-family:${FONT};${style}">${escapeHtml(row.label)}</td><td class="${cls}" align="right" style="font-family:${FONT};${style}white-space:nowrap;">${escapeHtml(row.value)}</td></tr>`;
  }).join("");
  return `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:8px 0 8px;">${body}</table>`;
}
function emailLayout(input) {
  const store = escapeHtml(input.storeName || storeNameFromEnv());
  const support = escapeHtml(input.supportEmail || SUPPORT_EMAIL);
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(input.title)}</title>
<style>
:root { color-scheme: light dark; supported-color-schemes: light dark; }
body { margin:0; padding:0; -webkit-text-size-adjust:100%; }
a { color:${C.link}; }
@media (max-width: 620px) { .em-pad { padding-left:20px !important; padding-right:20px !important; } }
@media (prefers-color-scheme: dark) {
  .em-canvas { background:#09090b !important; }
  .em-card { background:#18181b !important; border-color:#27272a !important; }
  .em-text { color:#fafafa !important; }
  .em-muted { color:#a1a1aa !important; }
  .em-line { border-color:#3f3f46 !important; }
  .em-panel { background:#27272a !important; border-color:#3f3f46 !important; color:#fafafa !important; }
  .em-btn { background:#fafafa !important; }
  .em-btn-a { color:#18181b !important; }
  .em-link { color:#fafafa !important; }
}
[data-ogsc] .em-text { color:#fafafa !important; }
[data-ogsc] .em-muted { color:#a1a1aa !important; }
[data-ogsb] .em-canvas { background:#09090b !important; }
[data-ogsb] .em-card { background:#18181b !important; }
</style>
</head>
<body class="em-canvas" style="margin:0;padding:0;background:${C.canvas};">
${input.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(input.preheader)}</div>` : ""}
<table role="presentation" class="em-canvas" width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="${C.canvas}" style="background:${C.canvas};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;">
<tr><td class="em-pad" style="padding:8px 32px 20px;font-family:${FONT};font-size:18px;line-height:24px;font-weight:700;letter-spacing:-0.01em;"><span class="em-text" style="color:${C.text};">${store}</span></td></tr>
<tr><td class="em-card" bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.line};border-radius:12px;">
<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
<tr><td class="em-pad" style="padding:32px 32px 16px;">
<h1 class="em-text" style="margin:0 0 16px;font-family:${FONT};font-size:24px;line-height:32px;font-weight:700;letter-spacing:-0.02em;color:${C.text};">${escapeHtml(input.title)}</h1>
${input.body}
</td></tr>
</table>
</td></tr>
<tr><td class="em-pad" style="padding:20px 32px 8px;font-family:${FONT};font-size:13px;line-height:20px;color:${C.subtle};">
<span class="em-muted" style="color:${C.subtle};">${input.footerNote ? `${input.footerNote}<br>` : ""}Questions? Email <a class="em-link" href="mailto:${support}" style="color:${C.muted};text-decoration:underline;">${support}</a>.<br>${store}</span>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
var SUPPORT_EMAIL, FONT, C, escapeHtml, p, emailParagraph, emailMuted;
var init_email_layout = __esm({
  "features/keystone/lib/email-layout.ts"() {
    "use strict";
    SUPPORT_EMAIL = "hello@cannabis.openship.org";
    FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
    C = {
      canvas: "#f4f4f5",
      card: "#ffffff",
      text: "#18181b",
      muted: "#52525b",
      subtle: "#71717a",
      line: "#e4e4e7",
      panel: "#fafafa",
      button: "#18181b",
      buttonText: "#ffffff",
      link: "#18181b"
    };
    escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    p = (html, style = "") => `<p class="em-text" style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:24px;color:${C.text};${style}">${html}</p>`;
    emailParagraph = p;
    emailMuted = (html) => `<p class="em-muted" style="margin:0 0 16px;font-family:${FONT};font-size:14px;line-height:22px;color:${C.muted};">${html}</p>`;
  }
});

// features/keystone/lib/orderMail.ts
var orderMail_exports = {};
__export(orderMail_exports, {
  sendPickupOrderConfirmationEmail: () => sendPickupOrderConfirmationEmail,
  sendPickupOrderReadyEmail: () => sendPickupOrderReadyEmail
});
function pickupMailTransport() {
  const port = Number(process.env.SMTP_PORT);
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Email delivery is not configured");
  return (0, import_nodemailer.createTransport)({ host: process.env.SMTP_HOST, port, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } });
}
async function sendPickupOrderConfirmationEmail(order) {
  if (!order.to) return { sent: false, error: "no_recipient" };
  try {
    const rows = order.lines.map((line) => `<tr><td style="padding:4px 0">${escapeHtml(line.title)} \xD7 ${line.units}</td><td align="right" style="padding:4px 0">${escapeHtml(line.total)}</td></tr>`).join("");
    const info = await pickupMailTransport().sendMail({
      to: order.to,
      from: process.env.SMTP_FROM,
      subject: `Your order ${order.reference} at ${order.storeName}`,
      html: emailLayout({
        storeName: order.storeName,
        preheader: `Order ${order.reference}: pickup ${order.whenLabel}`,
        title: "We have your order",
        body: `${emailParagraph(`Thanks ${escapeHtml(order.name)}. Order <strong>${escapeHtml(order.reference)}</strong> at ${escapeHtml(order.storeName)}.`)}
${emailPanel(`Pickup: ${escapeHtml(order.whenLabel)}`)}
${emailItems(order.lines.map((line) => ({ title: line.title, quantity: line.units, amount: line.total })))}
${emailTotals([{ label: "Total", value: order.total }])}
${emailButton("View or cancel your order", order.link)}
${emailMuted("Bring a valid government ID to pickup.")}`
      })
    });
    return { sent: true, messageId: typeof info?.messageId === "string" ? info.messageId : void 0, response: typeof info?.response === "string" ? info.response : void 0 };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : "send_failed" };
  }
}
async function sendPickupOrderReadyEmail(order) {
  if (!order.to) return { sent: false, error: "no_recipient" };
  try {
    const info = await pickupMailTransport().sendMail({
      to: order.to,
      from: process.env.SMTP_FROM,
      subject: `Order ${order.reference} is ready for pickup at ${order.storeName}`,
      html: emailLayout({
        storeName: order.storeName,
        preheader: `Order ${order.reference} is ready for pickup`,
        title: `${order.name ? `${order.name}, your` : "Your"} order is ready`,
        body: `${emailParagraph(`Order <strong>${escapeHtml(order.reference)}</strong> is packed and waiting at ${escapeHtml(order.storeName)}${order.address ? `, ${escapeHtml(order.address)}` : ""}.`)}
${emailPanel(`Pickup: ${escapeHtml(order.whenLabel)}`)}
${emailParagraph("Bring the valid government ID you ordered with. The name on the ID must match the order.")}
${emailMuted("Use the link in your order confirmation email to view or cancel the order.")}`
      })
    });
    return { sent: true, messageId: typeof info?.messageId === "string" ? info.messageId : void 0, response: typeof info?.response === "string" ? info.response : void 0 };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : "send_failed" };
  }
}
var import_nodemailer;
var init_orderMail = __esm({
  "features/keystone/lib/orderMail.ts"() {
    "use strict";
    import_nodemailer = require("nodemailer");
    init_email_layout();
  }
});

// features/keystone/utils/orderConfirmation.ts
var orderConfirmation_exports = {};
__export(orderConfirmation_exports, {
  deliverPickupConfirmation: () => deliverPickupConfirmation,
  deliverPickupReadyNotice: () => deliverPickupReadyNotice
});
async function deliverPickupConfirmation(context, args, send) {
  try {
    const sudo = context.sudo();
    const existing = await sudo.query.AuditEvent.findMany({ where: { action: { equals: "cart.confirmation_email" }, resourceId: { equals: args.cartId } }, take: 1, query: "id" });
    if (existing.length) return;
    let status5 = "skipped_not_configured";
    let error;
    let messageId;
    let response;
    const base2 = process.env.SMTP_STORE_LINK;
    if (process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASSWORD && base2) {
      try {
        const cart = await sudo.query.Cart.findOne({ where: { id: args.cartId }, query: "pickupWindowStart pickupWindowEnd totalCents premises { name timezone currencyCode } lines(take: 50) { titleSnapshot quantityMicrounits totalCents product { unitQuantityMicrounits } }" });
        const zone = cart.premises?.timezone || "UTC";
        const currency = cart.premises?.currencyCode || "USD";
        const money = (cents2) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format((cents2 || 0) / 100);
        const when = (value) => new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
        const end = new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(cart.pickupWindowEnd));
        const deliver = send || (await Promise.resolve().then(() => (init_orderMail(), orderMail_exports))).sendPickupOrderConfirmationEmail;
        const result = await deliver({
          to: args.email,
          storeName: cart.premises?.name || "Our store",
          reference: args.reference,
          name: args.name,
          whenLabel: `${when(cart.pickupWindowStart)} to ${end}`,
          lines: (cart.lines || []).map((line) => ({ title: line.titleSnapshot, units: Math.round(line.quantityMicrounits / (line.product?.unitQuantityMicrounits || line.quantityMicrounits)), total: money(line.totalCents) })),
          total: money(cart.totalCents),
          link: `${base2.replace(/\/$/, "")}/order/${encodeURIComponent(args.reference)}#${encodeURIComponent(args.proof)}`
        });
        status5 = result.sent ? "sent" : "failed";
        error = result.error;
        messageId = result.messageId;
        response = result.response;
      } catch (caught) {
        status5 = "failed";
        error = caught instanceof Error ? caught.message : "send_failed";
      }
    }
    await sudo.query.AuditEvent.createOne({ data: {
      organization: { connect: { id: args.scope.organizationId } },
      premises: { connect: { id: args.scope.premisesId } },
      action: "cart.confirmation_email",
      resourceType: "Cart",
      resourceId: args.cartId,
      correlationId: args.reference,
      reasonCode: status5,
      evidence: { status: status5, ...messageId ? { messageId: messageId.slice(0, 200) } : {}, ...response ? { smtpResponse: response.slice(0, 300) } : {}, ...error ? { error: error.slice(0, 200) } : {} },
      evidenceHash: (0, import_node_crypto9.createHash)("sha256").update(`${args.reference}:${status5}`).digest("hex"),
      occurredAt: /* @__PURE__ */ new Date()
    }, query: "id" });
  } catch (caught) {
    console.error("Order confirmation email bookkeeping failed:", caught instanceof Error ? caught.message : "unknown");
  }
}
async function deliverPickupReadyNotice(context, cartId, send) {
  try {
    const sudo = context.sudo();
    const cart = await sudo.query.Cart.findOne({ where: { id: cartId }, query: "id reference source status pickupName pickupWindowStart pickupWindowEnd organization { id } premises { id name timezone addressSnapshot } customer { contact }" });
    if (!cart || cart.source !== "pickup" || cart.status !== "staged" || !cart.organization?.id || !cart.premises?.id) return;
    const prior = await sudo.query.AuditEvent.findMany({ where: { action: { equals: "cart.ready_email" }, resourceId: { equals: cartId } }, take: 1, query: "id" });
    if (prior.length) return;
    const record = (status5, evidence = {}) => sudo.query.AuditEvent.createOne({ data: {
      organization: { connect: { id: cart.organization.id } },
      premises: { connect: { id: cart.premises.id } },
      action: "cart.ready_email",
      resourceType: "Cart",
      resourceId: cartId,
      correlationId: cart.reference,
      reasonCode: status5,
      evidence: { status: status5, ...evidence },
      evidenceHash: (0, import_node_crypto9.createHash)("sha256").update(`${cart.reference}:ready:${status5}`).digest("hex"),
      occurredAt: /* @__PURE__ */ new Date()
    }, query: "id" });
    const contact = cart.customer?.contact || {};
    const to = typeof contact.email === "string" ? contact.email : "";
    if (!to) {
      await record("skipped_no_recipient");
      return;
    }
    if (!(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASSWORD)) {
      await record("skipped_not_configured");
      return;
    }
    const zone = cart.premises.timezone || "UTC";
    const when = (value) => new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
    const end = cart.pickupWindowEnd ? new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(cart.pickupWindowEnd)) : "";
    const address = cart.premises.addressSnapshot && typeof cart.premises.addressSnapshot === "object" ? [cart.premises.addressSnapshot.line1, cart.premises.addressSnapshot.city].filter(Boolean).join(", ") : "";
    let result;
    try {
      const deliver = send || (await Promise.resolve().then(() => (init_orderMail(), orderMail_exports))).sendPickupOrderReadyEmail;
      result = await deliver({
        to,
        storeName: cart.premises.name || "Our store",
        reference: cart.reference,
        name: cart.pickupName || (typeof contact.name === "string" ? contact.name : ""),
        whenLabel: cart.pickupWindowStart ? `${when(cart.pickupWindowStart)}${end ? ` to ${end}` : ""}` : "during store hours",
        address
      });
    } catch (caught) {
      result = { sent: false, error: caught instanceof Error ? caught.message : "send_failed" };
    }
    await record(result.sent ? "sent" : "failed", { ...result.messageId ? { messageId: result.messageId.slice(0, 200) } : {}, ...result.response ? { smtpResponse: result.response.slice(0, 300) } : {}, ...result.error ? { error: result.error.slice(0, 200) } : {} });
  } catch (caught) {
    console.error("Order ready email bookkeeping failed:", caught instanceof Error ? caught.message : "unknown");
  }
}
var import_node_crypto9;
var init_orderConfirmation = __esm({
  "features/keystone/utils/orderConfirmation.ts"() {
    "use strict";
    import_node_crypto9 = require("node:crypto");
  }
});

// keystone.ts
var keystone_exports = {};
__export(keystone_exports, {
  default: () => keystone_default2
});
module.exports = __toCommonJS(keystone_exports);

// features/keystone/lib/s3-storage.ts
function s3ForcePathStyle(endpoint2) {
  let hostname = "";
  try {
    hostname = endpoint2 ? new URL(endpoint2).hostname : "";
  } catch {
  }
  return !(hostname === "storageapi.dev" || hostname.endsWith(".storageapi.dev"));
}

// features/keystone/index.ts
var import_auth = require("@keystone-6/auth");
var import_core8 = require("@keystone-6/core");
var import_config = require("dotenv/config");

// features/keystone/models/User.ts
var import_core = require("@keystone-6/core");
var import_access = require("@keystone-6/core/access");
var import_fields2 = require("@keystone-6/core/fields");

// features/keystone/access.ts
function isSignedIn({ session }) {
  return Boolean(session?.itemId) && session?.data.status !== "disabled";
}
var sessionPermission = (session, permission) => session?.data.status !== "disabled" && session?.data.role?.[permission] === true;
async function freshActor({ session, context }) {
  if (!session?.itemId || !context || session.data.status === "disabled") return null;
  const actor = await context.sudo().query.User.findOne({
    where: { id: session.itemId },
    query: `id status onboardingStatus organization { id } premises { id } role {
      canManagePeople canManageRoles canAccessDashboard canManageOnboarding canManageAuthority
      canManageCompliance canManageInventory canManageSales canManageFinance canManageIntegrations canViewReports
    } staffCredential { id status effectiveAt expiresAt user { id } organization { id } premises { id } }`
  });
  if (!actor || actor.status !== "active") return null;
  if (actor.organization?.id !== session.data.organization?.id || actor.premises?.id !== session.data.premises?.id) return null;
  for (const permission of permissionNames) {
    if (sessionPermission(session, permission) && actor.role?.[permission] !== true) return null;
  }
  return actor;
}
function hasCurrentCredential(actor) {
  const credential = actor?.staffCredential;
  const now = Date.now();
  return Boolean(credential && credential.status === "active" && new Date(credential.effectiveAt).getTime() <= now && new Date(credential.expiresAt).getTime() > now && credential.user?.id === actor.id && actor.organization?.id && credential.organization?.id === actor.organization.id && actor.premises?.id && credential.premises?.id === actor.premises.id);
}
var permissionNames = [
  "canManagePeople",
  "canManageRoles",
  "canAccessDashboard",
  "canManageOnboarding",
  "canManageAuthority",
  "canManageCompliance",
  "canManageInventory",
  "canManageSales",
  "canManageFinance",
  "canManageIntegrations",
  "canViewReports"
];
var permissions = Object.fromEntries(
  permissionNames.map((permission) => [permission, ({ session }) => sessionPermission(session, permission)])
);
var activePermissions = Object.fromEntries(
  permissionNames.map((permission) => [permission, async (args) => (await freshActor(args))?.role?.[permission] === true])
);
var operationalPermissions = Object.fromEntries(
  permissionNames.map((permission) => [permission, async (args) => {
    const actor = await freshActor(args);
    return actor?.role?.canAccessDashboard === true && actor.role?.[permission] === true && hasCurrentCredential(actor);
  }])
);
async function canManageScopedPeople(args) {
  const actor = await freshActor(args);
  if (!actor?.organization?.id || !actor?.premises?.id || actor.role?.canManagePeople !== true) return false;
  return !args.item || args.item.premisesId === actor.premises.id;
}
function organizationId(session) {
  return session?.data.organization?.id || null;
}
function premisesId(session) {
  return session?.data.premises?.id || null;
}
function organizationFilter({ session }) {
  const id = organizationId(session);
  return id ? { organization: { id: { equals: id } } } : false;
}
function organizationSelfFilter({ session }) {
  const id = organizationId(session);
  return id ? { id: { equals: id } } : false;
}
function premisesFilter({ session }) {
  const organization = organizationId(session);
  const premises = premisesId(session);
  return organization && premises ? { organization: { id: { equals: organization } }, premises: { id: { equals: premises } } } : false;
}
function immutableTenantAccess(read) {
  return {
    operation: { query: activePermissions[read], create: () => false, update: () => false, delete: () => false },
    filter: { query: organizationFilter }
  };
}
function immutableOrganizationAccess(read) {
  return {
    operation: { query: activePermissions[read], create: () => false, update: () => false, delete: () => false },
    filter: { query: organizationSelfFilter }
  };
}
function immutablePremisesAccess(read, purpose = "operational") {
  const query = purpose === "authority" ? activePermissions[read] : operationalPermissions[read];
  return {
    operation: { query, create: () => false, update: () => false, delete: () => false },
    filter: { query: premisesFilter }
  };
}
function isBootstrapActor(actor) {
  return !actor.organization?.id && !actor.premises?.id && actor.onboardingStatus !== "completed" && actor.role?.canAccessDashboard === true && actor.role?.canManageOnboarding === true;
}
function freshOrganizationFilter(actor) {
  return actor.organization?.id ? { organization: { id: { equals: actor.organization.id } } } : false;
}
function freshSelfFilter(actor) {
  const organization = freshOrganizationFilter(actor);
  return organization ? { AND: [{ id: { equals: actor.id } }, organization] } : false;
}
async function peopleFilter(args) {
  const actor = await freshActor(args);
  if (!actor) return false;
  if (isBootstrapActor(actor)) return {
    AND: [
      { id: { equals: actor.id } },
      { status: { equals: "active" } },
      { organization: null },
      { premises: null }
    ]
  };
  if (actor.role?.canManagePeople === true && actor.organization?.id && actor.premises?.id) {
    return { AND: [{ organization: { id: { equals: actor.organization.id } } }, { premises: { id: { equals: actor.premises.id } } }] };
  }
  return freshSelfFilter(actor);
}
async function roleQueryFilter(args) {
  const actor = await freshActor(args);
  if (!actor) return false;
  if (isBootstrapActor(actor)) return {
    AND: [
      { organization: null },
      { assignedTo: { some: { id: { equals: actor.id } } } }
    ]
  };
  return freshOrganizationFilter(actor);
}
var rules = {
  canReadPeople: peopleFilter,
  canUpdatePeople: peopleFilter
};

// features/keystone/models/trackingFields.ts
var import_fields = require("@keystone-6/core/fields");
var trackingFields = {
  createdAt: (0, import_fields.timestamp)({
    access: { read: () => true, create: () => false, update: () => false },
    defaultValue: { kind: "now" },
    validation: { isRequired: true },
    ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } }
  }),
  updatedAt: (0, import_fields.timestamp)({
    access: { read: () => true, create: () => false, update: () => false },
    db: { updatedAt: true },
    defaultValue: { kind: "now" },
    validation: { isRequired: true },
    ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } }
  })
};

// features/keystone/models/User.ts
var authorityFieldUI = { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } };
var scopedPeopleUI = { itemView: { fieldMode: async (args) => await canManageScopedPeople(args) ? "edit" : "read" } };
var User = (0, import_core.list)({
  access: {
    operation: { query: isSignedIn, create: () => false, update: isSignedIn, delete: () => false },
    filter: { query: rules.canReadPeople, update: rules.canUpdatePeople }
  },
  fields: {
    name: (0, import_fields2.text)({ validation: { isRequired: true } }),
    email: (0, import_fields2.text)({ isIndexed: "unique", validation: { isRequired: true }, isFilterable: false, isOrderable: false }),
    password: (0, import_fields2.password)({ access: { read: import_access.denyAll, update: async (args) => args.session?.itemId === args.item.id || await canManageScopedPeople(args) }, validation: { isRequired: true, length: { min: 10, max: 1e3 }, rejectCommon: true } }),
    status: (0, import_fields2.select)({ ui: scopedPeopleUI, access: { update: canManageScopedPeople }, type: "enum", options: [{ label: "Active", value: "active" }, { label: "Disabled", value: "disabled" }], defaultValue: "active", validation: { isRequired: true } }),
    organization: (0, import_fields2.relationship)({ ui: authorityFieldUI, ref: "Organization.users", access: { create: import_access.denyAll, update: import_access.denyAll } }),
    premises: (0, import_fields2.relationship)({ ui: authorityFieldUI, ref: "Premises.users", access: { create: import_access.denyAll, update: import_access.denyAll } }),
    role: (0, import_fields2.relationship)({ ui: authorityFieldUI, ref: "Role.assignedTo", access: { create: import_access.denyAll, update: import_access.denyAll } }),
    mfaMethod: (0, import_fields2.text)({ ui: authorityFieldUI, access: { create: import_access.denyAll, update: import_access.denyAll } }),
    mfaVerifiedAt: (0, import_fields2.timestamp)({ ui: authorityFieldUI, access: { create: import_access.denyAll, update: import_access.denyAll } }),
    staffCredential: (0, import_fields2.relationship)({ ui: authorityFieldUI, ref: "StaffCredential.user", access: { create: import_access.denyAll, update: import_access.denyAll } }),
    customerProfile: (0, import_fields2.relationship)({ ui: authorityFieldUI, ref: "Customer.user", access: { create: import_access.denyAll, update: import_access.denyAll } }),
    onboardingStatus: (0, import_fields2.select)({ ui: scopedPeopleUI, access: { update: canManageScopedPeople }, type: "enum", options: [
      { label: "Not Started", value: "not_started" },
      { label: "In Progress", value: "in_progress" },
      { label: "Completed", value: "completed" },
      { label: "Dismissed", value: "dismissed" }
    ], defaultValue: "not_started", validation: { isRequired: true } }),
    ...trackingFields
  }
});

// features/keystone/models/Role.ts
var import_core2 = require("@keystone-6/core");
var import_fields3 = require("@keystone-6/core/fields");
var capability = (label) => (0, import_fields3.checkbox)({ defaultValue: false, label });
var canManageRolesNow = activePermissions.canManageRoles;
async function callerOrganizationId(context) {
  const userId = context.session?.itemId;
  if (!userId) return null;
  const user = await context.sudo().query.User.findOne({ where: { id: userId }, query: "organization { id } role { " + permissionNames.join(" ") + " }" });
  return user ? { organizationId: user.organization?.id ?? null, role: user.role ?? {} } : null;
}
async function manageableRoleFilter(args) {
  const caller = await callerOrganizationId(args.context);
  if (!caller?.organizationId) return false;
  return { AND: [{ organization: { id: { equals: caller.organizationId } } }, { assignedTo: { none: {} } }] };
}
var Role = (0, import_core2.list)({
  access: {
    operation: { query: activePermissions.canAccessDashboard, create: canManageRolesNow, update: canManageRolesNow, delete: canManageRolesNow },
    filter: { query: roleQueryFilter, update: manageableRoleFilter, delete: manageableRoleFilter }
  },
  hooks: {
    resolveInput: {
      create: async ({ resolvedData, context }) => {
        if (!context.session?.itemId || resolvedData.organization) return resolvedData;
        const caller = await callerOrganizationId(context);
        if (!caller?.organizationId) throw new Error("An organization assignment is required");
        return { ...resolvedData, organization: { connect: { id: caller.organizationId } } };
      }
    },
    validate: {
      create: validateGrants,
      update: validateGrants
    }
  },
  fields: {
    organization: (0, import_fields3.relationship)({ ref: "Organization", access: { create: () => false, update: () => false } }),
    name: (0, import_fields3.text)({ validation: { isRequired: true } }),
    canManagePeople: capability("Manage staff and customer identities"),
    canManageRoles: capability("Manage roles"),
    canAccessDashboard: capability("Access operator dashboard"),
    canManageOnboarding: capability("Install an owner-approved authority pack"),
    canManageAuthority: capability("Manage license, premises, and staff authority"),
    canManageCompliance: capability("Manage eligibility, rules, holds, recalls, and incidents"),
    canManageInventory: capability("Manage regulated package custody"),
    canManageSales: capability("Operate carts, POS, and fulfillment"),
    canManageFinance: capability("Manage tenders, refunds, shifts, and cash"),
    canManageIntegrations: capability("Manage external provider queues"),
    canViewReports: capability("View audits and reconciliation"),
    assignedTo: (0, import_fields3.relationship)({ ref: "User.role", many: true, access: { create: () => false, update: () => false } }),
    ...trackingFields
  }
});
async function validateGrants({ operation, inputData, item, resolvedData, context, addValidationError }) {
  if (!context.session?.itemId || operation === "create" && inputData?.organization) return;
  const caller = await callerOrganizationId(context);
  for (const permission of permissionNames) {
    if (resolvedData[permission] === true && caller?.role?.[permission] !== true) {
      addValidationError(`A role cannot grant ${permission}, which you do not currently hold`);
    }
  }
}

// features/keystone/models/Authority.ts
var import_core3 = require("@keystone-6/core");
var import_fields4 = require("@keystone-6/core/fields");
var import_access4 = require("@keystone-6/core/access");

// features/keystone/utils/storeLogo.ts
var ALLOWED_ELEMENTS = /* @__PURE__ */ new Set([
  "svg",
  "g",
  "path",
  "defs",
  "lineargradient",
  "radialgradient",
  "stop",
  "clippath",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "title",
  "desc"
]);
var ALLOWED_ATTRIBUTES = /* @__PURE__ */ new Set([
  "xmlns",
  "fill",
  "fill-rule",
  "clip-rule",
  "height",
  "width",
  "viewbox",
  "d",
  "clip-path",
  "id",
  "x1",
  "x2",
  "y1",
  "y2",
  "gradientunits",
  "gradienttransform",
  "offset",
  "stop-color",
  "stop-opacity",
  "opacity",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "x",
  "y",
  "transform",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "points",
  "role",
  "aria-hidden",
  "aria-label",
  "preserveaspectratio"
]);
var ATTRIBUTE_PATTERN = /\s+([A-Za-z_:][\w:.-]*)\s*=\s*("[^"]*"|'[^']*')/g;
var TAG_PATTERN = /<\/?\s*([A-Za-z][\w:-]*)([^<>]*)>/g;
function sanitizeStoreLogoSvg(svg) {
  const source = svg.trim();
  if (!source.startsWith("<svg") || !source.endsWith("</svg>") || source.length > 1e5) {
    return "";
  }
  if (/<!|<\?|\b(?:javascript|data|vbscript):|\bon[a-z]+\s*=|\b(?:href|src|style)\s*=/i.test(source)) {
    return "";
  }
  let tagCount = 0;
  let match;
  TAG_PATTERN.lastIndex = 0;
  while (match = TAG_PATTERN.exec(source)) {
    tagCount += 1;
    const element = match[1].toLowerCase();
    if (!ALLOWED_ELEMENTS.has(element)) return "";
    if (match[0].startsWith("</")) continue;
    const attributes = match[2];
    let consumed = "";
    ATTRIBUTE_PATTERN.lastIndex = 0;
    let attributeMatch;
    while (attributeMatch = ATTRIBUTE_PATTERN.exec(attributes)) {
      consumed += attributeMatch[0];
      const attribute = attributeMatch[1].toLowerCase();
      const value = attributeMatch[2].slice(1, -1);
      if (!ALLOWED_ATTRIBUTES.has(attribute)) return "";
      if (attribute === "id" && !/^[A-Za-z_][\w:.-]*$/.test(value)) return "";
      if (/url\(/i.test(value) && !/^url\(#[A-Za-z_][\w:.-]*\)$/.test(value)) return "";
    }
    const remainder = attributes.replace(consumed, "").replace(/\//g, "").trim();
    if (remainder) return "";
  }
  TAG_PATTERN.lastIndex = 0;
  if (tagCount === 0 || source.replace(TAG_PATTERN, "").trim()) return "";
  return source;
}

// features/platform/store-settings/lib/store-logo.ts
var DEFAULT_STORE_LOGO_ICON = '<svg fill="none" height="100%" viewBox="0 0 38 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#155eef"><path d="m25.0008 24c0 3.3137-2.6863 6-6 6s-6-2.6863-6-6 2.6863-6 6-6 6 2.6863 6 6z"/><path d="m25.0008 10c0 3.3137-2.6863 6-6 6s-6-2.6863-6-6c0-3.31371 2.6863-6 6-6s6 2.68629 6 6z"/><path d="m37.125 31c0 3.3137-2.6863 6-6 6s-6-2.6863-6-6 2.6863-6 6-6 6 2.6863 6 6z"/><path d="m37.127 17.0002c0 3.3137-2.6863 6-6 6-3.3138 0-6-2.6863-6-6s2.6862-6 6-6c3.3137 0 6 2.6863 6 6z"/><path d="m25.0008 38c0 3.3137-2.6863 6-6 6s-6-2.6863-6-6 2.6863-6 6-6 6 2.6863 6 6z"/><path d="m12.877 17c0 3.3137-2.6863 6-6.00005 6-3.31371 0-5.999997-2.6863-5.999997-6s2.686287-6 5.999997-6c3.31375 0 6.00005 2.6863 6.00005 6z"/><path d="m12.875 30.9997c0 3.3137-2.6863 6-6 6-3.31371 0-6-2.6863-6-6s2.68629-6 6-6c3.3137 0 6 2.6863 6 6z"/></g></svg>';
var DEFAULT_STORE_LOGO_COLOR = "270";
function normalizeStoreLogoColor(value) {
  const numeric = Number.parseFloat(String(value ?? DEFAULT_STORE_LOGO_COLOR));
  if (!Number.isFinite(numeric)) return DEFAULT_STORE_LOGO_COLOR;
  return String((numeric % 360 + 360) % 360);
}

// features/keystone/models/Authority.ts
var status = (values, defaultValue) => (0, import_fields4.select)({
  type: "enum",
  options: values.map((value) => ({ label: value.replaceAll("_", " "), value })),
  ...defaultValue ? { defaultValue } : {},
  validation: { isRequired: true }
});
var org = () => (0, import_fields4.relationship)({ ref: "Organization" });
var site = () => (0, import_fields4.relationship)({ ref: "Premises" });
var Organization = (0, import_core3.list)({
  access: immutableOrganizationAccess("canManageAuthority"),
  fields: {
    name: (0, import_fields4.text)({ validation: { isRequired: true } }),
    legalName: (0, import_fields4.text)({ validation: { isRequired: true } }),
    status: status(["pending_authority", "active", "suspended", "closed"], "pending_authority"),
    jurisdictionCode: (0, import_fields4.text)({ validation: { isRequired: true }, isIndexed: true }),
    premises: (0, import_fields4.relationship)({ ref: "Premises.organization", many: true }),
    storefrontSettings: (0, import_fields4.relationship)({ ref: "StorefrontSettings.organization", many: true }),
    users: (0, import_fields4.relationship)({ ref: "User.organization", many: true }),
    ...trackingFields
  }
});
var Premises = (0, import_core3.list)({
  graphql: { plural: "CannabisPremises" },
  // The dashboard derives GraphQL names from the UI plural; "Premises" alone would equal the list key and fail every list.
  ui: { plural: "Cannabis Premises" },
  access: immutableTenantAccess("canManageAuthority"),
  fields: {
    organization: (0, import_fields4.relationship)({ ref: "Organization.premises" }),
    name: (0, import_fields4.text)({ validation: { isRequired: true } }),
    premisesCode: (0, import_fields4.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    addressSnapshot: (0, import_fields4.json)({ defaultValue: {} }),
    timezone: (0, import_fields4.text)({ validation: { isRequired: true } }),
    // ISO 4217 code for every amount recorded at this premises; null on premises installed before it was captured.
    currencyCode: (0, import_fields4.text)({ db: { isNullable: true }, validation: { match: { regex: /^[A-Z]{3}$/, explanation: "Currency must be a three-letter ISO 4217 code" } } }),
    status: status(["pending_authority", "active", "suspended", "closed"], "pending_authority"),
    users: (0, import_fields4.relationship)({ ref: "User.premises", many: true }),
    storefrontSettings: (0, import_fields4.relationship)({ ref: "StorefrontSettings.premises", many: true }),
    ...trackingFields
  }
});
var StorefrontSettings = (0, import_core3.list)({
  graphql: { plural: "CannabisStorefrontSettings" },
  // As for Premises: the UI plural must map to the GraphQL plural, not to the list key.
  ui: { plural: "Cannabis Storefront Settings" },
  access: immutablePremisesAccess("canManageAuthority", "authority"),
  db: {
    extendPrismaSchema(schema) {
      return schema.replace(/\n}/, '\n  @@unique([organizationId, premisesId], map: "StorefrontSettings_authority_scope_key")\n}');
    }
  },
  fields: {
    organization: (0, import_fields4.relationship)({
      ref: "Organization.storefrontSettings",
      access: { create: import_access4.denyAll, update: import_access4.denyAll },
      graphql: { isNonNull: { read: true } },
      db: { extendPrismaSchema: (field) => field.replace(/organization Organization\?/g, "organization Organization").replace(/organizationId String\?/g, "organizationId String") }
    }),
    premises: (0, import_fields4.relationship)({
      ref: "Premises.storefrontSettings",
      access: { create: import_access4.denyAll, update: import_access4.denyAll },
      graphql: { isNonNull: { read: true } },
      db: { extendPrismaSchema: (field) => field.replace(/premises Premises\?/g, "premises Premises").replace(/premisesId String\?/g, "premisesId String") }
    }),
    businessName: (0, import_fields4.text)({ validation: { isRequired: true, length: { min: 1, max: 120 } } }),
    tagline: (0, import_fields4.text)({ validation: { length: { max: 180 } } }),
    description: (0, import_fields4.text)({ validation: { length: { max: 240 } }, ui: { displayMode: "textarea" } }),
    brandHue: (0, import_fields4.integer)({ defaultValue: 215, validation: { isRequired: true, min: 0, max: 359 } }),
    // Restaurant StoreSettings lineage: enforce SVG allowlist even through sudo model writes.
    logoIcon: (0, import_fields4.text)({ defaultValue: DEFAULT_STORE_LOGO_ICON, hooks: {
      resolveInput: ({ resolvedData, fieldKey }) => {
        const value = resolvedData[fieldKey];
        return value === void 0 || value === null || value === "" ? value : typeof value === "string" ? sanitizeStoreLogoSvg(value) : "";
      },
      validate: ({ inputData, resolvedData, fieldKey, addValidationError }) => {
        const submitted = inputData?.[fieldKey];
        if (typeof submitted === "string" && submitted.trim() && !resolvedData?.[fieldKey]) addValidationError("Logo must be a valid, safe SVG document");
      }
    } }),
    logoColor: (0, import_fields4.text)({ defaultValue: DEFAULT_STORE_LOGO_COLOR, hooks: {
      resolveInput: ({ resolvedData, fieldKey }) => resolvedData[fieldKey] === void 0 ? void 0 : normalizeStoreLogoColor(resolvedData[fieldKey])
    } }),
    // Storefront cover photo, set through setCannabisStorefrontCover. Empty shows the built-in cover.
    heroImage: (0, import_fields4.image)({ storage: "my_images", label: "Cover photo" }),
    publicationStatus: status(["draft", "published"], "draft"),
    storefrontMode: status(["demo", "configured"], "configured"),
    demoCatalog: (0, import_fields4.json)({ defaultValue: [] }),
    ...trackingFields
  }
});
var CannabisLicense = (0, import_core3.list)({
  access: immutablePremisesAccess("canManageAuthority", "authority"),
  fields: {
    organization: org(),
    premises: site(),
    licenseNumber: (0, import_fields4.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    licenseType: (0, import_fields4.text)({ validation: { isRequired: true } }),
    regulatorName: (0, import_fields4.text)({ validation: { isRequired: true } }),
    authorizedActivities: (0, import_fields4.json)({ defaultValue: [] }),
    status: status(["draft", "active", "conditioned", "suspended", "expired", "revoked", "surrendered"], "draft"),
    effectiveAt: (0, import_fields4.timestamp)({ validation: { isRequired: true } }),
    expiresAt: (0, import_fields4.timestamp)({ validation: { isRequired: true } }),
    verifiedAt: (0, import_fields4.timestamp)(),
    authorityReference: (0, import_fields4.text)({ validation: { isRequired: true } }),
    ...trackingFields
  }
});
var StaffCredential = (0, import_core3.list)({
  access: immutablePremisesAccess("canManageAuthority", "authority"),
  fields: {
    organization: org(),
    premises: site(),
    user: (0, import_fields4.relationship)({ ref: "User.staffCredential" }),
    credentialType: (0, import_fields4.text)({ validation: { isRequired: true } }),
    credentialReference: (0, import_fields4.text)({ validation: { isRequired: true } }),
    allowedActivities: (0, import_fields4.json)({ defaultValue: [] }),
    approvalLimitCents: (0, import_fields4.integer)({ defaultValue: 0, validation: { min: 0 } }),
    status: status(["pending", "active", "suspended", "expired", "terminated"], "pending"),
    effectiveAt: (0, import_fields4.timestamp)({ validation: { isRequired: true } }),
    expiresAt: (0, import_fields4.timestamp)({ validation: { isRequired: true } }),
    trainingVerifiedAt: (0, import_fields4.timestamp)(),
    authorityVerifiedAt: (0, import_fields4.timestamp)(),
    evidenceHash: (0, import_fields4.text)({ validation: { isRequired: true } }),
    ...trackingFields
  }
});
var Customer = (0, import_core3.list)({
  access: immutablePremisesAccess("canManageCompliance"),
  fields: {
    organization: org(),
    premises: site(),
    user: (0, import_fields4.relationship)({ ref: "User.customerProfile" }),
    reference: (0, import_fields4.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    capacity: status(["adult_use", "patient", "caregiver"]),
    status: status(["pending_verification", "eligible", "ineligible", "suspended"], "pending_verification"),
    marketingConsent: (0, import_fields4.checkbox)({ defaultValue: false }),
    intakeProofHash: (0, import_fields4.text)({ isFilterable: false, isOrderable: false, access: { read: import_access4.denyAll, create: import_access4.denyAll, update: import_access4.denyAll } }),
    contact: (0, import_fields4.json)({ access: { read: operationalPermissions.canManageCompliance, create: import_access4.denyAll, update: import_access4.denyAll } }),
    ...trackingFields
  }
});
var EligibilityEvidence = (0, import_core3.list)({
  access: immutablePremisesAccess("canManageCompliance"),
  fields: {
    organization: org(),
    premises: site(),
    customer: (0, import_fields4.relationship)({ ref: "Customer" }),
    capacity: status(["adult_use", "patient", "caregiver"]),
    identityMethod: (0, import_fields4.text)({ validation: { isRequired: true } }),
    identityReferenceHash: (0, import_fields4.text)({ validation: { isRequired: true } }),
    dateOfBirth: (0, import_fields4.timestamp)({ validation: { isRequired: true } }),
    identityExpiresAt: (0, import_fields4.timestamp)({ validation: { isRequired: true } }),
    registryName: (0, import_fields4.text)(),
    registryReferenceHash: (0, import_fields4.text)(),
    registryVerifiedAt: (0, import_fields4.timestamp)(),
    registryExpiresAt: (0, import_fields4.timestamp)(),
    representedPatientReferenceHash: (0, import_fields4.text)(),
    allotmentRemainingMicrounits: (0, import_fields4.integer)({ validation: { min: 0 } }),
    result: status(["pending", "eligible", "ineligible", "expired", "revoked"], "pending"),
    reasonCodes: (0, import_fields4.json)({ defaultValue: [] }),
    evidenceHash: (0, import_fields4.text)({ validation: { isRequired: true } }),
    verifiedAt: (0, import_fields4.timestamp)(),
    ...trackingFields
  }
});
var JurisdictionRulePack = (0, import_core3.list)({
  access: immutablePremisesAccess("canManageCompliance", "authority"),
  fields: {
    organization: org(),
    premises: site(),
    version: (0, import_fields4.text)({ validation: { isRequired: true } }),
    jurisdictionCode: (0, import_fields4.text)({ validation: { isRequired: true } }),
    authorityCitations: (0, import_fields4.json)({ defaultValue: [] }),
    policyHash: (0, import_fields4.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    status: status(["draft", "approved", "effective", "superseded", "revoked"], "draft"),
    effectiveAt: (0, import_fields4.timestamp)({ validation: { isRequired: true } }),
    expiresAt: (0, import_fields4.timestamp)({ validation: { isRequired: true } }),
    approvedAt: (0, import_fields4.timestamp)(),
    approvedBy: (0, import_fields4.relationship)({ ref: "User" }),
    adultMinimumAge: (0, import_fields4.integer)({ validation: { min: 0, max: 120, isRequired: true } }),
    medicalMinimumAge: (0, import_fields4.integer)({ validation: { min: 0, max: 120, isRequired: true } }),
    operatingStartMinute: (0, import_fields4.integer)({ validation: { min: 0, max: 1439, isRequired: true } }),
    operatingEndMinute: (0, import_fields4.integer)({ validation: { min: 0, max: 1439, isRequired: true } }),
    purchaseLimits: (0, import_fields4.json)({ defaultValue: [] }),
    taxRules: (0, import_fields4.json)({ defaultValue: [] }),
    discountRules: (0, import_fields4.json)({ defaultValue: [] }),
    allowedTenderTypes: (0, import_fields4.json)({ defaultValue: [] }),
    labelRequirements: (0, import_fields4.json)({ defaultValue: [] }),
    returnRules: (0, import_fields4.json)({ defaultValue: {} }),
    outagePolicy: (0, import_fields4.json)({ defaultValue: {} }),
    privacyRules: (0, import_fields4.json)({ defaultValue: {} }),
    retentionRules: (0, import_fields4.json)({ defaultValue: {} }),
    medicalEnabled: (0, import_fields4.checkbox)({ defaultValue: false }),
    pickupEnabled: (0, import_fields4.checkbox)({ defaultValue: false }),
    deliveryEnabled: (0, import_fields4.checkbox)({ defaultValue: false }),
    offlineSalesAllowed: (0, import_fields4.checkbox)({ defaultValue: false }),
    ...trackingFields
  }
});

// features/keystone/models/Inventory.ts
var import_core4 = require("@keystone-6/core");
var import_fields5 = require("@keystone-6/core/fields");
var status2 = (values, defaultValue) => (0, import_fields5.select)({ type: "enum", options: values.map((value) => ({ label: value.replaceAll("_", " "), value })), ...defaultValue ? { defaultValue } : {}, validation: { isRequired: true } });
var org2 = () => (0, import_fields5.relationship)({ ref: "Organization" });
var site2 = () => (0, import_fields5.relationship)({ ref: "Premises" });
var Product = (0, import_core4.list)({
  access: immutablePremisesAccess("canManageInventory"),
  fields: {
    organization: org2(),
    premises: site2(),
    sku: (0, import_fields5.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    name: (0, import_fields5.text)({ validation: { isRequired: true } }),
    brand: (0, import_fields5.text)(),
    form: (0, import_fields5.text)({ validation: { isRequired: true } }),
    categoryCode: (0, import_fields5.text)({ validation: { isRequired: true } }),
    unitOfMeasure: (0, import_fields5.text)({ validation: { isRequired: true } }),
    unitQuantityMicrounits: (0, import_fields5.integer)({ validation: { min: 1, isRequired: true } }),
    equivalencyMicrounits: (0, import_fields5.integer)({ validation: { min: 1, isRequired: true } }),
    priceCents: (0, import_fields5.integer)({ validation: { min: 0, isRequired: true } }),
    taxCategoryCode: (0, import_fields5.text)({ validation: { isRequired: true } }),
    adultUseEligible: (0, import_fields5.checkbox)({ defaultValue: false }),
    medicalEligible: (0, import_fields5.checkbox)({ defaultValue: false }),
    status: status2(["draft", "active", "inactive"], "draft"),
    publicDescription: (0, import_fields5.text)(),
    publicImageUrl: (0, import_fields5.text)(),
    // Set only through amendCannabisProduct (the list is read-only), shown on the public menu and product page.
    photo: (0, import_fields5.image)({ storage: "my_images", label: "Photo" }),
    packages: (0, import_fields5.relationship)({ ref: "InventoryPackage.product", many: true }),
    ...trackingFields
  }
});
var InventoryPackage = (0, import_core4.list)({
  access: immutablePremisesAccess("canManageInventory"),
  fields: {
    organization: org2(),
    premises: site2(),
    product: (0, import_fields5.relationship)({ ref: "Product.packages" }),
    packageUid: (0, import_fields5.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    sourcePackageUid: (0, import_fields5.text)(),
    productionBatchNumber: (0, import_fields5.text)({ validation: { isRequired: true } }),
    lotNumber: (0, import_fields5.text)({ validation: { isRequired: true } }),
    quantityReceivedMicrounits: (0, import_fields5.integer)({ validation: { min: 1, isRequired: true } }),
    quantityOnHandMicrounits: (0, import_fields5.integer)({ validation: { min: 0, isRequired: true } }),
    reservedMicrounits: (0, import_fields5.integer)({ defaultValue: 0, validation: { min: 0 } }),
    unitOfMeasure: (0, import_fields5.text)({ validation: { isRequired: true } }),
    status: status2(["expected_inbound", "receiving_hold", "quarantined", "saleable", "reserved", "staged", "transfer_allocated", "in_transit", "waste_pending", "recalled", "depleted", "destroyed"], "expected_inbound"),
    testStatus: status2(["unknown", "pending", "passed", "failed", "retest"], "unknown"),
    labName: (0, import_fields5.text)(),
    labResultReference: (0, import_fields5.text)(),
    coaReference: (0, import_fields5.text)(),
    labVerifiedAt: (0, import_fields5.timestamp)(),
    manufacturedAt: (0, import_fields5.timestamp)(),
    receivedAt: (0, import_fields5.timestamp)(),
    expiresAt: (0, import_fields5.timestamp)({ validation: { isRequired: true } }),
    releasedAt: (0, import_fields5.timestamp)(),
    labelVersion: (0, import_fields5.text)({ validation: { isRequired: true } }),
    potencySnapshot: (0, import_fields5.json)({ defaultValue: {} }),
    lineage: (0, import_fields5.json)({ defaultValue: [] }),
    version: (0, import_fields5.integer)({ defaultValue: 1, validation: { min: 1 } }),
    holds: (0, import_fields5.relationship)({ ref: "PackageHold.package", many: true }),
    events: (0, import_fields5.relationship)({ ref: "InventoryEvent.package", many: true }),
    ...trackingFields
  }
});
var PackageHold = (0, import_core4.list)({
  access: immutablePremisesAccess("canManageCompliance"),
  fields: {
    organization: org2(),
    premises: site2(),
    package: (0, import_fields5.relationship)({ ref: "InventoryPackage.holds" }),
    type: status2(["quarantine", "test_hold", "recall", "discrepancy", "authority", "expiry"]),
    status: status2(["active", "released", "disposed"], "active"),
    reasonCode: (0, import_fields5.text)({ validation: { isRequired: true } }),
    reason: (0, import_fields5.text)({ validation: { isRequired: true } }),
    placedBy: (0, import_fields5.relationship)({ ref: "User" }),
    placedAt: (0, import_fields5.timestamp)({ validation: { isRequired: true } }),
    releasedBy: (0, import_fields5.relationship)({ ref: "User" }),
    releasedAt: (0, import_fields5.timestamp)(),
    releaseAuthorityReference: (0, import_fields5.text)(),
    evidenceHash: (0, import_fields5.text)({ validation: { isRequired: true } }),
    ...trackingFields
  }
});
var RegulatedManifest = (0, import_core4.list)({
  access: immutablePremisesAccess("canManageInventory"),
  fields: {
    organization: org2(),
    premises: site2(),
    manifestNumber: (0, import_fields5.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    type: status2(["receiving", "transfer_out", "transfer_in", "count", "adjustment", "waste", "destruction", "recall"]),
    status: status2(["proposed", "manifested", "receiving_hold", "accepted", "partially_accepted", "rejected", "dispatched", "in_transit", "completed", "reconciled"], "proposed"),
    sourceLicenseNumber: (0, import_fields5.text)(),
    destinationLicenseNumber: (0, import_fields5.text)(),
    transporterReference: (0, import_fields5.text)(),
    regulatorManifestId: (0, import_fields5.text)(),
    occurredAt: (0, import_fields5.timestamp)({ validation: { isRequired: true } }),
    completedAt: (0, import_fields5.timestamp)(),
    reasonCode: (0, import_fields5.text)({ validation: { isRequired: true } }),
    evidence: (0, import_fields5.json)({ defaultValue: {} }),
    evidenceHash: (0, import_fields5.text)({ validation: { isRequired: true } }),
    actor: (0, import_fields5.relationship)({ ref: "User" }),
    approvedBy: (0, import_fields5.relationship)({ ref: "User" }),
    packageEvents: (0, import_fields5.relationship)({ ref: "InventoryEvent.manifest", many: true }),
    ...trackingFields
  }
});
var InventoryEvent = (0, import_core4.list)({
  access: immutablePremisesAccess("canManageInventory"),
  fields: {
    organization: org2(),
    premises: site2(),
    package: (0, import_fields5.relationship)({ ref: "InventoryPackage.events" }),
    manifest: (0, import_fields5.relationship)({ ref: "RegulatedManifest.packageEvents" }),
    eventType: status2(["receive", "release", "reserve", "release_reservation", "sale", "return_quarantine", "transfer_out", "transfer_in", "count", "adjustment", "waste", "destruction", "recall_hold", "recall_release"]),
    quantityDeltaMicrounits: (0, import_fields5.integer)({ validation: { isRequired: true } }),
    beforeQuantityMicrounits: (0, import_fields5.integer)({ validation: { min: 0, isRequired: true } }),
    afterQuantityMicrounits: (0, import_fields5.integer)({ validation: { min: 0, isRequired: true } }),
    reasonCode: (0, import_fields5.text)({ validation: { isRequired: true } }),
    actor: (0, import_fields5.relationship)({ ref: "User" }),
    approvedBy: (0, import_fields5.relationship)({ ref: "User" }),
    sourceType: (0, import_fields5.text)({ validation: { isRequired: true } }),
    sourceId: (0, import_fields5.text)({ validation: { isRequired: true }, isIndexed: true }),
    idempotencyKey: (0, import_fields5.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    occurredAt: (0, import_fields5.timestamp)({ validation: { isRequired: true } }),
    evidenceHash: (0, import_fields5.text)({ validation: { isRequired: true } }),
    stateReportStatus: status2(["local_recorded", "queued", "accepted", "rejected", "reconciled"], "local_recorded"),
    ...trackingFields
  }
});
var RecallCase = (0, import_core4.list)({
  access: immutablePremisesAccess("canManageCompliance"),
  fields: {
    organization: org2(),
    premises: site2(),
    reference: (0, import_fields5.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    status: status2(["suspected", "hold", "scope_confirmed", "active", "monitoring", "disposition", "regulator_closed"], "suspected"),
    authorityReference: (0, import_fields5.text)({ validation: { isRequired: true } }),
    packageUids: (0, import_fields5.json)({ defaultValue: [] }),
    batchNumbers: (0, import_fields5.json)({ defaultValue: [] }),
    reason: (0, import_fields5.text)({ validation: { isRequired: true } }),
    openedAt: (0, import_fields5.timestamp)({ validation: { isRequired: true } }),
    closedAt: (0, import_fields5.timestamp)(),
    evidenceHash: (0, import_fields5.text)({ validation: { isRequired: true } }),
    ...trackingFields
  }
});

// features/keystone/models/PaymentProvider.ts
var import_core5 = require("@keystone-6/core");
var import_fields6 = require("@keystone-6/core/fields");
var PaymentProvider = (0, import_core5.list)({
  access: { operation: { query: permissions.canManageFinance, create: permissions.canManageFinance, update: permissions.canManageFinance, delete: permissions.canManageFinance } },
  fields: {
    name: (0, import_fields6.text)({ validation: { isRequired: true } }),
    code: (0, import_fields6.text)({ isIndexed: "unique", validation: { isRequired: true, match: { regex: /^pp_[a-zA-Z0-9_-]+$/, explanation: "Payment provider code must start with pp_" } } }),
    isInstalled: (0, import_fields6.checkbox)({ defaultValue: false }),
    credentials: (0, import_fields6.json)({ defaultValue: {} }),
    metadata: (0, import_fields6.json)({ defaultValue: {} }),
    createPaymentFunction: (0, import_fields6.text)({ validation: { isRequired: true } }),
    capturePaymentFunction: (0, import_fields6.text)({ validation: { isRequired: true } }),
    refundPaymentFunction: (0, import_fields6.text)({ validation: { isRequired: true } }),
    getPaymentStatusFunction: (0, import_fields6.text)({ validation: { isRequired: true } }),
    generatePaymentLinkFunction: (0, import_fields6.text)({ validation: { isRequired: true } }),
    handleWebhookFunction: (0, import_fields6.text)({ validation: { isRequired: true } }),
    tenderConfigurations: (0, import_fields6.relationship)({ ref: "TenderConfiguration.paymentProvider", many: true }),
    ...trackingFields
  }
});

// features/keystone/models/Commerce.ts
var import_core6 = require("@keystone-6/core");
var import_fields7 = require("@keystone-6/core/fields");
var status3 = (values, defaultValue) => (0, import_fields7.select)({ type: "enum", options: values.map((value) => ({ label: value.replaceAll("_", " "), value })), ...defaultValue ? { defaultValue } : {}, validation: { isRequired: true } });
var org3 = () => (0, import_fields7.relationship)({ ref: "Organization" });
var site3 = () => (0, import_fields7.relationship)({ ref: "Premises" });
var Register = (0, import_core6.list)({
  access: immutablePremisesAccess("canManageFinance"),
  fields: { organization: org3(), premises: site3(), code: (0, import_fields7.text)({ validation: { isRequired: true }, isIndexed: "unique" }), name: (0, import_fields7.text)({ validation: { isRequired: true } }), status: status3(["active", "inactive", "maintenance"], "active"), ...trackingFields }
});
var RegisterShift = (0, import_core6.list)({
  access: immutablePremisesAccess("canManageFinance"),
  fields: {
    organization: org3(),
    premises: site3(),
    register: (0, import_fields7.relationship)({ ref: "Register" }),
    operator: (0, import_fields7.relationship)({ ref: "User" }),
    status: status3(["scheduled", "open", "count_pending", "counted", "variance_review", "closed", "deposited"], "scheduled"),
    openingFloatCents: (0, import_fields7.integer)({ validation: { min: 0, isRequired: true } }),
    expectedCashCents: (0, import_fields7.integer)({ validation: { min: 0 } }),
    actualCashCents: (0, import_fields7.integer)({ validation: { min: 0 } }),
    varianceCents: (0, import_fields7.integer)(),
    openedAt: (0, import_fields7.timestamp)(),
    countedAt: (0, import_fields7.timestamp)(),
    closedAt: (0, import_fields7.timestamp)(),
    approvedBy: (0, import_fields7.relationship)({ ref: "User" }),
    evidenceHash: (0, import_fields7.text)({ validation: { isRequired: true } }),
    cashEvents: (0, import_fields7.relationship)({ ref: "CashEvent.shift", many: true }),
    sales: (0, import_fields7.relationship)({ ref: "Sale.shift", many: true }),
    ...trackingFields
  }
});
var CashEvent = (0, import_core6.list)({
  access: immutablePremisesAccess("canManageFinance"),
  fields: {
    organization: org3(),
    premises: site3(),
    shift: (0, import_fields7.relationship)({ ref: "RegisterShift.cashEvents" }),
    type: status3(["opening_float", "sale", "refund", "paid_in", "paid_out", "safe_drop", "count", "deposit"]),
    amountCents: (0, import_fields7.integer)({ validation: { isRequired: true } }),
    reasonCode: (0, import_fields7.text)({ validation: { isRequired: true } }),
    actor: (0, import_fields7.relationship)({ ref: "User" }),
    approvedBy: (0, import_fields7.relationship)({ ref: "User" }),
    occurredAt: (0, import_fields7.timestamp)({ validation: { isRequired: true } }),
    idempotencyKey: (0, import_fields7.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    evidenceHash: (0, import_fields7.text)({ validation: { isRequired: true } }),
    ...trackingFields
  }
});
var TenderConfiguration = (0, import_core6.list)({
  access: immutablePremisesAccess("canManageFinance"),
  fields: {
    organization: org3(),
    premises: site3(),
    code: (0, import_fields7.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    type: status3(["cash", "debit", "ach", "wallet", "other"]),
    displayName: (0, import_fields7.text)({ validation: { isRequired: true } }),
    enabled: (0, import_fields7.checkbox)({ defaultValue: false }),
    providerCode: (0, import_fields7.text)(),
    paymentProvider: (0, import_fields7.relationship)({ ref: "PaymentProvider.tenderConfigurations" }),
    authorityReference: (0, import_fields7.text)({ validation: { isRequired: true } }),
    effectiveAt: (0, import_fields7.timestamp)({ validation: { isRequired: true } }),
    expiresAt: (0, import_fields7.timestamp)({ validation: { isRequired: true } }),
    ...trackingFields
  }
});
var Cart = (0, import_core6.list)({
  access: immutablePremisesAccess("canManageSales"),
  fields: {
    organization: org3(),
    premises: site3(),
    customer: (0, import_fields7.relationship)({ ref: "Customer" }),
    shift: (0, import_fields7.relationship)({ ref: "RegisterShift" }),
    reference: (0, import_fields7.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    source: status3(["pos", "pickup", "customer_intake"]),
    status: status3(["draft", "preliminarily_eligible", "reserved", "picking", "staged", "final_verification", "completed", "expired", "cancelled", "rejected"], "draft"),
    guestProofHash: (0, import_fields7.text)({ isFilterable: false, isOrderable: false, access: { read: () => false, create: () => false, update: () => false } }),
    expiresAt: (0, import_fields7.timestamp)({ validation: { isRequired: true } }),
    rulePack: (0, import_fields7.relationship)({ ref: "JurisdictionRulePack" }),
    eligibilityEvidence: (0, import_fields7.relationship)({ ref: "EligibilityEvidence" }),
    subtotalCents: (0, import_fields7.integer)({ defaultValue: 0, validation: { min: 0 } }),
    discountCents: (0, import_fields7.integer)({ defaultValue: 0, validation: { min: 0 } }),
    taxCents: (0, import_fields7.integer)({ defaultValue: 0, validation: { min: 0 } }),
    totalCents: (0, import_fields7.integer)({ defaultValue: 0, validation: { min: 0 } }),
    lines: (0, import_fields7.relationship)({ ref: "CartLine.cart", many: true }),
    version: (0, import_fields7.integer)({ defaultValue: 1, validation: { min: 1 } }),
    // Online pickup orders: the shopper's chosen window and how they pay. The card reference is the Authorize.net
    // transaction id of the authorization; it is captured (or voided) by staff, never by the shopper.
    pickupWindowStart: (0, import_fields7.timestamp)(),
    pickupWindowEnd: (0, import_fields7.timestamp)(),
    pickupName: (0, import_fields7.text)(),
    pickupPhone: (0, import_fields7.text)(),
    paymentMethod: (0, import_fields7.text)(),
    paymentStatus: (0, import_fields7.text)(),
    paymentReference: (0, import_fields7.text)({ isFilterable: false, isOrderable: false }),
    ...trackingFields
  }
});
var CartLine = (0, import_core6.list)({
  access: immutablePremisesAccess("canManageSales"),
  fields: {
    organization: org3(),
    premises: site3(),
    cart: (0, import_fields7.relationship)({ ref: "Cart.lines" }),
    idempotencyKey: (0, import_fields7.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    package: (0, import_fields7.relationship)({ ref: "InventoryPackage" }),
    product: (0, import_fields7.relationship)({ ref: "Product" }),
    quantityMicrounits: (0, import_fields7.integer)({ validation: { min: 1, isRequired: true } }),
    equivalencyMicrounits: (0, import_fields7.integer)({ validation: { min: 1, isRequired: true } }),
    titleSnapshot: (0, import_fields7.text)({ validation: { isRequired: true } }),
    skuSnapshot: (0, import_fields7.text)({ validation: { isRequired: true } }),
    categoryCodeSnapshot: (0, import_fields7.text)({ validation: { isRequired: true } }),
    packageUidSnapshot: (0, import_fields7.text)({ validation: { isRequired: true } }),
    batchSnapshot: (0, import_fields7.text)({ validation: { isRequired: true } }),
    potencySnapshot: (0, import_fields7.json)({ defaultValue: {} }),
    unitPriceCents: (0, import_fields7.integer)({ validation: { min: 0, isRequired: true } }),
    subtotalCents: (0, import_fields7.integer)({ validation: { min: 0, isRequired: true } }),
    discountCents: (0, import_fields7.integer)({ defaultValue: 0, validation: { min: 0 } }),
    discountSnapshot: (0, import_fields7.json)({ defaultValue: {} }),
    taxBasisPoints: (0, import_fields7.integer)({ validation: { min: 0, max: 1e5, isRequired: true } }),
    taxCents: (0, import_fields7.integer)({ validation: { min: 0, isRequired: true } }),
    totalCents: (0, import_fields7.integer)({ validation: { min: 0, isRequired: true } }),
    ...trackingFields
  }
});
var Sale = (0, import_core6.list)({
  access: immutablePremisesAccess("canManageSales"),
  fields: {
    organization: org3(),
    premises: site3(),
    shift: (0, import_fields7.relationship)({ ref: "RegisterShift.sales" }),
    customer: (0, import_fields7.relationship)({ ref: "Customer" }),
    cart: (0, import_fields7.relationship)({ ref: "Cart" }),
    receiptNumber: (0, import_fields7.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    status: status3(["finalized", "state_queued", "state_accepted", "state_rejected", "reconciled", "reversal_pending", "reversed", "partially_refunded", "refunded"]),
    customerCapacitySnapshot: (0, import_fields7.text)({ validation: { isRequired: true } }),
    rulePackVersion: (0, import_fields7.text)({ validation: { isRequired: true } }),
    eligibilityEvidenceHash: (0, import_fields7.text)({ validation: { isRequired: true } }),
    purchaseLimitEvaluation: (0, import_fields7.json)({ defaultValue: {} }),
    subtotalCents: (0, import_fields7.integer)({ validation: { min: 0, isRequired: true } }),
    discountCents: (0, import_fields7.integer)({ validation: { min: 0, isRequired: true } }),
    taxCents: (0, import_fields7.integer)({ validation: { min: 0, isRequired: true } }),
    totalCents: (0, import_fields7.integer)({ validation: { min: 0, isRequired: true } }),
    refundedCents: (0, import_fields7.integer)({ defaultValue: 0, validation: { min: 0 } }),
    finalizedAt: (0, import_fields7.timestamp)({ validation: { isRequired: true } }),
    lines: (0, import_fields7.relationship)({ ref: "SaleLine.sale", many: true }),
    tenders: (0, import_fields7.relationship)({ ref: "Tender.sale", many: true }),
    refunds: (0, import_fields7.relationship)({ ref: "Refund.sale", many: true }),
    receiptSnapshot: (0, import_fields7.json)({ defaultValue: {} }),
    receiptHash: (0, import_fields7.text)({ validation: { isRequired: true } }),
    labelSnapshot: (0, import_fields7.json)({ defaultValue: {} }),
    labelHash: (0, import_fields7.text)({ validation: { isRequired: true } }),
    ...trackingFields
  }
});
var SaleLine = (0, import_core6.list)({
  access: immutablePremisesAccess("canManageSales"),
  fields: {
    organization: org3(),
    premises: site3(),
    sale: (0, import_fields7.relationship)({ ref: "Sale.lines" }),
    package: (0, import_fields7.relationship)({ ref: "InventoryPackage" }),
    titleSnapshot: (0, import_fields7.text)({ validation: { isRequired: true } }),
    skuSnapshot: (0, import_fields7.text)({ validation: { isRequired: true } }),
    categoryCodeSnapshot: (0, import_fields7.text)({ validation: { isRequired: true } }),
    packageUidSnapshot: (0, import_fields7.text)({ validation: { isRequired: true } }),
    batchSnapshot: (0, import_fields7.text)({ validation: { isRequired: true } }),
    coaReferenceSnapshot: (0, import_fields7.text)(),
    potencySnapshot: (0, import_fields7.json)({ defaultValue: {} }),
    quantityMicrounits: (0, import_fields7.integer)({ validation: { min: 1, isRequired: true } }),
    equivalencyMicrounits: (0, import_fields7.integer)({ validation: { min: 1, isRequired: true } }),
    unitPriceCents: (0, import_fields7.integer)({ validation: { min: 0, isRequired: true } }),
    discountCents: (0, import_fields7.integer)({ validation: { min: 0, isRequired: true } }),
    discountSnapshot: (0, import_fields7.json)({ defaultValue: {} }),
    taxCents: (0, import_fields7.integer)({ validation: { min: 0, isRequired: true } }),
    totalCents: (0, import_fields7.integer)({ validation: { min: 0, isRequired: true } }),
    ...trackingFields
  }
});
var Tender = (0, import_core6.list)({
  access: immutablePremisesAccess("canManageFinance"),
  fields: {
    organization: org3(),
    premises: site3(),
    sale: (0, import_fields7.relationship)({ ref: "Sale.tenders" }),
    configuration: (0, import_fields7.relationship)({ ref: "TenderConfiguration" }),
    typeSnapshot: (0, import_fields7.text)({ validation: { isRequired: true } }),
    amountCents: (0, import_fields7.integer)({ validation: { min: 0, isRequired: true } }),
    tenderedCents: (0, import_fields7.integer)({ validation: { min: 0 } }),
    changeCents: (0, import_fields7.integer)({ defaultValue: 0, validation: { min: 0 } }),
    status: status3(["received", "authorized", "captured", "reversed", "failed"], "received"),
    providerReference: (0, import_fields7.text)(),
    idempotencyKey: (0, import_fields7.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    evidenceHash: (0, import_fields7.text)({ validation: { isRequired: true } }),
    ...trackingFields
  }
});
var Refund = (0, import_core6.list)({
  access: immutablePremisesAccess("canManageFinance"),
  fields: {
    organization: org3(),
    premises: site3(),
    sale: (0, import_fields7.relationship)({ ref: "Sale.refunds" }),
    amountCents: (0, import_fields7.integer)({ validation: { min: 1, isRequired: true } }),
    reasonCode: (0, import_fields7.text)({ validation: { isRequired: true } }),
    inventoryDisposition: status3(["none", "quarantine", "waste", "returned_to_authority"]),
    status: status3(["pending", "completed", "failed", "reconciled"], "pending"),
    actor: (0, import_fields7.relationship)({ ref: "User" }),
    approvedBy: (0, import_fields7.relationship)({ ref: "User" }),
    originalTenderReference: (0, import_fields7.text)(),
    providerReference: (0, import_fields7.text)(),
    occurredAt: (0, import_fields7.timestamp)({ validation: { isRequired: true } }),
    evidenceHash: (0, import_fields7.text)({ validation: { isRequired: true } }),
    ...trackingFields
  }
});

// features/keystone/models/Operations.ts
var import_core7 = require("@keystone-6/core");
var import_fields8 = require("@keystone-6/core/fields");
var status4 = (values, defaultValue) => (0, import_fields8.select)({ type: "enum", options: values.map((value) => ({ label: value.replaceAll("_", " "), value })), ...defaultValue ? { defaultValue } : {}, validation: { isRequired: true } });
var org4 = () => (0, import_fields8.relationship)({ ref: "Organization" });
var site4 = () => (0, import_fields8.relationship)({ ref: "Premises" });
var AuditEvent = (0, import_core7.list)({
  access: immutablePremisesAccess("canViewReports"),
  fields: {
    organization: org4(),
    premises: site4(),
    actor: (0, import_fields8.relationship)({ ref: "User" }),
    action: (0, import_fields8.text)({ validation: { isRequired: true } }),
    resourceType: (0, import_fields8.text)({ validation: { isRequired: true } }),
    resourceId: (0, import_fields8.text)({ validation: { isRequired: true } }),
    correlationId: (0, import_fields8.text)({ validation: { isRequired: true }, isIndexed: true }),
    reasonCode: (0, import_fields8.text)({ validation: { isRequired: true } }),
    evidence: (0, import_fields8.json)({ defaultValue: {} }),
    evidenceHash: (0, import_fields8.text)({ validation: { isRequired: true } }),
    occurredAt: (0, import_fields8.timestamp)({ validation: { isRequired: true } }),
    ...trackingFields
  }
});
var IdempotencyKey = (0, import_core7.list)({
  access: immutablePremisesAccess("canViewReports"),
  fields: {
    organization: org4(),
    premises: site4(),
    scope: (0, import_fields8.text)({ validation: { isRequired: true } }),
    lookupKey: (0, import_fields8.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    requestHash: (0, import_fields8.text)({ validation: { isRequired: true } }),
    status: status4(["processing", "succeeded", "failed"], "processing"),
    responseSnapshot: (0, import_fields8.json)(),
    // Original command (credentials/proofs removed), read only by the owning actor's recovery query.
    requestSnapshot: (0, import_fields8.json)({ access: { read: () => false, create: () => false, update: () => false } }),
    startedAt: (0, import_fields8.timestamp)({ validation: { isRequired: true } }),
    completedAt: (0, import_fields8.timestamp)(),
    expiresAt: (0, import_fields8.timestamp)({ validation: { isRequired: true } }),
    actor: (0, import_fields8.relationship)({ ref: "User" }),
    ...trackingFields
  }
});
var StateEventInbox = (0, import_core7.list)({
  access: immutablePremisesAccess("canManageIntegrations"),
  fields: {
    organization: org4(),
    premises: site4(),
    providerCode: (0, import_fields8.text)({ validation: { isRequired: true } }),
    providerEventId: (0, import_fields8.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    payloadHash: (0, import_fields8.text)({ validation: { isRequired: true } }),
    signatureEvidence: (0, import_fields8.text)({ validation: { isRequired: true } }),
    status: status4(["received", "verified", "processed", "rejected", "needs_review"], "received"),
    receivedAt: (0, import_fields8.timestamp)({ validation: { isRequired: true } }),
    processedAt: (0, import_fields8.timestamp)(),
    rejectionReason: (0, import_fields8.text)(),
    payload: (0, import_fields8.json)({ defaultValue: {} }),
    ...trackingFields
  }
});
var IntegrationInstallation = (0, import_core7.list)({
  access: immutablePremisesAccess("canManageIntegrations"),
  fields: {
    organization: org4(),
    premises: site4(),
    providerCode: (0, import_fields8.text)({ validation: { isRequired: true } }),
    providerType: status4(["traceability", "patient_registry", "identity", "laboratory", "payment", "tax"]),
    status: status4(["unconfigured", "pending_validation", "active", "suspended", "revoked"], "unconfigured"),
    credentialReference: (0, import_fields8.text)({ isFilterable: false, isOrderable: false, access: { read: () => false, create: () => false, update: () => false } }),
    facilityReference: (0, import_fields8.text)(),
    capabilities: (0, import_fields8.json)({ defaultValue: [] }),
    validatedAt: (0, import_fields8.timestamp)(),
    authorityReference: (0, import_fields8.text)({ validation: { isRequired: true } }),
    lastSuccessfulSyncAt: (0, import_fields8.timestamp)(),
    ...trackingFields
  }
});
var ReconciliationRun = (0, import_core7.list)({
  access: immutablePremisesAccess("canViewReports"),
  fields: {
    organization: org4(),
    premises: site4(),
    type: status4(["inventory_state_physical", "sale_package", "tender_settlement", "tax", "cash", "outbox"]),
    status: status4(["pending", "running", "exceptions", "balanced", "approved", "failed"], "pending"),
    startedAt: (0, import_fields8.timestamp)({ validation: { isRequired: true } }),
    completedAt: (0, import_fields8.timestamp)(),
    localSnapshotHash: (0, import_fields8.text)({ validation: { isRequired: true } }),
    externalSnapshotHash: (0, import_fields8.text)(),
    discrepancyCount: (0, import_fields8.integer)({ defaultValue: 0, validation: { min: 0 } }),
    discrepancies: (0, import_fields8.json)({ defaultValue: [] }),
    owner: (0, import_fields8.relationship)({ ref: "User" }),
    approvedBy: (0, import_fields8.relationship)({ ref: "User" }),
    evidenceHash: (0, import_fields8.text)({ validation: { isRequired: true } }),
    ...trackingFields
  }
});
var ComplianceIncident = (0, import_core7.list)({
  access: immutablePremisesAccess("canManageCompliance"),
  fields: {
    organization: org4(),
    premises: site4(),
    reference: (0, import_fields8.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    type: status4(["refusal_of_sale", "identity", "patient_registry_outage", "traceability_outage", "payment_ambiguity", "inventory_discrepancy", "theft", "loss", "diversion", "recall", "privacy", "security", "system_outage", "offline_attempt"]),
    severity: status4(["low", "medium", "high", "critical"]),
    status: status4(["open", "contained", "investigating", "reported", "resolved", "closed"], "open"),
    occurredAt: (0, import_fields8.timestamp)({ validation: { isRequired: true } }),
    detectedAt: (0, import_fields8.timestamp)({ validation: { isRequired: true } }),
    notificationDueAt: (0, import_fields8.timestamp)(),
    reportedAt: (0, import_fields8.timestamp)(),
    description: (0, import_fields8.text)({ validation: { isRequired: true } }),
    affectedPackageUids: (0, import_fields8.json)({ defaultValue: [] }),
    customerReferenceHash: (0, import_fields8.text)(),
    outageMode: status4(["none", "fail_closed", "approved_degraded"], "none"),
    recoveryQueueReference: (0, import_fields8.text)(),
    authorityReference: (0, import_fields8.text)(),
    actor: (0, import_fields8.relationship)({ ref: "User" }),
    owner: (0, import_fields8.relationship)({ ref: "User" }),
    evidenceHash: (0, import_fields8.text)({ validation: { isRequired: true } }),
    ...trackingFields
  }
});

// features/keystone/models/index.ts
var models = {
  User,
  Role,
  Organization,
  Premises,
  StorefrontSettings,
  CannabisLicense,
  StaffCredential,
  Customer,
  EligibilityEvidence,
  JurisdictionRulePack,
  Product,
  InventoryPackage,
  PackageHold,
  RegulatedManifest,
  InventoryEvent,
  RecallCase,
  Register,
  RegisterShift,
  CashEvent,
  TenderConfiguration,
  Cart,
  CartLine,
  Sale,
  SaleLine,
  Tender,
  Refund,
  PaymentProvider,
  AuditEvent,
  IdempotencyKey,
  StateEventInbox,
  IntegrationInstallation,
  ReconciliationRun,
  ComplianceIncident
};
var LIST_VIEWS = {
  User: ["name", ["name", "email", "status", "role", "onboardingStatus"]],
  Role: ["name", ["name", "canManageAuthority", "canManageInventory", "canManageSales"]],
  Organization: ["name", ["name", "legalName", "jurisdictionCode", "status"]],
  Premises: ["name", ["name", "premisesCode", "timezone", "status"]],
  StorefrontSettings: ["businessName", ["businessName", "publicationStatus", "storefrontMode"]],
  CannabisLicense: ["licenseNumber", ["licenseNumber", "licenseType", "status"]],
  StaffCredential: ["credentialReference", ["credentialReference", "user", "credentialType", "status"]],
  Customer: ["reference", ["reference", "capacity", "status"]],
  EligibilityEvidence: ["identityMethod", ["customer", "capacity", "result"]],
  JurisdictionRulePack: ["version", ["version", "status"]],
  Product: ["name", ["name", "sku", "form", "categoryCode", "taxCategoryCode", "status"]],
  InventoryPackage: ["packageUid", ["packageUid", "product", "status", "testStatus"]],
  PackageHold: ["reasonCode", ["package", "type", "reasonCode", "status"]],
  RegulatedManifest: ["manifestNumber", ["manifestNumber", "type", "status"]],
  InventoryEvent: ["eventType", ["package", "eventType", "reasonCode"]],
  RecallCase: ["reference", ["reference", "status", "reason"]],
  Register: ["name", ["name", "code", "status"]],
  RegisterShift: ["status", ["register", "operator", "status"]],
  CashEvent: ["type", ["shift", "type"]],
  TenderConfiguration: ["displayName", ["displayName", "type", "enabled"]],
  PaymentProvider: ["name", ["name", "code", "isInstalled"]],
  Cart: ["reference", ["reference", "status"]],
  CartLine: ["titleSnapshot", ["cart", "titleSnapshot", "quantityMicrounits"]],
  Sale: ["receiptNumber", ["receiptNumber", "status"]],
  SaleLine: ["titleSnapshot", ["sale", "titleSnapshot", "quantityMicrounits"]],
  Tender: ["typeSnapshot", ["sale", "typeSnapshot", "status"]],
  Refund: ["reasonCode", ["sale", "reasonCode", "status"]],
  AuditEvent: ["action", ["action", "resourceType", "actor"]],
  IdempotencyKey: ["scope", ["scope", "status"]],
  StateEventInbox: ["providerEventId", ["providerCode", "providerEventId", "status"]],
  IntegrationInstallation: ["providerCode", ["providerCode", "providerType", "status"]],
  ReconciliationRun: ["type", ["type", "status", "discrepancyCount"]],
  ComplianceIncident: ["reference", ["reference", "type", "severity", "status"]]
};
var LIST_PERMISSION = {
  User: "canManagePeople",
  Role: "canManageRoles",
  Organization: "canManageAuthority",
  Premises: "canManageAuthority",
  StorefrontSettings: "canManageAuthority",
  CannabisLicense: "canManageAuthority",
  StaffCredential: "canManageAuthority",
  Customer: "canManageCompliance",
  EligibilityEvidence: "canManageCompliance",
  JurisdictionRulePack: "canManageCompliance",
  Register: "canManageFinance",
  RegisterShift: "canManageFinance",
  CashEvent: "canManageFinance",
  TenderConfiguration: "canManageFinance",
  PaymentProvider: "canManageFinance",
  Cart: "canManageSales",
  CartLine: "canManageSales",
  Sale: "canManageSales",
  SaleLine: "canManageSales",
  Tender: "canManageFinance",
  Refund: "canManageFinance",
  Product: "canManageInventory",
  InventoryPackage: "canManageInventory",
  PackageHold: "canManageCompliance",
  RegulatedManifest: "canManageInventory",
  InventoryEvent: "canManageInventory",
  RecallCase: "canManageCompliance",
  AuditEvent: "canViewReports",
  IdempotencyKey: "canViewReports",
  StateEventInbox: "canManageIntegrations",
  IntegrationInstallation: "canManageIntegrations",
  ReconciliationRun: "canViewReports",
  ComplianceIncident: "canManageCompliance"
};
for (const [key, model] of Object.entries(models)) {
  const view = LIST_VIEWS[key];
  const permission = LIST_PERMISSION[key];
  model.ui = {
    ...model.ui,
    ...permission ? { isHidden: ({ session }) => session?.data?.role?.[permission] !== true } : {},
    ...view ? { labelField: view[0], listView: { ...model.ui?.listView, initialColumns: view[1] } } : {},
    ...key === "User" ? {} : { itemView: { ...model.ui?.itemView, defaultFieldMode: "read" } }
  };
}

// features/keystone/ui-create-access.ts
function operationRule(access, operation) {
  if (typeof access === "function") return access;
  const rules2 = access?.operation;
  if (typeof rules2 === "function") return rules2;
  if (typeof rules2?.[operation] === "function") return rules2[operation];
  return void 0;
}
var createRule = (access) => operationRule(access, "create");
async function allowed(listKey, list8, operation, args) {
  const rule = operationRule(list8.access, operation);
  if (!rule) return true;
  try {
    return Boolean(await rule({ session: args.session, context: args.context, listKey, operation }));
  } catch {
    return false;
  }
}
var createAllowed = (listKey, list8, args) => allowed(listKey, list8, "create", args);
function withDeleteAwareUi(lists) {
  const out = {};
  for (const [listKey, list8] of Object.entries(lists)) {
    if (list8.ui?.hideDelete !== void 0 || !operationRule(list8.access, "delete")) {
      out[listKey] = list8;
      continue;
    }
    out[listKey] = {
      ...list8,
      ui: { ...list8.ui, hideDelete: async (args) => !await allowed(listKey, list8, "delete", args) }
    };
  }
  return out;
}
function withCreateAwareUi(lists) {
  const out = {};
  for (const [listKey, list8] of Object.entries(lists)) {
    if (list8.ui?.hideCreate !== void 0 || !createRule(list8.access)) {
      out[listKey] = list8;
      continue;
    }
    out[listKey] = {
      ...list8,
      ui: {
        ...list8.ui,
        hideCreate: async (args) => !await createAllowed(listKey, list8, args)
      }
    };
  }
  return out;
}

// features/keystone/index.ts
var import_session = require("@keystone-6/core/session");

// features/keystone/mutations/index.ts
var import_schema = require("@graphql-tools/schema");

// features/keystone/mutations/redirectToInit.ts
async function redirectToInit(root, args, context) {
  const userCount = await context.sudo().query.User.count({});
  if (userCount === 0) {
    return true;
  }
  return false;
}
var redirectToInit_default = redirectToInit;

// features/keystone/domain/transaction.ts
function serializableTransaction(context, work, timeout = 3e4) {
  const transaction = context.transaction;
  return transaction(work, { isolationLevel: "Serializable", maxWait: 5e3, timeout });
}

// features/keystone/domain/storefrontSettings.ts
var NEUTRAL_STOREFRONT_HUE = 215;
var NEUTRAL_STOREFRONT_SETTINGS = Object.freeze({
  businessName: null,
  tagline: null,
  description: null,
  brandHue: NEUTRAL_STOREFRONT_HUE,
  logoIcon: DEFAULT_STORE_LOGO_ICON,
  logoColor: DEFAULT_STORE_LOGO_COLOR,
  mode: "neutral",
  isConfigured: false
});
function requiredPublicText(value, label, max) {
  if (typeof value !== "string") throw new Error(`${label} must be text`);
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new Error(`${label} must contain 1-${max} characters`);
  return normalized;
}
function optionalPublicText(value, label, max) {
  if (value === void 0 || value === null || value === "") return null;
  if (typeof value !== "string") throw new Error(`${label} must be text`);
  const normalized = value.trim();
  if (normalized.length > max) throw new Error(`${label} must contain at most ${max} characters`);
  return normalized || null;
}
function assertStorefrontHue(value) {
  if (!Number.isInteger(value) || value < 0 || value > 359) {
    throw new Error("Brand hue must be an integer between 0 and 359");
  }
  return value;
}
function normalizeStorefrontSettingsInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Storefront settings input is required");
  const values = input;
  return {
    businessName: requiredPublicText(values.businessName, "Business name", 120),
    tagline: optionalPublicText(values.tagline, "Tagline", 180),
    description: optionalPublicText(values.description, "Description", 240),
    brandHue: assertStorefrontHue(values.brandHue)
  };
}
function normalizeLogoSettings(input) {
  const value = input.logoIcon;
  const logoIcon = value === void 0 ? DEFAULT_STORE_LOGO_ICON : typeof value === "string" ? sanitizeStoreLogoSvg(value) : "";
  if (value !== void 0 && !logoIcon) throw new Error("Logo must be a valid, safe SVG document");
  return { logoIcon, logoColor: normalizeStoreLogoColor(input.logoColor) };
}
function projectPublicStorefrontSettings(value) {
  try {
    if (!value || typeof value !== "object" || value.publicationStatus !== "published") {
      return { ...NEUTRAL_STOREFRONT_SETTINGS };
    }
    const mode = value.storefrontMode;
    if (mode !== "configured") return { ...NEUTRAL_STOREFRONT_SETTINGS };
    const settings = normalizeStorefrontSettingsInput(value);
    const row = value;
    return {
      ...settings,
      logoIcon: sanitizeStoreLogoSvg(String(row.logoIcon || "")) || DEFAULT_STORE_LOGO_ICON,
      logoColor: normalizeStoreLogoColor(row.logoColor),
      mode: "configured",
      isConfigured: true
    };
  } catch {
    return { ...NEUTRAL_STOREFRONT_SETTINGS };
  }
}

// features/keystone/domain/policyIdentity.ts
var POLICY_IDENTITY_FIELDS = [
  "jurisdictionCode",
  "ruleVersion",
  "ruleAuthorityCitations",
  "ruleEffectiveAt",
  "ruleExpiresAt",
  "adultMinimumAge",
  "medicalMinimumAge",
  "medicalEnabled",
  "operatingStartMinute",
  "operatingEndMinute",
  "purchaseLimits",
  "taxRules",
  "discountRules",
  "allowedTenderTypes",
  "labelRequirements",
  "returnRules",
  "outagePolicy",
  "privacyRules",
  "retentionRules",
  "pickupEnabled",
  "deliveryEnabled",
  "offlineSalesAllowed"
];
function policyIdentity(value) {
  const input = value;
  const identity = {};
  for (const field of POLICY_IDENTITY_FIELDS) {
    if (!(field in input) || input[field] === void 0) throw new Error(`Policy identity is missing ${field}`);
    identity[field] = input[field];
  }
  return identity;
}

// features/keystone/domain/premisesTime.ts
function zoneOffsetMs(instant, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(instant));
  const get = (type) => Number(parts.find((part) => part.type === type)?.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - Math.floor(instant / 1e3) * 1e3;
}
function isValidTimeZone(timeZone) {
  if (typeof timeZone !== "string" || !timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}
function endOfLocalDate(date2, timeZone) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date2);
  if (!match || !isValidTimeZone(timeZone)) throw new Error("Expiry must be a calendar date (YYYY-MM-DD) at a premises with a valid time zone");
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) throw new Error("Expiry date is not a real calendar date");
  const localMidnight = Date.UTC(year, month - 1, day + 1);
  let instant = localMidnight - zoneOffsetMs(localMidnight, timeZone);
  instant = localMidnight - zoneOffsetMs(instant, timeZone);
  return new Date(instant);
}
function localDateParts(now, timeZone) {
  if (!isValidTimeZone(timeZone)) throw new Error("The premises needs a valid time zone");
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (type) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}
var DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
function calendarDate(value) {
  const text8 = value instanceof Date ? Number.isFinite(value.getTime()) ? value.toISOString().slice(0, 10) : "" : typeof value === "string" ? value.trim() : "";
  const match = DATE_ONLY.exec(text8);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return { year, month, day, text: text8 };
}
function ageAtPremises(dateOfBirth, now, timeZone) {
  const dob = calendarDate(dateOfBirth);
  if (!dob) return null;
  const today = localDateParts(now, timeZone);
  if (dob.year * 1e4 + dob.month * 100 + dob.day > today.year * 1e4 + today.month * 100 + today.day) return null;
  let age = today.year - dob.year;
  if (today.month < dob.month || today.month === dob.month && today.day < dob.day) age -= 1;
  return age;
}

// features/lib/money.ts
function isSupportedCurrencyCode(value) {
  if (typeof value !== "string" || !/^[A-Z]{3}$/.test(value)) return false;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: value }).resolvedOptions().maximumFractionDigits === 2;
  } catch {
    return false;
  }
}

// features/keystone/mutations/workflow.ts
var import_node_crypto = require("node:crypto");
function canonicalize(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => [key, canonicalize(entry)]));
  return value;
}
function stableHash(value) {
  return (0, import_node_crypto.createHash)("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}
function assertText(value, label, min = 1, max = 500) {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) throw new Error(`${label} must contain ${min}-${max} characters`);
  return value.trim();
}
function assertInteger(value, label, min = 0, max = 2147483647) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${label} must be an integer between ${min} and ${max}`);
  return value;
}
function assertJsonValue(value, label) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${label} contains a non-finite number`);
    return value;
  }
  if (Array.isArray(value)) return value.map((entry, index) => assertJsonValue(entry, `${label}[${index}]`));
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, assertJsonValue(entry, `${label}.${key}`)]));
  }
  throw new Error(`${label} must contain only JSON values`);
}
async function requireActor(context, permission) {
  const session = context.session;
  if (!session?.itemId || session.data.status === "disabled") throw new Error("Authentication required");
  const actor = await context.sudo().query.User.findOne({
    where: { id: session.itemId },
    query: `id status onboardingStatus organization { id jurisdictionCode status } premises { id status timezone currencyCode organization { id } } role { id canAccessDashboard ${permission} } staffCredential { id status effectiveAt expiresAt allowedActivities approvalLimitCents evidenceHash user { id } organization { id } premises { id } }`
  });
  if (!actor || actor.status !== "active" || actor.role?.canAccessDashboard !== true || actor.role?.[permission] !== true) throw new Error("Current actor lacks required authority");
  if (actor.organization?.id !== session.data.organization?.id || actor.premises?.id !== session.data.premises?.id) throw new Error("Session authority scope is stale");
  return { session, actor, organizationId: actor.organization?.id, premisesId: actor.premises?.id };
}
async function requireReadAuthority(context, permission) {
  const scope = await requireActor(context, permission);
  const organizationId2 = scope.organizationId;
  const premisesId2 = scope.premisesId;
  if (!organizationId2 || !premisesId2 || scope.actor.premises?.organization?.id !== organizationId2) throw new Error("A premises assignment is required");
  return { ...scope, organizationId: organizationId2, premisesId: premisesId2 };
}
async function requireOperationalAuthority(context, permission, activity) {
  const scope = await requireReadAuthority(context, permission);
  const { organizationId: organizationId2, premisesId: premisesId2 } = scope;
  if (scope.actor.organization?.status !== "active" || scope.actor.premises?.status !== "active") throw new Error("Active organization and licensed premises authority are required");
  const now = Date.now();
  const credential = scope.actor.staffCredential;
  if (!credential || credential.status !== "active" || !(new Date(credential.effectiveAt).getTime() <= now) || !(new Date(credential.expiresAt).getTime() > now) || !Array.isArray(credential.allowedActivities) || !credential.allowedActivities.includes(activity) || credential.user?.id !== scope.actor.id || credential.organization?.id !== organizationId2 || credential.premises?.id !== premisesId2) throw new Error("Current staff credential does not authorize this activity");
  const license = await context.sudo().query.CannabisLicense.findMany({
    where: { organization: { id: { equals: organizationId2 } }, premises: { id: { equals: premisesId2 } }, status: { equals: "active" }, effectiveAt: { lte: /* @__PURE__ */ new Date() }, expiresAt: { gt: /* @__PURE__ */ new Date() } },
    take: 2,
    query: "id licenseNumber authorizedActivities status effectiveAt expiresAt organization { id } premises { id }"
  });
  if (license.length !== 1 || license[0].status !== "active" || !(new Date(license[0].effectiveAt).getTime() <= now) || !(new Date(license[0].expiresAt).getTime() > now) || !Array.isArray(license[0].authorizedActivities) || !license[0].authorizedActivities.includes(activity) || license[0].organization?.id !== organizationId2 || license[0].premises?.id !== premisesId2) throw new Error("Exactly one active license must authorize this premises activity");
  return { ...scope, organizationId: organizationId2, premisesId: premisesId2, license: license[0] };
}
async function fenceAuthority(tx, authority) {
  const rows = [
    ["User", authority.actor.id],
    ["Role", authority.actor.role?.id],
    ["StaffCredential", authority.actor.staffCredential?.id],
    ["Organization", authority.organizationId],
    ["Premises", authority.premisesId],
    ["CannabisLicense", authority.license?.id]
  ];
  for (const [table, id] of rows) {
    if (!id) continue;
    await tx.prisma.$queryRawUnsafe(`SELECT id FROM "${table}" WHERE id = $1 FOR SHARE`, id);
  }
}
var REASON_CODE = /^[a-z][a-z0-9_]{2,99}$/;
function assertReasonCode(value, label = "Reason code") {
  if (typeof value !== "string" || !REASON_CODE.test(value.trim())) throw new Error(`${label} must be a lowercase code such as damaged_packaging`);
  return value.trim();
}
var PRIVATE_INPUT_KEY = /password|proof|secret|token/i;
function retainedRequest(value) {
  if (Array.isArray(value)) return value.map(retainedRequest);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).filter(([key]) => !PRIVATE_INPUT_KEY.test(key)).map(([key, entry]) => [key, retainedRequest(entry)]));
  }
  if (value instanceof Date) return value.toISOString();
  if (value === void 0 || typeof value === "number" && !Number.isFinite(value)) return null;
  return value;
}
async function requireRulePack(context, organizationId2, premisesId2) {
  const packs = await context.sudo().query.JurisdictionRulePack.findMany({
    where: { organization: { id: { equals: organizationId2 } }, premises: { id: { equals: premisesId2 } }, status: { equals: "effective" }, effectiveAt: { lte: /* @__PURE__ */ new Date() }, expiresAt: { gt: /* @__PURE__ */ new Date() } },
    orderBy: [{ effectiveAt: "desc" }],
    take: 2,
    query: "id version status jurisdictionCode effectiveAt expiresAt approvedAt adultMinimumAge medicalMinimumAge medicalEnabled operatingStartMinute operatingEndMinute purchaseLimits taxRules discountRules allowedTenderTypes offlineSalesAllowed pickupEnabled labelRequirements"
  });
  if (packs.length !== 1) throw new Error("Exactly one approved effective jurisdiction rule pack is required");
  return packs[0];
}
var OPERATION_RECEIPT_SELECTION = "id requestHash status scope responseSnapshot actor { id } organization { id } premises { id }";
async function runControlledOperation(context, input, options, work) {
  const authority = await requireOperationalAuthority(context, options.permission, options.activity);
  const key = assertText(input.idempotencyKey, "Idempotency key", 8, 200);
  const lookupKey = `${authority.organizationId}:${authority.premisesId}:${options.scope}:${key}`;
  const requestHash = stableHash(input);
  async function freshAuthority(current) {
    const fresh = await requireOperationalAuthority(current, options.permission, options.activity);
    if (fresh.actor.id !== authority.actor.id || fresh.organizationId !== authority.organizationId || fresh.premisesId !== authority.premisesId) throw new Error("Operational command authority changed");
    return fresh;
  }
  async function acknowledge(current, receipt) {
    const fresh = await freshAuthority(current);
    if (receipt.requestHash !== requestHash) throw new Error("Idempotency key was reused with different input");
    if (receipt.scope !== options.scope || receipt.organization?.id !== fresh.organizationId || receipt.premises?.id !== fresh.premisesId || receipt.actor?.id !== fresh.actor.id) {
      throw new Error("Original command authority is unavailable; independent delegation or legacy review is required");
    }
    if (receipt.status !== "succeeded") throw new Error("This operation is already processing or failed and requires review");
    const result = receipt.responseSnapshot;
    if (!result || typeof result !== "object" || Array.isArray(result) || !("id" in result) || typeof result.id !== "string" || !("status" in result) || typeof result.status !== "string") throw new Error("Original command receipt requires review");
    const visible = await current.query[options.resourceType].findOne({ where: { id: result.id }, query: "id" });
    if (!visible || visible.id !== result.id) throw new Error("Original command resource is outside current access");
    const resource = await current.sudo().query[options.resourceType].findOne({ where: { id: result.id }, query: "id organization { id } premises { id }" });
    if (!resource || resource.organization?.id !== fresh.organizationId || resource.premises?.id !== fresh.premisesId) throw new Error("Original command resource is outside current authority");
    await options.authorize?.(current, fresh, "replay", result);
    return { ...result, replayed: true };
  }
  async function acquireLocks(tx) {
    for (const lockKey of [.../* @__PURE__ */ new Set([lookupKey, ...options.lockKeys || []])].sort()) {
      await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "openfront-cannabis", lockKey);
    }
  }
  async function lockedAcknowledgement() {
    return serializableTransaction(context, async (tx) => {
      await acquireLocks(tx);
      await fenceAuthority(tx, authority);
      const receipt = await tx.sudo().query.IdempotencyKey.findOne({ where: { lookupKey }, query: OPERATION_RECEIPT_SELECTION });
      if (!receipt) throw new Error("Original receipt is unavailable; review is required, not a replacement command");
      return acknowledge(tx, receipt);
    });
  }
  const existing = await context.sudo().query.IdempotencyKey.findOne({ where: { lookupKey }, query: OPERATION_RECEIPT_SELECTION });
  if (existing) return lockedAcknowledgement();
  const correlationId = (0, import_node_crypto.randomUUID)();
  try {
    return await serializableTransaction(context, async (tx) => {
      await acquireLocks(tx);
      await fenceAuthority(tx, authority);
      const sudo = tx.sudo();
      const raced = await sudo.query.IdempotencyKey.findOne({ where: { lookupKey }, query: OPERATION_RECEIPT_SELECTION });
      if (raced) return acknowledge(tx, raced);
      const currentAuthority = await freshAuthority(tx);
      await options.authorize?.(tx, currentAuthority, "execute");
      const idempotency = await sudo.query.IdempotencyKey.createOne({ data: {
        organization: { connect: { id: currentAuthority.organizationId } },
        premises: { connect: { id: currentAuthority.premisesId } },
        scope: options.scope,
        lookupKey,
        requestHash,
        requestSnapshot: retainedRequest(input),
        status: "processing",
        startedAt: /* @__PURE__ */ new Date(),
        expiresAt: new Date(Date.now() + 3e5),
        actor: { connect: { id: currentAuthority.actor.id } }
      }, query: "id" });
      const result = await work(tx, currentAuthority, correlationId);
      const responseSnapshot = JSON.parse(JSON.stringify(result));
      await sudo.query.IdempotencyKey.updateOne({ where: { id: idempotency.id }, data: { status: "succeeded", responseSnapshot, completedAt: /* @__PURE__ */ new Date() }, query: "id" });
      const evidenceHash = stableHash({ action: options.action, result: responseSnapshot, requestHash });
      await sudo.query.AuditEvent.createOne({ data: {
        organization: { connect: { id: currentAuthority.organizationId } },
        premises: { connect: { id: currentAuthority.premisesId } },
        actor: { connect: { id: currentAuthority.actor.id } },
        action: options.action,
        resourceType: options.resourceType,
        resourceId: result.id,
        correlationId,
        reasonCode: "controlled_workflow",
        evidence: responseSnapshot,
        evidenceHash,
        occurredAt: /* @__PURE__ */ new Date()
      }, query: "id" });
      return { ...result, replayed: false };
    });
  } catch (error) {
    if (!error || typeof error !== "object" || !("code" in error) || error.code !== "P2002") throw error;
    await freshAuthority(context);
    const winner = await context.sudo().query.IdempotencyKey.findOne({ where: { lookupKey }, query: OPERATION_RECEIPT_SELECTION });
    if (!winner) throw error;
    return lockedAcknowledgement();
  }
}

// features/keystone/domain/cannabisPolicy.ts
var asTime = (value) => new Date(value).getTime();
function assertEffectiveRulePack(pack, now = /* @__PURE__ */ new Date()) {
  if (pack.status !== "effective" || !pack.approvedAt) throw new Error("An approved effective jurisdiction rule pack is required");
  const time = now.getTime();
  if (asTime(pack.effectiveAt) > time || asTime(pack.expiresAt) <= time) throw new Error("Jurisdiction rule pack is outside its effective interval");
  if (!pack.jurisdictionCode.trim() || !pack.version.trim()) throw new Error("Jurisdiction and rule-pack version are required");
  if (!Number.isInteger(pack.adultMinimumAge) || !Number.isInteger(pack.medicalMinimumAge)) throw new Error("Age thresholds must be integer policy data");
  if (!Array.isArray(pack.purchaseLimits) || pack.purchaseLimits.length === 0) throw new Error("At least one configured purchase limit is required");
  const limitKeys = /* @__PURE__ */ new Set();
  for (const rule of pack.purchaseLimits) {
    if (!rule || !["adult_use", "patient", "caregiver"].includes(rule.capacity) || typeof rule.categoryCode !== "string" || !rule.categoryCode.trim()) throw new Error("Purchase-limit rules require a supported capacity and category");
    if (!["transaction", "day", "rolling", "allotment"].includes(rule.window) || !Number.isSafeInteger(rule.maxEquivalencyMicrounits) || rule.maxEquivalencyMicrounits < 0) throw new Error("Purchase-limit rules contain an unsupported window or maximum");
    if (rule.window === "rolling" && (!Number.isSafeInteger(rule.windowDays) || rule.windowDays < 1 || rule.windowDays > 366)) throw new Error("Rolling purchase limits require a supported explicit window in days");
    if (rule.window !== "rolling" && rule.windowDays != null) throw new Error("Only rolling purchase limits may specify windowDays");
    const key = purchaseLimitKey(rule);
    if (limitKeys.has(key)) throw new Error("Duplicate purchase-limit policy for the same capacity, category, and window");
    limitKeys.add(key);
  }
  if (!Array.isArray(pack.taxRules) || pack.taxRules.length === 0) throw new Error("At least one configured tax rule is required");
  const taxKeys = /* @__PURE__ */ new Set();
  for (const rule of pack.taxRules) {
    if (!rule || typeof rule.categoryCode !== "string" || !rule.categoryCode.trim() || !["adult_use", "patient", "caregiver", "all"].includes(rule.capacity) || !Number.isSafeInteger(rule.basisPoints) || rule.basisPoints < 0) throw new Error("Tax rules require a supported capacity/category and non-negative integer rate");
    const key = `${rule.categoryCode}:${rule.capacity}`;
    if (taxKeys.has(key)) throw new Error("Multiple tax rules match the same category and buyer capacity; supported policy is ambiguous");
    taxKeys.add(key);
  }
  if (!Array.isArray(pack.allowedTenderTypes) || pack.allowedTenderTypes.length === 0 || pack.allowedTenderTypes.some((type) => typeof type !== "string" || !type.trim())) throw new Error("At least one supported tender type is required");
  return pack;
}
function assertOperatingWindow(pack, localMinute2) {
  if (!Number.isInteger(localMinute2) || localMinute2 < 0 || localMinute2 > 1439) throw new Error("Local operating minute is invalid");
  const { operatingStartMinute: start, operatingEndMinute: end } = pack;
  const open = start <= end ? localMinute2 >= start && localMinute2 < end : localMinute2 >= start || localMinute2 < end;
  if (!open) throw new Error("The premises is outside its configured operating window");
}
function assertEligibility(input, pack) {
  if (!input.identityValid) throw new Error("Current identity evidence is required");
  const medical = input.capacity !== "adult_use";
  if (medical && !pack.medicalEnabled) throw new Error("Medical sales are not enabled by the active rule pack");
  const minimumAge = medical ? pack.medicalMinimumAge : pack.adultMinimumAge;
  if (!Number.isInteger(input.age) || input.age < minimumAge) throw new Error("Buyer does not meet the configured age requirement");
  if (medical && !input.registryValid) throw new Error("Current medical registry evidence is required");
  if (input.capacity === "caregiver" && !input.representedPatientValid) throw new Error("Current caregiver-to-patient authority is required");
}
function assertPackageSaleable(input, premisesId2, requestedMicrounits, now = /* @__PURE__ */ new Date()) {
  if (input.premisesId !== premisesId2) throw new Error("Package belongs to a different licensed premises");
  if (input.status !== "saleable" || input.testStatus !== "passed") throw new Error("Package is not released and saleable");
  if (input.activeHoldCount > 0) throw new Error("Package has an active hold");
  if (asTime(input.expiresAt) <= now.getTime()) throw new Error("Package is expired");
  if (!input.coaReference || !input.labelVersion) throw new Error("Authoritative COA and label version are required");
  if (!Number.isSafeInteger(requestedMicrounits) || requestedMicrounits <= 0) throw new Error("Requested package quantity must be a positive integer");
  if (input.quantityOnHandMicrounits - input.reservedMicrounits < requestedMicrounits) throw new Error("Insufficient exact-package available quantity");
}
function purchaseLimitKey(rule) {
  return `${rule.capacity ?? "all"}:${rule.window}:${rule.categoryCode}:${rule.window === "rolling" ? rule.windowDays ?? "missing" : ""}`;
}
function evaluatePurchaseLimits(input, pack) {
  const applicableRules = pack.purchaseLimits.filter((rule) => rule.capacity === input.capacity);
  if (applicableRules.length === 0) throw new Error("No purchase-limit policy exists for this buyer capacity");
  const unmatchedCategory = Object.entries(input.categoryTotals).find(([category, quantity]) => quantity > 0 && !applicableRules.some((rule) => rule.categoryCode === category));
  if (unmatchedCategory) throw new Error(`No purchase-limit policy exists for purchased category ${unmatchedCategory[0]}`);
  const decisions = applicableRules.map((rule) => {
    const current = input.categoryTotals[rule.categoryCode] || 0;
    const prior = rule.window === "transaction" ? 0 : input.priorWindowTotals[purchaseLimitKey(rule)] || 0;
    const total = current + prior;
    return { ...rule, current, prior, total, allowed: total <= rule.maxEquivalencyMicrounits };
  });
  if (decisions.length === 0) throw new Error("No purchase-limit policy exists for this buyer capacity");
  const denied = decisions.find((decision) => !decision.allowed);
  if (denied) throw new Error(`Configured ${denied.window} purchase limit exceeded for ${denied.categoryCode}`);
  return decisions;
}
function requireTaxRule(taxRules, categoryCode, capacity) {
  const matches = taxRules.filter((rule) => rule.categoryCode === categoryCode && (rule.capacity === capacity || rule.capacity === "all"));
  if (matches.length !== 1) throw new Error("Exactly one supported tax rule must match the product category and buyer capacity");
  return matches[0];
}
function calculateDiscountCents(subtotalCents, rule, now = /* @__PURE__ */ new Date()) {
  if (!Number.isSafeInteger(subtotalCents) || subtotalCents < 0 || !Number.isSafeInteger(rule.value) || rule.value < 0) throw new Error("Discount inputs must be non-negative safe integers");
  if (asTime(rule.startsAt) > now.getTime() || asTime(rule.expiresAt) <= now.getTime()) throw new Error("Discount rule is outside its effective interval");
  const discount = rule.type === "basis_points" ? Math.round(subtotalCents * rule.value / 1e4) : rule.value;
  if (discount > subtotalCents) throw new Error("Discount cannot exceed subtotal");
  if (rule.minimumLineTotalCents != null && subtotalCents - discount < rule.minimumLineTotalCents) throw new Error("Discount would violate the configured minimum line total");
  return discount;
}
function calculateTaxCents(subtotalCents, discountCents, basisPoints) {
  for (const [label, value] of Object.entries({ subtotalCents, discountCents, basisPoints })) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative safe integer`);
  }
  if (discountCents > subtotalCents) throw new Error("Discount cannot exceed subtotal");
  return Math.round((subtotalCents - discountCents) * basisPoints / 1e4);
}
function assertTenderAllowed(type, amountCents, totalCents, allowed2) {
  if (!allowed2.includes(type)) throw new Error("Tender type is not enabled by the active authority pack");
  if (!Number.isSafeInteger(amountCents) || !Number.isSafeInteger(totalCents) || amountCents < 0 || totalCents < 0) throw new Error("Tender amounts must be non-negative integer cents");
}
function assertTransition(current, next, transitions) {
  if (!transitions[current]?.includes(next)) throw new Error(`Invalid transition from ${current} to ${next}`);
}
function assertInventoryEventQuantityDelta(eventType, deltaMicrounits) {
  if (["release", "reserve", "release_reservation"].includes(eventType) && deltaMicrounits !== 0) {
    throw new Error(`Inventory ${eventType} cannot change physical package quantity`);
  }
}
function assertInventoryDestructionQuantityDelta(eventType, quantityOnHandMicrounits, deltaMicrounits) {
  if (eventType !== "destruction") return;
  if (!Number.isSafeInteger(quantityOnHandMicrounits) || quantityOnHandMicrounits < 0 || !Number.isSafeInteger(deltaMicrounits) || deltaMicrounits !== -quantityOnHandMicrounits) {
    throw new Error("Destruction must remove all remaining physical package quantity");
  }
}
var PACKAGE_TRANSITIONS = {
  expected_inbound: ["receiving_hold"],
  receiving_hold: ["quarantined", "saleable"],
  quarantined: ["saleable", "recalled", "waste_pending"],
  saleable: ["reserved", "transfer_allocated", "quarantined", "recalled", "waste_pending", "depleted"],
  reserved: ["saleable", "staged"],
  staged: ["saleable", "depleted"],
  transfer_allocated: ["saleable", "in_transit"],
  in_transit: ["receiving_hold"],
  waste_pending: ["destroyed"],
  recalled: ["quarantined", "destroyed"],
  depleted: [],
  destroyed: []
};
var COUNT_CORRECTABLE_STATUSES = /* @__PURE__ */ new Set(["saleable", "quarantined"]);
function countCorrectionError(pkg, deltaMicrounits) {
  if (!COUNT_CORRECTABLE_STATUSES.has(String(pkg.status))) return `A ${String(pkg.status).replaceAll("_", " ")} package's count can't be corrected here`;
  if (!Number.isSafeInteger(deltaMicrounits) || deltaMicrounits === 0) return "Enter the counted difference, more or less than zero";
  const after = pkg.quantityOnHandMicrounits + deltaMicrounits;
  if (!Number.isSafeInteger(after) || after < 0) return "The correction would leave less than zero on hand";
  if (after < pkg.reservedMicrounits) return "The correction would leave less than open carts hold; cancel those carts first";
  return null;
}

// features/keystone/mutations/onboarding.ts
var REQUIRED_ACTIVITIES = ["authority", "eligibility", "inventory", "sale", "cash", "state_reporting", "incident"];
var TENDER_TYPES = /* @__PURE__ */ new Set(["cash", "debit", "ach", "wallet", "other"]);
function date(value, label) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`${label} must be an ISO date-time`);
  return parsed;
}
function validate(input) {
  const requiredArrays = [[input.authorizedActivities, "license activities"], [input.staffAllowedActivities, "staff activities"], [input.ruleAuthorityCitations, "authority citations"], [input.purchaseLimits, "purchase limits"], [input.taxRules, "tax rules"], [input.allowedTenderTypes, "allowed tenders"], [input.labelRequirements, "label requirements"], [input.tenderConfigurations, "tender configurations"]];
  for (const [value, label] of requiredArrays) if (!Array.isArray(value) || value.length === 0) throw new Error(`Owner-supplied ${label} are required`);
  if (!Array.isArray(input.discountRules)) throw new Error("Owner-supplied discount rules must be an array; use an empty array to prohibit discounts");
  for (const [value, label] of [[input.returnRules, "return"], [input.outagePolicy, "outage"], [input.privacyRules, "privacy"], [input.retentionRules, "retention"]]) if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length === 0) throw new Error(`Owner-supplied ${label} rules are required`);
  for (const activity of REQUIRED_ACTIVITIES) if (!input.authorizedActivities.includes(activity) || !input.staffAllowedActivities.includes(activity)) throw new Error(`Authority pack must explicitly include ${activity}`);
  const licenseEffectiveAt = date(input.licenseEffectiveAt, "License effective date");
  const licenseExpiresAt = date(input.licenseExpiresAt, "License expiry");
  const credentialEffectiveAt = date(input.credentialEffectiveAt, "Credential effective date");
  const credentialExpiresAt = date(input.credentialExpiresAt, "Credential expiry");
  const ruleEffectiveAt = date(input.ruleEffectiveAt, "Rule effective date");
  const ruleExpiresAt = date(input.ruleExpiresAt, "Rule expiry");
  if (!isValidTimeZone(input.timezone)) throw new Error("Timezone must be an IANA time zone such as America/Denver");
  if (!isSupportedCurrencyCode(input.currencyCode)) throw new Error("Currency must be a three-letter ISO 4217 code with two decimal places, such as USD or CAD");
  if (licenseEffectiveAt >= licenseExpiresAt || credentialEffectiveAt >= credentialExpiresAt || ruleEffectiveAt >= ruleExpiresAt) throw new Error("Authority effective dates must precede expiry dates");
  assertInteger(input.adultMinimumAge, "Adult minimum age", 0, 120);
  assertInteger(input.medicalMinimumAge, "Medical minimum age", 0, 120);
  assertInteger(input.operatingStartMinute, "Operating start minute", 0, 1439);
  assertInteger(input.operatingEndMinute, "Operating end minute", 0, 1439);
  for (const tender of input.tenderConfigurations) {
    if (!TENDER_TYPES.has(tender.type)) throw new Error("Tender configuration type is unsupported");
    if (!input.allowedTenderTypes.includes(tender.type)) throw new Error("Every tender configuration must be allowed by the rule pack");
    date(tender.effectiveAt, "Tender effective date");
    date(tender.expiresAt, "Tender expiry");
  }
  if (input.allowedTenderTypes.some((type) => !TENDER_TYPES.has(type))) throw new Error("Allowed tender types must be cash, debit, ach, wallet or other");
  if (typeof input.staffEvidenceHash !== "string" || input.staffEvidenceHash.trim().length < 16) throw new Error("Credential evidence reference must contain at least 16 characters");
  if (input.ownerApprovalLimitCents !== void 0) assertInteger(input.ownerApprovalLimitCents, "Your approval limit", 0);
  assertEffectiveRulePack({
    id: "onboarding",
    version: String(input.ruleVersion ?? ""),
    status: "effective",
    approvedAt: /* @__PURE__ */ new Date(),
    jurisdictionCode: String(input.jurisdictionCode ?? ""),
    effectiveAt: ruleEffectiveAt,
    expiresAt: ruleExpiresAt,
    adultMinimumAge: input.adultMinimumAge,
    medicalMinimumAge: input.medicalMinimumAge,
    medicalEnabled: input.medicalEnabled === true,
    operatingStartMinute: input.operatingStartMinute,
    operatingEndMinute: input.operatingEndMinute,
    purchaseLimits: input.purchaseLimits,
    taxRules: input.taxRules,
    allowedTenderTypes: input.allowedTenderTypes,
    offlineSalesAllowed: false
  });
  return {
    licenseEffectiveAt,
    licenseExpiresAt,
    credentialEffectiveAt,
    credentialExpiresAt,
    ruleEffectiveAt,
    ruleExpiresAt,
    addressSnapshot: assertJsonValue(input.addressSnapshot, "Premises address snapshot"),
    ruleAuthorityCitations: assertJsonValue(input.ruleAuthorityCitations, "Rule authority citations"),
    purchaseLimits: assertJsonValue(input.purchaseLimits, "Purchase limits"),
    taxRules: assertJsonValue(input.taxRules, "Tax rules"),
    discountRules: assertJsonValue(input.discountRules, "Discount rules"),
    allowedTenderTypes: assertJsonValue(input.allowedTenderTypes, "Allowed tender types"),
    labelRequirements: assertJsonValue(input.labelRequirements, "Label requirements"),
    returnRules: assertJsonValue(input.returnRules, "Return rules"),
    outagePolicy: assertJsonValue(input.outagePolicy, "Outage policy"),
    privacyRules: assertJsonValue(input.privacyRules, "Privacy rules"),
    retentionRules: assertJsonValue(input.retentionRules, "Retention rules")
  };
}
async function provisionStaffAuthority(_root, args, context) {
  const input = args.input;
  return runControlledOperation(context, input, { permission: "canManageAuthority", activity: "authority", scope: "provisionStaffAuthority", resourceType: "StaffCredential", action: "staff.authority.provisioned", lockKeys: [String(input.email).toLowerCase()] }, async (tx, authority) => {
    const sudo = tx.sudo();
    const email = assertText(input.email, "Staff email", 3, 320).toLowerCase();
    if (await sudo.query.User.findOne({ where: { email }, query: "id" })) throw new Error("Staff email already exists");
    const password2 = assertText(input.temporaryPassword, "Temporary password", 10, 1e3);
    const grantor = await sudo.query.User.findOne({ where: { id: authority.actor.id }, query: `role { ${permissionNames.join(" ")} }` });
    const requested = input.permissions && typeof input.permissions === "object" ? input.permissions : {};
    const roleData = Object.fromEntries(permissionNames.map((permission) => [permission, requested[permission] === true]));
    roleData.canAccessDashboard = true;
    roleData.canManageOnboarding = false;
    for (const permission of permissionNames) if (roleData[permission] && grantor?.role?.[permission] !== true) throw new Error("You can only delegate permissions you currently hold");
    const own = authority.actor.staffCredential;
    const activities = input.allowedActivities;
    if (!Array.isArray(activities) || activities.length === 0 || activities.some((activity) => typeof activity !== "string")) throw new Error("Staff allowed activities are required");
    if (activities.some((activity) => !own?.allowedActivities?.includes(activity) || !authority.license.authorizedActivities?.includes(activity))) throw new Error("Staff activities must be within your own credential and the premises license");
    const effectiveAt = date(input.effectiveAt, "Credential effective date");
    const expiresAt = date(input.expiresAt, "Credential expiry");
    if (effectiveAt >= expiresAt) throw new Error("Credential effective date must precede expiry");
    const ceiling = Math.min(new Date(own.expiresAt).getTime(), new Date(authority.license.expiresAt).getTime());
    if (expiresAt.getTime() > ceiling) throw new Error("Staff credential cannot outlast your own credential or the premises license");
    const approvalLimitCents = assertInteger(input.approvalLimitCents ?? 0, "Approval limit", 0);
    if (approvalLimitCents > (own.approvalLimitCents ?? 0)) throw new Error("Approval limit cannot exceed your own");
    const role = await sudo.query.Role.createOne({ data: { organization: { connect: { id: authority.organizationId } }, name: assertText(input.roleName, "Role name"), ...roleData }, query: "id" });
    const user = await sudo.query.User.createOne({ data: { name: assertText(input.name, "Staff name"), email, password: password2, status: "active", organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, role: { connect: { id: role.id } }, onboardingStatus: "completed" }, query: "id" });
    const credential = await sudo.query.StaffCredential.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, user: { connect: { id: user.id } }, credentialType: assertText(input.credentialType, "Credential type"), credentialReference: assertText(input.credentialReference, "Credential reference"), allowedActivities: activities, approvalLimitCents, status: "active", effectiveAt, expiresAt, trainingVerifiedAt: input.trainingVerifiedAt ? date(input.trainingVerifiedAt, "Training date") : null, authorityVerifiedAt: null, evidenceHash: stableHash({ attestedBy: authority.actor.id, credentialReference: input.credentialReference, credentialType: input.credentialType }) }, query: "id status" });
    await sudo.query.User.updateOne({ where: { id: user.id }, data: { staffCredential: { connect: { id: credential.id } } }, query: "id" });
    return { id: credential.id, status: credential.status, reference: user.id };
  });
}
async function runCannabisOnboarding(_root, args, context) {
  const input = args.input;
  const dates = validate(input);
  const session = context.session;
  if (!session?.itemId || session.data?.status === "disabled" || session.data?.role?.canManageOnboarding !== true) throw new Error("Only an active human onboarding owner may install an authority pack");
  const actor = await context.sudo().query.User.findOne({ where: { id: session.itemId }, query: "id status onboardingStatus organization { id } role { canManageOnboarding }" });
  if (!actor || actor.status !== "active" || actor.role?.canManageOnboarding !== true) throw new Error("Current onboarding authority is unavailable");
  if (actor.onboardingStatus === "completed" || actor.organization?.id) throw new Error("Onboarding is already completed; authority changes require controlled compliance workflows");
  const digest = stableHash(input);
  const key = assertText(input.idempotencyKey, "Idempotency key", 8, 200);
  return serializableTransaction(context, async (tx) => {
    await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "openfront-cannabis-onboarding", session.itemId);
    const sudo = tx.sudo();
    const current = await sudo.query.User.findOne({ where: { id: session.itemId }, query: "id onboardingStatus organization { id }" });
    if (!current || current.onboardingStatus === "completed" || current.organization?.id) throw new Error("Onboarding cannot be replayed over existing authority");
    await sudo.query.User.updateOne({ where: { id: current.id }, data: { onboardingStatus: "in_progress" }, query: "id" });
    const organization = await sudo.query.Organization.createOne({ data: { name: assertText(input.organizationName, "Organization name"), legalName: assertText(input.legalName, "Legal name"), jurisdictionCode: assertText(input.jurisdictionCode, "Jurisdiction code"), status: "pending_authority" }, query: "id" });
    const premises = await sudo.query.Premises.createOne({ data: { organization: { connect: { id: organization.id } }, name: assertText(input.premisesName, "Premises name"), premisesCode: assertText(input.premisesCode, "Premises code"), addressSnapshot: dates.addressSnapshot, timezone: input.timezone, currencyCode: input.currencyCode, status: "pending_authority" }, query: "id" });
    const roleData = Object.fromEntries(permissionNames.map((permission) => [permission, true]));
    const ownerRole = await sudo.query.Role.createOne({ data: { organization: { connect: { id: organization.id } }, name: "Owner", ...roleData }, query: "id" });
    await sudo.query.CannabisLicense.createOne({ data: { organization: { connect: { id: organization.id } }, premises: { connect: { id: premises.id } }, licenseNumber: assertText(input.licenseNumber, "License number"), licenseType: assertText(input.licenseType, "License type"), regulatorName: assertText(input.regulatorName, "Regulator"), authorityReference: assertText(input.authorityReference, "License authority reference"), authorizedActivities: input.authorizedActivities, status: "active", effectiveAt: dates.licenseEffectiveAt, expiresAt: dates.licenseExpiresAt, verifiedAt: null }, query: "id" });
    const credential = await sudo.query.StaffCredential.createOne({ data: { organization: { connect: { id: organization.id } }, premises: { connect: { id: premises.id } }, user: { connect: { id: current.id } }, credentialType: assertText(input.credentialType, "Credential type"), credentialReference: assertText(input.credentialReference, "Credential reference"), allowedActivities: input.staffAllowedActivities, approvalLimitCents: input.ownerApprovalLimitCents ?? 0, status: "active", effectiveAt: dates.credentialEffectiveAt, expiresAt: dates.credentialExpiresAt, trainingVerifiedAt: null, authorityVerifiedAt: null, evidenceHash: assertText(input.staffEvidenceHash, "Credential evidence hash", 16, 500) }, query: "id" });
    const policyHash = stableHash(policyIdentity({ ...input, deliveryEnabled: false, offlineSalesAllowed: false }));
    const rule = await sudo.query.JurisdictionRulePack.createOne({ data: { organization: { connect: { id: organization.id } }, premises: { connect: { id: premises.id } }, version: assertText(input.ruleVersion, "Rule version"), jurisdictionCode: input.jurisdictionCode, authorityCitations: dates.ruleAuthorityCitations, policyHash, status: "effective", effectiveAt: dates.ruleEffectiveAt, expiresAt: dates.ruleExpiresAt, approvedAt: /* @__PURE__ */ new Date(), approvedBy: { connect: { id: current.id } }, adultMinimumAge: input.adultMinimumAge, medicalMinimumAge: input.medicalMinimumAge, operatingStartMinute: input.operatingStartMinute, operatingEndMinute: input.operatingEndMinute, purchaseLimits: dates.purchaseLimits, taxRules: dates.taxRules, discountRules: dates.discountRules, allowedTenderTypes: dates.allowedTenderTypes, labelRequirements: dates.labelRequirements, returnRules: dates.returnRules, outagePolicy: dates.outagePolicy, privacyRules: dates.privacyRules, retentionRules: dates.retentionRules, medicalEnabled: input.medicalEnabled, pickupEnabled: input.pickupEnabled, deliveryEnabled: false, offlineSalesAllowed: false }, query: "id" });
    const existingManual = await sudo.query.PaymentProvider.findOne({ where: { code: "pp_manual_pickup" }, query: "id" });
    const manualProvider = existingManual || await sudo.query.PaymentProvider.createOne({ data: { name: "Pay at pickup: cash or debit", code: "pp_manual_pickup", isInstalled: true, credentials: {}, metadata: {}, createPaymentFunction: "manual", capturePaymentFunction: "manual", refundPaymentFunction: "manual", getPaymentStatusFunction: "manual", generatePaymentLinkFunction: "manual", handleWebhookFunction: "manual" }, query: "id" });
    const existingAeropay = await sudo.query.PaymentProvider.findOne({ where: { code: "pp_aeropay_aeropay" }, query: "id" });
    if (!existingAeropay) await sudo.query.PaymentProvider.createOne({ data: { name: "Aeropay", code: "pp_aeropay_aeropay", isInstalled: false, credentials: {}, metadata: {}, createPaymentFunction: "aeropay", capturePaymentFunction: "aeropay", refundPaymentFunction: "aeropay", getPaymentStatusFunction: "aeropay", generatePaymentLinkFunction: "aeropay", handleWebhookFunction: "aeropay" }, query: "id" });
    for (const tender of input.tenderConfigurations) await sudo.query.TenderConfiguration.createOne({ data: { organization: { connect: { id: organization.id } }, premises: { connect: { id: premises.id } }, code: tender.code, type: tender.type, displayName: tender.displayName, enabled: true, ...tender.type === "debit" ? { paymentProvider: { connect: { id: manualProvider.id } }, providerCode: "pp_manual_pickup" } : {}, authorityReference: tender.authorityReference, effectiveAt: date(tender.effectiveAt, "Tender effective date"), expiresAt: date(tender.expiresAt, "Tender expiry") }, query: "id" });
    await sudo.query.IntegrationInstallation.createOne({ data: { organization: { connect: { id: organization.id } }, premises: { connect: { id: premises.id } }, providerCode: assertText(input.traceabilityProviderCode, "Traceability provider code"), providerType: "traceability", status: "unconfigured", authorityReference: assertText(input.traceabilityAuthorityReference, "Traceability authority reference"), capabilities: [] }, query: "id" });
    const storefrontSettings = await sudo.query.StorefrontSettings.createOne({ data: {
      organization: { connect: { id: organization.id } },
      premises: { connect: { id: premises.id } },
      businessName: assertText(input.organizationName, "Organization name", 1, 120),
      brandHue: NEUTRAL_STOREFRONT_HUE,
      publicationStatus: "published",
      storefrontMode: "configured"
    }, query: "id publicationStatus" });
    await sudo.query.Organization.updateOne({ where: { id: organization.id }, data: { status: "active" }, query: "id" });
    await sudo.query.Premises.updateOne({ where: { id: premises.id }, data: { status: "active" }, query: "id" });
    await sudo.query.User.updateOne({ where: { id: current.id }, data: { organization: { connect: { id: organization.id } }, premises: { connect: { id: premises.id } }, role: { connect: { id: ownerRole.id } }, staffCredential: { connect: { id: credential.id } }, onboardingStatus: "completed" }, query: "id" });
    await sudo.query.AuditEvent.createOne({ data: { organization: { connect: { id: organization.id } }, premises: { connect: { id: premises.id } }, actor: { connect: { id: current.id } }, action: "authority_pack.installed", resourceType: "JurisdictionRulePack", resourceId: rule.id, correlationId: key, reasonCode: "owner_supplied_authority_pack", evidence: { digest, storefrontSettingsId: storefrontSettings.id, provenance: "owner_attested" }, evidenceHash: digest, occurredAt: /* @__PURE__ */ new Date() }, query: "id" });
    return { id: organization.id, status: "completed", reference: premises.id, authorityPackHash: digest };
  });
}
async function dismissCannabisOnboarding(_root, _args, context) {
  const session = context.session;
  if (!session?.itemId) throw new Error("Authentication required");
  const user = await context.sudo().query.User.findOne({ where: { id: session.itemId }, query: "id status onboardingStatus" });
  if (!user || user.status !== "active") throw new Error("Authentication required");
  if (user.onboardingStatus === "completed") return { status: "completed" };
  await context.sudo().query.User.updateOne({ where: { id: user.id }, data: { onboardingStatus: "dismissed" }, query: "id" });
  return { status: "dismissed" };
}

// features/keystone/mutations/receipts.ts
async function cannabisCommandReceipt(_root, args, context) {
  const authority = await requireReadAuthority(context, "canAccessDashboard");
  const scope = assertText(args.input?.scope, "Command scope", 3, 100);
  const key = assertText(args.input?.idempotencyKey, "Idempotency key", 8, 200);
  const lookupKey = `${authority.organizationId}:${authority.premisesId}:${scope}:${key}`;
  const receipt = await context.sudo().query.IdempotencyKey.findOne({ where: { lookupKey }, query: "id scope status requestSnapshot responseSnapshot startedAt completedAt actor { id }" });
  if (!receipt || receipt.actor?.id !== authority.actor.id) return { state: "not_found" };
  return {
    state: receipt.status,
    scope: receipt.scope,
    startedAt: receipt.startedAt,
    completedAt: receipt.completedAt ?? null,
    request: receipt.requestSnapshot ?? null,
    result: receipt.status === "succeeded" ? receipt.responseSnapshot : null
  };
}
async function cannabisSaleReceipt(_root, args, context) {
  let authority;
  try {
    authority = await requireReadAuthority(context, "canManageSales");
  } catch {
    return { state: "forbidden" };
  }
  const saleId = assertText(args.saleId, "Sale ID", 1, 100);
  const sale = await context.sudo().query.Sale.findOne({ where: { id: saleId }, query: `id receiptNumber status finalizedAt customerCapacitySnapshot rulePackVersion subtotalCents discountCents taxCents totalCents refundedCents receiptSnapshot organization { id } premises { id }
    lines(orderBy: [{ createdAt: asc }], take: 100) { id titleSnapshot skuSnapshot packageUidSnapshot batchSnapshot quantityMicrounits unitPriceCents discountCents taxCents totalCents package { unitOfMeasure } } linesCount
    tenders(take: 20) { id typeSnapshot amountCents changeCents status } refunds(orderBy: [{ occurredAt: desc }], take: 20) { id amountCents status reasonCode occurredAt }` });
  if (!sale || sale.organization?.id !== authority.organizationId || sale.premises?.id !== authority.premisesId) return { state: "not_found" };
  const snapshot = sale.receiptSnapshot && typeof sale.receiptSnapshot === "object" && !Array.isArray(sale.receiptSnapshot) ? sale.receiptSnapshot : {};
  const { organization: _organization, premises: _premises, receiptSnapshot: _receiptSnapshot, ...detail } = sale;
  return { state: "ok", sale: { ...detail, currencyCode: typeof snapshot.currencyCode === "string" ? snapshot.currencyCode : null, linesHasMore: Number(sale.linesCount) > 100 } };
}

// features/keystone/domain/runtimeCapabilities.ts
var enabledCapabilities = /* @__PURE__ */ new Set([
  // Read-only public menu: implemented in mutations/public.ts, listing only released, lab-passed,
  // unexpired, unheld packages with free quantity, each re-checked by assertPackageSaleable.
  "storefront.public-live-menu",
  // Owner sign-off 2026-10-24 for in-store regulated sales. Each command below is
  // permission- and credential-checked, idempotent and audited. Hold release, shift
  // close and refunds keep a second person, who re-enters their own password for
  // that one command (mutations/approval.ts).
  "inventory.action-bound-approval",
  // hold release (recall holds close through their recall)
  "identity.verified-eligibility",
  // staff ID check at the counter
  "commerce.pos-cart",
  "commerce.reservation-ledger",
  // cart lines reserve stock; cancel releases it
  "commerce.sale-finalization",
  "provider.traceability-acceptance",
  "provider.payment-capture",
  // non-cash tenders carry the card terminal's approval reference
  "finance.action-bound-approval",
  // blind-count shift close
  "finance.verified-refunds"
]);
function requireRuntimeCapability(capability2, reason) {
  if (!enabledCapabilities.has(capability2)) throw new Error(reason);
}
function isRuntimeCapabilityEnabled(capability2) {
  return enabledCapabilities.has(capability2);
}

// features/keystone/mutations/approval.ts
var import_bcryptjs = __toESM(require("bcryptjs"));
var APPROVAL_FAILED = "Approver email or password is incorrect";
async function verifySecondApprover(context, raw, permission) {
  const input = raw || {};
  const email = assertText(input.approverEmail, "Approver email", 3, 320).toLowerCase();
  const password2 = typeof input.approverPassword === "string" ? input.approverPassword : "";
  if (!password2 || password2.length > 1e3) throw new Error(APPROVAL_FAILED);
  const approver = await context.sudo().db.User.findOne({ where: { email } });
  const matches = await import_bcryptjs.default.compare(password2, typeof approver?.password === "string" ? approver.password : "$2a$10$gYkqdfuI69EYQnEGtCg/z.NwCTZ5qkedyZ1tQ7LGTrhYPXpI0tcVO");
  if (!approver || !matches) throw new Error(APPROVAL_FAILED);
  if (approver.id === context.session?.itemId) throw new Error("The second approver must be someone else");
  const current = await context.sudo().query.User.findOne({ where: { id: approver.id }, query: `id status organization { id } premises { id } role { ${permission} } staffCredential { status effectiveAt expiresAt }` });
  const credential = current?.staffCredential;
  const now = Date.now();
  if (!current || current.status !== "active" || current.role?.[permission] !== true || !credential || credential.status !== "active" || !(new Date(credential.effectiveAt).getTime() <= now) || !(new Date(credential.expiresAt).getTime() > now)) throw new Error("The approver's role or credential does not allow this approval");
  return String(approver.id);
}
function withApprover(input, approvedById) {
  const { approverEmail: _email, approverPassword: _password, ...rest } = input || {};
  return { ...rest, approvedById };
}

// features/keystone/mutations/inventory.ts
var EVENT_STATUS = {
  release: ["saleable"],
  reserve: ["reserved"],
  release_reservation: ["saleable"],
  transfer_out: ["transfer_allocated", "in_transit"],
  transfer_in: ["receiving_hold"],
  count: ["saleable", "quarantined"],
  adjustment: ["saleable", "quarantined"],
  waste: ["waste_pending"],
  destruction: ["destroyed"],
  recall_hold: ["recalled"],
  recall_release: ["quarantined"],
  return_quarantine: ["quarantined"]
};
var isManagedInventoryEventType = (value) => value in EVENT_STATUS;
var DUAL_APPROVAL = /* @__PURE__ */ new Set(["count", "adjustment", "waste", "destruction", "recall_hold", "recall_release"]);
var DATE_ONLY2 = /^\d{4}-\d{2}-\d{2}$/;
var optionalText = (value, label, max = 200) => value == null || value === "" ? null : assertText(value, label, 1, max);
async function receiveCannabisPackage(_root, args, context) {
  const input = args.input;
  assertInteger(input.quantityMicrounits, "Received quantity", 1);
  const expiresInput = assertText(input.expiresAt, "Expiry", 10, 40);
  if (!DATE_ONLY2.test(expiresInput) && !Number.isFinite(new Date(expiresInput).getTime())) throw new Error("Expiry must be a date");
  const manifestNumber = assertText(input.manifestNumber, "Manifest number");
  const reasonCode = assertReasonCode(input.reasonCode);
  return runControlledOperation(context, input, { permission: "canManageInventory", activity: "inventory", scope: "receiveCannabisPackage", resourceType: "InventoryPackage", action: "inventory.package.received", lockKeys: [`package:${String(input.packageUid)}`, `manifest:${manifestNumber}`] }, async (tx, authority, correlationId) => {
    const sudo = tx.sudo();
    const timezone = authority.actor.premises?.timezone;
    const expiry = DATE_ONLY2.test(expiresInput) ? endOfLocalDate(expiresInput, timezone) : new Date(expiresInput);
    if (!(expiry.getTime() > Date.now())) throw new Error("Received package expiry must be in the future");
    const manufacturedAt = input.manufacturedAt ? DATE_ONLY2.test(String(input.manufacturedAt)) ? endOfLocalDate(String(input.manufacturedAt), timezone) : new Date(String(input.manufacturedAt)) : null;
    if (manufacturedAt && !Number.isFinite(manufacturedAt.getTime())) throw new Error("Manufactured date is invalid");
    const product = await sudo.query.Product.findOne({ where: { id: assertText(input.productId, "Product ID") }, query: "id organization { id } premises { id } status unitOfMeasure" });
    if (!product || product.organization?.id !== authority.organizationId || product.premises?.id !== authority.premisesId || product.status !== "active") throw new Error("Active product is not available in this premises");
    const existing = await sudo.query.InventoryPackage.findOne({ where: { packageUid: assertText(input.packageUid, "Package UID") }, query: "id" });
    if (existing) throw new Error("Package UID already exists");
    const sourceLicenseNumber = assertText(input.sourceLicenseNumber, "Source license");
    const evidence = { origin: "manual_entry_unverified", expiryInput: expiresInput, timezone, ...input.evidence && typeof input.evidence === "object" ? { submitted: input.evidence } : {} };
    const evidenceHash = stableHash(evidence);
    const prior = await sudo.query.RegulatedManifest.findOne({ where: { manifestNumber }, query: "id manifestNumber type status sourceLicenseNumber organization { id } premises { id }" });
    if (prior && (prior.organization?.id !== authority.organizationId || prior.premises?.id !== authority.premisesId || prior.type !== "receiving" || prior.sourceLicenseNumber !== sourceLicenseNumber)) throw new Error("This manifest number is already recorded for a different transfer");
    const manifest = prior ?? await sudo.query.RegulatedManifest.createOne({ data: {
      organization: { connect: { id: authority.organizationId } },
      premises: { connect: { id: authority.premisesId } },
      manifestNumber,
      type: "receiving",
      status: "receiving_hold",
      sourceLicenseNumber,
      destinationLicenseNumber: authority.license.licenseNumber,
      regulatorManifestId: optionalText(input.regulatorManifestId, "Regulator manifest ID") ?? "",
      occurredAt: /* @__PURE__ */ new Date(),
      reasonCode,
      evidence,
      evidenceHash,
      actor: { connect: { id: authority.actor.id } }
    }, query: "id manifestNumber" });
    const inventoryPackage = await sudo.query.InventoryPackage.createOne({ data: {
      organization: { connect: { id: authority.organizationId } },
      premises: { connect: { id: authority.premisesId } },
      product: { connect: { id: product.id } },
      packageUid: input.packageUid,
      sourcePackageUid: optionalText(input.sourcePackageUid, "Source package UID") ?? "",
      productionBatchNumber: assertText(input.productionBatchNumber, "Production batch"),
      lotNumber: assertText(input.lotNumber, "Lot number"),
      quantityReceivedMicrounits: input.quantityMicrounits,
      quantityOnHandMicrounits: input.quantityMicrounits,
      reservedMicrounits: 0,
      unitOfMeasure: product.unitOfMeasure,
      status: "receiving_hold",
      testStatus: "unknown",
      labName: optionalText(input.labName, "Lab name") ?? "",
      labResultReference: optionalText(input.labResultReference, "Lab result reference") ?? "",
      coaReference: optionalText(input.coaReference, "COA reference") ?? "",
      manufacturedAt,
      receivedAt: /* @__PURE__ */ new Date(),
      expiresAt: expiry,
      labelVersion: assertText(input.labelVersion, "Label version"),
      potencySnapshot: {},
      lineage: [],
      version: 1
    }, query: "id packageUid status testStatus expiresAt" });
    await sudo.query.InventoryEvent.createOne({ data: {
      organization: { connect: { id: authority.organizationId } },
      premises: { connect: { id: authority.premisesId } },
      package: { connect: { id: inventoryPackage.id } },
      manifest: { connect: { id: manifest.id } },
      eventType: "receive",
      quantityDeltaMicrounits: input.quantityMicrounits,
      beforeQuantityMicrounits: 0,
      afterQuantityMicrounits: input.quantityMicrounits,
      reasonCode,
      actor: { connect: { id: authority.actor.id } },
      sourceType: "RegulatedManifest",
      sourceId: manifest.id,
      idempotencyKey: `${correlationId}:receive`,
      occurredAt: /* @__PURE__ */ new Date(),
      evidenceHash,
      stateReportStatus: "queued"
    }, query: "id" });
    return { id: inventoryPackage.id, status: inventoryPackage.status, testStatus: inventoryPackage.testStatus, expiresAt: inventoryPackage.expiresAt, reference: manifest.manifestNumber, manifestAttached: Boolean(prior), stateReport: { eventType: "receive", packageUid: inventoryPackage.packageUid, quantityMicrounits: input.quantityMicrounits, unitOfMeasure: product.unitOfMeasure, manifestNumber: manifest.manifestNumber } };
  });
}
async function releasePackageHold(_root, args, context) {
  requireRuntimeCapability("inventory.action-bound-approval", "Hold release is disabled until an authenticated, action-bound second-party approval workflow is implemented.");
  const input = withApprover(args.input, await verifySecondApprover(context, args.input, "canManageCompliance"));
  if (!input.approvedById || input.approvedById === context.session?.itemId) throw new Error("Hold release requires an independent compliance approver");
  return runControlledOperation(context, input, { permission: "canManageCompliance", activity: "inventory", scope: "releasePackageHold", resourceType: "PackageHold", action: "inventory.hold.released", lockKeys: [String(input.holdId)] }, async (tx, authority) => {
    const sudo = tx.sudo();
    const hold = await sudo.query.PackageHold.findOne({ where: { id: assertText(input.holdId, "Hold ID") }, query: "id type status organization { id } premises { id } package { id packageUid status }" });
    if (!hold || hold.status !== "active" || hold.organization?.id !== authority.organizationId || hold.premises?.id !== authority.premisesId) throw new Error("Active hold is outside this authority scope");
    if (hold.type === "recall") throw new Error("Recall holds are released by closing their recall");
    const approver = await sudo.query.User.findOne({ where: { id: input.approvedById }, query: "id status organization { id } premises { id } role { canManageCompliance }" });
    if (!approver || approver.status !== "active" || !approver.role?.canManageCompliance || approver.organization?.id !== authority.organizationId || approver.premises?.id !== authority.premisesId) throw new Error("Approver lacks current compliance authority");
    await sudo.query.PackageHold.updateOne({ where: { id: hold.id }, data: { status: "released", releasedBy: { connect: { id: approver.id } }, releasedAt: /* @__PURE__ */ new Date(), releaseAuthorityReference: assertText(input.releaseAuthorityReference, "Release authority reference") }, query: "id" });
    return { id: hold.id, status: "released", reference: hold.package.packageUid };
  });
}
async function postCannabisInventoryEvent(_root, args, context) {
  requireRuntimeCapability("inventory.event-specific-custody", "Generic inventory events are disabled until event-specific conservation, approvals, and custody evidence are implemented.");
  const input = args.input;
  const eventType = assertText(input.eventType, "Event type");
  if (!isManagedInventoryEventType(eventType) || !EVENT_STATUS[eventType].includes(input.nextStatus)) throw new Error("Event type cannot produce the requested package status");
  const delta = assertInteger(Math.abs(input.quantityDeltaMicrounits), "Quantity delta", 0) * (input.quantityDeltaMicrounits < 0 ? -1 : 1);
  assertInventoryEventQuantityDelta(eventType, delta);
  const expectedVersion = assertInteger(input.expectedVersion, "Expected package version", 1);
  if (DUAL_APPROVAL.has(eventType) && (!input.approvedById || input.approvedById === context.session?.itemId)) throw new Error("This inventory event requires an independent approver");
  return runControlledOperation(context, input, { permission: eventType.startsWith("recall") ? "canManageCompliance" : "canManageInventory", activity: "inventory", scope: `postInventory:${eventType}`, resourceType: "InventoryPackage", action: `inventory.${eventType}`, lockKeys: [String(input.packageId)] }, async (tx, authority, correlationId) => {
    const sudo = tx.sudo();
    const pkg = await sudo.query.InventoryPackage.findOne({ where: { id: assertText(input.packageId, "Package ID") }, query: "id packageUid status testStatus expiresAt coaReference labelVersion quantityOnHandMicrounits reservedMicrounits version organization { id } premises { id } holds(where: { status: { equals: active } }, take: 1) { id }" });
    if (!pkg || pkg.organization?.id !== authority.organizationId || pkg.premises?.id !== authority.premisesId) throw new Error("Package is outside the actor authority scope");
    assertInventoryDestructionQuantityDelta(eventType, pkg.quantityOnHandMicrounits, delta);
    assertTransition(pkg.status, input.nextStatus, PACKAGE_TRANSITIONS);
    if (input.nextStatus === "saleable" && (pkg.testStatus !== "passed" || !pkg.coaReference || !pkg.labelVersion || new Date(pkg.expiresAt) <= /* @__PURE__ */ new Date() || pkg.holds?.length)) throw new Error("Package cannot be released without passed tests, authoritative COA/label, future expiry, and no active holds");
    const after = pkg.quantityOnHandMicrounits + delta;
    if (!Number.isSafeInteger(after) || after < 0 || after < pkg.reservedMicrounits) throw new Error("Inventory event would violate package quantity or reservations");
    if (pkg.version !== expectedVersion) throw new Error("Package changed; recount and retry with the current version");
    const updated = await tx.prisma.inventoryPackage.updateMany({ where: { id: pkg.id, version: expectedVersion, quantityOnHandMicrounits: pkg.quantityOnHandMicrounits }, data: { quantityOnHandMicrounits: after, status: input.nextStatus, version: { increment: 1 } } });
    if (updated.count !== 1) throw new Error("Concurrent package update detected");
    let approver = null;
    if (input.approvedById) {
      approver = await sudo.query.User.findOne({ where: { id: input.approvedById }, query: "id status organization { id } premises { id } role { canManageCompliance canManageInventory }" });
      if (!approver || approver.status !== "active" || approver.organization?.id !== authority.organizationId || approver.premises?.id !== authority.premisesId || !approver.role?.canManageCompliance && !approver.role?.canManageInventory) throw new Error("Independent approver lacks current premises authority");
    }
    const evidenceHash = stableHash(input.evidence || {});
    const manifest = await sudo.query.RegulatedManifest.createOne({ data: {
      organization: { connect: { id: authority.organizationId } },
      premises: { connect: { id: authority.premisesId } },
      manifestNumber: assertText(input.manifestNumber, "Manifest number"),
      type: eventType === "transfer_out" || eventType === "transfer_in" ? eventType : eventType === "recall_hold" || eventType === "recall_release" ? "recall" : eventType === "count" ? "count" : eventType === "waste" ? "waste" : eventType === "destruction" ? "destruction" : "adjustment",
      status: eventType === "transfer_out" ? "dispatched" : input.nextStatus === "destroyed" ? "completed" : "accepted",
      sourceLicenseNumber: input.sourceLicenseNumber || authority.license.licenseNumber,
      destinationLicenseNumber: input.destinationLicenseNumber || authority.license.licenseNumber,
      regulatorManifestId: input.regulatorManifestId || "",
      occurredAt: /* @__PURE__ */ new Date(),
      reasonCode: assertText(input.reasonCode, "Reason code"),
      evidence: input.evidence || {},
      evidenceHash,
      actor: { connect: { id: authority.actor.id } },
      ...approver ? { approvedBy: { connect: { id: approver.id } } } : {}
    }, query: "id manifestNumber" });
    await sudo.query.InventoryEvent.createOne({ data: {
      organization: { connect: { id: authority.organizationId } },
      premises: { connect: { id: authority.premisesId } },
      package: { connect: { id: pkg.id } },
      manifest: { connect: { id: manifest.id } },
      eventType,
      quantityDeltaMicrounits: delta,
      beforeQuantityMicrounits: pkg.quantityOnHandMicrounits,
      afterQuantityMicrounits: after,
      reasonCode: input.reasonCode,
      actor: { connect: { id: authority.actor.id } },
      ...approver ? { approvedBy: { connect: { id: approver.id } } } : {},
      sourceType: "RegulatedManifest",
      sourceId: manifest.id,
      idempotencyKey: `${correlationId}:${eventType}`,
      occurredAt: /* @__PURE__ */ new Date(),
      evidenceHash,
      stateReportStatus: "queued"
    }, query: "id" });
    if (eventType === "recall_hold") {
      await sudo.query.PackageHold.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, package: { connect: { id: pkg.id } }, type: "recall", status: "active", reasonCode: input.reasonCode, reason: assertText(input.reason, "Recall reason", 4), placedBy: { connect: { id: authority.actor.id } }, placedAt: /* @__PURE__ */ new Date(), evidenceHash }, query: "id" });
      await sudo.query.RecallCase.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, reference: assertText(input.recallReference, "Recall reference"), status: "active", authorityReference: assertText(input.recallAuthorityReference, "Recall authority reference"), packageUids: [pkg.packageUid], batchNumbers: input.batchNumbers || [], reason: input.reason, openedAt: /* @__PURE__ */ new Date(), evidenceHash }, query: "id" });
    }
    return { id: pkg.id, status: input.nextStatus, reference: pkg.packageUid, quantityOnHandMicrounits: after, version: expectedVersion + 1, stateReport: { eventType, packageUid: pkg.packageUid, quantityDeltaMicrounits: delta, manifestNumber: manifest.manifestNumber, reasonCode: input.reasonCode } };
  });
}
var MAX_COUNT_CORRECTION_MICROUNITS = 1e9;
async function recordCannabisCountCorrection(_root, args, context) {
  const raw = args.input || {};
  const delta = Number(raw.quantityDeltaMicrounits);
  if (!Number.isSafeInteger(delta) || delta === 0 || Math.abs(delta) > MAX_COUNT_CORRECTION_MICROUNITS) throw new Error("Enter the counted difference, more or less than zero");
  const expectedVersion = assertInteger(raw.expectedVersion, "Expected package version", 1);
  const note = assertText(raw.note, "Count note", 4, 500);
  const input = withApprover(raw, await verifySecondApprover(context, raw, "canManageCompliance"));
  const packageId = assertText(input.packageId, "Package ID");
  return runControlledOperation(context, input, { permission: "canManageInventory", activity: "inventory", scope: "recordCannabisCountCorrection", resourceType: "InventoryPackage", action: "inventory.count_correction", lockKeys: [`package:${packageId}`] }, async (tx, authority, correlationId) => {
    const sudo = tx.sudo();
    const pkg = await sudo.query.InventoryPackage.findOne({ where: { id: packageId }, query: "id packageUid status quantityOnHandMicrounits reservedMicrounits version organization { id } premises { id }" });
    if (!pkg || pkg.organization?.id !== authority.organizationId || pkg.premises?.id !== authority.premisesId) throw new Error("Package is outside this premises");
    if (pkg.version !== expectedVersion) throw new Error("This package changed since you counted it. Refresh and count again.");
    const refused = countCorrectionError(pkg, delta);
    if (refused) throw new Error(refused);
    const after = pkg.quantityOnHandMicrounits + delta;
    const approver = await sudo.query.User.findOne({ where: { id: input.approvedById }, query: "id status organization { id } premises { id } role { canManageCompliance }" });
    if (!approver || approver.id === authority.actor.id || approver.status !== "active" || !approver.role?.canManageCompliance || approver.organization?.id !== authority.organizationId || approver.premises?.id !== authority.premisesId) throw new Error("The second approver needs compliance authority at this premises");
    const changed = await tx.prisma.inventoryPackage.updateMany({ where: { id: pkg.id, version: expectedVersion, quantityOnHandMicrounits: pkg.quantityOnHandMicrounits, status: pkg.status }, data: { quantityOnHandMicrounits: after, version: { increment: 1 } } });
    if (changed.count !== 1) throw new Error("This package changed since you counted it. Refresh and count again.");
    const evidence = { note, countedBy: authority.actor.id, approvedBy: approver.id };
    const evidenceHash = stableHash(evidence);
    const manifest = await sudo.query.RegulatedManifest.createOne({ data: {
      organization: { connect: { id: authority.organizationId } },
      premises: { connect: { id: authority.premisesId } },
      manifestNumber: `COUNT-${correlationId}`,
      type: "count",
      status: "accepted",
      sourceLicenseNumber: authority.license.licenseNumber,
      destinationLicenseNumber: authority.license.licenseNumber,
      regulatorManifestId: "",
      occurredAt: /* @__PURE__ */ new Date(),
      reasonCode: "count_correction",
      evidence,
      evidenceHash,
      actor: { connect: { id: authority.actor.id } },
      approvedBy: { connect: { id: approver.id } }
    }, query: "id manifestNumber" });
    await sudo.query.InventoryEvent.createOne({ data: {
      organization: { connect: { id: authority.organizationId } },
      premises: { connect: { id: authority.premisesId } },
      package: { connect: { id: pkg.id } },
      manifest: { connect: { id: manifest.id } },
      eventType: "count",
      quantityDeltaMicrounits: delta,
      beforeQuantityMicrounits: pkg.quantityOnHandMicrounits,
      afterQuantityMicrounits: after,
      reasonCode: "count_correction",
      actor: { connect: { id: authority.actor.id } },
      approvedBy: { connect: { id: approver.id } },
      sourceType: "RegulatedManifest",
      sourceId: manifest.id,
      idempotencyKey: `${correlationId}:count`,
      occurredAt: /* @__PURE__ */ new Date(),
      evidenceHash,
      stateReportStatus: "queued"
    }, query: "id" });
    return { id: pkg.id, status: String(pkg.status), reference: pkg.packageUid, quantityOnHandMicrounits: after, version: expectedVersion + 1, stateReport: { eventType: "count", packageUid: pkg.packageUid, quantityDeltaMicrounits: delta, manifestNumber: manifest.manifestNumber, reasonCode: "count_correction" } };
  });
}

// features/keystone/mutations/public.ts
var import_node_crypto5 = require("node:crypto");

// features/keystone/utils/paymentProviderConfig.ts
function isPaymentProviderConfigured(code) {
  if (code.startsWith("pp_manual")) return true;
  if (code.startsWith("pp_aeropay")) return Boolean(process.env.AEROPAY_API_KEY && process.env.AEROPAY_API_SECRET && process.env.AEROPAY_MERCHANT_ID && process.env.AEROPAY_WEBHOOK_SECRET && process.env.AEROPAY_BANK_ACCOUNT_ID);
  if (code.startsWith("pp_authorizenet")) return Boolean(process.env.AUTHORIZENET_API_LOGIN_ID && process.env.AUTHORIZENET_TRANSACTION_KEY && process.env.NEXT_PUBLIC_AUTHORIZENET_CLIENT_KEY && process.env.NEXT_PUBLIC_AUTHORIZENET_API_LOGIN_ID === process.env.AUTHORIZENET_API_LOGIN_ID);
  return false;
}
function getPublicPaymentProviderConfig(code) {
  if (!isPaymentProviderConfigured(code)) return null;
  if (code.startsWith("pp_authorizenet")) return { provider: "authorizenet", apiLoginId: process.env.AUTHORIZENET_API_LOGIN_ID, clientKey: process.env.NEXT_PUBLIC_AUTHORIZENET_CLIENT_KEY, env: process.env.AUTHORIZENET_ENV === "production" ? "production" : "sandbox" };
  return null;
}

// features/keystone/mutations/onlinePayments.ts
var import_node_crypto4 = require("node:crypto");

// features/integrations/payment/index.ts
var paymentProviderAdapters = {
  manual: () => Promise.resolve().then(() => (init_manual(), manual_exports)),
  aeropay: () => Promise.resolve().then(() => (init_aeropay(), aeropay_exports)),
  authorizenet: () => Promise.resolve().then(() => (init_authorizenet(), authorizenet_exports))
};

// features/keystone/utils/paymentProviderAdapter.ts
var ADAPTERS = new Set(Object.keys(paymentProviderAdapters));
var OPERATIONS = /* @__PURE__ */ new Set(["createPaymentFunction", "capturePaymentFunction", "refundPaymentFunction", "getPaymentStatusFunction", "generatePaymentLinkFunction", "handleWebhookFunction"]);
function paymentAdapterPayload(provider, args) {
  const input = {};
  for (const key of ["cart", "order", "amount", "currency", "idempotencyKey", "paymentId", "refundId", "event", "headers", "rawBody", "opaqueData", "captureNow"]) if (args?.[key] !== void 0) input[key] = args[key];
  if (input.headers && typeof input.headers === "object") input.headers = Object.fromEntries(Object.entries(input.headers).filter(([key]) => key.toLowerCase().startsWith("x-aeropay-") || key.toLowerCase().startsWith("x-anet-") || key.toLowerCase().startsWith("stripe-") || key.toLowerCase().startsWith("paypal-")));
  return { ...input, provider: { id: provider.id, code: provider.code, credentials: provider.credentials || {} } };
}
async function executeAdapterFunction({ provider, functionName, args }) {
  if (!OPERATIONS.has(functionName)) throw new Error("Unknown payment adapter operation");
  const selected = provider?.[functionName];
  if (typeof selected !== "string") throw new Error("Payment adapter is not configured");
  if (/^https?:/i.test(selected)) throw new Error("External payment adapters are not enabled for this vertical");
  if (!ADAPTERS.has(selected)) throw new Error("Unknown registered payment adapter");
  const adapter = await paymentProviderAdapters[selected]();
  if (typeof adapter[functionName] !== "function") throw new Error("Payment adapter operation is unavailable");
  try {
    return await adapter[functionName](paymentAdapterPayload(provider, args));
  } catch {
    throw new Error(`Payment adapter ${functionName} failed; reconcile the original attempt before retrying`);
  }
}
var createPayment = (p2) => executeAdapterFunction({ provider: p2.provider, functionName: "createPaymentFunction", args: p2 });
var capturePayment = (p2) => executeAdapterFunction({ provider: p2.provider, functionName: "capturePaymentFunction", args: p2 });
var refundPayment = (p2) => executeAdapterFunction({ provider: p2.provider, functionName: "refundPaymentFunction", args: p2 });

// features/keystone/domain/lifecycles.ts
function tenderStatusFromCapture(providerStatus) {
  if (providerStatus === "captured" || providerStatus === "succeeded") return "captured";
  throw new Error("Payment capture is ambiguous");
}
var FINALIZABLE_CART_STATUSES = ["reserved", "staged"];
var RELEASABLE_PAYMENT_STATUSES = ["authorized", "void_failed"];
function customerBlocksSale(status5) {
  return status5 === "suspended" || status5 === "ineligible";
}
var EXPIRABLE_CART_STATUSES = ["preliminarily_eligible", "reserved", "picking", "staged"];
function saleVoidError(sale) {
  if (["reversed", "reversal_pending"].includes(sale.status)) return "This sale is already voided";
  if (["refunded", "partially_refunded"].includes(sale.status) || sale.refundedCents > 0) return "A sale with a refund can't be voided; refund the rest instead";
  if (sale.shiftStatus !== "open") return "Only a sale on a still-open shift can be voided; refund it instead";
  if (sale.tenderTypes.some((type) => type !== "cash")) return "A card sale is refunded through its terminal, not voided";
  if (sale.tenderStatuses.some((status5) => status5 !== "received")) return "A tender on this sale has already moved; refund it instead";
  if (sale.packageStatuses.some((status5) => !["saleable", "quarantined"].includes(status5))) return "A package on this sale is no longer on the shelf; refund the sale and correct the count instead";
  return null;
}

// features/keystone/mutations/onlinePayments.ts
var CARD_PROVIDER_CODE = "pp_authorizenet_authorizenet";
var PROVIDER_SELECTION = "id code isInstalled credentials createPaymentFunction capturePaymentFunction refundPaymentFunction getPaymentStatusFunction generatePaymentLinkFunction handleWebhookFunction";
async function onlineCardProvider(context, scope, ensure) {
  if (!isPaymentProviderConfigured(CARD_PROVIDER_CODE)) return null;
  const sudo = context.sudo();
  let provider = await sudo.query.PaymentProvider.findOne({ where: { code: CARD_PROVIDER_CODE }, query: PROVIDER_SELECTION });
  if (!provider && ensure) {
    provider = await sudo.query.PaymentProvider.createOne({ data: {
      name: "Authorize.net",
      code: CARD_PROVIDER_CODE,
      isInstalled: true,
      credentials: {},
      metadata: {},
      createPaymentFunction: "authorizenet",
      capturePaymentFunction: "authorizenet",
      refundPaymentFunction: "authorizenet",
      getPaymentStatusFunction: "authorizenet",
      generatePaymentLinkFunction: "authorizenet",
      handleWebhookFunction: "authorizenet"
    }, query: PROVIDER_SELECTION });
  }
  if (provider && !provider.isInstalled) return null;
  if (!ensure) return provider ?? { code: CARD_PROVIDER_CODE };
  const now = /* @__PURE__ */ new Date();
  const debit = await sudo.query.TenderConfiguration.findMany({ where: { organization: { id: { equals: scope.organizationId } }, premises: { id: { equals: scope.premisesId } }, type: { equals: "debit" }, enabled: { equals: true }, effectiveAt: { lte: now }, expiresAt: { gt: now } }, take: 2, query: "id paymentProvider { id }" });
  if (debit.length !== 1) return null;
  if (!debit[0].paymentProvider) await sudo.query.TenderConfiguration.updateOne({ where: { id: debit[0].id }, data: { paymentProvider: { connect: { id: provider.id } }, providerCode: CARD_PROVIDER_CODE }, query: "id" });
  else if (debit[0].paymentProvider.id !== provider.id) return null;
  return provider;
}
async function releaseOnlinePayment(context, cartId) {
  const sudo = context.sudo();
  const cart = await sudo.query.Cart.findOne({ where: { id: cartId }, query: "id reference paymentMethod paymentStatus paymentReference totalCents organization { id } premises { id }" });
  if (!cart || cart.paymentMethod !== "card" || !RELEASABLE_PAYMENT_STATUSES.includes(cart.paymentStatus) || !cart.paymentReference) return null;
  const provider = await sudo.query.PaymentProvider.findOne({ where: { code: CARD_PROVIDER_CODE }, query: PROVIDER_SELECTION });
  let released = false;
  try {
    if (provider) {
      const result = await refundPayment({ provider, paymentId: cart.paymentReference, amount: cart.totalCents, currency: "USD", idempotencyKey: `release${cart.reference}` });
      released = ["refunded", "canceled", "voided"].includes(String(result?.status));
    }
  } catch {
    released = false;
  }
  await sudo.query.Cart.updateOne({ where: { id: cart.id }, data: { paymentStatus: released ? "voided" : "void_failed" }, query: "id" });
  if (!released) {
    await sudo.query.ComplianceIncident.createOne({ data: {
      organization: { connect: { id: cart.organization.id } },
      premises: { connect: { id: cart.premises.id } },
      reference: `INC-PAY-${(0, import_node_crypto4.randomUUID)()}`,
      type: "payment_ambiguity",
      severity: "high",
      status: "open",
      occurredAt: /* @__PURE__ */ new Date(),
      detectedAt: /* @__PURE__ */ new Date(),
      description: `Card authorization for online order ${cart.reference} could not be released; void it in the card processor and reconcile.`,
      affectedPackageUids: [],
      customerReferenceHash: (0, import_node_crypto4.createHash)("sha256").update(cart.id).digest("hex"),
      evidenceHash: (0, import_node_crypto4.createHash)("sha256").update(`${cart.id}:${cart.paymentReference}:release_failed`).digest("hex")
    }, query: "id" });
  }
  return released ? "voided" : "void_failed";
}

// features/keystone/mutations/public.ts
var proofHash = (value) => (0, import_node_crypto5.createHash)("sha256").update(value).digest("hex");
var PublicScopeMissing = class extends Error {
};
async function publicScope(context) {
  const organizations = await context.sudo().query.Organization.findMany({ where: { status: { equals: "active" } }, take: 2, query: "id jurisdictionCode premises(where: { status: { equals: active } }, take: 2) { id timezone currencyCode addressSnapshot }" });
  if (organizations.length !== 1 || organizations[0].premises?.length !== 1) throw new PublicScopeMissing("Public service is unavailable until exactly one authority scope is active");
  return { organization: organizations[0], premises: organizations[0].premises[0] };
}
async function publicAuthority(context) {
  const { organization, premises } = await publicScope(context);
  const pack = await requireRulePack(context, organization.id, premises.id);
  assertEffectiveRulePack(pack);
  return { organization, premises, pack };
}
async function publicVisit(context, scope) {
  const address = scope.premises.addressSnapshot && typeof scope.premises.addressSnapshot === "object" && !Array.isArray(scope.premises.addressSnapshot) ? scope.premises.addressSnapshot : {};
  const pick = (key) => typeof address[key] === "string" && address[key].trim() ? address[key].trim().slice(0, 200) : null;
  let hours = null;
  let tenders = [];
  let minimumAge = null;
  let medicalMinimumAge = null;
  let cardOnline = false;
  let pickupEnabled = false;
  try {
    const pack = await requireRulePack(context, scope.organization.id, scope.premises.id);
    assertEffectiveRulePack(pack);
    hours = { opensMinute: pack.operatingStartMinute, closesMinute: pack.operatingEndMinute };
    tenders = Array.isArray(pack.allowedTenderTypes) ? pack.allowedTenderTypes.filter((type) => typeof type === "string").slice(0, 10) : [];
    minimumAge = pack.adultMinimumAge;
    medicalMinimumAge = pack.medicalEnabled ? pack.medicalMinimumAge : null;
    pickupEnabled = pack.pickupEnabled === true;
    cardOnline = pack.pickupEnabled === true && tenders.includes("debit") && isPaymentProviderConfigured(CARD_PROVIDER_CODE);
  } catch {
  }
  return { address: { line1: pick("line1"), city: pick("city"), region: pick("region"), postalCode: pick("postalCode"), country: pick("country") }, phone: pick("phone"), timezone: scope.premises.timezone ?? null, hours, tenders, minimumAge, medicalMinimumAge, cardOnline, pickupEnabled };
}
async function publicCannabisStorefrontSettings(_root, _args, context) {
  let authority;
  try {
    authority = await publicScope(context);
  } catch (error) {
    return error instanceof PublicScopeMissing ? { ...NEUTRAL_STOREFRONT_SETTINGS } : { ...NEUTRAL_STOREFRONT_SETTINGS, unavailable: true };
  }
  try {
    const settings = await context.sudo().query.StorefrontSettings.findMany({
      where: {
        organization: { id: { equals: authority.organization.id } },
        premises: { id: { equals: authority.premises.id } },
        publicationStatus: { equals: "published" }
      },
      orderBy: [{ createdAt: "asc" }],
      take: 2,
      query: "businessName tagline description brandHue logoIcon logoColor heroImage { url } publicationStatus storefrontMode"
    });
    if (settings.length > 1) return { ...NEUTRAL_STOREFRONT_SETTINGS, unavailable: true };
    if (settings.length !== 1) return { ...NEUTRAL_STOREFRONT_SETTINGS };
    const projected = projectPublicStorefrontSettings(settings[0]);
    return projected.isConfigured ? { ...projected, coverUrl: settings[0].heroImage?.url ?? null, visit: await publicVisit(context, authority) } : projected;
  } catch {
    return { ...NEUTRAL_STOREFRONT_SETTINGS, unavailable: true };
  }
}
async function publicCannabisMenu(_root, _args, context) {
  let authority;
  try {
    authority = await publicAuthority(context);
  } catch (error) {
    return { unavailable: true, reason: error instanceof PublicScopeMissing ? "not_set_up" : "sales_rules", products: [] };
  }
  if (!isRuntimeCapabilityEnabled("storefront.public-live-menu")) return { unavailable: true, reason: "sales_rules", products: [] };
  const scope = { organization: { id: { equals: authority.organization.id } }, premises: { id: { equals: authority.premises.id } } };
  const [packages] = await Promise.all([
    context.sudo().query.InventoryPackage.findMany({
      where: { ...scope, status: { equals: "saleable" }, testStatus: { equals: "passed" }, expiresAt: { gt: /* @__PURE__ */ new Date() }, quantityOnHandMicrounits: { gt: 0 } },
      orderBy: [{ expiresAt: "asc" }, { createdAt: "asc" }],
      take: 201,
      query: "id status testStatus expiresAt quantityOnHandMicrounits reservedMicrounits coaReference labelVersion holds(where: { status: { equals: active } }, take: 1) { id } product { id name sku form categoryCode unitQuantityMicrounits priceCents publicDescription publicImageUrl photo { url } adultUseEligible medicalEligible status } premises { id }"
    })
  ]);
  if (packages.length > 200) throw new Error("Menu projection exceeds its bounded source page and requires operator review");
  const products = /* @__PURE__ */ new Map();
  for (const pkg of packages) {
    const premisesId2 = pkg.premises?.id;
    if (!premisesId2 || premisesId2 !== authority.premises.id || !pkg.product || pkg.product.status !== "active") continue;
    try {
      assertPackageSaleable({ status: pkg.status, testStatus: pkg.testStatus, expiresAt: pkg.expiresAt, premisesId: premisesId2, quantityOnHandMicrounits: pkg.quantityOnHandMicrounits, reservedMicrounits: pkg.reservedMicrounits, activeHoldCount: pkg.holds?.length || 0, coaReference: pkg.coaReference, labelVersion: pkg.labelVersion }, authority.premises.id, pkg.product.unitQuantityMicrounits);
    } catch {
      continue;
    }
    if (!products.has(pkg.product.id)) products.set(pkg.product.id, { id: pkg.product.id, name: pkg.product.name, sku: pkg.product.sku, form: pkg.product.form, categoryCode: pkg.product.categoryCode, priceCents: pkg.product.priceCents, description: pkg.product.publicDescription, imageUrl: pkg.product.photo?.url || pkg.product.publicImageUrl || null, adultUseEligible: pkg.product.adultUseEligible, medicalEligible: pkg.product.medicalEligible, available: true });
  }
  return { jurisdictionCode: authority.organization.jurisdictionCode, rulePackVersion: authority.pack.version, currencyCode: authority.premises.currencyCode ?? null, products: [...products.values()] };
}
async function submitCannabisCustomerIntake(_root, args, context) {
  requireRuntimeCapability("privacy.approved-intake", "Customer identity intake is disabled until owner-approved privacy, retention, abuse-limiting, and atomic-recovery controls are implemented.");
  const input = args.input;
  const authority = await publicAuthority(context);
  const capacity = input.capacity;
  if (!["adult_use", "patient", "caregiver"].includes(capacity)) throw new Error("Unsupported buyer capacity");
  if (capacity !== "adult_use" && !authority.pack.medicalEnabled) throw new Error("Medical intake is not enabled");
  const email = assertText(input.email, "Email", 3, 320).toLowerCase();
  const dobDate = calendarDate(input.dateOfBirth);
  const idExpiry = calendarDate(input.identityExpiresAt);
  if (!dobDate || !idExpiry) throw new Error("Identity dates must be real calendar dates (YYYY-MM-DD)");
  const dateOfBirth = /* @__PURE__ */ new Date(`${dobDate.text}T00:00:00.000Z`);
  const identityExpiresAt = endOfLocalDate(idExpiry.text, authority.premises.timezone);
  const identityMethod = assertText(input.identityMethod, "Identity method");
  const identityReferenceHash = assertText(input.identityReferenceHash, "Identity reference hash", 16, 500);
  const optionalIntakeText = (value, label) => value == null || value === "" ? null : assertText(value, label, 1, 500);
  const registryName = optionalIntakeText(input.registryName, "Registry name");
  const registryReferenceHash = optionalIntakeText(input.registryReferenceHash, "Registry reference hash");
  const representedPatientReferenceHash = optionalIntakeText(input.representedPatientReferenceHash, "Represented patient reference hash");
  const proof = (0, import_node_crypto5.randomBytes)(32).toString("base64url");
  const reference = `INTAKE-${(0, import_node_crypto5.randomUUID)()}`;
  const sudo = context.sudo();
  const customer = await sudo.query.Customer.createOne({ data: { organization: { connect: { id: authority.organization.id } }, premises: { connect: { id: authority.premises.id } }, reference, capacity, status: "pending_verification", intakeProofHash: proofHash(proof), contact: { email }, marketingConsent: input.marketingConsent === true }, query: "id reference" });
  await sudo.query.EligibilityEvidence.createOne({ data: { organization: { connect: { id: authority.organization.id } }, premises: { connect: { id: authority.premises.id } }, customer: { connect: { id: customer.id } }, capacity, identityMethod, identityReferenceHash, dateOfBirth, identityExpiresAt, registryName, registryReferenceHash, representedPatientReferenceHash, result: "pending", reasonCodes: ["staff_verification_required"], evidenceHash: stableHash({ capacity, identityMethod, identityReferenceHash, dateOfBirth: dateOfBirth.toISOString() }) }, query: "id" });
  return { reference, proof, status: "pending_verification", message: "Intake is not eligibility. Staff must verify current authority before reservation or sale." };
}
async function recordEligibilityDecision(_root, args, context) {
  requireRuntimeCapability("identity.verified-eligibility", "Eligibility decisions are disabled until current identity and registry evidence can be independently verified and recorded.");
  const input = args.input;
  return runControlledOperation(context, input, { permission: "canManageCompliance", activity: "eligibility", scope: "recordEligibilityDecision", resourceType: "EligibilityEvidence", action: "eligibility.decided" }, async (tx, authority) => {
    const sudo = tx.sudo();
    const pack = await requireRulePack(tx, authority.organizationId, authority.premisesId);
    assertEffectiveRulePack(pack);
    const customer = await sudo.query.Customer.findOne({ where: { id: assertText(input.customerId, "Customer ID") }, query: "id capacity status organization { id } premises { id }" });
    if (!customer || customer.organization?.id !== authority.organizationId || customer.premises?.id !== authority.premisesId) throw new Error("Customer is outside this premises authority");
    const timezone = authority.actor.premises?.timezone;
    const now = /* @__PURE__ */ new Date();
    const dobDate = calendarDate(input.dateOfBirth);
    const idExpiry = calendarDate(input.identityExpiresAt);
    if (!dobDate || !idExpiry || input.registryExpiresAt && !calendarDate(input.registryExpiresAt)) throw new Error("Identity dates must be real calendar dates (YYYY-MM-DD)");
    const dob = /* @__PURE__ */ new Date(`${dobDate.text}T00:00:00.000Z`);
    const identityExpiresAt = endOfLocalDate(idExpiry.text, timezone);
    const age = ageAtPremises(dobDate.text, now, timezone);
    if (age === null) throw new Error("Date of birth must not be in the future");
    assertEligibility({ capacity: customer.capacity, age, identityValid: identityExpiresAt > now && input.identityVerified === true, registryValid: input.registryVerified === true && (!input.registryExpiresAt || endOfLocalDate(calendarDate(input.registryExpiresAt).text, timezone) > now), representedPatientValid: input.representedPatientVerified === true }, pack);
    const evidenceHash = stableHash({ ...input, verifier: authority.actor.id, ruleVersion: pack.version });
    const evidence = await sudo.query.EligibilityEvidence.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, customer: { connect: { id: customer.id } }, capacity: customer.capacity, identityMethod: input.identityMethod, identityReferenceHash: input.identityReferenceHash, dateOfBirth: dob, identityExpiresAt, registryName: input.registryName || "", registryReferenceHash: input.registryReferenceHash || "", registryVerifiedAt: input.registryVerified ? now : null, registryExpiresAt: input.registryExpiresAt ? endOfLocalDate(calendarDate(input.registryExpiresAt).text, timezone) : null, representedPatientReferenceHash: input.representedPatientReferenceHash || "", allotmentRemainingMicrounits: input.allotmentRemainingMicrounits ?? null, result: "eligible", reasonCodes: ["configured_authority_verified"], evidenceHash, verifiedAt: now }, query: "id result" });
    await sudo.query.Customer.updateOne({ where: { id: customer.id }, data: { status: "eligible" }, query: "id" });
    return { id: evidence.id, status: evidence.result, reference: customer.id, rulePackVersion: pack.version };
  });
}

// features/keystone/mutations/commerce.ts
var import_node_crypto6 = require("node:crypto");

// features/keystone/domain/cartReservations.ts
var MAX_DATABASE_INT = 2147483647;
var CANCELLABLE_CART_STATUSES = ["preliminarily_eligible", "reserved", "picking", "staged"];
function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function planCartCancellation(snapshot) {
  if (!snapshot || typeof snapshot.id !== "string" || !snapshot.id) throw new Error("Cart snapshot is invalid");
  if (snapshot.status === "cancelled") return { disposition: "replay", cartId: snapshot.id };
  if (!CANCELLABLE_CART_STATUSES.includes(snapshot.status)) throw new Error("Cart is not cancellable");
  if (!Number.isSafeInteger(snapshot.version) || snapshot.version < 1 || snapshot.version > MAX_DATABASE_INT) throw new Error("Cart version is invalid");
  if (!Array.isArray(snapshot.lines) || snapshot.lines.length > 250) throw new Error("Cart reservation lines exceed the bounded cancellation contract");
  const releases = /* @__PURE__ */ new Map();
  let totalReleasedMicrounits = 0;
  for (const [index, value] of snapshot.lines.entries()) {
    if (!isRecord(value) || typeof value.id !== "string" || !value.id || !Number.isSafeInteger(value.quantityMicrounits) || value.quantityMicrounits < 1 || value.quantityMicrounits > MAX_DATABASE_INT || !isRecord(value.package) || typeof value.package.id !== "string" || !value.package.id) {
      throw new Error(`Cart reservation line ${index + 1} is invalid`);
    }
    const quantity = value.quantityMicrounits;
    const packageId = value.package.id;
    const group = releases.get(packageId) ?? { packageId, quantityMicrounits: 0, lineIds: [] };
    const groupedQuantity = group.quantityMicrounits + quantity;
    if (!Number.isSafeInteger(groupedQuantity) || groupedQuantity > MAX_DATABASE_INT) throw new Error("Grouped package release exceeds the database integer range");
    group.quantityMicrounits = groupedQuantity;
    group.lineIds.push(value.id);
    releases.set(packageId, group);
    totalReleasedMicrounits += quantity;
  }
  return {
    disposition: "cancel",
    cartId: snapshot.id,
    expectedStatus: snapshot.status,
    expectedVersion: snapshot.version,
    releases: [...releases.values()].map((group) => ({ ...group, lineIds: [...group.lineIds].sort() })).sort((left, right) => left.packageId.localeCompare(right.packageId)),
    releasedLines: snapshot.lines.length,
    totalReleasedMicrounits
  };
}
function assertCartCancellationFence(plan, current) {
  if (current.id !== plan.cartId || current.version !== plan.expectedVersion || current.status !== plan.expectedStatus || !CANCELLABLE_CART_STATUSES.includes(current.status)) {
    throw new Error("Cart state changed concurrently");
  }
}
function assertReservationCanBeReleased(reservedMicrounits, releaseMicrounits) {
  if (!Number.isSafeInteger(reservedMicrounits) || reservedMicrounits < 0 || reservedMicrounits > MAX_DATABASE_INT || !Number.isSafeInteger(releaseMicrounits) || releaseMicrounits < 1 || releaseMicrounits > MAX_DATABASE_INT) {
    throw new Error("Package reservation quantities are invalid");
  }
  if (reservedMicrounits < releaseMicrounits) throw new Error("Package reservation ledger is inconsistent");
  return reservedMicrounits - releaseMicrounits;
}

// features/keystone/domain/saleConservation.ts
var MAX_DATABASE_INT2 = 2147483647;
function isRecord2(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function groupSaleLinesByPackage(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 250) throw new Error("Sale requires 1-250 exact-package lines");
  const groups = /* @__PURE__ */ new Map();
  for (const [lineIndex, entry] of value.entries()) {
    if (!isRecord2(entry) || !isRecord2(entry.package) || typeof entry.package.id !== "string" || !entry.package.id || !Number.isSafeInteger(entry.quantityMicrounits) || entry.quantityMicrounits < 1 || entry.quantityMicrounits > MAX_DATABASE_INT2) {
      throw new Error(`Sale line ${lineIndex + 1} has an invalid package quantity`);
    }
    const packageId = entry.package.id;
    const quantity = entry.quantityMicrounits;
    const group = groups.get(packageId) ?? { packageId, quantityMicrounits: 0, lineIndexes: [] };
    const groupedQuantity = group.quantityMicrounits + quantity;
    if (!Number.isSafeInteger(groupedQuantity) || groupedQuantity > MAX_DATABASE_INT2) throw new Error("Grouped package sale exceeds the database integer range");
    group.quantityMicrounits = groupedQuantity;
    group.lineIndexes.push(lineIndex);
    groups.set(packageId, group);
  }
  return [...groups.values()].sort((left, right) => left.packageId.localeCompare(right.packageId));
}
function assertReservedPackageForSale(input, premisesId2, requestedMicrounits, now = /* @__PURE__ */ new Date()) {
  if (input.premisesId !== premisesId2) throw new Error("Package belongs to a different licensed premises");
  if (input.status !== "saleable" || input.testStatus !== "passed") throw new Error("Package is not released and saleable");
  if (!Number.isSafeInteger(input.activeHoldCount) || input.activeHoldCount < 0 || input.activeHoldCount > 0) throw new Error("Package has an active hold");
  const expiresAt = new Date(input.expiresAt).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) throw new Error("Package is expired");
  if (!input.coaReference || !input.labelVersion) throw new Error("Authoritative COA and label version are required");
  for (const [label, quantity] of [["on-hand", input.quantityOnHandMicrounits], ["reserved", input.reservedMicrounits], ["requested", requestedMicrounits]]) {
    if (!Number.isSafeInteger(quantity) || quantity < (label === "requested" ? 1 : 0) || quantity > MAX_DATABASE_INT2) throw new Error(`Package ${label} quantity is invalid`);
  }
  if (input.reservedMicrounits > input.quantityOnHandMicrounits) throw new Error("Package reservation exceeds physical on-hand quantity");
  if (input.quantityOnHandMicrounits < requestedMicrounits || input.reservedMicrounits < requestedMicrounits) throw new Error("Exact package reservation is insufficient for sale");
}
function planSaleLineBalances(lines, group, quantityOnHandMicrounits) {
  if (!Number.isSafeInteger(quantityOnHandMicrounits) || quantityOnHandMicrounits < group.quantityMicrounits) throw new Error("Physical on-hand quantity is insufficient for grouped sale");
  let remaining = quantityOnHandMicrounits;
  return group.lineIndexes.map((lineIndex) => {
    const line = lines[lineIndex];
    if (!line || line.package.id !== group.packageId || !Number.isSafeInteger(line.quantityMicrounits) || line.quantityMicrounits < 1) throw new Error("Sale line package grouping is inconsistent");
    const before = remaining;
    remaining -= line.quantityMicrounits;
    if (remaining < 0) throw new Error("Sale line allocation exceeds physical on-hand quantity");
    return { lineIndex, before, after: remaining };
  });
}
function assertFinalSaleCartFence(expected, current) {
  if (!FINALIZABLE_CART_STATUSES.includes(expected.status) || current.id !== expected.id || current.status !== expected.status || current.version !== expected.version) {
    throw new Error("Reserved cart state changed concurrently");
  }
}

// features/keystone/domain/packageAllocation.ts
var MAX_INT = 2147483647;
function readAllocationReceipt(value, resourceId, cartId) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const evidence = value;
  if (evidence.id !== resourceId || typeof evidence.quoteHash !== "string" || !/^[a-f0-9]{64}$/.test(evidence.quoteHash) || !evidence.quote || typeof evidence.quote !== "object" || Array.isArray(evidence.quote)) return null;
  const quote = evidence.quote;
  const quantity = quote.quantityMicrounits;
  const totalCents = quote.totalCents;
  if (quote.schemaVersion !== 1 || quote.cartId !== cartId || typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_INT || typeof totalCents !== "number" || !Number.isSafeInteger(totalCents) || totalCents < 0 || totalCents > MAX_INT) return null;
  return { quantityMicrounits: quantity, totalCents, quoteHash: evidence.quoteHash };
}
function choosePackageForProduct(rows, scope, productId, quantity, now = /* @__PURE__ */ new Date()) {
  if (!Array.isArray(rows) || rows.length > 51 || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_INT) throw new Error("Allocation source read is invalid");
  const candidates = rows.slice(0, 50).filter((pkg) => {
    if (!pkg || pkg.organization?.id !== scope.organizationId || pkg.premises?.id !== scope.premisesId || pkg.product?.id !== productId || pkg.product.organization?.id !== scope.organizationId || pkg.product.premises?.id !== scope.premisesId || pkg.product.status !== "active" || pkg.status !== "saleable" || pkg.testStatus !== "passed" || !Array.isArray(pkg.holds) || pkg.holds.length || !pkg.coaReference || !pkg.labelVersion || !(new Date(pkg.expiresAt).getTime() > now.getTime()) || !Number.isSafeInteger(pkg.reservedMicrounits) || !Number.isSafeInteger(pkg.quantityOnHandMicrounits) || pkg.reservedMicrounits < 0 || pkg.quantityOnHandMicrounits < pkg.reservedMicrounits || pkg.quantityOnHandMicrounits > MAX_INT || !Number.isSafeInteger(pkg.product.unitQuantityMicrounits) || pkg.product.unitQuantityMicrounits < 1 || quantity % pkg.product.unitQuantityMicrounits !== 0 || pkg.quantityOnHandMicrounits - pkg.reservedMicrounits < quantity) return false;
    return typeof pkg.id === "string" && Boolean(pkg.id);
  });
  candidates.sort((left, right) => new Date(left.expiresAt).getTime() - new Date(right.expiresAt).getTime() || left.id.localeCompare(right.id));
  if (!candidates.length) throw new Error(rows.length > 50 ? "Allocation source page needs continuation; no stock was allocated" : "No complete saleable unit is available");
  return candidates[0].id;
}
function assertReservationLedger(ledger, packageId, reserved, scope) {
  if (!Array.isArray(ledger) || ledger.length > 500 || !Number.isSafeInteger(reserved) || reserved < 0) throw new Error("Complete package allocation ledger is required");
  const ids = /* @__PURE__ */ new Set();
  let total = 0;
  for (const line of ledger) {
    if (!line || typeof line.id !== "string" || !line.id || ids.has(line.id) || line.package?.id !== packageId || line.organization?.id !== scope.organizationId || line.premises?.id !== scope.premisesId || line.cart?.organization?.id !== scope.organizationId || line.cart?.premises?.id !== scope.premisesId || !line.cart?.id || !["preliminarily_eligible", "reserved", "picking", "staged", "final_verification"].includes(line.cart.status) || !Number.isSafeInteger(line.quantityMicrounits) || line.quantityMicrounits < 1 || line.quantityMicrounits > MAX_INT) throw new Error("Package allocation evidence is ambiguous");
    ids.add(line.id);
    total += line.quantityMicrounits;
    if (!Number.isSafeInteger(total) || total > MAX_INT) throw new Error("Package allocation ledger exceeds integer range");
  }
  if (total !== reserved) throw new Error("Reservation counter does not match complete allocation ledger");
}
function planReservationBalances(onHand, reserved, requested) {
  if (![onHand, reserved, requested].every(Number.isSafeInteger) || onHand < 0 || reserved < 0 || requested < 1 || onHand > MAX_INT || reserved > MAX_INT || requested > MAX_INT || reserved + requested > onHand) {
    throw new Error("Reservation would violate exact-package quantity conservation");
  }
  return {
    beforeReservedMicrounits: reserved,
    afterReservedMicrounits: reserved + requested,
    beforeQuantityMicrounits: onHand,
    afterQuantityMicrounits: onHand,
    quantityDeltaMicrounits: 0
  };
}

// features/keystone/domain/allocationQuote.ts
function calculateAllocationQuote(pkg, cart, pack, quantity, promotionCode, authority, now = /* @__PURE__ */ new Date()) {
  const product = pkg.product;
  for (const value of [pkg.version, cart.version]) {
    if (!Number.isSafeInteger(value) || value < 1 || value >= 2147483647) throw new Error("Allocation quote version is invalid");
  }
  for (const value of [product.unitQuantityMicrounits, product.equivalencyMicrounits, quantity]) {
    if (!Number.isSafeInteger(value) || value < 1 || value > 2147483647) throw new Error("Allocation quote quantity is invalid");
  }
  if (!["adult_use", "patient", "caregiver"].includes(cart.customer.capacity) || pkg.unitOfMeasure !== product.unitOfMeasure || quantity % product.unitQuantityMicrounits !== 0 || product.status !== "active" || (cart.customer.capacity === "adult_use" ? !product.adultUseEligible : !product.medicalEligible)) throw new Error("Product unit/capacity is not eligible");
  const units = quantity / product.unitQuantityMicrounits;
  const subtotalCents = product.priceCents * units;
  const equivalencyMicrounits = product.equivalencyMicrounits * units;
  if (!Number.isSafeInteger(product.priceCents) || product.priceCents < 0 || !Number.isSafeInteger(subtotalCents) || subtotalCents > 2147483647 || !Number.isSafeInteger(equivalencyMicrounits) || equivalencyMicrounits > 2147483647) throw new Error("Allocation quote exceeds integer storage range");
  const taxRule = requireTaxRule(pack.taxRules, product.taxCategoryCode, cart.customer.capacity);
  let discountCents = 0;
  let discountSnapshot = {};
  if (promotionCode) {
    const discounts = (pack.discountRules || []).filter((candidate) => candidate.code === promotionCode && candidate.categoryCode === product.categoryCode && (candidate.capacity === cart.customer.capacity || candidate.capacity === "all"));
    if (discounts.length !== 1) throw new Error("Exactly one configured promotion must match");
    discountCents = calculateDiscountCents(subtotalCents, discounts[0], now);
    discountSnapshot = { code: discounts[0].code, type: discounts[0].type, value: discounts[0].value, authorityPackVersion: pack.version };
  }
  const taxCents = calculateTaxCents(subtotalCents, discountCents, taxRule.basisPoints);
  const totalCents = subtotalCents - discountCents + taxCents;
  if (!Number.isSafeInteger(totalCents) || totalCents > 2147483647) throw new Error("Quoted total exceeds integer storage range");
  const policySnapshot = JSON.parse(JSON.stringify(pack));
  const packageSnapshot = JSON.parse(JSON.stringify(pkg));
  return {
    schemaVersion: 1,
    policySnapshot,
    packageSnapshot,
    actorId: authority.actor.id,
    organizationId: authority.organizationId,
    premisesId: authority.premisesId,
    cartId: cart.id,
    cartVersion: cart.version,
    buyerCapacity: cart.customer.capacity,
    packageId: pkg.id,
    packageVersion: pkg.version,
    productId: product.id,
    unitOfMeasure: pkg.unitOfMeasure,
    unitQuantityMicrounits: product.unitQuantityMicrounits,
    units,
    quantityMicrounits: quantity,
    equivalencyMicrounits,
    unitPriceCents: product.priceCents,
    subtotalCents,
    discountCents,
    discountSnapshot,
    taxBasisPoints: taxRule.basisPoints,
    taxCents,
    totalCents,
    promotionCode,
    rulePackId: pack.id,
    rulePackVersion: pack.version
  };
}

// features/keystone/mutations/commerce.ts
var SYSTEM_CANCEL = Symbol("system-cancel");
var hash = (value) => (0, import_node_crypto6.createHash)("sha256").update(value).digest("hex");
function ageAt(dobValue, now, timezone) {
  return ageAtPremises(dobValue, now, timezone) ?? -1;
}
function localMinute(now, timezone) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) throw new Error("Premises timezone could not be evaluated");
  return hour * 60 + minute;
}
async function validateCustomerProof(context, customerId, proof) {
  const customer = await context.sudo().query.Customer.findOne({ where: { id: customerId }, query: "id reference capacity status intakeProofHash organization { id } premises { id }" });
  if (!customer || !customer.intakeProofHash || customer.intakeProofHash !== hash(assertText(proof, "Customer proof", 32, 500))) throw new Error("Customer proof is invalid");
  return customer;
}
async function purchaseWindowTotals(sudo, customerId, pack, now) {
  const priorSales = await sudo.query.Sale.findMany({ where: { customer: { id: { equals: customerId } }, finalizedAt: { gte: new Date(now.getTime() - 366 * 864e5) }, status: { in: ["finalized", "state_queued", "state_accepted", "state_rejected", "reconciled", "partially_refunded"] } }, orderBy: [{ finalizedAt: "desc" }], take: 1001, query: "finalizedAt lines { categoryCodeSnapshot equivalencyMicrounits }" });
  if (priorSales.length > 1e3) throw new Error("Purchase history exceeds bounded automatic evaluation and requires compliance review");
  const priorWindowTotals = {};
  for (const rule of pack.purchaseLimits) {
    const windowMs = rule.window === "day" ? 864e5 : rule.window === "rolling" ? assertInteger(rule.windowDays, "Rolling limit days", 1, 366) * 864e5 : rule.window === "allotment" ? 366 * 864e5 : 0;
    if (!windowMs) continue;
    priorWindowTotals[purchaseLimitKey(rule)] = priorSales.filter((sale) => now.getTime() - new Date(sale.finalizedAt).getTime() < windowMs).flatMap((sale) => sale.lines || []).filter((line) => line.categoryCodeSnapshot === rule.categoryCode).reduce((sum, line) => sum + line.equivalencyMicrounits, 0);
  }
  return priorWindowTotals;
}
async function createCustomerPickupCart(_root, args, context) {
  requireRuntimeCapability("commerce.customer-cart", "Customer carts are disabled until owned account/intake continuity and server-side allocation are implemented.");
  const input = args.input;
  const customer = await validateCustomerProof(context, assertText(input.customerId, "Customer ID"), input.proof);
  if (customer.status !== "eligible") throw new Error("Customer is not currently eligible");
  const pack = await requireRulePack(context, customer.organization.id, customer.premises.id);
  assertEffectiveRulePack(pack);
  if (!pack.pickupEnabled) throw new Error("Pickup reservations are not enabled by the active rule pack");
  const evidence = await context.sudo().query.EligibilityEvidence.findMany({ where: { customer: { id: { equals: customer.id } }, result: { equals: "eligible" }, identityExpiresAt: { gt: /* @__PURE__ */ new Date() } }, orderBy: [{ verifiedAt: "desc" }], take: 1, query: "id result registryExpiresAt capacity" });
  if (evidence.length !== 1 || customer.capacity !== "adult_use" && (!evidence[0].registryExpiresAt || new Date(evidence[0].registryExpiresAt) <= /* @__PURE__ */ new Date())) throw new Error("Exactly one current eligibility decision is required");
  const existing = await context.sudo().query.Cart.findMany({ where: { customer: { id: { equals: customer.id } }, status: { in: ["preliminarily_eligible", "reserved", "picking", "staged"] }, expiresAt: { gt: /* @__PURE__ */ new Date() } }, orderBy: [{ createdAt: "desc" }], take: 2, query: "id reference status expiresAt" });
  if (existing.length > 1) throw new Error("Multiple active carts require staff reconciliation");
  if (existing.length === 1) return { ...existing[0], proof: input.proof, replayed: true };
  const reference = `CART-${(0, import_node_crypto6.randomUUID)()}`;
  const expiresAt = new Date(Date.now() + 15 * 6e4);
  const cart = await context.sudo().query.Cart.createOne({ data: { organization: { connect: { id: customer.organization.id } }, premises: { connect: { id: customer.premises.id } }, customer: { connect: { id: customer.id } }, reference, source: "pickup", status: "preliminarily_eligible", guestProofHash: hash(input.proof), expiresAt, rulePack: { connect: { id: pack.id } }, eligibilityEvidence: { connect: { id: evidence[0].id } } }, query: "id reference status expiresAt" });
  return { ...cart, proof: input.proof };
}
async function createPosCannabisCart(_root, args, context) {
  requireRuntimeCapability("commerce.pos-cart", "POS carts are disabled until the verified customer and register workflow is implemented.");
  const input = args.input;
  return runControlledOperation(context, input, { permission: "canManageSales", activity: "sale", scope: "createPosCannabisCart", resourceType: "Cart", action: "cart.pos.created" }, async (tx, authority) => {
    const sudo = tx.sudo();
    const pack = await requireRulePack(tx, authority.organizationId, authority.premisesId);
    assertEffectiveRulePack(pack);
    const customer = await sudo.query.Customer.findOne({ where: { id: assertText(input.customerId, "Customer ID") }, query: "id capacity status organization { id } premises { id }" });
    const evidence = await sudo.query.EligibilityEvidence.findOne({ where: { id: assertText(input.eligibilityEvidenceId, "Eligibility evidence ID") }, query: "id customer { id } result identityExpiresAt registryExpiresAt" });
    const shift = await sudo.query.RegisterShift.findOne({ where: { id: assertText(input.shiftId, "Shift ID") }, query: "id status organization { id } premises { id } operator { id }" });
    if (!customer || customer.status !== "eligible" || customer.organization?.id !== authority.organizationId || customer.premises?.id !== authority.premisesId) throw new Error("Customer is not currently eligible in this premises");
    if (!evidence || evidence.customer?.id !== customer.id || evidence.result !== "eligible" || new Date(evidence.identityExpiresAt) <= /* @__PURE__ */ new Date() || customer.capacity !== "adult_use" && (!evidence.registryExpiresAt || new Date(evidence.registryExpiresAt) <= /* @__PURE__ */ new Date())) throw new Error("Current eligibility evidence is required");
    if (!shift || shift.status !== "open" || shift.organization?.id !== authority.organizationId || shift.premises?.id !== authority.premisesId || shift.operator?.id !== authority.actor.id) throw new Error("Actor must own an open register shift");
    const cart = await sudo.query.Cart.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, customer: { connect: { id: customer.id } }, shift: { connect: { id: shift.id } }, reference: `CART-${(0, import_node_crypto6.randomUUID)()}`, source: "pos", status: "preliminarily_eligible", expiresAt: new Date(Date.now() + 30 * 6e4), rulePack: { connect: { id: pack.id } }, eligibilityEvidence: { connect: { id: evidence.id } } }, query: "id reference status" });
    return { id: cart.id, status: cart.status, reference: cart.reference };
  });
}
var ALLOCATION_PACKAGE_SELECTION = "id packageUid productionBatchNumber unitOfMeasure status testStatus expiresAt quantityOnHandMicrounits reservedMicrounits coaReference labName labResultReference labVerifiedAt labelVersion potencySnapshot version organization { id } premises { id } holds(where: { status: { equals: active } }, take: 1) { id } product { id name sku unitOfMeasure categoryCode unitQuantityMicrounits equivalencyMicrounits priceCents taxCategoryCode adultUseEligible medicalEligible status organization { id } premises { id } }";
async function cannabisCartAllocationQuote(_root, args, context) {
  const authority = await requireOperationalAuthority(context, "canManageSales", "sale");
  if (!args.input || typeof args.input !== "object" || Array.isArray(args.input)) throw new Error("Allocation quote input is invalid");
  const input = args.input;
  const cartId = assertText(input.cartId, "Cart ID", 1, 100);
  const visible = await context.query.Cart.findOne({ where: { id: cartId }, query: "id" });
  if (!visible || visible.id !== cartId) throw new Error("Cart quote is outside current access");
  const cart = await context.sudo().query.Cart.findOne({ where: { id: cartId }, query: "id version status expiresAt organization { id } premises { id } customer { id capacity organization { id } premises { id } } eligibilityEvidence { id } shift { id } rulePack { id }" });
  if (!cart || cart.organization?.id !== authority.organizationId || cart.premises?.id !== authority.premisesId || cart.customer?.organization?.id !== authority.organizationId || cart.customer?.premises?.id !== authority.premisesId) throw new Error("Cart quote relationships are outside current authority");
  if (!["preliminarily_eligible", "reserved"].includes(cart.status) || !(new Date(cart.expiresAt).getTime() > Date.now())) throw new Error("This cart is closed or expired");
  const productId = assertText(input.productId, "Product ID", 1, 100);
  const quantity = assertInteger(input.quantityMicrounits, "Quantity", 1);
  const candidates = await context.sudo().query.InventoryPackage.findMany({ where: { organization: { id: { equals: authority.organizationId } }, premises: { id: { equals: authority.premisesId } }, product: { id: { equals: productId } }, status: { equals: "saleable" } }, orderBy: [{ expiresAt: "asc" }, { id: "asc" }], take: 51, query: ALLOCATION_PACKAGE_SELECTION });
  const id = choosePackageForProduct(candidates, authority, productId, quantity);
  const pkg = candidates.find((candidate) => candidate.id === id);
  const pack = await requireRulePack(context, authority.organizationId, authority.premisesId);
  assertEffectiveRulePack(pack);
  if (!(new Date(pack.effectiveAt).getTime() <= Date.now()) || !(new Date(pack.expiresAt).getTime() > Date.now()) || cart.rulePack?.id !== pack.id) throw new Error("Current configured cart policy is unavailable");
  const quote = calculateAllocationQuote(pkg, { id: cart.id, version: cart.version, customer: { capacity: cart.customer.capacity } }, pack, quantity, input.promotionCode ? assertText(input.promotionCode, "Promotion code", 1, 100) : null, { organizationId: authority.organizationId, premisesId: authority.premisesId, actor: { id: authority.actor.id } });
  const boundQuote = {
    ...quote,
    customerId: cart.customer.id,
    eligibilityEvidenceId: cart.eligibilityEvidence?.id ?? null,
    shiftId: cart.shift?.id ?? null,
    currencyCode: authority.actor.premises?.currencyCode ?? null,
    cartExpiresAt: new Date(cart.expiresAt).toISOString(),
    observedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  return {
    quote: boundQuote,
    quoteHash: stableHash(quote),
    packagesHasMore: candidates.length > 50,
    reservationReadiness: "Price quote only. Nothing is reserved until it is added to the cart."
  };
}
async function addCannabisCartLine(_root, args, context) {
  requireRuntimeCapability("commerce.reservation-ledger", "Cart reservations remain disabled pending complete ownership/replay semantics and PostgreSQL concurrency verification.");
  const staffAuthority = await requireOperationalAuthority(context, "canManageSales", "sale");
  if (!args.input || typeof args.input !== "object" || Array.isArray(args.input)) throw new Error("Allocation input is invalid");
  const raw = args.input;
  if (raw.packageId != null || raw.priceCents != null || raw.actorId != null || raw.proof != null) throw new Error("Allocation authority and package/price choice are server-owned; owned guest/delegation contracts require separate review");
  const input = {
    cartId: assertText(raw.cartId, "Cart ID", 1, 100),
    productId: assertText(raw.productId, "Product ID", 1, 100),
    quantityMicrounits: assertInteger(raw.quantityMicrounits, "Quantity", 1),
    expectedCartVersion: assertInteger(raw.expectedCartVersion, "Expected cart version", 1, 2147483646),
    reviewedQuoteHash: assertText(raw.reviewedQuoteHash, "Reviewed quote hash", 64, 64),
    promotionCode: raw.promotionCode ? assertText(raw.promotionCode, "Promotion code", 1, 100) : null,
    idempotencyKey: assertText(raw.idempotencyKey, "Idempotency key", 8, 99)
  };
  const quantity = input.quantityMicrounits;
  const allowed2 = await context.query.Cart.findOne({ where: { id: input.cartId }, query: "id" });
  if (!allowed2 || allowed2.id !== input.cartId) throw new Error("Cart is outside current access");
  const cart = await context.sudo().query.Cart.findOne({ where: { id: input.cartId }, query: "id organization { id } premises { id }" });
  if (!cart || staffAuthority.organizationId !== cart.organization?.id || staffAuthority.premisesId !== cart.premises?.id) throw new Error("Cart is outside current staff authority");
  const operationKey = `${cart.id}:${input.idempotencyKey}`;
  return runControlledOperation(context, { ...input, idempotencyKey: operationKey }, {
    permission: "canManageSales",
    activity: "sale",
    scope: "addCannabisCartLine",
    resourceType: "CartLine",
    action: "cart.line.reserved",
    authorize: async (current, authority, phase, result) => {
      const readable = await current.query.Cart.findOne({ where: { id: input.cartId }, query: "id" });
      if (!readable || readable.id !== input.cartId) throw new Error("Cart is outside current access");
      const resource = await current.sudo().query.Cart.findOne({ where: { id: input.cartId }, query: "id organization { id } premises { id }" });
      if (!resource || resource.organization?.id !== authority.organizationId || resource.premises?.id !== authority.premisesId) throw new Error("Cart is outside current allocation authority");
      if (phase === "replay") {
        const line = result ? await current.sudo().query.CartLine.findOne({ where: { id: String(result.id) }, query: "id cart { id } product { id }" }) : null;
        if (!line || line.cart?.id !== input.cartId || line.product?.id !== input.productId) throw new Error("Original allocation no longer matches this cart");
      }
    }
  }, async (tx, currentAuthority, correlationId) => {
    await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "cannabis-cart", cart.id);
    await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "cannabis-policy", `${currentAuthority.organizationId}:${currentAuthority.premisesId}`);
    const sudo = tx.sudo();
    const currentCart = await sudo.query.Cart.findOne({ where: { id: cart.id }, query: "id status expiresAt guestProofHash version organization { id } premises { id } customer { id capacity } rulePack { id } lines(take: 250) { id categoryCodeSnapshot equivalencyMicrounits }" });
    const legacy = await sudo.query.CartLine.findOne({ where: { idempotencyKey: operationKey }, query: "id" });
    if (legacy) throw new Error("Legacy allocation has no original full command receipt; review is required, not a replacement key");
    if (!currentCart || currentCart.version !== input.expectedCartVersion || !["preliminarily_eligible", "reserved"].includes(currentCart.status) || !(new Date(currentCart.expiresAt).getTime() > Date.now())) throw new Error("Active current-version cart is required");
    if ((currentCart.lines || []).length >= 249) throw new Error("Cart line bound reached");
    if (currentAuthority.organizationId !== currentCart.organization?.id || currentAuthority.premisesId !== currentCart.premises?.id || !currentCart.customer) throw new Error("Cart is outside current staff authority");
    await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "cannabis-customer-purchase-window", `${currentAuthority.organizationId}:${currentAuthority.premisesId}:${currentCart.customer.id}`);
    const pack = await requireRulePack(tx, currentCart.organization.id, currentCart.premises.id);
    assertEffectiveRulePack(pack);
    if (currentCart.rulePack?.id !== pack.id) throw new Error("Cart rule pack is stale");
    const candidates = await sudo.query.InventoryPackage.findMany({ where: { organization: { id: { equals: currentAuthority.organizationId } }, premises: { id: { equals: currentAuthority.premisesId } }, product: { id: { equals: input.productId } }, status: { equals: "saleable" } }, orderBy: [{ expiresAt: "asc" }, { id: "asc" }], take: 51, query: ALLOCATION_PACKAGE_SELECTION });
    const packageId = choosePackageForProduct(candidates, currentAuthority, input.productId, quantity);
    await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "cannabis-package", packageId);
    const pkg = await sudo.query.InventoryPackage.findOne({ where: { id: packageId }, query: ALLOCATION_PACKAGE_SELECTION });
    if (!pkg || pkg.organization?.id !== currentCart.organization.id || pkg.premises?.id !== currentCart.premises.id || !pkg.product || pkg.product.status !== "active") throw new Error("Package is outside cart authority");
    assertPackageSaleable({ status: pkg.status, testStatus: pkg.testStatus, expiresAt: pkg.expiresAt, premisesId: pkg.premises.id, quantityOnHandMicrounits: pkg.quantityOnHandMicrounits, reservedMicrounits: pkg.reservedMicrounits, activeHoldCount: pkg.holds?.length || 0, coaReference: pkg.coaReference, labelVersion: pkg.labelVersion }, currentCart.premises.id, quantity);
    if (pkg.product.id !== input.productId || pkg.product.organization?.id !== currentAuthority.organizationId || pkg.product.premises?.id !== currentAuthority.premisesId) throw new Error("Product is outside current allocation authority");
    const quote = calculateAllocationQuote(pkg, { id: currentCart.id, version: currentCart.version, customer: { capacity: currentCart.customer.capacity } }, pack, quantity, input.promotionCode, { organizationId: currentAuthority.organizationId, premisesId: currentAuthority.premisesId, actor: { id: currentAuthority.actor.id } });
    const quoteHash = stableHash(quote);
    if (input.reviewedQuoteHash !== quoteHash) throw new Error(`Reviewed quote changed; retain the original command and review a separate new intent (${input.reviewedQuoteHash.slice(0, 8)} != ${quoteHash.slice(0, 8)})`);
    const { subtotalCents, discountCents, discountSnapshot, taxCents, totalCents, equivalencyMicrounits } = quote;
    const balances = planReservationBalances(pkg.quantityOnHandMicrounits, pkg.reservedMicrounits, quantity);
    const ledger = await sudo.query.CartLine.findMany({
      where: { package: { id: { equals: pkg.id } }, cart: { status: { in: ["preliminarily_eligible", "reserved", "picking", "staged", "final_verification"] } } },
      take: 501,
      query: "id quantityMicrounits organization { id } premises { id } package { id } cart { id status organization { id } premises { id } }"
    });
    assertReservationLedger(ledger, pkg.id, pkg.reservedMicrounits, currentAuthority);
    const categoryTotals = /* @__PURE__ */ Object.create(null);
    if (!Array.isArray(currentCart.lines)) throw new Error("Complete cart limit evidence is required");
    for (const line2 of currentCart.lines) {
      if (!line2.categoryCodeSnapshot || !Number.isSafeInteger(line2.equivalencyMicrounits) || line2.equivalencyMicrounits < 1) throw new Error("Cart equivalency evidence is invalid");
      categoryTotals[line2.categoryCodeSnapshot] = (categoryTotals[line2.categoryCodeSnapshot] || 0) + line2.equivalencyMicrounits;
      if (!Number.isSafeInteger(categoryTotals[line2.categoryCodeSnapshot])) throw new Error("Cart equivalency total exceeds safe integer range");
    }
    categoryTotals[pkg.product.categoryCode] = (categoryTotals[pkg.product.categoryCode] || 0) + equivalencyMicrounits;
    evaluatePurchaseLimits({ capacity: currentCart.customer.capacity, categoryTotals, priorWindowTotals: await purchaseWindowTotals(sudo, currentCart.customer.id, pack, /* @__PURE__ */ new Date()) }, pack);
    const claimed = await tx.prisma.inventoryPackage.updateMany({ where: { id: pkg.id, organizationId: currentAuthority.organizationId, premisesId: currentAuthority.premisesId, status: "saleable", quantityOnHandMicrounits: balances.beforeQuantityMicrounits, version: pkg.version, reservedMicrounits: balances.beforeReservedMicrounits }, data: { reservedMicrounits: balances.afterReservedMicrounits, version: { increment: 1 } } });
    if (claimed.count !== 1) throw new Error("Package reservation changed concurrently");
    const line = await sudo.query.CartLine.createOne({ data: { organization: { connect: { id: currentCart.organization.id } }, premises: { connect: { id: currentCart.premises.id } }, cart: { connect: { id: currentCart.id } }, idempotencyKey: operationKey, package: { connect: { id: pkg.id } }, product: { connect: { id: pkg.product.id } }, quantityMicrounits: quantity, equivalencyMicrounits, titleSnapshot: pkg.product.name, skuSnapshot: pkg.product.sku, categoryCodeSnapshot: pkg.product.categoryCode, packageUidSnapshot: pkg.packageUid, batchSnapshot: pkg.productionBatchNumber, potencySnapshot: pkg.potencySnapshot, unitPriceCents: pkg.product.priceCents, subtotalCents, discountCents, discountSnapshot, taxBasisPoints: quote.taxBasisPoints, taxCents, totalCents }, query: "id totalCents" });
    await sudo.query.InventoryEvent.createOne({ data: {
      organization: { connect: { id: currentAuthority.organizationId } },
      premises: { connect: { id: currentAuthority.premisesId } },
      package: { connect: { id: pkg.id } },
      eventType: "reserve",
      quantityDeltaMicrounits: 0,
      beforeQuantityMicrounits: balances.beforeQuantityMicrounits,
      afterQuantityMicrounits: balances.afterQuantityMicrounits,
      reasonCode: "cart_reservation",
      actor: { connect: { id: currentAuthority.actor.id } },
      sourceType: "CartLine",
      sourceId: line.id,
      idempotencyKey: `${operationKey}:reserve`,
      occurredAt: /* @__PURE__ */ new Date(),
      evidenceHash: stableHash({ quote, balances, cartLineId: line.id, correlationId }),
      stateReportStatus: "local_recorded"
    }, query: "id" });
    const totals = await sudo.query.CartLine.findMany({ where: { cart: { id: { equals: currentCart.id } } }, take: 250, query: "subtotalCents discountCents taxCents totalCents" });
    if (totals.length >= 250) throw new Error("Cart line bound reached");
    const sum = (field) => totals.reduce((total, entry) => {
      if (!Number.isSafeInteger(entry[field]) || entry[field] < 0 || !Number.isSafeInteger(total + entry[field]) || total + entry[field] > 2147483647) throw new Error("Cart monetary evidence exceeds integer storage range");
      return total + entry[field];
    }, 0);
    const cartUpdated = await tx.prisma.cart.updateMany({ where: { id: currentCart.id, organizationId: currentAuthority.organizationId, premisesId: currentAuthority.premisesId, version: currentCart.version, status: currentCart.status }, data: { status: "reserved", subtotalCents: sum("subtotalCents"), discountCents: sum("discountCents"), taxCents: sum("taxCents"), totalCents: sum("totalCents"), version: { increment: 1 } } });
    if (cartUpdated.count !== 1) throw new Error("Cart state changed concurrently");
    return { id: line.id, status: "reserved", cartId: currentCart.id, version: currentCart.version + 1, totalCents: line.totalCents, quote, quoteHash, balances };
  });
}
async function cancelCannabisCart(_root, args, context) {
  requireRuntimeCapability("commerce.reservation-ledger", "Cart cancellation is disabled until PostgreSQL concurrency, rollback, and replay behavior are verified.");
  const input = args.input;
  const cancellationKey = assertText(input.idempotencyKey, "Idempotency key", 8, 200);
  const cancellationReason = assertText(input.reasonCode || "cart_cancelled", "Cancellation reason");
  const cart = await context.sudo().query.Cart.findOne({
    where: { id: assertText(input.cartId, "Cart ID") },
    query: "id reference status guestProofHash organization { id } premises { id }"
  });
  if (!cart) throw new Error("Cart is not found");
  let actor = null;
  const staff = Boolean(context.session?.data?.role?.canManageSales);
  if (staff) {
    const authority = await requireOperationalAuthority(context, "canManageSales", "sale");
    if (authority.organizationId !== cart.organization.id || authority.premisesId !== cart.premises.id) throw new Error("Cart is outside current staff authority");
    actor = authority.actor;
  } else if (input.system !== SYSTEM_CANCEL && (!input.proof || cart.guestProofHash !== hash(input.proof))) {
    throw new Error("Cart ownership proof is invalid");
  }
  if (cart.status === "cancelled") {
    await releaseOnlinePayment(context, cart.id);
    return { id: cart.id, status: "cancelled", reference: cart.reference, replayed: true };
  }
  const cancelled = await serializableTransaction(context, async (tx) => {
    await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "cannabis-cart", cart.id);
    const sudo = tx.sudo();
    const currentCart = await sudo.query.Cart.findOne({
      where: { id: cart.id },
      query: "id reference status guestProofHash version organization { id } premises { id } lines(take: 251) { id quantityMicrounits package { id } }"
    });
    if (!currentCart) throw new Error("Cart is not found");
    if (currentCart.organization?.id !== cart.organization.id || currentCart.premises?.id !== cart.premises.id) throw new Error("Cart authority scope changed concurrently");
    if (staff) {
      if (actor?.organization?.id !== currentCart.organization.id || actor?.premises?.id !== currentCart.premises.id) throw new Error("Cart is outside current staff authority");
    } else if (input.system !== SYSTEM_CANCEL && (!input.proof || currentCart.guestProofHash !== hash(input.proof))) {
      throw new Error("Cart ownership proof is invalid");
    }
    const plan = planCartCancellation({ id: currentCart.id, status: currentCart.status, version: currentCart.version, lines: currentCart.lines });
    if (plan.disposition === "replay") return { id: currentCart.id, status: "cancelled", reference: currentCart.reference, replayed: true };
    for (const release of plan.releases) {
      await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "cannabis-package", release.packageId);
    }
    const packageSnapshots = /* @__PURE__ */ new Map();
    for (const release of plan.releases) {
      const pkg = await sudo.query.InventoryPackage.findOne({
        where: { id: release.packageId },
        query: "id version quantityOnHandMicrounits reservedMicrounits organization { id } premises { id }"
      });
      if (!pkg || pkg.organization?.id !== currentCart.organization.id || pkg.premises?.id !== currentCart.premises.id) throw new Error("Package is outside cart authority");
      assertReservationCanBeReleased(pkg.reservedMicrounits, release.quantityMicrounits);
      packageSnapshots.set(release.packageId, pkg);
    }
    for (const release of plan.releases) {
      const pkg = packageSnapshots.get(release.packageId);
      const released = await tx.prisma.inventoryPackage.updateMany({
        where: {
          id: release.packageId,
          version: pkg.version,
          quantityOnHandMicrounits: pkg.quantityOnHandMicrounits,
          reservedMicrounits: { equals: pkg.reservedMicrounits, gte: release.quantityMicrounits }
        },
        data: { reservedMicrounits: { decrement: release.quantityMicrounits }, version: { increment: 1 } }
      });
      if (released.count !== 1) throw new Error("Concurrent reservation release detected");
    }
    const cartFence = await sudo.query.Cart.findOne({ where: { id: currentCart.id }, query: "id status version" });
    if (!cartFence) throw new Error("Cart is not found");
    assertCartCancellationFence(plan, { id: cartFence.id, status: cartFence.status, version: cartFence.version });
    const transitioned = await tx.prisma.cart.updateMany({
      where: { id: plan.cartId, version: plan.expectedVersion, status: plan.expectedStatus },
      data: { status: "cancelled", version: { increment: 1 } }
    });
    if (transitioned.count !== 1) throw new Error("Cart state changed concurrently");
    const occurredAt = /* @__PURE__ */ new Date();
    for (const release of plan.releases) {
      const pkg = packageSnapshots.get(release.packageId);
      const reservedAfter = assertReservationCanBeReleased(pkg.reservedMicrounits, release.quantityMicrounits);
      await sudo.query.InventoryEvent.createOne({
        data: {
          organization: { connect: { id: currentCart.organization.id } },
          premises: { connect: { id: currentCart.premises.id } },
          package: { connect: { id: release.packageId } },
          eventType: "release_reservation",
          quantityDeltaMicrounits: 0,
          beforeQuantityMicrounits: pkg.quantityOnHandMicrounits,
          afterQuantityMicrounits: pkg.quantityOnHandMicrounits,
          reasonCode: cancellationReason,
          ...actor ? { actor: { connect: { id: actor.id } } } : {},
          sourceType: "Cart",
          sourceId: currentCart.id,
          idempotencyKey: `cancel:${currentCart.id}:${release.packageId}:${hash(cancellationKey)}`,
          occurredAt,
          evidenceHash: stableHash({ cartId: currentCart.id, packageId: release.packageId, lineIds: release.lineIds, reservedBefore: pkg.reservedMicrounits, releasedMicrounits: release.quantityMicrounits, reservedAfter, cancellationKey }),
          stateReportStatus: "local_recorded"
        },
        query: "id"
      });
    }
    await sudo.query.AuditEvent.createOne({
      data: {
        organization: { connect: { id: currentCart.organization.id } },
        premises: { connect: { id: currentCart.premises.id } },
        ...actor ? { actor: { connect: { id: actor.id } } } : {},
        action: "cart.cancelled",
        resourceType: "Cart",
        resourceId: currentCart.id,
        correlationId: cancellationKey,
        reasonCode: cancellationReason,
        evidence: { releasedLines: plan.releasedLines, releasedPackages: plan.releases.length, releasedMicrounits: plan.totalReleasedMicrounits },
        evidenceHash: stableHash({ cartId: currentCart.id, status: "cancelled", cancellationKey, releases: plan.releases }),
        occurredAt
      },
      query: "id"
    });
    return { id: currentCart.id, status: "cancelled", reference: currentCart.reference };
  }, 2e4);
  if (!cancelled.replayed) await releaseOnlinePayment(context, cart.id);
  return cancelled;
}
async function finalizeCannabisSale(_root, args, context) {
  requireRuntimeCapability("commerce.sale-finalization", "Sale finalization remains disabled pending PostgreSQL conservation/race proof, current eligibility verification, authenticated provider acceptance, and supported tender execution.");
  requireRuntimeCapability("provider.traceability-acceptance", "Traceability acceptance is disabled until an authenticated provider acknowledgment is verified and linked to this premises.");
  const input = args.input;
  const cartId = assertText(input.cartId, "Cart ID");
  return runControlledOperation(context, input, { permission: "canManageSales", activity: "sale", scope: "finalizeCannabisSale", resourceType: "Sale", action: "sale.finalized", lockKeys: [cartId] }, async (tx, authority, correlationId) => {
    await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "cannabis-cart", cartId);
    const sudo = tx.sudo();
    const now = /* @__PURE__ */ new Date();
    const pack = await requireRulePack(tx, authority.organizationId, authority.premisesId);
    assertEffectiveRulePack(pack, now);
    assertOperatingWindow(pack, localMinute(now, authority.actor.premises.timezone));
    if (pack.offlineSalesAllowed !== false) throw new Error("Bounded launch requires offline regulated sales to remain disabled");
    const traceability = await sudo.query.IntegrationInstallation.findMany({ where: { organization: { id: { equals: authority.organizationId } }, premises: { id: { equals: authority.premisesId } }, providerType: { equals: "traceability" }, status: { equals: "active" } }, take: 2, query: "id providerCode validatedAt authorityReference" });
    if (traceability.length > 1 || traceability.length === 1 && !traceability[0].validatedAt) throw new Error("Exactly one externally validated active traceability installation is required before sale");
    let cardAuthorization = null;
    const online = await sudo.query.Cart.findOne({ where: { id: cartId }, query: "id source shift { id } paymentMethod paymentStatus paymentReference eligibilityEvidence { id } customer { id status } organization { id } premises { id } pickupWindowStart" });
    if (online && online.source === "pickup" && !online.shift) {
      if (online.organization?.id !== authority.organizationId || online.premises?.id !== authority.premisesId) throw new Error("Cart is outside current staff authority");
      if (input.idVerified !== true) throw new Error("Check the customer\u2019s ID against the order and confirm it before completing a pickup order");
      const openShifts = await sudo.query.RegisterShift.findMany({ where: { organization: { id: { equals: authority.organizationId } }, premises: { id: { equals: authority.premisesId } }, status: { equals: "open" }, operator: { id: { equals: authority.actor.id } } }, take: 1, query: "id" });
      if (openShifts.length !== 1) throw new Error("Open your register shift before completing a pickup order");
      if (!online.eligibilityEvidence || !online.customer) throw new Error("Pickup order has no customer on file");
      if (customerBlocksSale(online.customer.status)) throw new Error("This customer can no longer be served; see a manager");
      await sudo.query.EligibilityEvidence.updateOne({ where: { id: online.eligibilityEvidence.id }, data: { result: "eligible", verifiedAt: now, reasonCodes: ["checked_at_pickup"] }, query: "id" });
      await sudo.query.Customer.updateOne({ where: { id: online.customer.id }, data: { status: "eligible" }, query: "id" });
      await sudo.query.Cart.updateOne({ where: { id: online.id }, data: { shift: { connect: { id: openShifts[0].id } } }, query: "id" });
      if (online.paymentMethod === "card" && online.paymentStatus === "authorized" && online.paymentReference) {
        cardAuthorization = online.paymentReference;
        const first = Array.isArray(input.tenders) ? input.tenders[0] : null;
        if (first && first.type === "debit" && !first.providerReference) first.providerReference = online.paymentReference;
        else if (first && first.providerReference !== online.paymentReference) throw new Error("This order was paid by card; complete it with the card payment on the order");
      }
    }
    const cart = await sudo.query.Cart.findOne({ where: { id: cartId }, query: "id reference status expiresAt totalCents subtotalCents discountCents taxCents version organization { id } premises { id } shift { id status operator { id } } customer { id capacity status } eligibilityEvidence { id result capacity dateOfBirth identityExpiresAt registryExpiresAt evidenceHash allotmentRemainingMicrounits } rulePack { id version } lines(take: 251) { id package { id version status testStatus expiresAt unitOfMeasure premises { id } quantityOnHandMicrounits reservedMicrounits coaReference labelVersion holds(where: { status: { equals: active } }, take: 1) { id } } product { id categoryCode } titleSnapshot skuSnapshot categoryCodeSnapshot packageUidSnapshot batchSnapshot potencySnapshot quantityMicrounits equivalencyMicrounits unitPriceCents discountCents discountSnapshot taxCents totalCents }" });
    if (!cart || cart.organization?.id !== authority.organizationId || cart.premises?.id !== authority.premisesId || !FINALIZABLE_CART_STATUSES.includes(cart.status) || new Date(cart.expiresAt) <= now || cart.rulePack?.id !== pack.id) throw new Error("Reserved cart is stale or outside current authority");
    if (!cart.shift || cart.shift.status !== "open" || cart.shift.operator?.id !== authority.actor.id) throw new Error("Actor must own the cart's open register shift");
    const evidence = cart.eligibilityEvidence;
    if (!evidence || evidence.result !== "eligible" || evidence.capacity !== cart.customer.capacity || new Date(evidence.identityExpiresAt) <= now) throw new Error("Current eligibility evidence is required at final verification");
    assertEligibility({ capacity: cart.customer.capacity, age: ageAt(evidence.dateOfBirth, now, authority.actor.premises?.timezone), identityValid: true, registryValid: cart.customer.capacity === "adult_use" || Boolean(evidence.registryExpiresAt && new Date(evidence.registryExpiresAt) > now), representedPatientValid: cart.customer.capacity !== "caregiver" || Boolean(input.representedPatientVerified) }, pack);
    const salePackageGroups = groupSaleLinesByPackage(cart.lines);
    const categoryTotals = {};
    for (const line of cart.lines) categoryTotals[line.categoryCodeSnapshot] = (categoryTotals[line.categoryCodeSnapshot] || 0) + line.equivalencyMicrounits;
    const priorWindowTotals = await purchaseWindowTotals(sudo, cart.customer.id, pack, now);
    const limitDecision = evaluatePurchaseLimits({ capacity: cart.customer.capacity, categoryTotals, priorWindowTotals }, pack);
    if (cart.customer.capacity !== "adult_use" && evidence.allotmentRemainingMicrounits != null && Object.values(categoryTotals).reduce((a, b) => a + b, 0) > evidence.allotmentRemainingMicrounits) throw new Error("Patient or caregiver allotment is insufficient");
    const tenders = input.tenders;
    if (!Array.isArray(tenders) || tenders.length < 1 || tenders.length > 10) throw new Error("Sale requires 1-10 tenders");
    let tenderTotal = 0;
    const tenderConfigs = [];
    for (const tender of tenders) {
      const amount = assertInteger(tender.amountCents, "Tender amount", 0);
      assertTenderAllowed(tender.type, amount, cart.totalCents, pack.allowedTenderTypes);
      tenderTotal += amount;
      if (tender.type !== "cash") requireRuntimeCapability("provider.payment-capture", "Electronic tenders are disabled until a trusted payment adapter confirms capture and settlement.");
      const tenderedCents = assertInteger(tender.tenderedCents ?? amount, "Tendered cents", amount);
      const changeCents = assertInteger(tender.changeCents ?? 0, "Change cents", 0);
      if (tender.type === "cash" && tenderedCents - changeCents !== amount) throw new Error("Cash tendered less change must equal the applied tender amount");
      if (tender.type !== "cash" && (tenderedCents !== amount || changeCents !== 0)) throw new Error("Non-cash tender must match its applied amount exactly");
      if (tender.type !== "cash") tender.providerReference = assertText(tender.providerReference, "Terminal approval reference", 2, 200);
      const configurations = await sudo.query.TenderConfiguration.findMany({ where: { organization: { id: { equals: authority.organizationId } }, premises: { id: { equals: authority.premisesId } }, type: { equals: tender.type }, enabled: { equals: true }, effectiveAt: { lte: now }, expiresAt: { gt: now } }, take: 2, query: "id code type providerCode paymentProvider { id code isInstalled capturePaymentFunction refundPaymentFunction credentials }" });
      if (configurations.length !== 1) throw new Error("Exactly one current tender configuration is required");
      if (tender.type !== "cash") {
        const config2 = configurations[0];
        const provider = config2.paymentProvider;
        if (!provider || !provider.isInstalled || !isPaymentProviderConfigured(provider.code)) throw new Error("Configured payment provider is not installed or configured");
        let result;
        try {
          result = await capturePayment({ provider, paymentId: tender.providerReference, amount, currency: authority.actor.premises?.currencyCode || "USD", idempotencyKey: `${input.idempotencyKey}:capture:${tenderConfigs.length}` });
          const resultAmount = Number(result?.amount);
          const resultCurrency = String(result?.currency || authority.actor.premises?.currencyCode || "USD").toUpperCase();
          if (resultAmount !== amount || resultCurrency !== String(authority.actor.premises?.currencyCode || "USD").toUpperCase()) throw new Error("Payment provider capture amount or currency mismatch");
          if (result.status !== "captured" && result.status !== "succeeded") throw new Error("Payment capture is ambiguous");
        } catch (error) {
          await context.sudo().query.ComplianceIncident.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, reference: `INC-PAY-${(0, import_node_crypto6.randomUUID)()}`, type: "payment_ambiguity", severity: "high", status: "open", occurredAt: now, detectedAt: /* @__PURE__ */ new Date(), description: "Payment capture outcome is ambiguous; do not retry or complete this sale until reconciled.", affectedPackageUids: [], customerReferenceHash: hash(cart.customer.id), outageMode: "fail_closed", recoveryQueueReference: tender.providerReference, authorityReference: provider.code, actor: { connect: { id: authority.actor.id } }, owner: { connect: { id: authority.actor.id } }, evidenceHash: stableHash({ providerId: provider.id, paymentReference: tender.providerReference, amountCents: amount, idempotencyKey: `${input.idempotencyKey}:capture:${tenderConfigs.length}`, error: error instanceof Error ? error.message : "unknown" }) }, query: "id" });
          throw new Error("Payment capture is ambiguous; incident recorded and reconciliation is required");
        }
        tender.providerReference = String(result.paymentIntentId || result.transactionId || tender.providerReference);
        tender.providerStatus = tenderStatusFromCapture(result.status);
        tender.paymentProviderId = provider.id;
      }
      tenderConfigs.push(configurations[0]);
    }
    if (tenderTotal !== cart.totalCents) throw new Error("Tender total must exactly equal sale total in integer cents");
    const salePackageSnapshots = /* @__PURE__ */ new Map();
    const saleLineBalances = /* @__PURE__ */ new Map();
    for (const group of salePackageGroups) {
      await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "cannabis-package", group.packageId);
    }
    for (const group of salePackageGroups) {
      const pkg = await sudo.query.InventoryPackage.findOne({
        where: { id: group.packageId },
        query: "id version status testStatus expiresAt unitOfMeasure quantityOnHandMicrounits reservedMicrounits coaReference labelVersion organization { id } premises { id } holds(where: { status: { equals: active } }, take: 1) { id }"
      });
      if (!pkg || pkg.organization?.id !== authority.organizationId || pkg.premises?.id !== authority.premisesId || pkg.premises?.id !== cart.premises?.id) throw new Error("Package is outside current sale authority");
      assertReservedPackageForSale({
        status: pkg.status,
        testStatus: pkg.testStatus,
        expiresAt: pkg.expiresAt,
        premisesId: pkg.premises.id,
        quantityOnHandMicrounits: pkg.quantityOnHandMicrounits,
        reservedMicrounits: pkg.reservedMicrounits,
        activeHoldCount: pkg.holds?.length || 0,
        coaReference: pkg.coaReference,
        labelVersion: pkg.labelVersion
      }, authority.premisesId, group.quantityMicrounits, now);
      salePackageSnapshots.set(group.packageId, pkg);
      for (const balance of planSaleLineBalances(cart.lines, group, pkg.quantityOnHandMicrounits)) {
        saleLineBalances.set(balance.lineIndex, { before: balance.before, after: balance.after });
      }
    }
    const receiptNumber = `SALE-${(0, import_node_crypto6.randomUUID)()}`;
    const receiptSnapshot = { receiptNumber, finalizedAt: now.toISOString(), currencyCode: authority.actor.premises?.currencyCode ?? null, licenseNumber: authority.license.licenseNumber, premisesId: authority.premisesId, customerCapacity: cart.customer.capacity, rulePackVersion: pack.version, lines: cart.lines.map((line) => ({ title: line.titleSnapshot, sku: line.skuSnapshot, packageUid: line.packageUidSnapshot, batch: line.batchSnapshot, quantityMicrounits: line.quantityMicrounits, unitPriceCents: line.unitPriceCents, discountCents: line.discountCents, discountSnapshot: line.discountSnapshot, taxCents: line.taxCents, totalCents: line.totalCents })), subtotalCents: cart.subtotalCents, discountCents: cart.discountCents, taxCents: cart.taxCents, totalCents: cart.totalCents, tenders: tenders.map((tender) => ({ type: tender.type, amountCents: tender.amountCents, changeCents: tender.changeCents ?? 0 })) };
    const labelSnapshot = { rulePackVersion: pack.version, requirements: pack.labelRequirements, lines: cart.lines.map((line) => {
      const pkg = salePackageSnapshots.get(line.package.id);
      return { packageUid: line.packageUidSnapshot, batch: line.batchSnapshot, potency: line.potencySnapshot, coaReference: pkg.coaReference, labelVersion: pkg.labelVersion };
    }) };
    const sale = await sudo.query.Sale.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, shift: { connect: { id: cart.shift.id } }, customer: { connect: { id: cart.customer.id } }, cart: { connect: { id: cart.id } }, receiptNumber, status: "state_queued", customerCapacitySnapshot: cart.customer.capacity, rulePackVersion: pack.version, eligibilityEvidenceHash: evidence.evidenceHash, purchaseLimitEvaluation: limitDecision, subtotalCents: cart.subtotalCents, discountCents: cart.discountCents, taxCents: cart.taxCents, totalCents: cart.totalCents, finalizedAt: now, receiptSnapshot, receiptHash: stableHash(receiptSnapshot), labelSnapshot, labelHash: stableHash(labelSnapshot) }, query: "id receiptNumber status" });
    for (const group of salePackageGroups) {
      const pkg = salePackageSnapshots.get(group.packageId);
      const consumed = await tx.prisma.inventoryPackage.updateMany({
        where: {
          id: group.packageId,
          version: pkg.version,
          quantityOnHandMicrounits: pkg.quantityOnHandMicrounits,
          reservedMicrounits: { equals: pkg.reservedMicrounits, gte: group.quantityMicrounits }
        },
        data: {
          quantityOnHandMicrounits: { decrement: group.quantityMicrounits },
          reservedMicrounits: { decrement: group.quantityMicrounits },
          version: { increment: 1 },
          ...pkg.quantityOnHandMicrounits === group.quantityMicrounits ? { status: "depleted" } : {}
        }
      });
      if (consumed.count !== 1) throw new Error("Concurrent exact-package sale detected");
    }
    for (const [index, line] of cart.lines.entries()) {
      const pkg = salePackageSnapshots.get(line.package.id);
      const balance = saleLineBalances.get(index);
      if (!balance) throw new Error("Sale line quantity conservation is incomplete");
      const saleLine = await sudo.query.SaleLine.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, sale: { connect: { id: sale.id } }, package: { connect: { id: line.package.id } }, titleSnapshot: line.titleSnapshot, skuSnapshot: line.skuSnapshot, categoryCodeSnapshot: line.categoryCodeSnapshot, packageUidSnapshot: line.packageUidSnapshot, batchSnapshot: line.batchSnapshot, coaReferenceSnapshot: pkg.coaReference, potencySnapshot: line.potencySnapshot, quantityMicrounits: line.quantityMicrounits, equivalencyMicrounits: line.equivalencyMicrounits, unitPriceCents: line.unitPriceCents, discountCents: line.discountCents, discountSnapshot: line.discountSnapshot, taxCents: line.taxCents, totalCents: line.totalCents }, query: "id" });
      await sudo.query.InventoryEvent.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, package: { connect: { id: line.package.id } }, eventType: "sale", quantityDeltaMicrounits: -line.quantityMicrounits, beforeQuantityMicrounits: balance.before, afterQuantityMicrounits: balance.after, reasonCode: "sale", actor: { connect: { id: authority.actor.id } }, sourceType: "SaleLine", sourceId: saleLine.id, idempotencyKey: `${correlationId}:line:${index}`, occurredAt: now, evidenceHash: stableHash({ saleId: sale.id, saleLineId: saleLine.id, packageId: line.package.id, before: balance.before, after: balance.after }), stateReportStatus: "queued" }, query: "id" });
    }
    for (const [index, tender] of tenders.entries()) await sudo.query.Tender.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, sale: { connect: { id: sale.id } }, configuration: { connect: { id: tenderConfigs[index].id } }, typeSnapshot: tender.type, amountCents: tender.amountCents, tenderedCents: tender.tenderedCents ?? tender.amountCents, changeCents: tender.changeCents ?? 0, status: tender.type === "cash" ? "received" : tender.providerStatus, providerReference: tender.type === "cash" ? "" : tender.providerReference, idempotencyKey: `${correlationId}:tender:${index}`, evidenceHash: stableHash(tender) }, query: "id" });
    await sudo.query.CashEvent.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, shift: { connect: { id: cart.shift.id } }, type: "sale", amountCents: tenders.filter((t) => t.type === "cash").reduce((sum, tender) => sum + tender.amountCents, 0), reasonCode: "sale", actor: { connect: { id: authority.actor.id } }, occurredAt: now, idempotencyKey: `${correlationId}:cash`, evidenceHash: stableHash({ saleId: sale.id }) }, query: "id" });
    const cartFence = await sudo.query.Cart.findOne({ where: { id: cart.id }, query: "id status version" });
    if (!cartFence) throw new Error("Reserved cart is missing during finalization");
    assertFinalSaleCartFence({ id: cart.id, status: cart.status, version: cart.version }, { id: cartFence.id, status: cartFence.status, version: cartFence.version });
    const completed = await tx.prisma.cart.updateMany({ where: { id: cart.id, version: cart.version, status: cart.status }, data: { status: "completed", version: { increment: 1 } } });
    if (completed.count !== 1) throw new Error("Reserved cart state changed concurrently");
    if (online?.source === "pickup") await sudo.query.Cart.updateOne({ where: { id: cart.id }, data: { paymentStatus: cardAuthorization ? "captured" : "paid_at_pickup" }, query: "id" });
    return { id: sale.id, status: sale.status, reference: sale.receiptNumber, totalCents: cart.totalCents, stateReport: { receiptNumber: sale.receiptNumber, finalizedAt: now.toISOString(), customerCapacity: cart.customer.capacity, rulePackVersion: pack.version, packages: cart.lines.map((line) => ({ packageUid: line.packageUidSnapshot, quantityMicrounits: line.quantityMicrounits, unitOfMeasure: salePackageSnapshots.get(line.package.id).unitOfMeasure })) } };
  });
}
async function voidCannabisSale(_root, args, context) {
  requireRuntimeCapability("finance.verified-refunds", "Voids are disabled with refunds.");
  const raw = args.input || {};
  const reason = assertText(raw.reason, "Void reason", 4, 500);
  const input = withApprover(raw, await verifySecondApprover(context, raw, "canManageFinance"));
  const saleId = assertText(input.saleId, "Sale ID");
  return runControlledOperation(context, input, { permission: "canManageFinance", activity: "cash", scope: "voidCannabisSale", resourceType: "Sale", action: "sale.voided", lockKeys: [saleId] }, async (tx, authority, correlationId) => {
    const sudo = tx.sudo();
    const now = /* @__PURE__ */ new Date();
    const sale = await sudo.query.Sale.findOne({ where: { id: saleId }, query: "id receiptNumber status totalCents refundedCents organization { id } premises { id } shift { id status } lines(take: 251) { id quantityMicrounits package { id } } tenders(take: 11) { id typeSnapshot status amountCents }" });
    if (!sale || sale.organization?.id !== authority.organizationId || sale.premises?.id !== authority.premisesId) throw new Error("Sale is outside this premises");
    const packageIds = [...new Set(sale.lines.map((line) => line.package.id))];
    for (const id of packageIds) await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "cannabis-package", id);
    const packages = await sudo.query.InventoryPackage.findMany({ where: { id: { in: packageIds } }, query: "id status version quantityOnHandMicrounits" });
    const refused = saleVoidError({ status: sale.status, refundedCents: sale.refundedCents, shiftStatus: sale.shift?.status, tenderTypes: sale.tenders.map((t) => t.typeSnapshot), tenderStatuses: sale.tenders.map((t) => t.status), packageStatuses: packages.map((p2) => p2.status) });
    if (refused) throw new Error(refused);
    const approver = await sudo.query.User.findOne({ where: { id: input.approvedById }, query: "id status organization { id } premises { id } role { canManageFinance }" });
    if (!approver || approver.id === authority.actor.id || approver.status !== "active" || !approver.role?.canManageFinance || approver.organization?.id !== authority.organizationId || approver.premises?.id !== authority.premisesId) throw new Error("The second approver needs finance authority at this premises");
    const voided = await tx.prisma.sale.updateMany({ where: { id: sale.id, status: sale.status, refundedCents: 0 }, data: { status: "reversed" } });
    if (voided.count !== 1) throw new Error("This sale changed while voiding; refresh it");
    const onHand = new Map(packages.map((p2) => [p2.id, { ...p2 }]));
    for (const [index, line] of sale.lines.entries()) {
      const pkg = onHand.get(line.package.id);
      const changed = await tx.prisma.inventoryPackage.updateMany({ where: { id: pkg.id, version: pkg.version, quantityOnHandMicrounits: pkg.quantityOnHandMicrounits }, data: { quantityOnHandMicrounits: { increment: line.quantityMicrounits }, version: { increment: 1 } } });
      if (changed.count !== 1) throw new Error("A package on this sale changed while voiding; refresh it");
      const before = pkg.quantityOnHandMicrounits;
      const after = before + line.quantityMicrounits;
      pkg.quantityOnHandMicrounits = after;
      pkg.version += 1;
      await sudo.query.InventoryEvent.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, package: { connect: { id: pkg.id } }, eventType: "adjustment", quantityDeltaMicrounits: line.quantityMicrounits, beforeQuantityMicrounits: before, afterQuantityMicrounits: after, reasonCode: "sale_voided", actor: { connect: { id: authority.actor.id } }, approvedBy: { connect: { id: approver.id } }, sourceType: "SaleLine", sourceId: line.id, idempotencyKey: `${correlationId}:void:${index}`, occurredAt: now, evidenceHash: stableHash({ saleId: sale.id, saleLineId: line.id, before, after, reason }), stateReportStatus: "queued" }, query: "id" });
    }
    for (const tender of sale.tenders) await sudo.query.Tender.updateOne({ where: { id: tender.id }, data: { status: "reversed" }, query: "id" });
    const cashCents = sale.tenders.reduce((sum, tender) => sum + tender.amountCents, 0);
    await sudo.query.CashEvent.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, shift: { connect: { id: sale.shift.id } }, type: "refund", amountCents: -cashCents, reasonCode: "sale_voided", actor: { connect: { id: authority.actor.id } }, approvedBy: { connect: { id: approver.id } }, occurredAt: now, idempotencyKey: `${correlationId}:void-cash`, evidenceHash: stableHash({ saleId: sale.id, reason }) }, query: "id" });
    return { id: sale.id, status: "reversed", reference: sale.receiptNumber, returnedMicrounits: sale.lines.reduce((sum, line) => sum + line.quantityMicrounits, 0), stateReport: { receiptNumber: sale.receiptNumber, voided: true, reason } };
  });
}

// features/keystone/domain/reconciliationEvidence.ts
function isPlainRecord(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function isJsonValue(value, ancestors = /* @__PURE__ */ new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object") return false;
  if (!Array.isArray(value) && !isPlainRecord(value)) return false;
  if (ancestors.has(value)) return false;
  ancestors.add(value);
  const valid = Array.isArray(value) ? value.every((child) => isJsonValue(child, ancestors)) : Object.values(value).every((child) => isJsonValue(child, ancestors));
  ancestors.delete(value);
  return valid;
}
function validateReconciliationSubmission(discrepancies) {
  if (!Array.isArray(discrepancies)) throw new Error("Discrepancies must be supplied as an array");
  for (const [index, discrepancy] of discrepancies.entries()) {
    if (!isPlainRecord(discrepancy) || Object.keys(discrepancy).length === 0 || !isJsonValue(discrepancy)) {
      throw new Error(`Discrepancy claim ${index + 1} must be a non-empty JSON object`);
    }
  }
  return {
    discrepancies,
    discrepancyCount: discrepancies.length,
    status: "pending"
  };
}

// features/keystone/domain/providerEventScope.ts
function assertProviderEventScopeMatch(existing, current) {
  if (!existing.providerCode || !existing.organizationId || !existing.premisesId || existing.providerCode !== current.providerCode || existing.organizationId !== current.organizationId || existing.premisesId !== current.premisesId) {
    throw new Error("Provider event ID conflicts with another provider authority scope");
  }
}

// features/keystone/domain/operatorReadBounds.ts
var MAX_SHIFT_CASH_EVENTS = 500;
var CASH_EVENT_TYPES = /* @__PURE__ */ new Set([
  "opening_float",
  "sale",
  "refund",
  "paid_in",
  "paid_out",
  "safe_drop",
  "count",
  "deposit"
]);
function isRecord3(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function isCompleteShiftCashEventRead(value) {
  if (!Array.isArray(value) || value.length >= MAX_SHIFT_CASH_EVENTS) return false;
  for (let index = 0; index < value.length; index += 1) {
    const event = value[index];
    if (!Object.hasOwn(value, index) || !isRecord3(event) || typeof event.type !== "string" || !CASH_EVENT_TYPES.has(event.type) || !Number.isSafeInteger(event.amountCents)) return false;
  }
  return true;
}

// features/keystone/domain/refundAllocation.ts
var MAX_REFUND_ALLOCATION_EVIDENCE_ROWS = 500;
var MAX_MONEY_CENTS = 2147483647;
var REFUND_STATUSES = /* @__PURE__ */ new Set(["pending", "completed", "failed", "reconciled"]);
var TENDER_STATUSES = /* @__PURE__ */ new Set(["received", "authorized", "captured", "reversed", "failed"]);
function isRecord4(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function isText(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 500 && value.trim() === value;
}
function isMoney(value, minimum) {
  return Number.isSafeInteger(value) && value >= minimum && value <= MAX_MONEY_CENTS;
}
function getRefundEvidenceTenderIds(refunds, originalTenderId) {
  if (!Array.isArray(refunds) || refunds.length > MAX_REFUND_ALLOCATION_EVIDENCE_ROWS || !isText(originalTenderId)) return void 0;
  const ids = /* @__PURE__ */ new Set([originalTenderId]);
  for (const refund of refunds) {
    if (!isRecord4(refund) || !isText(refund.originalTenderReference)) return void 0;
    ids.add(refund.originalTenderReference);
  }
  return [...ids];
}
function evaluateRefundAllocationEvidence(input) {
  const { saleId, organizationId: organizationId2, premisesId: premisesId2, originalTenderId, requestedAmountCents, saleRefundedCents, refunds, tenders } = input;
  if (!isText(saleId) || !isText(organizationId2) || !isText(premisesId2) || !isText(originalTenderId) || !isMoney(requestedAmountCents, 1) || !isMoney(saleRefundedCents, 0) || !Array.isArray(refunds) || refunds.length > MAX_REFUND_ALLOCATION_EVIDENCE_ROWS || !Array.isArray(tenders) || tenders.length > MAX_REFUND_ALLOCATION_EVIDENCE_ROWS + 1) {
    return { ok: false, reason: "incomplete" };
  }
  const expectedTenderIds = /* @__PURE__ */ new Set([originalTenderId]);
  const refundIds = /* @__PURE__ */ new Set();
  let totalRefundedCents = 0;
  let allocatedToOriginalTenderCents = 0;
  for (const refund of refunds) {
    if (!isRecord4(refund) || !isText(refund.id) || refundIds.has(refund.id) || !isMoney(refund.amountCents, 1) || !REFUND_STATUSES.has(String(refund.status)) || !isText(refund.originalTenderReference) || !isRecord4(refund.sale) || refund.sale.id !== saleId || !isRecord4(refund.organization) || refund.organization.id !== organizationId2 || !isRecord4(refund.premises) || refund.premises.id !== premisesId2) {
      return { ok: false, reason: "incomplete" };
    }
    refundIds.add(refund.id);
    expectedTenderIds.add(refund.originalTenderReference);
    totalRefundedCents += refund.amountCents;
    if (!Number.isSafeInteger(totalRefundedCents) || totalRefundedCents > MAX_MONEY_CENTS) return { ok: false, reason: "incomplete" };
    if (refund.originalTenderReference === originalTenderId) {
      allocatedToOriginalTenderCents += refund.amountCents;
      if (!Number.isSafeInteger(allocatedToOriginalTenderCents) || allocatedToOriginalTenderCents > MAX_MONEY_CENTS) return { ok: false, reason: "incomplete" };
    }
  }
  if (totalRefundedCents !== saleRefundedCents) return { ok: false, reason: "incomplete" };
  const tenderById = /* @__PURE__ */ new Map();
  for (const tender of tenders) {
    if (!isRecord4(tender) || !isText(tender.id) || tenderById.has(tender.id) || !isMoney(tender.amountCents, 0) || !isText(tender.typeSnapshot) || !TENDER_STATUSES.has(String(tender.status)) || !isRecord4(tender.sale) || tender.sale.id !== saleId || !isRecord4(tender.organization) || tender.organization.id !== organizationId2 || !isRecord4(tender.premises) || tender.premises.id !== premisesId2) {
      return { ok: false, reason: "incomplete" };
    }
    tenderById.set(tender.id, {
      id: tender.id,
      amountCents: tender.amountCents,
      typeSnapshot: tender.typeSnapshot,
      status: String(tender.status)
    });
  }
  if (tenderById.size !== expectedTenderIds.size || [...expectedTenderIds].some((id) => !tenderById.has(id))) {
    return { ok: false, reason: "incomplete" };
  }
  const originalTender = tenderById.get(originalTenderId);
  if (!originalTender || originalTender.status === "reversed") return { ok: false, reason: "incomplete" };
  if (allocatedToOriginalTenderCents + requestedAmountCents > originalTender.amountCents) {
    return { ok: false, reason: "limit" };
  }
  return { ok: true, originalTender };
}

// features/keystone/domain/publicImages.ts
var import_node_crypto7 = require("node:crypto");
var import_node_stream = require("node:stream");
var MAX_PUBLIC_IMAGE_BYTES = 10 * 1024 * 1024;
var EXTENSIONS = /* @__PURE__ */ new Set(["jpg", "png", "webp", "gif"]);
async function readPublicImageUpload(upload, maxBytes = MAX_PUBLIC_IMAGE_BYTES) {
  const file = await upload;
  if (!file || typeof file.createReadStream !== "function") return null;
  const chunks = [];
  let size = 0;
  for await (const chunk of file.createReadStream()) {
    size += chunk.length;
    if (size > maxBytes) throw new Error(`Photo must be ${Math.round(maxBytes / 1024 / 1024)} MB or smaller`);
    chunks.push(Buffer.from(chunk));
  }
  if (!size) throw new Error("Photo file is empty");
  const buffer = Buffer.concat(chunks);
  return { buffer, filename: String(file.filename || "photo"), sha256: (0, import_node_crypto7.createHash)("sha256").update(buffer).digest("hex") };
}
function imageColumns(prefix, image3) {
  return {
    [`${prefix}_id`]: image3?.id ?? null,
    [`${prefix}_extension`]: image3?.extension ?? null,
    [`${prefix}_filesize`]: image3?.filesize ?? null,
    [`${prefix}_width`]: image3?.width ?? null,
    [`${prefix}_height`]: image3?.height ?? null
  };
}
async function storePublicImage(context, upload) {
  let stored;
  try {
    stored = await context.images("my_images").getDataFromStream(import_node_stream.Readable.from(upload.buffer), upload.filename);
  } catch {
    throw new Error("Photo must be a JPEG, PNG, WebP or GIF image");
  }
  if (!EXTENSIONS.has(stored.extension)) throw new Error("Photo must be a JPEG, PNG, WebP or GIF image");
  return stored;
}

// features/keystone/mutations/rulePack.ts
var import_node_crypto8 = require("node:crypto");
var PACK_FIELDS = "id version status jurisdictionCode authorityCitations effectiveAt expiresAt approvedAt adultMinimumAge medicalMinimumAge medicalEnabled operatingStartMinute operatingEndMinute purchaseLimits taxRules discountRules allowedTenderTypes labelRequirements returnRules outagePolicy privacyRules retentionRules pickupEnabled deliveryEnabled offlineSalesAllowed organization { id } premises { id }";
async function latestRulePack(context, organizationId2, premisesId2) {
  const packs = await context.sudo().query.JurisdictionRulePack.findMany({
    where: { organization: { id: { equals: organizationId2 } }, premises: { id: { equals: premisesId2 } }, status: { equals: "effective" } },
    orderBy: [{ effectiveAt: "desc" }],
    take: 2,
    query: PACK_FIELDS
  });
  return { pack: packs[0] ?? null, count: packs.length };
}
function rulePackProblem(pack) {
  if (!pack) return "No effective sales rules are installed";
  try {
    assertEffectiveRulePack(pack);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Sales rules are invalid";
  }
}
var TENDER_TYPES2 = ["cash", "debit", "ach", "wallet", "other"];
var TENDER_LABEL = { cash: "Cash", debit: "Debit", ach: "ACH", wallet: "Wallet", other: "Other" };
function tenderTypes(value) {
  if (!Array.isArray(value) || !value.length || value.some((type) => !TENDER_TYPES2.includes(type))) throw new Error("Choose at least one payment type: cash, debit, ach, wallet or other");
  return [...new Set(value)];
}
async function syncTenderConfigurations(tx, authority, allowed2, now, expiresAt, reference) {
  const sudo = tx.sudo();
  const configs = await sudo.query.TenderConfiguration.findMany({ where: { organization: { id: { equals: authority.organizationId } }, premises: { id: { equals: authority.premisesId } } }, take: 50, query: "id type enabled authorityReference" });
  const fallbackReference = typeof reference === "string" && reference.trim() ? reference.trim().slice(0, 200) : configs.find((config2) => config2.authorityReference)?.authorityReference || "owner_attested";
  for (const config2 of configs) {
    const wanted = allowed2.includes(String(config2.type));
    if (config2.enabled !== wanted) await sudo.query.TenderConfiguration.updateOne({ where: { id: config2.id }, data: { enabled: wanted, ...wanted ? { effectiveAt: now, expiresAt } : {} }, query: "id" });
  }
  for (const type of allowed2) {
    if (configs.some((config2) => config2.type === type)) continue;
    await sudo.query.TenderConfiguration.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, code: `${type.toUpperCase()}-${(0, import_node_crypto8.randomUUID)().slice(0, 8)}`, type, displayName: TENDER_LABEL[type] ?? type, enabled: true, authorityReference: fallbackReference, effectiveAt: now, expiresAt }, query: "id" });
  }
}
var optionalInteger = (value, fallback, label, min, max) => value === void 0 || value === null || value === "" ? fallback : assertInteger(value, label, min, max);
async function amendCannabisRulePack(_root, args, context) {
  const input = args.input || {};
  const authority = await requireReadAuthority(context, "canManageAuthority");
  const owner = await context.sudo().query.User.findOne({ where: { id: authority.actor.id }, query: "role { canManageOnboarding } staffCredential { id }" });
  if (owner?.role?.canManageOnboarding !== true) throw new Error("Only the business owner can amend sales rules");
  const key = assertText(input.idempotencyKey, "Idempotency key", 8, 200);
  const version = assertText(input.version, "Rule version", 1, 100);
  const lookupKey = `${authority.organizationId}:${authority.premisesId}:amendCannabisRulePack:${key}`;
  const requestHash = stableHash(input);
  return serializableTransaction(context, async (tx) => {
    await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "openfront-cannabis", `${authority.organizationId}:${authority.premisesId}:rule-pack`);
    await fenceAuthority(tx, authority);
    const sudo = tx.sudo();
    const prior = await sudo.query.IdempotencyKey.findOne({ where: { lookupKey }, query: "requestHash status responseSnapshot actor { id }" });
    if (prior) {
      if (prior.requestHash !== requestHash || prior.actor?.id !== authority.actor.id) throw new Error("Idempotency key was reused with different input");
      return { ...prior.responseSnapshot, replayed: true };
    }
    const { pack: current } = await latestRulePack(tx, authority.organizationId, authority.premisesId);
    if (!current) throw new Error("No effective sales rules are installed; complete onboarding first");
    if (current.version === version) throw new Error("Use a new rule version for the amendment");
    const now = /* @__PURE__ */ new Date();
    const expiresAt = input.expiresAt ? new Date(assertText(input.expiresAt, "Rule expiry")) : new Date(current.expiresAt);
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= now) throw new Error("Rule expiry must be in the future");
    const next = {
      jurisdictionCode: current.jurisdictionCode,
      version,
      status: "effective",
      approvedAt: now,
      effectiveAt: now,
      expiresAt,
      adultMinimumAge: optionalInteger(input.adultMinimumAge, current.adultMinimumAge, "Adult minimum age", 0, 120),
      medicalMinimumAge: optionalInteger(input.medicalMinimumAge, current.medicalMinimumAge, "Medical minimum age", 0, 120),
      operatingStartMinute: optionalInteger(input.operatingStartMinute, current.operatingStartMinute, "Opening time", 0, 1439),
      operatingEndMinute: optionalInteger(input.operatingEndMinute, current.operatingEndMinute, "Closing time", 0, 1439),
      purchaseLimits: input.purchaseLimits === void 0 ? current.purchaseLimits : assertJsonValue(input.purchaseLimits, "Purchase limits"),
      taxRules: input.taxRules === void 0 ? current.taxRules : assertJsonValue(input.taxRules, "Tax rules"),
      discountRules: input.discountRules === void 0 ? current.discountRules : assertJsonValue(input.discountRules, "Discount rules"),
      allowedTenderTypes: input.allowedTenderTypes === void 0 ? current.allowedTenderTypes : tenderTypes(input.allowedTenderTypes),
      medicalEnabled: input.medicalEnabled === void 0 ? current.medicalEnabled : input.medicalEnabled === true,
      offlineSalesAllowed: current.offlineSalesAllowed,
      pickupEnabled: input.pickupEnabled === void 0 ? current.pickupEnabled : input.pickupEnabled === true
    };
    if (!Array.isArray(next.discountRules)) throw new Error("Discount rules must be a list; leave it empty to prohibit discounts");
    assertEffectiveRulePack({ id: "amendment", ...next }, now);
    const policyHash = stableHash(policyIdentity({
      jurisdictionCode: next.jurisdictionCode,
      ruleVersion: version,
      ruleAuthorityCitations: current.authorityCitations,
      ruleEffectiveAt: now.toISOString(),
      ruleExpiresAt: expiresAt.toISOString(),
      adultMinimumAge: next.adultMinimumAge,
      medicalMinimumAge: next.medicalMinimumAge,
      medicalEnabled: next.medicalEnabled,
      operatingStartMinute: next.operatingStartMinute,
      operatingEndMinute: next.operatingEndMinute,
      purchaseLimits: next.purchaseLimits,
      taxRules: next.taxRules,
      discountRules: next.discountRules,
      allowedTenderTypes: next.allowedTenderTypes,
      labelRequirements: current.labelRequirements,
      returnRules: current.returnRules,
      outagePolicy: current.outagePolicy,
      privacyRules: current.privacyRules,
      retentionRules: current.retentionRules,
      pickupEnabled: next.pickupEnabled,
      deliveryEnabled: current.deliveryEnabled,
      offlineSalesAllowed: current.offlineSalesAllowed
    }));
    await sudo.query.JurisdictionRulePack.updateOne({ where: { id: current.id }, data: { status: "superseded" }, query: "id" });
    const created = await sudo.query.JurisdictionRulePack.createOne({ data: {
      organization: { connect: { id: authority.organizationId } },
      premises: { connect: { id: authority.premisesId } },
      version,
      jurisdictionCode: next.jurisdictionCode,
      authorityCitations: current.authorityCitations,
      policyHash,
      status: "effective",
      effectiveAt: now,
      expiresAt,
      approvedAt: now,
      approvedBy: { connect: { id: authority.actor.id } },
      adultMinimumAge: next.adultMinimumAge,
      medicalMinimumAge: next.medicalMinimumAge,
      operatingStartMinute: next.operatingStartMinute,
      operatingEndMinute: next.operatingEndMinute,
      purchaseLimits: next.purchaseLimits,
      taxRules: next.taxRules,
      discountRules: next.discountRules,
      allowedTenderTypes: next.allowedTenderTypes,
      labelRequirements: current.labelRequirements,
      returnRules: current.returnRules,
      outagePolicy: current.outagePolicy,
      privacyRules: current.privacyRules,
      retentionRules: current.retentionRules,
      medicalEnabled: next.medicalEnabled,
      pickupEnabled: next.pickupEnabled,
      deliveryEnabled: current.deliveryEnabled,
      offlineSalesAllowed: current.offlineSalesAllowed
    }, query: "id version" });
    await syncTenderConfigurations(tx, authority, next.allowedTenderTypes, now, expiresAt, input.tenderReference);
    let approvalLimitCents = null;
    if (input.ownerApprovalLimitCents !== void 0 && input.ownerApprovalLimitCents !== null && input.ownerApprovalLimitCents !== "") {
      approvalLimitCents = assertInteger(input.ownerApprovalLimitCents, "Your approval limit", 0);
      if (!owner.staffCredential?.id) throw new Error("Your staff credential is unavailable");
      await sudo.query.StaffCredential.updateOne({ where: { id: owner.staffCredential.id }, data: { approvalLimitCents }, query: "id" });
    }
    const result = { id: created.id, status: "effective", reference: created.version, supersededId: current.id, approvalLimitCents };
    await sudo.query.IdempotencyKey.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, scope: "amendCannabisRulePack", lookupKey, requestHash, requestSnapshot: retainedRequest(input), status: "succeeded", responseSnapshot: JSON.parse(JSON.stringify(result)), startedAt: now, completedAt: /* @__PURE__ */ new Date(), expiresAt: new Date(Date.now() + 3e5), actor: { connect: { id: authority.actor.id } } }, query: "id" });
    await sudo.query.AuditEvent.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, actor: { connect: { id: authority.actor.id } }, action: "authority.rule_pack.amended", resourceType: "JurisdictionRulePack", resourceId: created.id, correlationId: key, reasonCode: "owner_amendment", evidence: { supersededId: current.id, supersededVersion: current.version, version, approvalLimitCents, provenance: "owner_attested" }, evidenceHash: policyHash, occurredAt: now }, query: "id" });
    return result;
  });
}
var optionalText2 = (value, label, max = 200) => value === void 0 || value === null ? null : typeof value === "string" ? value.trim().slice(0, max) : (() => {
  throw new Error(`${label} must be text`);
})();
async function amendCannabisPremisesDetails(_root, args, context) {
  const input = args.input || {};
  const authority = await requireReadAuthority(context, "canManageAuthority");
  const owner = await context.sudo().query.User.findOne({ where: { id: authority.actor.id }, query: "role { canManageOnboarding }" });
  if (owner?.role?.canManageOnboarding !== true) throw new Error("Only the business owner can change the premises address and phone");
  const key = assertText(input.idempotencyKey, "Idempotency key", 8, 200);
  const lookupKey = `${authority.organizationId}:${authority.premisesId}:amendCannabisPremisesDetails:${key}`;
  const requestHash = stableHash(input);
  const fields = { line1: optionalText2(input.line1, "Street address"), city: optionalText2(input.city, "City"), region: optionalText2(input.region, "State or province"), postalCode: optionalText2(input.postalCode, "Postal code", 20), country: optionalText2(input.country, "Country", 60), phone: optionalText2(input.phone, "Phone", 40) };
  if (!fields.line1 || !fields.city || !fields.region) throw new Error("Street address, city and state or province are required");
  if (fields.phone && !/^[+()\d\s.-]{7,40}$/.test(fields.phone)) throw new Error("Phone may contain digits, spaces, +, -, . and parentheses only");
  return serializableTransaction(context, async (tx) => {
    await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "openfront-cannabis", lookupKey);
    await fenceAuthority(tx, authority);
    const sudo = tx.sudo();
    const prior = await sudo.query.IdempotencyKey.findOne({ where: { lookupKey }, query: "requestHash responseSnapshot actor { id }" });
    if (prior) {
      if (prior.requestHash !== requestHash || prior.actor?.id !== authority.actor.id) throw new Error("Idempotency key was reused with different input");
      return { ...prior.responseSnapshot, replayed: true };
    }
    const premises = await sudo.query.Premises.findOne({ where: { id: authority.premisesId }, query: "id addressSnapshot" });
    if (!premises) throw new Error("Premises is unavailable");
    const before = premises.addressSnapshot && typeof premises.addressSnapshot === "object" && !Array.isArray(premises.addressSnapshot) ? premises.addressSnapshot : {};
    const after = { ...before, ...Object.fromEntries(Object.entries(fields).map(([name, value]) => [name, value || null])) };
    await sudo.query.Premises.updateOne({ where: { id: premises.id }, data: { addressSnapshot: JSON.parse(JSON.stringify(after)) }, query: "id" });
    const now = /* @__PURE__ */ new Date();
    const result = { id: premises.id, status: "updated", reference: premises.id };
    await sudo.query.IdempotencyKey.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, scope: "amendCannabisPremisesDetails", lookupKey, requestHash, requestSnapshot: retainedRequest(input), status: "succeeded", responseSnapshot: result, startedAt: now, completedAt: now, expiresAt: new Date(Date.now() + 3e5), actor: { connect: { id: authority.actor.id } } }, query: "id" });
    await sudo.query.AuditEvent.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, actor: { connect: { id: authority.actor.id } }, action: "authority.premises.details_amended", resourceType: "Premises", resourceId: premises.id, correlationId: key, reasonCode: "owner_amendment", evidence: JSON.parse(JSON.stringify({ before, after })), evidenceHash: stableHash({ before, after }), occurredAt: now }, query: "id" });
    return result;
  });
}

// features/keystone/mutations/operations.ts
async function configureCannabisProduct(_root, args, context) {
  const input = args.input;
  assertInteger(input.unitQuantityMicrounits, "Unit quantity", 1);
  assertInteger(input.equivalencyMicrounits, "Equivalency", 1);
  assertInteger(input.priceCents, "Price", 0);
  if (input.adultUseEligible !== true && input.medicalEligible !== true) throw new Error("Product must be explicitly eligible for at least one configured channel");
  return runControlledOperation(context, input, { permission: "canManageInventory", activity: "inventory", scope: "configureCannabisProduct", resourceType: "Product", action: "catalog.product.configured", lockKeys: [String(input.sku)] }, async (tx, authority) => {
    const sudo = tx.sudo();
    const existing = await sudo.query.Product.findOne({ where: { sku: assertText(input.sku, "SKU") }, query: "id name" });
    if (existing) throw new Error(`SKU ${input.sku.trim()} is already used by ${existing.name}`);
    const product = await sudo.query.Product.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, sku: input.sku, name: assertText(input.name, "Product name"), brand: input.brand ? assertText(input.brand, "Brand", 1, 200) : "", form: assertText(input.form, "Product form"), categoryCode: assertText(input.categoryCode, "Category code"), unitOfMeasure: assertText(input.unitOfMeasure, "Unit of measure"), unitQuantityMicrounits: input.unitQuantityMicrounits, equivalencyMicrounits: input.equivalencyMicrounits, priceCents: input.priceCents, taxCategoryCode: assertText(input.taxCategoryCode, "Tax category"), adultUseEligible: input.adultUseEligible === true, medicalEligible: input.medicalEligible === true, status: "active", publicDescription: input.publicDescription ? assertText(input.publicDescription, "Public description", 1, 1e3) : "", publicImageUrl: "" }, query: "id sku status" });
    return { id: product.id, status: product.status, reference: product.sku };
  });
}
async function linkTenderPaymentProvider(_root, args, context) {
  const input = args.input || {};
  return runControlledOperation(context, input, { permission: "canManageFinance", activity: "cash", scope: "linkTenderPaymentProvider", resourceType: "TenderConfiguration", action: "tender.provider.linked", lockKeys: [String(input.tenderConfigurationId)] }, async (tx, authority) => {
    const sudo = tx.sudo();
    const tender = await sudo.query.TenderConfiguration.findOne({ where: { id: assertText(input.tenderConfigurationId, "Tender configuration") }, query: "id type organization { id } premises { id }" });
    const provider = await sudo.query.PaymentProvider.findOne({ where: { id: assertText(input.paymentProviderId, "Payment provider") }, query: "id code isInstalled" });
    if (!tender || tender.organization?.id !== authority.organizationId || tender.premises?.id !== authority.premisesId || tender.type === "cash") throw new Error("Tender configuration is outside finance authority or cannot accept a provider");
    if (!provider || !provider.isInstalled || !isPaymentProviderConfigured(provider.code)) throw new Error("Payment provider is not installed and configured");
    await sudo.query.TenderConfiguration.updateOne({ where: { id: tender.id }, data: { paymentProvider: { connect: { id: provider.id } }, providerCode: provider.code }, query: "id" });
    return { id: tender.id, status: "linked", reference: provider.code };
  });
}
async function configureRegister(_root, args, context) {
  const input = args.input;
  return runControlledOperation(context, input, { permission: "canManageFinance", activity: "cash", scope: "configureRegister", resourceType: "Register", action: "register.configured", lockKeys: [String(input.code)] }, async (tx, authority) => {
    const sudo = tx.sudo();
    const existing = await sudo.query.Register.findOne({ where: { code: assertText(input.code, "Register code") }, query: "id name" });
    if (existing) throw new Error(`Register code ${input.code.trim()} is already used by ${existing.name}`);
    const register = await sudo.query.Register.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, code: input.code, name: assertText(input.name, "Register name"), status: "active" }, query: "id code status" });
    return { id: register.id, status: register.status, reference: register.code };
  });
}
async function openRegisterShift(_root, args, context) {
  const input = args.input;
  const opening = assertInteger(input.openingFloatCents, "Opening float", 0);
  return runControlledOperation(context, input, { permission: "canManageFinance", activity: "cash", scope: "openRegisterShift", resourceType: "RegisterShift", action: "cash.shift.opened", lockKeys: [String(input.registerId)] }, async (tx, authority, correlationId) => {
    const sudo = tx.sudo();
    const register = await sudo.query.Register.findOne({ where: { id: assertText(input.registerId, "Register ID") }, query: "id code status organization { id } premises { id }" });
    if (!register || register.status !== "active" || register.organization?.id !== authority.organizationId || register.premises?.id !== authority.premisesId) throw new Error("Active register is outside actor authority");
    const existing = await sudo.query.RegisterShift.findMany({ where: { register: { id: { equals: register.id } }, status: { in: ["open", "count_pending", "counted", "variance_review"] } }, take: 2, query: "id" });
    if (existing.length) throw new Error("Register already has an unresolved shift");
    const evidenceHash = stableHash({ opening, denominationEvidence: input.denominationEvidence });
    const shift = await sudo.query.RegisterShift.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, register: { connect: { id: register.id } }, operator: { connect: { id: authority.actor.id } }, status: "open", openingFloatCents: opening, expectedCashCents: opening, openedAt: /* @__PURE__ */ new Date(), evidenceHash }, query: "id status" });
    await sudo.query.CashEvent.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, shift: { connect: { id: shift.id } }, type: "opening_float", amountCents: opening, reasonCode: "opening_float", actor: { connect: { id: authority.actor.id } }, occurredAt: /* @__PURE__ */ new Date(), idempotencyKey: `${correlationId}:open`, evidenceHash }, query: "id" });
    return { id: shift.id, status: shift.status, reference: register.code };
  });
}
async function closeRegisterShift(_root, args, context) {
  requireRuntimeCapability("finance.action-bound-approval", "Shift close is disabled until an authenticated, action-bound second-party approval workflow is implemented.");
  const actual = assertInteger(args.input?.actualCashCents, "Actual cash", 0);
  const input = withApprover(args.input, await verifySecondApprover(context, args.input, "canManageFinance"));
  if (!input.approvedById || input.approvedById === context.session?.itemId) throw new Error("Shift close requires an independent approver");
  return runControlledOperation(context, input, { permission: "canManageFinance", activity: "cash", scope: "closeRegisterShift", resourceType: "RegisterShift", action: "cash.shift.closed", lockKeys: [String(input.shiftId)] }, async (tx, authority, correlationId) => {
    const sudo = tx.sudo();
    const shift = await sudo.query.RegisterShift.findOne({ where: { id: assertText(input.shiftId, "Shift ID") }, query: "id status openingFloatCents organization { id } premises { id } operator { id } cashEvents(take: 500) { type amountCents }" });
    if (!shift || shift.status !== "open" || shift.organization?.id !== authority.organizationId || shift.premises?.id !== authority.premisesId || shift.operator?.id !== authority.actor.id) throw new Error("Actor does not own this open shift");
    if (!isCompleteShiftCashEventRead(shift.cashEvents)) throw new Error("Shift cash event read is incomplete; reconcile before close");
    const approver = await sudo.query.User.findOne({ where: { id: input.approvedById }, query: "id status organization { id } premises { id } role { canManageFinance }" });
    if (!approver || approver.status !== "active" || !approver.role?.canManageFinance || approver.organization?.id !== authority.organizationId || approver.premises?.id !== authority.premisesId) throw new Error("Approver lacks current finance authority");
    const expected = shift.cashEvents.reduce((sum, event) => sum + event.amountCents, 0);
    const variance = actual - expected;
    const evidenceHash = stableHash({ actual, expected, variance, denominationEvidence: input.denominationEvidence });
    await sudo.query.CashEvent.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, shift: { connect: { id: shift.id } }, type: "count", amountCents: actual, reasonCode: "blind_close_count", actor: { connect: { id: authority.actor.id } }, approvedBy: { connect: { id: approver.id } }, occurredAt: /* @__PURE__ */ new Date(), idempotencyKey: `${correlationId}:count`, evidenceHash }, query: "id" });
    const status5 = variance === 0 ? "closed" : "variance_review";
    await sudo.query.RegisterShift.updateOne({ where: { id: shift.id }, data: { status: status5, expectedCashCents: expected, actualCashCents: actual, varianceCents: variance, countedAt: /* @__PURE__ */ new Date(), ...status5 === "closed" ? { closedAt: /* @__PURE__ */ new Date(), approvedBy: { connect: { id: approver.id } } } : {} }, query: "id" });
    return { id: shift.id, status: status5, reference: String(variance), expectedCashCents: expected, actualCashCents: actual };
  });
}
async function approveCashVariance(_root, args, context) {
  const input = args.input;
  return runControlledOperation(context, input, { permission: "canManageFinance", activity: "cash", scope: "approveCashVariance", resourceType: "RegisterShift", action: "cash.variance.approved", lockKeys: [String(input.shiftId)] }, async (tx, authority) => {
    const sudo = tx.sudo();
    const shift = await sudo.query.RegisterShift.findOne({ where: { id: assertText(input.shiftId, "Shift ID") }, query: "id status varianceCents organization { id } premises { id } operator { id }" });
    if (!shift || shift.status !== "variance_review" || shift.organization?.id !== authority.organizationId || shift.premises?.id !== authority.premisesId || shift.operator?.id === authority.actor.id) throw new Error("An independent finance actor must approve this variance-review shift");
    const ceiling = authority.actor.staffCredential?.approvalLimitCents;
    if (!Number.isSafeInteger(shift.varianceCents) || !Number.isSafeInteger(ceiling) || ceiling <= 0 || Math.abs(shift.varianceCents) > ceiling) throw new Error("This variance exceeds your approval limit");
    const evidenceHash = stableHash({ varianceCents: shift.varianceCents, reason: input.reason, evidence: input.evidence });
    await sudo.query.CashEvent.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, shift: { connect: { id: shift.id } }, type: "count", amountCents: 0, reasonCode: assertReasonCode(input.reasonCode, "Variance reason code"), actor: { connect: { id: authority.actor.id } }, approvedBy: { connect: { id: authority.actor.id } }, occurredAt: /* @__PURE__ */ new Date(), idempotencyKey: `${input.idempotencyKey}:variance`, evidenceHash }, query: "id" });
    await sudo.query.RegisterShift.updateOne({ where: { id: shift.id }, data: { status: "closed", approvedBy: { connect: { id: authority.actor.id } }, closedAt: /* @__PURE__ */ new Date() }, query: "id" });
    return { id: shift.id, status: "closed", reference: String(shift.varianceCents) };
  });
}
async function refundCannabisSale(_root, args, context) {
  requireRuntimeCapability("finance.verified-refunds", "Refunds are disabled until trusted payment outcomes, cumulative tender allocations, return custody, and independent approvals are implemented.");
  const amount = assertInteger(args.input?.amountCents, "Refund amount", 1);
  const input = withApprover(args.input, await verifySecondApprover(context, args.input, "canManageFinance"));
  if (!input.approvedById || input.approvedById === context.session?.itemId) throw new Error("Refund requires independent approval");
  return runControlledOperation(context, input, { permission: "canManageFinance", activity: "cash", scope: "refundCannabisSale", resourceType: "Refund", action: "sale.refunded", lockKeys: [String(input.saleId)] }, async (tx, authority, correlationId) => {
    const sudo = tx.sudo();
    const sale = await sudo.query.Sale.findOne({ where: { id: assertText(input.saleId, "Sale ID") }, query: "id receiptNumber status totalCents refundedCents organization { id } premises { id } shift { id status }" });
    if (!sale || sale.organization?.id !== authority.organizationId || sale.premises?.id !== authority.premisesId || ["reversed", "refunded"].includes(sale.status)) throw new Error("Sale cannot be refunded in this authority scope");
    if (sale.refundedCents + amount > sale.totalCents) throw new Error("Refund exceeds the immutable sale total");
    const approver = await sudo.query.User.findOne({ where: { id: input.approvedById }, query: "id status organization { id } premises { id } role { canManageFinance }" });
    if (!approver || approver.status !== "active" || !approver.role?.canManageFinance || approver.organization?.id !== authority.organizationId || approver.premises?.id !== authority.premisesId) throw new Error("Approver lacks current finance authority");
    if (!["none", "quarantine", "waste", "returned_to_authority"].includes(input.inventoryDisposition)) throw new Error("Explicit returned-product disposition is required");
    const originalTenderId = assertText(input.originalTenderId, "Original tender ID");
    const refundRows = await sudo.query.Refund.findMany({
      where: { sale: { id: { equals: sale.id } } },
      take: MAX_REFUND_ALLOCATION_EVIDENCE_ROWS + 1,
      query: "id amountCents status originalTenderReference sale { id } organization { id } premises { id }"
    });
    const tenderIds = getRefundEvidenceTenderIds(refundRows, originalTenderId);
    if (!tenderIds) throw new Error("Refund allocation evidence is incomplete or ambiguous");
    const tenderRows = await sudo.query.Tender.findMany({
      where: { id: { in: tenderIds } },
      take: MAX_REFUND_ALLOCATION_EVIDENCE_ROWS + 1,
      query: "id amountCents typeSnapshot status providerReference sale { id } organization { id } premises { id } configuration { paymentProvider { id code isInstalled refundPaymentFunction credentials } }"
    });
    const allocation = evaluateRefundAllocationEvidence({
      saleId: sale.id,
      organizationId: authority.organizationId,
      premisesId: authority.premisesId,
      originalTenderId,
      requestedAmountCents: amount,
      saleRefundedCents: sale.refundedCents,
      refunds: refundRows,
      tenders: tenderRows
    });
    if (!allocation.ok) throw new Error(allocation.reason === "limit" ? "Refund exceeds the remaining original tender allocation" : "Refund allocation evidence is incomplete or ambiguous");
    const originalTender = tenderRows.find((tender) => tender.id === originalTenderId);
    if (!originalTender) throw new Error("Original tender details are unavailable");
    let providerReference = "";
    if (originalTender.typeSnapshot !== "cash") {
      const provider = originalTender.configuration?.paymentProvider;
      if (!provider || !provider.isInstalled) throw new Error("Tender payment provider is unavailable");
      const result = await refundPayment({ provider, paymentId: originalTender.providerReference, amount, currency: authority.actor.premises?.currencyCode || "USD", idempotencyKey: `${input.idempotencyKey}:refund`, refundId: `${sale.id}:${originalTender.id}:${amount}` });
      if (Number(result?.amount) !== amount || String(result?.currency || "USD").toUpperCase() !== String(authority.actor.premises?.currencyCode || "USD").toUpperCase() || !["refunded", "succeeded"].includes(result?.status)) throw new Error("Payment refund outcome is ambiguous; reconcile before retrying");
      providerReference = String(result.paymentIntentId || result.transactionId || originalTender.providerReference);
    }
    const evidenceHash = stableHash(input.evidence || {});
    const refund = await sudo.query.Refund.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, sale: { connect: { id: sale.id } }, amountCents: amount, reasonCode: assertText(input.reasonCode, "Refund reason"), inventoryDisposition: input.inventoryDisposition, status: "completed", actor: { connect: { id: authority.actor.id } }, approvedBy: { connect: { id: approver.id } }, originalTenderReference: originalTender.id, providerReference, occurredAt: /* @__PURE__ */ new Date(), evidenceHash }, query: "id status" });
    const refundedCents = sale.refundedCents + amount;
    const saleStatus = refundedCents === sale.totalCents ? "refunded" : "partially_refunded";
    await sudo.query.Sale.updateOne({ where: { id: sale.id }, data: { refundedCents, status: saleStatus }, query: "id" });
    if (originalTender.typeSnapshot === "cash") await sudo.query.CashEvent.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, shift: { connect: { id: sale.shift.id } }, type: "refund", amountCents: -amount, reasonCode: input.reasonCode, actor: { connect: { id: authority.actor.id } }, approvedBy: { connect: { id: approver.id } }, occurredAt: /* @__PURE__ */ new Date(), idempotencyKey: `${correlationId}:refund`, evidenceHash }, query: "id" });
    return { id: refund.id, status: refund.status, reference: sale.receiptNumber, saleStatus };
  });
}
async function recordComplianceIncident(_root, args, context) {
  const input = args.input;
  return runControlledOperation(context, input, { permission: "canManageCompliance", activity: "incident", scope: "recordComplianceIncident", resourceType: "ComplianceIncident", action: "incident.recorded" }, async (tx, authority) => {
    if (!["refusal_of_sale", "identity", "patient_registry_outage", "traceability_outage", "payment_ambiguity", "inventory_discrepancy", "theft", "loss", "diversion", "recall", "privacy", "security", "system_outage", "offline_attempt"].includes(input.type)) throw new Error("Unsupported incident type");
    if (input.type === "offline_attempt" && input.outageMode !== "fail_closed") throw new Error("Offline regulated sale attempts must fail closed");
    if (!["low", "medium", "high", "critical"].includes(input.severity)) throw new Error("Select an incident severity");
    if (input.outageMode != null && !["none", "fail_closed", "approved_degraded"].includes(input.outageMode)) throw new Error("Unsupported outage mode");
    const occurredAt = input.occurredAt ? new Date(input.occurredAt) : /* @__PURE__ */ new Date();
    const notificationDueAt = input.notificationDueAt ? new Date(input.notificationDueAt) : null;
    if (!Number.isFinite(occurredAt.getTime()) || occurredAt.getTime() > Date.now() + 6e4) throw new Error("Occurred time must be a past date and time");
    if (notificationDueAt && !Number.isFinite(notificationDueAt.getTime())) throw new Error("Notification due time is invalid");
    const incident = await tx.sudo().query.ComplianceIncident.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, reference: `INC-${Date.now()}-${authority.actor.id.slice(-6)}`, type: input.type, severity: input.severity, status: "open", occurredAt, detectedAt: /* @__PURE__ */ new Date(), notificationDueAt, description: assertText(input.description, "Incident description", 4, 5e3), affectedPackageUids: input.affectedPackageUids || [], customerReferenceHash: input.customerReferenceHash || "", outageMode: input.outageMode || "none", recoveryQueueReference: input.recoveryQueueReference || "", authorityReference: input.authorityReference || "", actor: { connect: { id: authority.actor.id } }, owner: { connect: { id: authority.actor.id } }, evidenceHash: stableHash(input.evidence || {}) }, query: "id reference status" });
    return { id: incident.id, status: incident.status, reference: incident.reference };
  });
}
async function activateIntegrationInstallation(_root, args, context) {
  requireRuntimeCapability("provider.installation-verification", "Provider installation activation is disabled until a provider adapter verifies capabilities and authority directly.");
  const input = args.input;
  return runControlledOperation(context, input, { permission: "canManageIntegrations", activity: "state_reporting", scope: "activateIntegrationInstallation", resourceType: "IntegrationInstallation", action: "integration.validated", lockKeys: [String(input.installationId)] }, async (tx, authority) => {
    const sudo = tx.sudo();
    const installation = await sudo.query.IntegrationInstallation.findOne({ where: { id: assertText(input.installationId, "Installation ID") }, query: "id status providerType organization { id } premises { id }" });
    if (!installation || installation.organization?.id !== authority.organizationId || installation.premises?.id !== authority.premisesId || !["unconfigured", "pending_validation", "suspended"].includes(installation.status)) throw new Error("Integration installation is outside this authority scope");
    const credentialReference = assertText(input.credentialReference, "External secret-manager credential reference", 8, 500);
    const authorityReference = assertText(input.authorityReference, "Provider validation authority reference", 4, 500);
    if (input.externallyValidated !== true) throw new Error("External provider validation evidence is required; software cannot self-certify an integration");
    await sudo.query.IntegrationInstallation.updateOne({ where: { id: installation.id }, data: { status: "active", credentialReference, facilityReference: assertText(input.facilityReference, "Facility reference"), capabilities: input.capabilities || [], validatedAt: /* @__PURE__ */ new Date(), authorityReference }, query: "id" });
    return { id: installation.id, status: "active", reference: authorityReference };
  });
}
async function recordStateInboxEvent(_root, args, context) {
  requireRuntimeCapability("provider.authenticated-inbox", "Provider inbox records are disabled until signatures are verified by a trusted adapter.");
  const input = args.input;
  return runControlledOperation(context, input, { permission: "canManageIntegrations", activity: "state_reporting", scope: "recordStateInboxEvent", resourceType: "StateEventInbox", action: "state.inbox.recorded" }, async (tx, authority) => {
    if (!input.signatureEvidence) throw new Error("Provider signature evidence is required for later adapter verification");
    const providerEventId = assertText(input.providerEventId, "Provider event ID");
    const providerCode = assertText(input.providerCode, "Provider code");
    const existing = await tx.sudo().query.StateEventInbox.findOne({ where: { providerEventId }, query: "id payloadHash status providerCode organization { id } premises { id }" });
    const payloadHash = stableHash(input.payload || {});
    if (existing) {
      assertProviderEventScopeMatch(
        { providerCode: existing.providerCode, organizationId: existing.organization?.id, premisesId: existing.premises?.id },
        { providerCode, organizationId: authority.organizationId, premisesId: authority.premisesId }
      );
      if (existing.payloadHash !== payloadHash) throw new Error("Provider event ID was replayed with different payload");
      return { id: existing.id, status: existing.status, reference: providerEventId };
    }
    const event = await tx.sudo().query.StateEventInbox.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, providerCode, providerEventId, payloadHash, signatureEvidence: input.signatureEvidence, status: "received", receivedAt: /* @__PURE__ */ new Date(), payload: input.payload || {} }, query: "id status" });
    return { id: event.id, status: event.status, reference: input.providerEventId };
  });
}
async function approveReconciliationRun(_root, args, context) {
  requireRuntimeCapability("provider.computed-reconciliation", "Reconciliation approval is disabled until the comparison is computed from trusted source snapshots.");
  const input = args.input;
  return runControlledOperation(context, input, { permission: "canViewReports", activity: "state_reporting", scope: "approveReconciliationRun", resourceType: "ReconciliationRun", action: "reconciliation.approved", lockKeys: [String(input.runId)] }, async (tx, authority) => {
    const sudo = tx.sudo();
    const run = await sudo.query.ReconciliationRun.findOne({ where: { id: assertText(input.runId, "Reconciliation run ID") }, query: "id status discrepancyCount owner { id } organization { id } premises { id }" });
    if (!run || run.organization?.id !== authority.organizationId || run.premises?.id !== authority.premisesId || run.owner?.id === authority.actor.id || run.status !== "balanced" || run.discrepancyCount !== 0) throw new Error("Independent approval requires a balanced zero-discrepancy run");
    await sudo.query.ReconciliationRun.updateOne({ where: { id: run.id }, data: { status: "approved", approvedBy: { connect: { id: authority.actor.id } } }, query: "id" });
    return { id: run.id, status: "approved", reference: assertText(input.approvalReference, "Approval reference") };
  });
}
async function recordReconciliationRun(_root, args, context) {
  requireRuntimeCapability("provider.computed-reconciliation", "Reconciliation recording is disabled until local and external snapshots are computed and linked to evidence.");
  const input = args.input;
  return runControlledOperation(context, input, { permission: "canViewReports", activity: "state_reporting", scope: "recordReconciliationRun", resourceType: "ReconciliationRun", action: "reconciliation.recorded" }, async (tx, authority) => {
    const submission = validateReconciliationSubmission(input.discrepancies);
    const run = await tx.sudo().query.ReconciliationRun.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, type: input.type, status: submission.status, startedAt: new Date(input.startedAt || Date.now()), completedAt: null, localSnapshotHash: assertText(input.localSnapshotHash, "Local snapshot hash", 16), externalSnapshotHash: input.externalSnapshotHash || "", discrepancyCount: submission.discrepancyCount, discrepancies: submission.discrepancies, owner: { connect: { id: authority.actor.id } }, evidenceHash: stableHash({ local: input.localSnapshotHash, external: input.externalSnapshotHash, discrepancies: submission.discrepancies }) }, query: "id status" });
    return { id: run.id, status: run.status, reference: String(submission.discrepancyCount) };
  });
}
var INCIDENT_TRANSITIONS = {
  open: ["contained", "investigating", "resolved"],
  contained: ["investigating", "resolved"],
  investigating: ["reported", "resolved"],
  reported: ["resolved"],
  resolved: ["closed"],
  closed: []
};
async function transitionComplianceIncident(_root, args, context) {
  const input = args.input;
  const incidentId = assertText(input.incidentId, "Incident ID");
  const expectedStatus = assertText(input.expectedStatus, "Current status");
  const nextStatus = assertText(input.nextStatus, "Next status");
  if (!INCIDENT_TRANSITIONS[expectedStatus]?.includes(nextStatus)) throw new Error(`An incident cannot move from ${expectedStatus} to ${nextStatus}`);
  const reasonCode = assertReasonCode(input.reasonCode);
  const authorityReference = nextStatus === "reported" ? assertText(input.authorityReference, "Report reference", 2, 200) : "";
  return runControlledOperation(context, input, { permission: "canManageCompliance", activity: "incident", scope: "transitionComplianceIncident", resourceType: "ComplianceIncident", action: "incident.transitioned", lockKeys: [incidentId] }, async (tx, authority) => {
    const incident = await tx.sudo().query.ComplianceIncident.findOne({ where: { id: incidentId }, query: "id reference status organization { id } premises { id }" });
    if (!incident || incident.organization?.id !== authority.organizationId || incident.premises?.id !== authority.premisesId) throw new Error("Incident is outside this premises");
    const changed = await tx.prisma.complianceIncident.updateMany({ where: { id: incident.id, status: expectedStatus }, data: { status: nextStatus, ...nextStatus === "reported" ? { reportedAt: /* @__PURE__ */ new Date(), authorityReference } : {}, ownerId: authority.actor.id } });
    if (changed.count !== 1) throw new Error("This incident changed since you opened it. Refresh and try again.");
    return { id: incident.id, status: nextStatus, reference: incident.reference, beforeStatus: incident.status, reasonCode };
  });
}
var PRODUCT_STATUS = /* @__PURE__ */ new Set(["active", "inactive"]);
async function amendCannabisProduct(_root, args, context) {
  const upload = await readPublicImageUpload(args.photo);
  const input = upload ? { ...args.input, photoSha256: upload.sha256 } : args.input;
  const removePhoto = input.removePhoto === true;
  if (upload && removePhoto) throw new Error("Upload a photo or remove it, not both");
  const productId = assertText(input.productId, "Product ID");
  const expectedUpdatedAt = new Date(assertText(input.expectedUpdatedAt, "Product revision"));
  if (!Number.isFinite(expectedUpdatedAt.getTime())) throw new Error("Product revision is invalid");
  if (input.unitOfMeasure != null || input.unitQuantityMicrounits != null || input.equivalencyMicrounits != null || input.sku != null) throw new Error("Unit, equivalency and SKU cannot be changed; configure a new product instead");
  const data = {};
  if (input.name != null) data.name = assertText(input.name, "Product name", 1, 200);
  if (input.priceCents != null) data.priceCents = assertInteger(input.priceCents, "Price", 0);
  if (input.status != null) {
    if (!PRODUCT_STATUS.has(input.status)) throw new Error("Product status must be active or inactive");
    data.status = input.status;
  }
  if (input.adultUseEligible != null) data.adultUseEligible = input.adultUseEligible === true;
  if (input.medicalEligible != null) data.medicalEligible = input.medicalEligible === true;
  if (input.publicDescription != null) data.publicDescription = input.publicDescription === "" ? "" : assertText(input.publicDescription, "Public description", 1, 1e3);
  if (input.categoryCode != null) data.categoryCode = assertText(input.categoryCode, "Purchase-limit category", 1, 60);
  if (input.taxCategoryCode != null) data.taxCategoryCode = assertText(input.taxCategoryCode, "Tax category", 1, 60);
  if (!Object.keys(data).length && !upload && !removePhoto) throw new Error("No product changes were submitted");
  if (upload) await requireOperationalAuthority(context, "canManageInventory", "inventory");
  const stored = upload ? await storePublicImage(context, upload) : null;
  return runControlledOperation(context, input, { permission: "canManageInventory", activity: "inventory", scope: "amendCannabisProduct", resourceType: "Product", action: "catalog.product.amended", lockKeys: [productId] }, async (tx, authority) => {
    const product = await tx.sudo().query.Product.findOne({ where: { id: productId }, query: "id sku name priceCents status adultUseEligible medicalEligible publicDescription categoryCode taxCategoryCode photo { id } updatedAt organization { id } premises { id }" });
    if (!product || product.organization?.id !== authority.organizationId || product.premises?.id !== authority.premisesId) throw new Error("Product is outside this premises");
    for (const [field, value] of Object.entries(data)) if (product[field] === value || field === "publicDescription" && !value && !product.publicDescription) delete data[field];
    const photoChange = stored ? { photo: { uploaded: `${stored.id}.${stored.extension}`, sha256: upload.sha256, width: stored.width, height: stored.height } } : removePhoto && product.photo?.id ? { photo: { removed: true } } : {};
    if (!Object.keys(data).length && !Object.keys(photoChange).length) throw new Error("No changes to save");
    if (data.categoryCode != null || data.taxCategoryCode != null) {
      const { pack } = await latestRulePack(tx, authority.organizationId, authority.premisesId);
      const limits = Array.isArray(pack?.purchaseLimits) ? pack.purchaseLimits : [];
      const taxes = Array.isArray(pack?.taxRules) ? pack.taxRules : [];
      if (data.categoryCode != null && !limits.some((rule) => rule?.categoryCode === data.categoryCode)) throw new Error(`No purchase limit in the current sales rules uses category ${data.categoryCode}`);
      if (data.taxCategoryCode != null && !taxes.some((rule) => rule?.categoryCode === data.taxCategoryCode)) throw new Error(`No tax rule in the current sales rules uses category ${data.taxCategoryCode}`);
    }
    const next = { adultUseEligible: product.adultUseEligible, medicalEligible: product.medicalEligible, ...data };
    if (next.adultUseEligible !== true && next.medicalEligible !== true) throw new Error("Product must remain eligible for at least one channel");
    const columns = Object.keys(photoChange).length ? imageColumns("photo", stored) : {};
    const changed = await tx.prisma.product.updateMany({ where: { id: product.id, updatedAt: expectedUpdatedAt }, data: { ...data, ...columns } });
    if (changed.count !== 1) throw new Error("This product changed since you opened it. Refresh and try again.");
    const before = { name: product.name, priceCents: product.priceCents, status: product.status, adultUseEligible: product.adultUseEligible, medicalEligible: product.medicalEligible, publicDescription: product.publicDescription, categoryCode: product.categoryCode, taxCategoryCode: product.taxCategoryCode };
    return { id: product.id, status: String(next.status ?? product.status), reference: product.sku, before, changes: { ...data, ...photoChange } };
  });
}
async function revokeStaffCredential(_root, args, context) {
  const input = args.input;
  const credentialId = assertText(input.credentialId, "Credential ID");
  const nextStatus = assertText(input.nextStatus, "Credential status");
  if (!["suspended", "terminated"].includes(nextStatus)) throw new Error("Credentials can be suspended or terminated here");
  const reasonCode = assertReasonCode(input.reasonCode);
  return runControlledOperation(context, input, { permission: "canManageAuthority", activity: "authority", scope: "revokeStaffCredential", resourceType: "StaffCredential", action: "staff.credential.revoked", lockKeys: [credentialId] }, async (tx, authority) => {
    const credential = await tx.sudo().query.StaffCredential.findOne({ where: { id: credentialId }, query: "id status user { id } organization { id } premises { id }" });
    if (!credential || credential.organization?.id !== authority.organizationId || credential.premises?.id !== authority.premisesId) throw new Error("Credential is outside this premises");
    if (credential.user?.id === authority.actor.id) throw new Error("You cannot revoke your own credential");
    if (!["active", "pending", "suspended"].includes(credential.status) || credential.status === nextStatus) throw new Error(`A ${credential.status} credential cannot be ${nextStatus}`);
    await tx.sudo().query.StaffCredential.updateOne({ where: { id: credential.id }, data: { status: nextStatus }, query: "id" });
    return { id: credential.id, status: nextStatus, reference: credential.user?.id ?? credential.id, beforeStatus: credential.status, reasonCode };
  });
}
async function amendRegister(_root, args, context) {
  const input = args.input;
  const registerId = assertText(input.registerId, "Register ID");
  if (!["active", "inactive", "maintenance"].includes(input.status)) throw new Error("Register status must be active, inactive or maintenance");
  return runControlledOperation(context, input, { permission: "canManageFinance", activity: "cash", scope: "amendRegister", resourceType: "Register", action: "register.amended", lockKeys: [registerId] }, async (tx, authority) => {
    const register = await tx.sudo().query.Register.findOne({ where: { id: registerId }, query: "id code name status organization { id } premises { id }" });
    if (!register || register.organization?.id !== authority.organizationId || register.premises?.id !== authority.premisesId) throw new Error("Register is outside this premises");
    if (input.status !== "active") {
      const open = await tx.sudo().query.RegisterShift.count({ where: { register: { id: { equals: register.id } }, status: { in: ["open", "count_pending", "counted", "variance_review"] } } });
      if (open) throw new Error("Resolve this register's open shift first");
    }
    const name = input.name ? assertText(input.name, "Register name", 1, 200) : register.name;
    await tx.sudo().query.Register.updateOne({ where: { id: register.id }, data: { name, status: input.status }, query: "id" });
    return { id: register.id, status: input.status, reference: register.code, before: { name: register.name, status: register.status } };
  });
}
var RENEWABLE = { license: ["active", "expired", "conditioned"], credential: ["active", "expired", "pending", "suspended"] };
async function renewCannabisAuthority(_root, args, context) {
  const input = args.input;
  const authority = await requireReadAuthority(context, "canManageAuthority");
  const owner = await context.sudo().query.User.findOne({ where: { id: authority.actor.id }, query: "role { canManageOnboarding }" });
  if (owner?.role?.canManageOnboarding !== true) throw new Error("Only the business owner can renew licenses and credentials");
  const kind = input.kind === "license" ? "license" : input.kind === "credential" ? "credential" : null;
  if (!kind) throw new Error("Choose a license or credential to renew");
  const recordId = assertText(input.id, "Record ID");
  const key = assertText(input.idempotencyKey, "Idempotency key", 8, 200);
  const effectiveAt = new Date(assertText(input.effectiveAt, "Effective date"));
  const expiresAt = new Date(assertText(input.expiresAt, "Expiry date"));
  if (!Number.isFinite(effectiveAt.getTime()) || !Number.isFinite(expiresAt.getTime()) || effectiveAt >= expiresAt || expiresAt.getTime() <= Date.now()) throw new Error("Enter a valid period that ends in the future");
  const reference = assertText(input.reference, kind === "license" ? "Renewal reference" : "Credential number", 2, 200);
  const lookupKey = `${authority.organizationId}:${authority.premisesId}:renewCannabisAuthority:${key}`;
  const requestHash = stableHash(input);
  return serializableTransaction(context, async (tx) => {
    await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "openfront-cannabis", lookupKey);
    await fenceAuthority(tx, authority);
    const sudo = tx.sudo();
    const prior = await sudo.query.IdempotencyKey.findOne({ where: { lookupKey }, query: "requestHash status responseSnapshot actor { id }" });
    if (prior) {
      if (prior.requestHash !== requestHash || prior.actor?.id !== authority.actor.id) throw new Error("Idempotency key was reused with different input");
      return { ...prior.responseSnapshot, replayed: true };
    }
    const list8 = kind === "license" ? sudo.query.CannabisLicense : sudo.query.StaffCredential;
    const record = await list8.findOne({ where: { id: recordId }, query: `id status effectiveAt expiresAt ${kind === "license" ? "authorityReference" : "credentialReference"} organization { id } premises { id }` });
    if (!record || record.organization?.id !== authority.organizationId || record.premises?.id !== authority.premisesId) throw new Error("Record is outside this premises");
    if (!RENEWABLE[kind].includes(record.status)) throw new Error(`A ${record.status} ${kind} can't be renewed here`);
    const before = { status: record.status, effectiveAt: record.effectiveAt, expiresAt: record.expiresAt, reference: kind === "license" ? record.authorityReference : record.credentialReference };
    await list8.updateOne({ where: { id: record.id }, data: { status: "active", effectiveAt, expiresAt, ...kind === "license" ? { authorityReference: reference } : { credentialReference: reference } }, query: "id" });
    const result = { id: record.id, status: "active", reference: kind, before, after: { effectiveAt: effectiveAt.toISOString(), expiresAt: expiresAt.toISOString() } };
    await sudo.query.IdempotencyKey.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, scope: "renewCannabisAuthority", lookupKey, requestHash, requestSnapshot: retainedRequest(input), status: "succeeded", responseSnapshot: JSON.parse(JSON.stringify(result)), startedAt: /* @__PURE__ */ new Date(), completedAt: /* @__PURE__ */ new Date(), expiresAt: new Date(Date.now() + 3e5), actor: { connect: { id: authority.actor.id } } }, query: "id" });
    await sudo.query.AuditEvent.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, actor: { connect: { id: authority.actor.id } }, action: `authority.${kind}.renewed`, resourceType: kind === "license" ? "CannabisLicense" : "StaffCredential", resourceId: record.id, correlationId: key, reasonCode: "owner_renewal", evidence: JSON.parse(JSON.stringify(result)), evidenceHash: stableHash(result), occurredAt: /* @__PURE__ */ new Date() }, query: "id" });
    return { ...result, replayed: false };
  });
}

// features/keystone/domain/packageReadiness.ts
function packageBalance(input) {
  const { quantityOnHandMicrounits: onHand, reservedMicrounits: reserved } = input;
  if (!Number.isSafeInteger(onHand) || !Number.isSafeInteger(reserved) || onHand < 0 || reserved < 0 || reserved > onHand) {
    return { state: "discrepancy", onHandMicrounits: onHand, reservedMicrounits: reserved };
  }
  return { state: "ok", onHandMicrounits: onHand, reservedMicrounits: reserved, availableMicrounits: onHand - reserved };
}
function packageReadiness(input, now = /* @__PURE__ */ new Date()) {
  const reasons = [];
  const balance = packageBalance(input);
  if (input.status !== "saleable") reasons.push("status_not_saleable");
  if (input.testStatus !== "passed") reasons.push("test_not_passed");
  if (input.activeHoldCount > 0) reasons.push("active_hold");
  if (!input.expiresAt || !(new Date(input.expiresAt).getTime() > now.getTime())) reasons.push("expired");
  if (!input.coaReference || !input.labelVersion) reasons.push("missing_coa_or_label");
  if (balance.state === "discrepancy") reasons.push("balance_discrepancy");
  else if (balance.availableMicrounits <= 0) reasons.push("no_free_quantity");
  return { ready: reasons.length === 0, reasons, balance };
}

// features/keystone/mutations/workspace.ts
var WORKSPACE_PAGE_SIZE = 50;
var DAY_MS = 864e5;
var UNRESOLVED_INCIDENT = ["open", "contained", "investigating", "reported"];
var sectionAuthority = {
  overview: { permission: "canAccessDashboard", activity: "authority", mode: "read" },
  authority: { permission: "canManageAuthority", activity: "authority", mode: "read" },
  compliance: { permission: "canManageCompliance", activity: "eligibility", mode: "operational" },
  inventory: { permission: "canManageInventory", activity: "inventory", mode: "operational" },
  receiving: { permission: "canManageInventory", activity: "inventory", mode: "operational" },
  menu: { permission: "canManageInventory", activity: "inventory", mode: "operational" },
  pos: { permission: "canManageSales", activity: "sale", mode: "operational" },
  cash: { permission: "canManageFinance", activity: "cash", mode: "operational" },
  reconciliation: { permission: "canViewReports", activity: "state_reporting", mode: "operational" },
  incidents: { permission: "canManageCompliance", activity: "incident", mode: "read" },
  staff: { permission: "canManagePeople", activity: "authority", mode: "read" },
  customers: { permission: "canManageCompliance", activity: "eligibility", mode: "read" },
  customer: { permission: "canManageCompliance", activity: "eligibility", mode: "read" },
  sales: { permission: "canManageSales", activity: "sale", mode: "read" },
  product: { permission: "canManageInventory", activity: "inventory", mode: "read" },
  recalls: { permission: "canManageCompliance", activity: "inventory", mode: "read" },
  audit: { permission: "canViewReports", activity: "state_reporting", mode: "read" }
};
function readOptions(raw) {
  const value = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const bounded = (entry, max) => typeof entry === "string" && entry.trim() && entry.trim().length <= max ? entry.trim() : null;
  return { cursor: bounded(value.cursor, 100), search: bounded(value.search, 100), filter: bounded(value.filter, 40), productSearch: bounded(value.productSearch, 100), id: bounded(value.id, 100) };
}
var AUDIT_RESOURCE_LABELS = {
  Product: "name",
  InventoryPackage: "packageUid",
  PackageHold: "package { packageUid }",
  RecallCase: "reference",
  StaffCredential: "credentialReference",
  CannabisLicense: "licenseNumber",
  JurisdictionRulePack: "version",
  Premises: "name",
  Register: "name",
  ComplianceIncident: "reference",
  User: "name",
  StorefrontSettings: "businessName",
  Customer: "reference",
  Sale: "receiptNumber",
  RegulatedManifest: "manifestNumber"
};
async function page(context, list8, args) {
  const take = args.take ?? WORKSPACE_PAGE_SIZE;
  const api = context.sudo().query[list8];
  const [rows, total] = await Promise.all([
    api.findMany({ where: args.where, orderBy: [...args.orderBy, { id: "asc" }], take: take + 1, ...args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}, query: args.query }),
    api.count({ where: args.where })
  ]);
  return { items: rows.slice(0, take), nextCursor: rows.length > take ? String(rows[take - 1].id) : null, total: Number(total) };
}
function intervalState(record, now, activeStatus = "active") {
  if (record.status !== activeStatus) return "inactive";
  if (!(new Date(record.effectiveAt).getTime() <= now)) return "not_yet_effective";
  if (!(new Date(record.expiresAt).getTime() > now)) return "expired";
  if (new Date(record.expiresAt).getTime() < now + 30 * DAY_MS) return "expiring_soon";
  return "current";
}
function notificationState(incident, now) {
  if (!UNRESOLVED_INCIDENT.includes(incident.status)) return "resolved";
  if (!incident.notificationDueAt) return "none";
  const due = new Date(incident.notificationDueAt).getTime();
  if (!Number.isFinite(due)) return "unknown";
  if (due <= now) return "overdue";
  if (due < now + DAY_MS) return "due_soon";
  return "upcoming";
}
var PACKAGE_SELECTION = "id packageUid sourcePackageUid productionBatchNumber lotNumber status testStatus quantityReceivedMicrounits quantityOnHandMicrounits reservedMicrounits unitOfMeasure expiresAt receivedAt manufacturedAt coaReference labName labResultReference labelVersion version product { id name sku } holds(where: { status: { equals: active } }, orderBy: [{ placedAt: desc }], take: 10) { id type reasonCode reason status placedAt } holdsCount(where: { status: { equals: active } }) events(orderBy: [{ occurredAt: desc }], take: 12) { id eventType quantityDeltaMicrounits beforeQuantityMicrounits afterQuantityMicrounits reasonCode occurredAt stateReportStatus manifest { manifestNumber status } actor { name } } eventsCount";
function projectPackage(pkg, now) {
  const readiness = packageReadiness({ status: pkg.status, testStatus: pkg.testStatus, expiresAt: pkg.expiresAt, coaReference: pkg.coaReference, labelVersion: pkg.labelVersion, quantityOnHandMicrounits: pkg.quantityOnHandMicrounits, reservedMicrounits: pkg.reservedMicrounits, activeHoldCount: Number(pkg.holdsCount) || 0 }, now);
  return { ...pkg, readiness: { ready: readiness.ready, reasons: readiness.reasons }, balance: readiness.balance };
}
function readyPackageWhere(now) {
  return { status: { equals: "saleable" }, testStatus: { equals: "passed" }, expiresAt: { gt: now }, holds: { none: { status: { equals: "active" } } }, coaReference: { not: { equals: "" } }, labelVersion: { not: { equals: "" } } };
}
var PACKAGE_FILTERS = {
  all: () => ({}),
  receiving: () => ({ status: { in: ["expected_inbound", "receiving_hold"] } }),
  held: () => ({ OR: [{ holds: { some: { status: { equals: "active" } } } }, { status: { in: ["quarantined", "recalled"] } }] }),
  ready: readyPackageWhere,
  closed: () => ({ status: { in: ["depleted", "destroyed"] } })
};
async function cannabisOperationsWorkspace(_root, args, context) {
  const section = String(args.section || "");
  const required = sectionAuthority[section];
  if (!required) throw new Error("Unsupported workspace section");
  const options = readOptions(args.options);
  let readAuthority;
  try {
    readAuthority = await requireReadAuthority(context, required.permission);
  } catch {
    return { section, state: "forbidden" };
  }
  let operatingClosedReason = null;
  try {
    await requireOperationalAuthority(context, required.permission, required.activity);
  } catch (error) {
    operatingClosedReason = error instanceof Error ? error.message : "Operating authority is not current";
  }
  if (required.mode === "operational" && operatingClosedReason) return { section, state: "operating_closed", reason: operatingClosedReason };
  const authority = readAuthority;
  const sudo = context.sudo();
  const now = /* @__PURE__ */ new Date();
  const nowMs = now.getTime();
  const credential = authority.actor.staffCredential;
  const credentialCurrent = Boolean(credential && credential.status === "active" && new Date(credential.effectiveAt).getTime() <= nowMs && new Date(credential.expiresAt).getTime() > nowMs);
  const limited = Boolean(operatingClosedReason) && credentialCurrent && Array.isArray(credential?.allowedActivities) && !credential.allowedActivities.includes(required.activity);
  const scope = { organization: { id: { equals: authority.organizationId } }, premises: { id: { equals: authority.premisesId } } };
  const base2 = {
    section,
    state: "ok",
    generatedAt: now.toISOString(),
    authorityFingerprint: stableHash([authority.actor.id, authority.organizationId, authority.premisesId]),
    jurisdictionCode: authority.actor.organization?.jurisdictionCode ?? null,
    premisesId: authority.premisesId,
    timezone: authority.actor.premises?.timezone ?? null,
    currencyCode: authority.actor.premises?.currencyCode ?? null,
    operating: { open: !operatingClosedReason, reason: operatingClosedReason, limited },
    salesRules: { version: null, problem: null }
  };
  const { pack: rulePack } = await latestRulePack(context, authority.organizationId, authority.premisesId);
  base2.salesRules = { version: rulePack?.version ?? null, problem: rulePackProblem(rulePack) };
  if (section === "overview") {
    const role = (await sudo.query.User.findOne({ where: { id: authority.actor.id }, query: "role { canManageInventory canManageCompliance canManageAuthority canManageSales canManageFinance canViewReports }" }))?.role;
    const result = { ...base2, access: { inventory: role?.canManageInventory === true, compliance: role?.canManageCompliance === true, authority: role?.canManageAuthority === true, sales: role?.canManageSales === true, finance: role?.canManageFinance === true, reports: role?.canViewReports === true } };
    if (role?.canManageInventory === true && !operatingClosedReason) {
      const ready = await page(context, "InventoryPackage", { where: { ...scope, ...readyPackageWhere(now) }, orderBy: [{ expiresAt: "asc" }], take: 10, query: "id packageUid expiresAt quantityOnHandMicrounits reservedMicrounits unitOfMeasure product { name }" });
      const [held, receiving] = await Promise.all([
        sudo.query.InventoryPackage.count({ where: { ...scope, ...PACKAGE_FILTERS.held(now) } }),
        sudo.query.InventoryPackage.count({ where: { ...scope, ...PACKAGE_FILTERS.receiving(now) } })
      ]);
      result.inventory = { ready: ready.items, readyTotal: ready.total, heldTotal: held, receivingTotal: receiving };
    }
    if (role?.canManageCompliance === true) {
      const open = await page(context, "ComplianceIncident", { where: { ...scope, status: { in: UNRESOLVED_INCIDENT } }, orderBy: [{ detectedAt: "desc" }], take: 10, query: "id reference type severity status detectedAt notificationDueAt" });
      const overdue = await sudo.query.ComplianceIncident.count({ where: { ...scope, status: { in: UNRESOLVED_INCIDENT }, notificationDueAt: { lte: now } } });
      result.incidents = { open: open.items.map((incident) => ({ ...incident, notificationState: notificationState(incident, nowMs) })), openTotal: open.total, overdueTotal: overdue };
    }
    if (role?.canManageAuthority === true) result.authorityAccess = true;
    return result;
  }
  if (section === "authority") {
    const licenses = await page(context, "CannabisLicense", { where: scope, orderBy: [{ expiresAt: "asc" }], query: "id licenseNumber licenseType status effectiveAt expiresAt regulatorName" });
    const credentials = await page(context, "StaffCredential", { where: scope, orderBy: [{ expiresAt: "asc" }], cursor: options.cursor, query: "id credentialType status effectiveAt expiresAt approvalLimitCents user { id name }" });
    const states = credentials.items.map((credential2) => intervalState(credential2, nowMs));
    const self = await sudo.query.User.findOne({ where: { id: authority.actor.id }, query: "role { canManageOnboarding } staffCredential { id approvalLimitCents }" });
    const premisesRow = await sudo.query.Premises.findOne({ where: { id: authority.premisesId }, query: "name addressSnapshot" });
    const address = premisesRow?.addressSnapshot && typeof premisesRow.addressSnapshot === "object" && !Array.isArray(premisesRow.addressSnapshot) ? premisesRow.addressSnapshot : {};
    const addressText = (key) => typeof address[key] === "string" ? address[key].slice(0, 200) : null;
    return {
      ...base2,
      self: { credentialId: self?.staffCredential?.id ?? null, isOwner: self?.role?.canManageOnboarding === true, approvalLimitCents: self?.staffCredential?.approvalLimitCents ?? 0 },
      premises: { name: premisesRow?.name ?? null, line1: addressText("line1"), city: addressText("city"), region: addressText("region"), postalCode: addressText("postalCode"), country: addressText("country"), phone: addressText("phone") },
      rules: rulePack ? {
        id: rulePack.id,
        version: rulePack.version,
        effectiveAt: new Date(rulePack.effectiveAt).toISOString(),
        expiresAt: new Date(rulePack.expiresAt).toISOString(),
        adultMinimumAge: rulePack.adultMinimumAge,
        medicalMinimumAge: rulePack.medicalMinimumAge,
        medicalEnabled: rulePack.medicalEnabled === true,
        operatingStartMinute: rulePack.operatingStartMinute,
        operatingEndMinute: rulePack.operatingEndMinute,
        purchaseLimits: Array.isArray(rulePack.purchaseLimits) ? rulePack.purchaseLimits.slice(0, 50) : [],
        taxRules: Array.isArray(rulePack.taxRules) ? rulePack.taxRules.slice(0, 50) : [],
        discountRuleCount: Array.isArray(rulePack.discountRules) ? rulePack.discountRules.length : 0,
        allowedTenderTypes: Array.isArray(rulePack.allowedTenderTypes) ? rulePack.allowedTenderTypes.filter((type) => typeof type === "string").slice(0, 10) : []
      } : null,
      ruleVersions: await sudo.query.JurisdictionRulePack.findMany({ where: scope, orderBy: [{ effectiveAt: "desc" }], take: 20, query: "id version status effectiveAt expiresAt approvedAt approvedBy { name }" }),
      licenses: { ...licenses, items: licenses.items.map((license) => ({ ...license, intervalState: intervalState(license, nowMs) })) },
      credentials: { ...credentials, items: credentials.items.map((credential2, index) => ({ ...credential2, intervalState: states[index] })) }
    };
  }
  if (section === "compliance") {
    const pendingCustomers = await page(context, "Customer", { where: { ...scope, status: { equals: "pending_verification" } }, orderBy: [{ createdAt: "asc" }], cursor: options.cursor, query: "id reference capacity status createdAt" });
    const holds = await page(context, "PackageHold", { where: { ...scope, status: { equals: "active" } }, orderBy: [{ placedAt: "asc" }], query: "id type reasonCode placedAt package { id packageUid }" });
    const recalls = await page(context, "RecallCase", { where: scope, orderBy: [{ openedAt: "desc" }], query: "id reference status reason openedAt" });
    return {
      ...base2,
      pendingCustomers: { ...pendingCustomers, items: pendingCustomers.items.map((customer) => ({ ...customer, kind: "customer_eligibility" })) },
      holds,
      recalls: { ...recalls, items: recalls.items.map((recall) => ({ ...recall, kind: "recall_case" })) }
    };
  }
  if (section === "inventory") {
    const filter2 = options.filter && PACKAGE_FILTERS[options.filter] ? options.filter : "all";
    const search = options.search ? { OR: [{ packageUid: { contains: options.search, mode: "insensitive" } }, { lotNumber: { contains: options.search, mode: "insensitive" } }, { product: { name: { contains: options.search, mode: "insensitive" } } }] } : {};
    const packages = await page(context, "InventoryPackage", { where: { AND: [scope, PACKAGE_FILTERS[filter2](now), search] }, orderBy: [{ expiresAt: "asc" }], cursor: options.cursor, query: PACKAGE_SELECTION });
    const counts = Object.fromEntries(await Promise.all(Object.entries(PACKAGE_FILTERS).map(async ([key, where]) => [key, await sudo.query.InventoryPackage.count({ where: { AND: [scope, where(now)] } })])));
    return {
      ...base2,
      filter: filter2,
      search: options.search,
      counts,
      packages: { ...packages, items: packages.items.map((pkg) => projectPackage(pkg, now)) },
      actions: { release: { available: true } }
    };
  }
  if (section === "receiving") {
    const inbound = { type: { in: ["receiving", "transfer_in"] } };
    const search = options.search ? { manifestNumber: { contains: options.search, mode: "insensitive" } } : {};
    const manifests = await page(context, "RegulatedManifest", { where: { AND: [scope, inbound, search] }, orderBy: [{ occurredAt: "desc" }], cursor: options.cursor, query: "id manifestNumber type status sourceLicenseNumber destinationLicenseNumber transporterReference regulatorManifestId occurredAt reasonCode packageEvents(orderBy: [{ occurredAt: asc }], take: 20) { id eventType quantityDeltaMicrounits package { packageUid unitOfMeasure } } packageEventsCount" });
    const productSearch = options.productSearch ? { OR: [{ name: { contains: options.productSearch, mode: "insensitive" } }, { sku: { contains: options.productSearch, mode: "insensitive" } }] } : {};
    const products = await page(context, "Product", { where: { AND: [scope, { status: { equals: "active" } }, productSearch] }, orderBy: [{ name: "asc" }], take: 100, query: "id name sku form unitOfMeasure unitQuantityMicrounits" });
    const [receivingHoldTotal, discrepancyTotal] = await Promise.all([
      sudo.query.InventoryPackage.count({ where: { ...scope, status: { equals: "receiving_hold" } } }),
      sudo.query.RegulatedManifest.count({ where: { AND: [scope, inbound, { status: { in: ["partially_accepted", "rejected"] } }] } })
    ]);
    return { ...base2, search: options.search, productSearch: options.productSearch, manifests, products, receivingHoldTotal, discrepancyTotal };
  }
  if (section === "menu") {
    const search = options.search ? { OR: [{ name: { contains: options.search, mode: "insensitive" } }, { sku: { contains: options.search, mode: "insensitive" } }] } : {};
    const products = await page(context, "Product", { where: { AND: [scope, { status: { equals: "active" } }, search] }, orderBy: [{ name: "asc" }], cursor: options.cursor, query: `id name sku form categoryCode taxCategoryCode priceCents status unitOfMeasure adultUseEligible medicalEligible updatedAt publicDescription packages(where: { status: { equals: saleable }, testStatus: { equals: passed }, expiresAt: { gt: "${now.toISOString()}" } }, orderBy: [{ expiresAt: asc }], take: 20) { id quantityOnHandMicrounits reservedMicrounits status testStatus expiresAt coaReference labelVersion holdsCount(where: { status: { equals: active } }) }` });
    const items = products.items.map((product) => {
      const candidates = Array.isArray(product.packages) ? product.packages : [];
      const ready = candidates.filter((pkg) => packageReadiness({ ...pkg, activeHoldCount: Number(pkg.holdsCount) || 0 }, now).ready);
      const availableMicrounits = ready.reduce((sum, pkg) => sum + (pkg.quantityOnHandMicrounits - pkg.reservedMicrounits), 0);
      const { packages: _packages, ...rest } = product;
      return { ...rest, readyPackageCount: ready.length, readyCountComplete: candidates.length < 20, availableMicrounits };
    });
    const inactiveTotal = await sudo.query.Product.count({ where: { ...scope, status: { in: ["draft", "inactive"] } } });
    const categories = { limit: [...new Set((Array.isArray(rulePack?.purchaseLimits) ? rulePack.purchaseLimits : []).map((rule) => rule?.categoryCode).filter((code) => typeof code === "string" && code.trim() !== ""))].slice(0, 50), tax: [...new Set((Array.isArray(rulePack?.taxRules) ? rulePack.taxRules : []).map((rule) => rule?.categoryCode).filter((code) => typeof code === "string" && code.trim() !== ""))].slice(0, 50) };
    return { ...base2, search: options.search, products: { ...products, items }, inactiveTotal, categories };
  }
  if (section === "pos") {
    const carts = await page(context, "Cart", { where: { ...scope, status: { in: ["preliminarily_eligible", "reserved", "picking", "staged", "final_verification"] } }, orderBy: [{ createdAt: "asc" }], cursor: options.cursor, query: "id reference source status version expiresAt subtotalCents discountCents taxCents totalCents pickupWindowStart pickupWindowEnd pickupName pickupPhone paymentMethod paymentStatus customer { id reference capacity } shift { id operator { id } } lines(take: 50) { id titleSnapshot quantityMicrounits totalCents package { unitOfMeasure } }" });
    const myShifts = await sudo.query.RegisterShift.findMany({ where: { ...scope, status: { equals: "open" }, operator: { id: { equals: authority.actor.id } } }, orderBy: [{ openedAt: "desc" }], take: 5, query: "id register { name code }" });
    const tenderTypes2 = await sudo.query.TenderConfiguration.findMany({ where: { ...scope, enabled: { equals: true }, effectiveAt: { lte: now }, expiresAt: { gt: now } }, orderBy: [{ type: "asc" }], take: 10, query: "type displayName" });
    const productSearch = options.productSearch ? { OR: [{ name: { contains: options.productSearch, mode: "insensitive" } }, { sku: { contains: options.productSearch, mode: "insensitive" } }] } : {};
    const products = await page(context, "Product", { where: { AND: [scope, { status: { equals: "active" } }, productSearch] }, orderBy: [{ name: "asc" }], take: 100, query: "id name sku form unitQuantityMicrounits unitOfMeasure" });
    const sales = await page(context, "Sale", { where: scope, orderBy: [{ finalizedAt: "desc" }], take: 25, query: "id receiptNumber status totalCents finalizedAt" });
    const allowed2 = Array.isArray(rulePack?.allowedTenderTypes) ? rulePack.allowedTenderTypes : [];
    return { ...base2, carts, products, sales, productSearch: options.productSearch, actorId: authority.actor.id, myShifts, medicalEnabled: rulePack?.medicalEnabled === true, tenderTypes: tenderTypes2.filter((tender) => allowed2.includes(String(tender.type))) };
  }
  if (section === "cash") {
    const shifts = await page(context, "RegisterShift", { where: scope, orderBy: [{ createdAt: "desc" }], cursor: options.cursor, query: "id status openingFloatCents expectedCashCents actualCashCents varianceCents openedAt closedAt register { id name code } operator { id name }" });
    const registers = await page(context, "Register", { where: scope, orderBy: [{ code: "asc" }], take: 100, query: "id code name status" });
    const tenders = await sudo.query.TenderConfiguration.findMany({ where: scope, orderBy: [{ type: "asc" }], take: 20, query: "id code type displayName enabled authorityReference effectiveAt expiresAt" });
    const shiftEvents = await Promise.all(shifts.items.map((shift) => sudo.query.CashEvent.findMany({ where: { shift: { id: { equals: shift.id } } }, orderBy: [{ occurredAt: "desc" }], take: 10, query: "id type amountCents reasonCode occurredAt actor { name }" })));
    return { ...base2, actorId: authority.actor.id, shifts: { ...shifts, items: shifts.items.map((shift, index) => ({ ...shift, cashEvents: shiftEvents[index] })) }, registers, tenders };
  }
  if (section === "reconciliation") {
    const runs = await page(context, "ReconciliationRun", { where: scope, orderBy: [{ startedAt: "desc" }], cursor: options.cursor, query: "id type status discrepancyCount startedAt completedAt" });
    const installations = await sudo.query.IntegrationInstallation.count({ where: { ...scope, status: { equals: "active" } } });
    const integrations = await sudo.query.IntegrationInstallation.findMany({ where: scope, orderBy: [{ providerType: "asc" }], take: 20, query: "id providerCode providerType status facilityReference authorityReference validatedAt lastSuccessfulSyncAt" });
    const inbox = await page(context, "StateEventInbox", { where: scope, orderBy: [{ receivedAt: "desc" }], take: 25, query: "id providerCode providerEventId status receivedAt processedAt rejectionReason" });
    return { ...base2, runs, integrations, inbox };
  }
  if (section === "staff") {
    const search = options.search ? { OR: [{ name: { contains: options.search, mode: "insensitive" } }, { email: { contains: options.search, mode: "insensitive" } }] } : {};
    const people = await page(context, "User", {
      where: { AND: [scope, search] },
      orderBy: [{ name: "asc" }],
      cursor: options.cursor,
      query: "id name email status createdAt role { id name canManagePeople canManageAuthority canManageCompliance canManageInventory canManageSales canManageFinance canManageIntegrations canViewReports canManageOnboarding } staffCredential { id credentialType credentialReference status effectiveAt expiresAt allowedActivities approvalLimitCents }"
    });
    return { ...base2, selfId: authority.actor.id, search: options.search, people: { ...people, items: people.items.map((person) => ({ ...person, credential: person.staffCredential ? { ...person.staffCredential, intervalState: intervalState(person.staffCredential, nowMs) } : null, staffCredential: void 0 })) } };
  }
  if (section === "customers") {
    const statuses = ["pending_verification", "eligible", "ineligible", "suspended"];
    const filter2 = options.filter && statuses.includes(options.filter) ? options.filter : "all";
    const search = options.search ? { reference: { contains: options.search, mode: "insensitive" } } : {};
    const customers = await page(context, "Customer", { where: { AND: [scope, filter2 === "all" ? {} : { status: { equals: filter2 } }, search] }, orderBy: [{ createdAt: "desc" }], cursor: options.cursor, query: "id reference capacity status marketingConsent createdAt" });
    const counts = Object.fromEntries(await Promise.all(["all", ...statuses].map(async (status5) => [status5, await sudo.query.Customer.count({ where: { ...scope, ...status5 === "all" ? {} : { status: { equals: status5 } } } })])));
    return { ...base2, filter: filter2, search: options.search, customers, counts };
  }
  if (section === "customer") {
    const customer = options.id ? await sudo.query.Customer.findOne({ where: { id: options.id }, query: "id reference capacity status marketingConsent createdAt organization { id } premises { id }" }) : null;
    if (!customer || customer.organization?.id !== authority.organizationId || customer.premises?.id !== authority.premisesId) return { ...base2, customer: null, evidence: [], carts: [], sales: [] };
    const byCustomer = { customer: { id: { equals: customer.id } } };
    const [evidence, carts, sales] = await Promise.all([
      sudo.query.EligibilityEvidence.findMany({ where: byCustomer, orderBy: [{ createdAt: "desc" }], take: 20, query: "id capacity identityMethod result reasonCodes identityExpiresAt registryName registryExpiresAt verifiedAt createdAt" }),
      sudo.query.Cart.findMany({ where: byCustomer, orderBy: [{ createdAt: "desc" }], take: 20, query: "id reference source status totalCents expiresAt createdAt" }),
      sudo.query.Sale.findMany({ where: byCustomer, orderBy: [{ finalizedAt: "desc" }], take: 20, query: "id receiptNumber status totalCents finalizedAt" })
    ]);
    const { organization: _organization, premises: _premises, ...rest } = customer;
    return { ...base2, customer: rest, evidence, carts, sales };
  }
  if (section === "sales") {
    const groups = { finalized: ["finalized"], reporting: ["state_queued", "state_rejected"], reported: ["state_accepted", "reconciled"], refunds: ["partially_refunded", "refunded", "reversal_pending", "reversed"] };
    const filter2 = options.filter && groups[options.filter] ? options.filter : "all";
    const search = options.search ? { receiptNumber: { contains: options.search, mode: "insensitive" } } : {};
    const sales = await page(context, "Sale", { where: { AND: [scope, filter2 === "all" ? {} : { status: { in: groups[filter2] } }, search] }, orderBy: [{ finalizedAt: "desc" }], cursor: options.cursor, query: "id receiptNumber status totalCents refundedCents customerCapacitySnapshot finalizedAt linesCount" });
    const counts = Object.fromEntries(await Promise.all(["all", ...Object.keys(groups)].map(async (group) => [group, await sudo.query.Sale.count({ where: { ...scope, ...group === "all" ? {} : { status: { in: groups[group] } } } })])));
    const refunds = await page(context, "Refund", { where: scope, orderBy: [{ occurredAt: "desc" }], take: 10, query: "id amountCents reasonCode status inventoryDisposition occurredAt sale { id receiptNumber }" });
    return { ...base2, filter: filter2, search: options.search, sales, counts, refunds };
  }
  if (section === "product") {
    const product = options.id ? await sudo.query.Product.findOne({ where: { id: options.id }, query: "id name sku brand form categoryCode taxCategoryCode unitOfMeasure unitQuantityMicrounits equivalencyMicrounits priceCents status adultUseEligible medicalEligible publicDescription publicImageUrl photo { url } updatedAt createdAt organization { id } premises { id }" }) : null;
    if (!product || product.organization?.id !== authority.organizationId || product.premises?.id !== authority.premisesId) return { ...base2, product: null, packages: { items: [], nextCursor: null, total: 0 }, saleLines: [], categories: { limit: [], tax: [] } };
    const packages = await page(context, "InventoryPackage", { where: { ...scope, product: { id: { equals: product.id } } }, orderBy: [{ expiresAt: "asc" }], cursor: options.cursor, take: 25, query: PACKAGE_SELECTION });
    const saleLines = await sudo.query.SaleLine.findMany({ where: { ...scope, skuSnapshot: { equals: product.sku } }, orderBy: [{ createdAt: "desc" }], take: 20, query: "id quantityMicrounits totalCents packageUidSnapshot createdAt sale { id receiptNumber status finalizedAt }" });
    const codes = (rules2) => [...new Set((Array.isArray(rules2) ? rules2 : []).map((rule) => rule?.categoryCode).filter((code) => typeof code === "string" && code.trim() !== ""))].slice(0, 50);
    const { organization: _organization, premises: _premises, photo, ...rest } = product;
    return { ...base2, product: { ...rest, photoUrl: photo?.url || rest.publicImageUrl || null }, packages: { ...packages, items: packages.items.map((pkg) => projectPackage(pkg, now)) }, saleLines, categories: { limit: codes(rulePack?.purchaseLimits), tax: codes(rulePack?.taxRules) } };
  }
  if (section === "recalls") {
    const statuses = ["suspected", "hold", "scope_confirmed", "active", "monitoring", "disposition", "regulator_closed"];
    const filter2 = options.filter === "closed" ? "closed" : options.filter === "all" ? "all" : "open";
    const where = filter2 === "all" ? scope : filter2 === "closed" ? { ...scope, status: { equals: "regulator_closed" } } : { ...scope, status: { in: statuses.filter((status5) => status5 !== "regulator_closed") } };
    const recalls = await page(context, "RecallCase", { where, orderBy: [{ openedAt: "desc" }], cursor: options.cursor, query: "id reference status authorityReference packageUids batchNumbers reason openedAt closedAt" });
    const heldCounts = await Promise.all(recalls.items.map((recall) => sudo.query.PackageHold.count({ where: { ...scope, type: { equals: "recall" }, status: { equals: "active" }, reason: { startsWith: `${recall.reference}:` } } })));
    const [openTotal2, closedTotal, heldTotal] = await Promise.all([
      sudo.query.RecallCase.count({ where: { ...scope, status: { not: { equals: "regulator_closed" } } } }),
      sudo.query.RecallCase.count({ where: { ...scope, status: { equals: "regulator_closed" } } }),
      sudo.query.PackageHold.count({ where: { ...scope, type: { equals: "recall" }, status: { equals: "active" } } })
    ]);
    return { ...base2, filter: filter2, recalls: { ...recalls, items: recalls.items.map((recall, index) => ({ ...recall, packageUids: Array.isArray(recall.packageUids) ? recall.packageUids.slice(0, 50) : [], batchNumbers: Array.isArray(recall.batchNumbers) ? recall.batchNumbers.slice(0, 50) : [], activeHolds: heldCounts[index] })) }, openTotal: openTotal2, closedTotal, heldTotal };
  }
  if (section === "audit") {
    const resourceType = options.filter && /^[A-Za-z]{2,60}$/.test(options.filter) ? options.filter : null;
    const search = options.search ? { action: { contains: options.search, mode: "insensitive" } } : {};
    const events = await page(context, "AuditEvent", { where: { AND: [scope, resourceType ? { resourceType: { equals: resourceType } } : {}, search] }, orderBy: [{ occurredAt: "desc" }], cursor: options.cursor, query: "id action resourceType resourceId reasonCode correlationId occurredAt actor { name }" });
    const labelled = await Promise.all(Object.entries(AUDIT_RESOURCE_LABELS).map(async ([list8, field]) => {
      const ids = [...new Set(events.items.filter((event) => event.resourceType === list8).map((event) => String(event.resourceId)))];
      if (!ids.length) return [];
      const rows = await sudo.query[list8].findMany({ where: { id: { in: ids } }, query: `id ${field}` });
      return rows.map((row) => [`${list8}:${row.id}`, field.includes("{") ? row.package?.packageUid : row[field]]);
    }));
    const labels = new Map(labelled.flat().filter(([, label]) => label));
    return { ...base2, filter: resourceType, search: options.search, events: { ...events, items: events.items.map((event) => ({ ...event, resourceLabel: labels.get(`${event.resourceType}:${event.resourceId}`) ?? null })) } };
  }
  const filter = options.filter === "all" ? "all" : "open";
  const incidents = await page(context, "ComplianceIncident", { where: { ...scope, ...filter === "open" ? { status: { in: UNRESOLVED_INCIDENT } } : {} }, orderBy: [{ detectedAt: "desc" }], cursor: options.cursor, query: "id reference type severity status occurredAt detectedAt notificationDueAt reportedAt description" });
  const [openTotal, overdueTotal, highTotal] = await Promise.all([
    sudo.query.ComplianceIncident.count({ where: { ...scope, status: { in: UNRESOLVED_INCIDENT } } }),
    sudo.query.ComplianceIncident.count({ where: { ...scope, status: { in: UNRESOLVED_INCIDENT }, notificationDueAt: { lte: now } } }),
    sudo.query.ComplianceIncident.count({ where: { ...scope, status: { in: UNRESOLVED_INCIDENT }, severity: { in: ["high", "critical"] } } })
  ]);
  return { ...base2, filter, incidents: { ...incidents, items: incidents.items.map((incident) => ({ ...incident, notificationState: notificationState(incident, nowMs) })) }, openTotal, overdueTotal, highTotal };
}

// features/keystone/domain/cartFulfillment.ts
var MAX_INT2 = 2147483647;
var MAX_FULFILLMENT_LINES = 250;
var MAX_ALLOCATION_EVIDENCE_LINES = 500;
var PREPARATION_TRANSITIONS = {
  reserved: ["picking"],
  picking: ["staged", "reserved"],
  staged: ["picking"]
};
var ALLOCATED_CART_STATUSES = ["preliminarily_eligible", "reserved", "picking", "staged", "final_verification"];
function assertFulfillmentScope(value, scope) {
  const candidate = value;
  if (!candidate || typeof candidate !== "object" || candidate.organization?.id !== scope.organizationId || candidate.premises?.id !== scope.premisesId) {
    throw new Error("Cart preparation evidence is outside current authority");
  }
}
function planCartPreparation(cart, expectedVersion, nextStatus, scope, now = /* @__PURE__ */ new Date()) {
  assertFulfillmentScope(cart, scope);
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1 || cart.version !== expectedVersion || cart.version >= MAX_INT2) {
    throw new Error("Cart preparation version is stale or invalid");
  }
  const expiry = new Date(cart.expiresAt).getTime();
  if (!Number.isFinite(expiry) || expiry <= now.getTime()) throw new Error("Cart reservation expired");
  if (!Object.hasOwn(PREPARATION_TRANSITIONS, cart.status) || !PREPARATION_TRANSITIONS[cart.status].includes(nextStatus)) {
    throw new Error("Unsupported cart preparation transition");
  }
  if (!Array.isArray(cart.lines) || cart.lines.length < 1 || cart.lines.length > MAX_FULFILLMENT_LINES) {
    throw new Error("Cart preparation needs complete bounded reservation lines");
  }
  const ids = /* @__PURE__ */ new Set();
  const groups = /* @__PURE__ */ new Map();
  for (const line of cart.lines) {
    assertFulfillmentScope(line, scope);
    if (!line.id || ids.has(line.id) || line.cart?.id !== cart.id || !line.package?.id || !Number.isSafeInteger(line.quantityMicrounits) || line.quantityMicrounits < 1 || line.quantityMicrounits > MAX_INT2) {
      throw new Error("Cart preparation reservation line is invalid");
    }
    ids.add(line.id);
    const total = (groups.get(line.package.id) || 0) + line.quantityMicrounits;
    if (!Number.isSafeInteger(total) || total > MAX_INT2) throw new Error("Package allocation exceeds integer range");
    groups.set(line.package.id, total);
  }
  return [...groups].sort(([left], [right]) => left.localeCompare(right)).map(([packageId, quantityMicrounits]) => ({ packageId, quantityMicrounits }));
}
function assertPreparationAllocationCoverage(cart, ledger, packages, scope) {
  if (!Array.isArray(ledger) || ledger.length > MAX_ALLOCATION_EVIDENCE_LINES || !Array.isArray(packages) || packages.length > MAX_FULFILLMENT_LINES) {
    throw new Error("Allocation evidence is incomplete");
  }
  const expectedIds = new Set(cart.lines.map((line) => line.package.id));
  const packageIds = /* @__PURE__ */ new Set();
  for (const pkg of packages) {
    assertFulfillmentScope(pkg, scope);
    if (packageIds.has(pkg.id) || !expectedIds.has(pkg.id) || !Number.isSafeInteger(pkg.reservedMicrounits) || pkg.reservedMicrounits < 0 || pkg.reservedMicrounits > MAX_INT2) {
      throw new Error("Allocation package evidence is invalid");
    }
    packageIds.add(pkg.id);
  }
  if (packageIds.size !== expectedIds.size) throw new Error("Allocation package evidence is incomplete");
  const ids = /* @__PURE__ */ new Set();
  const totals = /* @__PURE__ */ new Map();
  const targetLines = new Map(cart.lines.map((line) => [line.id, line]));
  const covered = /* @__PURE__ */ new Set();
  for (const line of ledger) {
    assertFulfillmentScope(line, scope);
    assertFulfillmentScope(line.cart, scope);
    if (!line.id || ids.has(line.id) || !line.cart?.id || !ALLOCATED_CART_STATUSES.includes(line.cart.status) || !packageIds.has(line.package?.id) || !Number.isSafeInteger(line.quantityMicrounits) || line.quantityMicrounits < 1 || line.quantityMicrounits > MAX_INT2) {
      throw new Error("Allocation line evidence is invalid");
    }
    ids.add(line.id);
    const total = (totals.get(line.package.id) || 0) + line.quantityMicrounits;
    if (!Number.isSafeInteger(total) || total > MAX_INT2) throw new Error("Allocation ledger exceeds integer range");
    totals.set(line.package.id, total);
    const target = targetLines.get(line.id);
    if (target) {
      if (line.cart.id !== cart.id || line.cart.status !== cart.status || target.package.id !== line.package.id || target.quantityMicrounits !== line.quantityMicrounits) {
        throw new Error("Cart allocation evidence changed");
      }
      covered.add(line.id);
    } else if (line.cart.id === cart.id) throw new Error("Cart reservation read is incomplete");
  }
  if (covered.size !== targetLines.size || packages.some((pkg) => (totals.get(pkg.id) || 0) !== pkg.reservedMicrounits)) {
    throw new Error("Reservation counter does not match the complete allocation ledger");
  }
}

// features/keystone/mutations/fulfillment.ts
async function cannabisCartPreparation(_root, args, context) {
  const authority = await requireOperationalAuthority(context, "canManageSales", "sale");
  const cartId = assertText(args.cartId, "Cart ID");
  const readable = await context.query.Cart.findOne({ where: { id: cartId }, query: "id" });
  if (!readable || readable.id !== cartId) throw new Error("Cart detail is outside current access");
  const cart = await context.sudo().query.Cart.findOne({ where: { id: cartId }, query: `
    id reference source status version expiresAt totalCents organization { id } premises { id }
    lines(take: ${MAX_FULFILLMENT_LINES + 1}, orderBy: [{ createdAt: asc }, { id: asc }]) {
      id titleSnapshot packageUidSnapshot quantityMicrounits totalCents organization { id } premises { id } cart { id }
    }
  ` });
  assertFulfillmentScope(cart, authority);
  if (!Array.isArray(cart.lines)) throw new Error("Cart preparation detail is incomplete");
  for (const line of cart.lines) {
    assertFulfillmentScope(line, authority);
    if (line.cart?.id !== cart.id) throw new Error("Cart line is outside current detail authority");
  }
  const events = await context.sudo().query.AuditEvent.findMany({
    where: {
      organization: { id: { equals: authority.organizationId } },
      premises: { id: { equals: authority.premisesId } },
      resourceType: { equals: "Cart" },
      resourceId: { equals: cartId },
      action: { equals: "cart.preparation.transitioned" }
    },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: 21,
    query: "id occurredAt actor { name } evidence"
  });
  const allocationEvents = await context.sudo().query.AuditEvent.findMany({
    where: {
      organization: { id: { equals: authority.organizationId } },
      premises: { id: { equals: authority.premisesId } },
      resourceType: { equals: "CartLine" },
      resourceId: { in: cart.lines.slice(0, MAX_FULFILLMENT_LINES).map((line) => line.id) },
      action: { equals: "cart.line.reserved" }
    },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: 21,
    query: "id resourceId occurredAt evidence actor { name }"
  });
  const allocationHistory = allocationEvents.slice(0, 20).map((event) => {
    const fields = readAllocationReceipt(event.evidence, event.resourceId, cart.id);
    return {
      id: event.id,
      occurredAt: event.occurredAt,
      actorName: event.actor?.name || "Operator",
      resourceId: event.resourceId,
      evidenceState: fields ? "recorded_fields" : "unknown_legacy",
      ...fields
    };
  });
  return {
    id: cart.id,
    reference: cart.reference,
    status: cart.status,
    source: cart.source,
    version: cart.version,
    expiresAt: cart.expiresAt,
    totalCents: cart.totalCents,
    authorityFingerprint: stableHash([authority.actor.id, authority.organizationId, authority.premisesId]),
    lines: cart.lines.slice(0, MAX_FULFILLMENT_LINES).map((line) => ({ id: line.id, titleSnapshot: line.titleSnapshot, packageUidSnapshot: line.packageUidSnapshot, quantityMicrounits: line.quantityMicrounits, totalCents: line.totalCents })),
    linesHasMore: cart.lines.length > MAX_FULFILLMENT_LINES,
    historyHasMore: events.length > 20,
    allocationHistory,
    allocationHistoryHasMore: allocationEvents.length > 20,
    history: events.slice(0, 20).map((event) => ({
      id: event.id,
      occurredAt: event.occurredAt,
      actorName: event.actor?.name,
      beforeStatus: typeof event.evidence?.beforeStatus === "string" ? event.evidence.beforeStatus : null,
      status: typeof event.evidence?.status === "string" ? event.evidence.status : null,
      reasonCode: typeof event.evidence?.reasonCode === "string" ? event.evidence.reasonCode : null
    })),
    verification: "preparation_only_not_sale_or_handoff"
  };
}
async function transitionCannabisCartPreparation(_root, args, context) {
  const input = {
    cartId: assertText(args.input.cartId, "Cart ID"),
    expectedVersion: assertInteger(args.input.expectedVersion, "Cart version", 1, 2147483646),
    nextStatus: assertText(args.input.nextStatus, "Preparation status"),
    reasonCode: assertReasonCode(args.input.reasonCode, "Preparation reason"),
    idempotencyKey: assertText(args.input.idempotencyKey, "Idempotency key", 8, 200)
  };
  const authority = await requireOperationalAuthority(context, "canManageSales", "sale");
  const visible = await context.query.Cart.findOne({ where: { id: input.cartId }, query: "id" });
  if (!visible || visible.id !== input.cartId) throw new Error("Cart is outside current access");
  const scope = await context.sudo().query.Cart.findOne({ where: { id: input.cartId }, query: "id organization { id } premises { id }" });
  assertFulfillmentScope(scope, authority);
  const result = await runControlledOperation(context, input, {
    permission: "canManageSales",
    activity: "sale",
    scope: "transitionCannabisCartPreparation",
    resourceType: "Cart",
    action: "cart.preparation.transitioned",
    authorize: async (current, fresh) => {
      const allowed2 = await current.query.Cart.findOne({ where: { id: input.cartId }, query: "id" });
      if (!allowed2 || allowed2.id !== input.cartId) throw new Error("Cart is outside current access");
      const resource = await current.sudo().query.Cart.findOne({ where: { id: input.cartId }, query: "id organization { id } premises { id }" });
      assertFulfillmentScope(resource, fresh);
    }
  }, async (tx, operationAuthority) => {
    await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "cannabis-cart", input.cartId);
    const currentAuthority = await requireOperationalAuthority(tx, "canManageSales", "sale");
    if (currentAuthority.organizationId !== operationAuthority.organizationId || currentAuthority.premisesId !== operationAuthority.premisesId) throw new Error("Operational authority changed");
    const sudo = tx.sudo();
    const now = /* @__PURE__ */ new Date();
    const cart = await sudo.query.Cart.findOne({ where: { id: input.cartId }, query: `
      id reference version status source expiresAt organization { id } premises { id }
      customer { id status capacity organization { id } premises { id } }
      eligibilityEvidence { id result identityMethod capacity identityExpiresAt registryExpiresAt customer { id } organization { id } premises { id } }
      lines(take: ${MAX_FULFILLMENT_LINES + 1}) { id quantityMicrounits cart { id } package { id } organization { id } premises { id } }
    ` });
    assertFulfillmentScope(cart, currentAuthority);
    const groups = planCartPreparation(cart, input.expectedVersion, input.nextStatus, currentAuthority, now);
    assertFulfillmentScope(cart.customer, currentAuthority);
    assertFulfillmentScope(cart.eligibilityEvidence, currentAuthority);
    const evidence = cart.eligibilityEvidence;
    const onlineDeclared = cart.source === "pickup" && cart.customer.status === "pending_verification" && cart.customer.capacity === "adult_use" && evidence?.identityMethod === "online_declared" && evidence?.result === "pending";
    if (!(cart.customer.status === "eligible" || onlineDeclared) || !["adult_use", "patient", "caregiver"].includes(cart.customer.capacity) || evidence.customer?.id !== cart.customer.id || evidence.capacity !== cart.customer.capacity || !(evidence.result === "eligible" || onlineDeclared) || !(new Date(evidence.identityExpiresAt).getTime() > now.getTime()) || cart.customer.capacity !== "adult_use" && !(new Date(evidence.registryExpiresAt).getTime() > now.getTime())) {
      throw new Error("Current customer evidence is required for cart preparation; this is not final eligibility verification");
    }
    for (const group of groups) {
      await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "cannabis-package", group.packageId);
    }
    const packages = await sudo.query.InventoryPackage.findMany({
      where: { id: { in: groups.map((group) => group.packageId) } },
      take: MAX_FULFILLMENT_LINES + 1,
      query: "id version status testStatus expiresAt quantityOnHandMicrounits reservedMicrounits coaReference labelVersion organization { id } premises { id } holds(where: { status: { equals: active } }, take: 1) { id }"
    });
    const ledger = await sudo.query.CartLine.findMany({
      where: { package: { id: { in: groups.map((group) => group.packageId) } }, cart: { status: { notIn: ["completed", "cancelled"] } } },
      take: MAX_ALLOCATION_EVIDENCE_LINES + 1,
      query: "id quantityMicrounits package { id } cart { id status organization { id } premises { id } } organization { id } premises { id }"
    });
    assertPreparationAllocationCoverage(cart, ledger, packages, currentAuthority);
    for (const pkg of packages) {
      const group = groups.find((group2) => group2.packageId === pkg.id);
      if (!Array.isArray(pkg.holds)) throw new Error("Package hold evidence is incomplete");
      assertReservedPackageForSale({
        status: pkg.status,
        testStatus: pkg.testStatus,
        expiresAt: pkg.expiresAt,
        quantityOnHandMicrounits: pkg.quantityOnHandMicrounits,
        reservedMicrounits: pkg.reservedMicrounits,
        coaReference: pkg.coaReference,
        labelVersion: pkg.labelVersion,
        premisesId: pkg.premises.id,
        activeHoldCount: pkg.holds.length
      }, currentAuthority.premisesId, group.quantityMicrounits, now);
    }
    const changed = await tx.prisma.cart.updateMany({
      where: {
        id: cart.id,
        version: input.expectedVersion,
        status: cart.status,
        organizationId: currentAuthority.organizationId,
        premisesId: currentAuthority.premisesId
      },
      data: { status: input.nextStatus, version: { increment: 1 } }
    });
    if (changed.count !== 1) throw new Error("Cart preparation changed concurrently; refresh before retrying");
    return {
      id: cart.id,
      reference: cart.reference,
      status: input.nextStatus,
      version: input.expectedVersion + 1,
      beforeStatus: cart.status,
      beforeVersion: cart.version,
      reasonCode: input.reasonCode,
      packages: groups.map((group) => ({ ...group, version: packages.find((pkg) => pkg.id === group.packageId).version })),
      verification: "preparation_only_not_sale_or_handoff"
    };
  });
  if (input.nextStatus === "staged") {
    const { deliverPickupReadyNotice: deliverPickupReadyNotice2 } = await Promise.resolve().then(() => (init_orderConfirmation(), orderConfirmation_exports));
    await deliverPickupReadyNotice2(context, input.cartId);
  }
  return result;
}

// features/keystone/mutations/storefrontSettings.ts
var SETTINGS_SELECTION = "id businessName tagline description brandHue logoIcon logoColor heroImage { url } publicationStatus storefrontMode updatedAt";
async function scopedSettings(context, organizationId2, premisesId2) {
  return context.sudo().query.StorefrontSettings.findMany({
    where: {
      organization: { id: { equals: organizationId2 } },
      premises: { id: { equals: premisesId2 } }
    },
    orderBy: [{ createdAt: "asc" }],
    take: 2,
    query: SETTINGS_SELECTION
  });
}
async function cannabisStorefrontSettingsWorkspace(_root, _args, context) {
  let authority;
  try {
    authority = await requireReadAuthority(context, "canManageAuthority");
  } catch {
    return { state: "forbidden" };
  }
  let canSave = true;
  try {
    await requireOperationalAuthority(context, "canManageAuthority", "authority");
  } catch {
    canSave = false;
  }
  const settings = await scopedSettings(context, authority.organizationId, authority.premisesId);
  if (settings.length > 1) throw new Error("Storefront settings scope is inconsistent and requires review");
  const row = settings[0];
  return {
    state: "ok",
    canSave,
    revision: row ? new Date(row.updatedAt).toISOString() : null,
    settings: row ? {
      businessName: row.businessName,
      tagline: row.tagline || "",
      description: row.description || "",
      brandHue: row.brandHue,
      ...normalizeLogoSettings({ logoIcon: row.logoIcon || void 0, logoColor: row.logoColor }),
      publicationStatus: row.publicationStatus,
      storefrontMode: row.storefrontMode
    } : null,
    coverUrl: row?.heroImage?.url ?? null,
    publicPreview: projectPublicStorefrontSettings(row),
    organizationId: authority.organizationId,
    premisesId: authority.premisesId
  };
}
async function configureCannabisStorefrontSettings(_root, args, context) {
  const input = args.input;
  return runControlledOperation(context, input, {
    permission: "canManageAuthority",
    activity: "authority",
    scope: "configureCannabisStorefrontSettings",
    lockKeys: ["storefront-settings"],
    resourceType: "StorefrontSettings",
    action: "storefront.settings.configured"
  }, async (tx, authority) => {
    const settings = normalizeStorefrontSettingsInput(input);
    const logo = normalizeLogoSettings(input);
    const existing = await scopedSettings(tx, authority.organizationId, authority.premisesId);
    if (existing.length > 1) throw new Error("Storefront settings scope is inconsistent and requires review");
    const currentRevision = existing[0] ? new Date(existing[0].updatedAt).toISOString() : null;
    if ((input.expectedRevision ?? null) !== currentRevision) throw new Error("Store settings changed since this form was opened");
    const data = {
      businessName: settings.businessName,
      tagline: settings.tagline,
      description: settings.description,
      brandHue: settings.brandHue,
      ...logo,
      publicationStatus: "published",
      storefrontMode: "configured"
    };
    const saved = existing[0] ? await tx.sudo().query.StorefrontSettings.updateOne({ where: { id: existing[0].id }, data, query: SETTINGS_SELECTION }) : await tx.sudo().query.StorefrontSettings.createOne({ data: {
      ...data,
      organization: { connect: { id: authority.organizationId } },
      premises: { connect: { id: authority.premisesId } }
    }, query: SETTINGS_SELECTION });
    return { id: saved.id, status: "configured", revision: new Date(saved.updatedAt).toISOString(), ...projectPublicStorefrontSettings(saved) };
  });
}
async function setCannabisStorefrontCover(_root, args, context) {
  const upload = await readPublicImageUpload(args.photo);
  const input = upload ? { ...args.input, photoSha256: upload.sha256 } : args.input;
  const remove = input?.remove === true;
  if (!upload && !remove) throw new Error("Choose a cover photo to upload");
  if (upload && remove) throw new Error("Upload a cover photo or remove it, not both");
  await requireOperationalAuthority(context, "canManageAuthority", "authority");
  const stored = upload ? await storePublicImage(context, upload) : null;
  return runControlledOperation(context, input, {
    permission: "canManageAuthority",
    activity: "authority",
    scope: "setCannabisStorefrontCover",
    lockKeys: ["storefront-settings"],
    resourceType: "StorefrontSettings",
    action: "storefront.cover.set"
  }, async (tx, authority) => {
    const existing = await scopedSettings(tx, authority.organizationId, authority.premisesId);
    if (existing.length !== 1) throw new Error("Save Store Settings before adding a cover photo");
    const changed = await tx.prisma.storefrontSettings.updateMany({ where: { id: existing[0].id }, data: imageColumns("heroImage", stored) });
    if (changed.count !== 1) throw new Error("Store settings changed; refresh and try again");
    const cover = stored ? { uploaded: `${stored.id}.${stored.extension}`, sha256: upload.sha256, width: stored.width, height: stored.height } : { removed: true };
    return { id: existing[0].id, status: stored ? "cover_set" : "cover_removed", cover };
  });
}

// features/keystone/mutations/staffAccess.ts
async function setStaffTemporaryPassword(_root, args, context) {
  const input = args.input || {};
  const userId = assertText(input.userId, "Staff member");
  const password2 = assertText(input.temporaryPassword, "Temporary password", 10, 1e3);
  return runControlledOperation(context, input, { permission: "canManagePeople", activity: "authority", scope: "setStaffTemporaryPassword", resourceType: "User", action: "staff.password.reset", lockKeys: [userId] }, async (tx, authority) => {
    const sudo = tx.sudo();
    const target = await sudo.query.User.findOne({ where: { id: userId }, query: "id status organization { id } premises { id } role { canManageOnboarding }" });
    if (!target || target.organization?.id !== authority.organizationId || target.premises?.id !== authority.premisesId) throw new Error("Staff member is outside this premises");
    const actor = await sudo.query.User.findOne({ where: { id: authority.actor.id }, query: "role { canManageOnboarding }" });
    if (target.role?.canManageOnboarding === true && target.id !== authority.actor.id && actor?.role?.canManageOnboarding !== true) throw new Error("Only the owner can reset an owner's password");
    await sudo.query.User.updateOne({ where: { id: target.id }, data: { password: password2 }, query: "id" });
    return { id: target.id, status: target.status, reference: target.id };
  });
}
async function changeStaffPermissions(_root, args, context) {
  const input = args.input || {};
  const userId = assertText(input.userId, "Staff member");
  const requested = input.permissions && typeof input.permissions === "object" && !Array.isArray(input.permissions) ? input.permissions : null;
  if (!requested) throw new Error("Choose the staff member's permissions");
  return runControlledOperation(context, input, { permission: "canManagePeople", activity: "authority", scope: "changeStaffPermissions", resourceType: "User", action: "staff.permissions.changed", lockKeys: [userId] }, async (tx, authority) => {
    const sudo = tx.sudo();
    if (userId === authority.actor.id) throw new Error("You cannot change your own permissions");
    const target = await sudo.query.User.findOne({ where: { id: userId }, query: `id name status organization { id } premises { id } role { id name ${permissionNames.join(" ")} }` });
    if (!target || target.organization?.id !== authority.organizationId || target.premises?.id !== authority.premisesId) throw new Error("Staff member is outside this premises");
    if (target.role?.canManageOnboarding === true) throw new Error("An owner's permissions cannot be changed here");
    const grantor = await sudo.query.User.findOne({ where: { id: authority.actor.id }, query: `role { ${permissionNames.join(" ")} }` });
    const next = Object.fromEntries(permissionNames.map((permission) => [permission, requested[permission] === true]));
    next.canAccessDashboard = true;
    next.canManageOnboarding = false;
    for (const permission of permissionNames) {
      if (next[permission] && target.role?.[permission] !== true && grantor?.role?.[permission] !== true) throw new Error("You can only grant permissions you currently hold");
    }
    const name = assertText(target.role?.name || `${target.name} staff`, "Role name");
    const role = await sudo.query.Role.createOne({ data: { organization: { connect: { id: authority.organizationId } }, name, ...next }, query: "id" });
    await sudo.query.User.updateOne({ where: { id: target.id }, data: { role: { connect: { id: role.id } } }, query: "id" });
    return { id: target.id, status: target.status, reference: role.id, beforeRoleId: target.role?.id ?? null };
  });
}

// features/keystone/mutations/ruleErrors.ts
var import_graphql = require("graphql");
function exposeRuleErrors(resolvers) {
  return Object.fromEntries(Object.entries(resolvers).map(([name, resolve]) => [name, async (...args) => {
    try {
      return await resolve(...args);
    } catch (error) {
      if (error instanceof Error && error.constructor === Error && error.message && error.message.length <= 300) {
        throw new import_graphql.GraphQLError(error.message, { extensions: { code: "BAD_USER_INPUT" } });
      }
      throw error;
    }
  }]));
}

// features/keystone/mutations/custody.ts
var import_node_crypto10 = require("node:crypto");
var HOLD_TYPES = /* @__PURE__ */ new Set(["quarantine", "test_hold", "discrepancy", "authority", "expiry"]);
var MAX_RECALL_PACKAGES = 200;
async function placePackageHold(_root, args, context) {
  const input = args.input || {};
  const packageId = assertText(input.packageId, "Package");
  const type = assertText(input.type, "Hold type");
  if (!HOLD_TYPES.has(type)) throw new Error("Hold type must be quarantine, test hold, discrepancy, authority or expiry");
  const reasonCode = assertReasonCode(input.reasonCode);
  const reason = assertText(input.reason, "Hold reason", 4, 1e3);
  return runControlledOperation(context, input, { permission: "canManageCompliance", activity: "inventory", scope: "placePackageHold", resourceType: "PackageHold", action: "inventory.hold.placed", lockKeys: [`package:${packageId}`] }, async (tx, authority) => {
    const sudo = tx.sudo();
    const pkg = await sudo.query.InventoryPackage.findOne({ where: { id: packageId }, query: "id packageUid status organization { id } premises { id }" });
    if (!pkg || pkg.organization?.id !== authority.organizationId || pkg.premises?.id !== authority.premisesId) throw new Error("Package is outside this premises");
    if (["depleted", "destroyed"].includes(String(pkg.status))) throw new Error(`A ${pkg.status} package can't be held`);
    const hold = await sudo.query.PackageHold.createOne({ data: {
      organization: { connect: { id: authority.organizationId } },
      premises: { connect: { id: authority.premisesId } },
      package: { connect: { id: pkg.id } },
      type,
      status: "active",
      reasonCode,
      reason,
      placedBy: { connect: { id: authority.actor.id } },
      placedAt: /* @__PURE__ */ new Date(),
      evidenceHash: stableHash({ packageId: pkg.id, type, reasonCode, reason, actor: authority.actor.id })
    }, query: "id" });
    return { id: hold.id, status: "active", reference: pkg.packageUid };
  });
}
async function openRecallCase(_root, args, context) {
  const input = args.input || {};
  const authorityReference = assertText(input.authorityReference, "Recall notice reference", 2, 200);
  const reason = assertText(input.reason, "Recall reason", 4, 1e3);
  const list8 = (value, label) => {
    if (value == null) return [];
    if (!Array.isArray(value) || value.length > MAX_RECALL_PACKAGES || value.some((entry) => typeof entry !== "string" || !entry.trim() || entry.length > 200)) throw new Error(`${label} must be a list of up to ${MAX_RECALL_PACKAGES} codes`);
    return [...new Set(value.map((entry) => entry.trim()))];
  };
  const packageUids = list8(input.packageUids, "Package UIDs");
  const batchNumbers = list8(input.batchNumbers, "Batch numbers");
  if (!packageUids.length && !batchNumbers.length) throw new Error("Enter at least one package UID or production batch");
  return runControlledOperation(context, input, { permission: "canManageCompliance", activity: "inventory", scope: "openRecallCase", resourceType: "RecallCase", action: "compliance.recall.opened", lockKeys: [`recall:${authorityReference}`] }, async (tx, authority) => {
    const sudo = tx.sudo();
    const scope = { organization: { id: { equals: authority.organizationId } }, premises: { id: { equals: authority.premisesId } } };
    const matches = await sudo.query.InventoryPackage.findMany({
      where: { ...scope, status: { notIn: ["depleted", "destroyed"] }, OR: [...packageUids.length ? [{ packageUid: { in: packageUids } }] : [], ...batchNumbers.length ? [{ productionBatchNumber: { in: batchNumbers } }] : []] },
      take: MAX_RECALL_PACKAGES + 1,
      query: "id packageUid"
    });
    if (matches.length > MAX_RECALL_PACKAGES) throw new Error(`More than ${MAX_RECALL_PACKAGES} packages match; split the recall by batch`);
    if (!matches.length) {
      const swapped = await sudo.query.InventoryPackage.count({ where: { ...scope, status: { notIn: ["depleted", "destroyed"] }, OR: [...batchNumbers.length ? [{ packageUid: { in: batchNumbers } }] : [], ...packageUids.length ? [{ productionBatchNumber: { in: packageUids } }] : []] } });
      throw new Error(swapped ? "No package matches. These codes match the other box: package UIDs go under Package UIDs, batch numbers under Production batches" : "No package at this premises matches these package UIDs or production batches");
    }
    const timeZone = isValidTimeZone(authority.actor.premises?.timezone) ? authority.actor.premises.timezone : "UTC";
    const localDate2 = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(/* @__PURE__ */ new Date()).replaceAll("-", "");
    const reference = `RC-${localDate2}-${(0, import_node_crypto10.randomUUID)().slice(0, 6).toUpperCase()}`;
    const evidenceHash = stableHash({ authorityReference, reason, packageUids, batchNumbers, matched: matches.map((pkg) => pkg.packageUid) });
    const recall = await sudo.query.RecallCase.createOne({ data: {
      organization: { connect: { id: authority.organizationId } },
      premises: { connect: { id: authority.premisesId } },
      reference,
      status: "hold",
      authorityReference,
      packageUids: [.../* @__PURE__ */ new Set([...packageUids, ...matches.map((pkg) => pkg.packageUid)])],
      batchNumbers,
      reason,
      openedAt: /* @__PURE__ */ new Date(),
      evidenceHash
    }, query: "id reference" });
    for (const pkg of matches) {
      await sudo.query.PackageHold.createOne({ data: {
        organization: { connect: { id: authority.organizationId } },
        premises: { connect: { id: authority.premisesId } },
        package: { connect: { id: pkg.id } },
        type: "recall",
        status: "active",
        reasonCode: "recall_notice",
        reason: `${recall.reference}: ${reason}`.slice(0, 1e3),
        placedBy: { connect: { id: authority.actor.id } },
        placedAt: /* @__PURE__ */ new Date(),
        evidenceHash
      }, query: "id" });
    }
    return { id: recall.id, status: "hold", reference: recall.reference, heldPackages: matches.length };
  });
}
var LAB_RESULTS = /* @__PURE__ */ new Set(["passed", "failed"]);
var RELEASABLE = /* @__PURE__ */ new Set(["receiving_hold", "quarantined"]);
async function recordPackageLabResult(_root, args, context) {
  const input = args.input || {};
  const packageId = assertText(input.packageId, "Package");
  const result = assertText(input.result, "Lab result");
  if (!LAB_RESULTS.has(result)) throw new Error("Lab result must be passed or failed");
  const labName = assertText(input.labName, "Lab name", 2, 200);
  const labResultReference = assertText(input.labResultReference, "Lab result reference", 2, 200);
  const coaReference = assertText(input.coaReference, "COA reference", 2, 200);
  return runControlledOperation(context, input, { permission: "canManageInventory", activity: "inventory", scope: "recordPackageLabResult", resourceType: "InventoryPackage", action: "inventory.lab_result.recorded", lockKeys: [`package:${packageId}`] }, async (tx, authority) => {
    const sudo = tx.sudo();
    const pkg = await sudo.query.InventoryPackage.findOne({ where: { id: packageId }, query: "id packageUid status version organization { id } premises { id }" });
    if (!pkg || pkg.organization?.id !== authority.organizationId || pkg.premises?.id !== authority.premisesId) throw new Error("Package is outside this premises");
    if (!RELEASABLE.has(String(pkg.status))) throw new Error(`A lab result can't be recorded on a ${String(pkg.status).replaceAll("_", " ")} package`);
    const changed = await tx.prisma.inventoryPackage.updateMany({ where: { id: pkg.id, version: pkg.version }, data: { testStatus: result, labName, labResultReference, coaReference, labVerifiedAt: /* @__PURE__ */ new Date(), version: { increment: 1 }, ...result === "failed" ? { status: "quarantined" } : {} } });
    if (changed.count !== 1) throw new Error("This package changed since you opened it. Refresh and try again.");
    if (result === "failed") await sudo.query.PackageHold.createOne({ data: {
      organization: { connect: { id: authority.organizationId } },
      premises: { connect: { id: authority.premisesId } },
      package: { connect: { id: pkg.id } },
      type: "test_hold",
      status: "active",
      reasonCode: "failed_lab_result",
      reason: `Failed lab result ${labResultReference} (${labName})`,
      placedBy: { connect: { id: authority.actor.id } },
      placedAt: /* @__PURE__ */ new Date(),
      evidenceHash: stableHash({ packageId: pkg.id, result, labName, labResultReference, coaReference })
    }, query: "id" });
    return { id: pkg.id, status: result === "failed" ? "quarantined" : String(pkg.status), testStatus: result, reference: pkg.packageUid };
  });
}
async function releaseCannabisPackage(_root, args, context) {
  const input = args.input || {};
  const packageId = assertText(input.packageId, "Package");
  return runControlledOperation(context, input, { permission: "canManageInventory", activity: "inventory", scope: "releaseCannabisPackage", resourceType: "InventoryPackage", action: "inventory.release", lockKeys: [`package:${packageId}`] }, async (tx, authority, correlationId) => {
    const sudo = tx.sudo();
    const pkg = await sudo.query.InventoryPackage.findOne({ where: { id: packageId }, query: "id packageUid status testStatus expiresAt coaReference labelVersion quantityOnHandMicrounits version organization { id } premises { id } holds(where: { status: { equals: active } }, take: 1) { id }" });
    if (!pkg || pkg.organization?.id !== authority.organizationId || pkg.premises?.id !== authority.premisesId) throw new Error("Package is outside this premises");
    if (!RELEASABLE.has(String(pkg.status))) throw new Error(`A ${String(pkg.status).replaceAll("_", " ")} package can't be released`);
    if (pkg.testStatus !== "passed") throw new Error("Record a passed lab result first");
    if (!pkg.coaReference || !pkg.labelVersion) throw new Error("COA reference and label version are required");
    if (!(new Date(pkg.expiresAt).getTime() > Date.now())) throw new Error("This package has expired");
    if (pkg.holds?.length) throw new Error("Release its active holds first");
    if (!(pkg.quantityOnHandMicrounits > 0)) throw new Error("This package has no stock");
    const changed = await tx.prisma.inventoryPackage.updateMany({ where: { id: pkg.id, version: pkg.version, status: pkg.status }, data: { status: "saleable", releasedAt: /* @__PURE__ */ new Date(), version: { increment: 1 } } });
    if (changed.count !== 1) throw new Error("This package changed since you opened it. Refresh and try again.");
    await sudo.query.InventoryEvent.createOne({ data: {
      organization: { connect: { id: authority.organizationId } },
      premises: { connect: { id: authority.premisesId } },
      package: { connect: { id: pkg.id } },
      eventType: "release",
      quantityDeltaMicrounits: 0,
      beforeQuantityMicrounits: pkg.quantityOnHandMicrounits,
      afterQuantityMicrounits: pkg.quantityOnHandMicrounits,
      reasonCode: "lab_passed_release",
      actor: { connect: { id: authority.actor.id } },
      sourceType: "InventoryPackage",
      sourceId: pkg.id,
      idempotencyKey: `${correlationId}:release`,
      occurredAt: /* @__PURE__ */ new Date(),
      evidenceHash: stableHash({ packageId: pkg.id, coaReference: pkg.coaReference, labelVersion: pkg.labelVersion }),
      stateReportStatus: "queued"
    }, query: "id" });
    return { id: pkg.id, status: "saleable", reference: pkg.packageUid, stateReport: { eventType: "release", packageUid: pkg.packageUid } };
  });
}
var RECALL_STAGES = ["hold", "scope_confirmed", "active", "monitoring", "disposition", "regulator_closed"];
var RECALL_DISPOSITIONS = /* @__PURE__ */ new Set(["release", "destroy"]);
async function advanceRecallCase(_root, args, context) {
  const nextStatus = assertText(args.input?.nextStatus, "Recall stage");
  if (!RECALL_STAGES.includes(nextStatus) || nextStatus === "hold") throw new Error("Recall stage must be scope confirmed, active, monitoring, disposition or regulator closed");
  const closing = nextStatus === "regulator_closed";
  const input = closing ? withApprover(args.input, await verifySecondApprover(context, args.input, "canManageCompliance")) : args.input || {};
  const recallId = assertText(input.recallId, "Recall");
  const disposition = closing ? assertText(input.disposition, "Disposition") : null;
  if (closing && !RECALL_DISPOSITIONS.has(disposition)) throw new Error("Disposition must be release or destroy");
  const closureReference = closing ? assertText(input.closureReference, "Regulator closure reference", 2, 200) : null;
  return runControlledOperation(context, input, { permission: "canManageCompliance", activity: "inventory", scope: "advanceRecallCase", resourceType: "RecallCase", action: closing ? "compliance.recall.closed" : "compliance.recall.advanced", lockKeys: [`recall:${recallId}`] }, async (tx, authority, correlationId) => {
    const sudo = tx.sudo();
    const recall = await sudo.query.RecallCase.findOne({ where: { id: recallId }, query: "id reference status organization { id } premises { id }" });
    if (!recall || recall.organization?.id !== authority.organizationId || recall.premises?.id !== authority.premisesId) throw new Error("Recall is outside this premises");
    const from = RECALL_STAGES.indexOf(recall.status);
    const to = RECALL_STAGES.indexOf(nextStatus);
    if (from < 0 || to <= from) throw new Error(`A ${String(recall.status).replaceAll("_", " ")} recall can't move to ${nextStatus.replaceAll("_", " ")}`);
    let settled = 0;
    if (closing) {
      if (input.approvedById === authority.actor.id) throw new Error("The second approver must be someone else");
      const approver = await sudo.query.User.findOne({ where: { id: String(input.approvedById) }, query: "id status organization { id } premises { id } role { canManageCompliance }" });
      if (!approver || approver.status !== "active" || !approver.role?.canManageCompliance || approver.organization?.id !== authority.organizationId || approver.premises?.id !== authority.premisesId) throw new Error("Approver lacks current compliance authority");
      const holds = await sudo.query.PackageHold.findMany({ where: { organization: { id: { equals: authority.organizationId } }, premises: { id: { equals: authority.premisesId } }, type: { equals: "recall" }, status: { equals: "active" }, reason: { startsWith: `${recall.reference}:` } }, take: MAX_RECALL_PACKAGES + 1, query: "id package { id packageUid status quantityOnHandMicrounits reservedMicrounits version }" });
      if (holds.length > MAX_RECALL_PACKAGES) throw new Error(`More than ${MAX_RECALL_PACKAGES} packages are held; settle them with the state system first`);
      for (const hold of holds) {
        const pkg = hold.package;
        if (disposition === "destroy" && pkg && !["depleted", "destroyed"].includes(String(pkg.status))) {
          if (pkg.reservedMicrounits) throw new Error(`Package ${pkg.packageUid} is in an open cart; cancel that cart first`);
          const changed = await tx.prisma.inventoryPackage.updateMany({ where: { id: pkg.id, version: pkg.version, quantityOnHandMicrounits: pkg.quantityOnHandMicrounits }, data: { quantityOnHandMicrounits: 0, status: "destroyed", version: { increment: 1 } } });
          if (changed.count !== 1) throw new Error(`Package ${pkg.packageUid} changed; refresh and try again`);
          await sudo.query.InventoryEvent.createOne({ data: {
            organization: { connect: { id: authority.organizationId } },
            premises: { connect: { id: authority.premisesId } },
            package: { connect: { id: pkg.id } },
            eventType: "destruction",
            quantityDeltaMicrounits: -pkg.quantityOnHandMicrounits,
            beforeQuantityMicrounits: pkg.quantityOnHandMicrounits,
            afterQuantityMicrounits: 0,
            reasonCode: "recall_destruction",
            actor: { connect: { id: authority.actor.id } },
            approvedBy: { connect: { id: approver.id } },
            sourceType: "RecallCase",
            sourceId: recall.id,
            idempotencyKey: `${correlationId}:destroy:${pkg.id}`,
            occurredAt: /* @__PURE__ */ new Date(),
            evidenceHash: stableHash({ recallId: recall.id, packageId: pkg.id, closureReference }),
            stateReportStatus: "queued"
          }, query: "id" });
        }
        await sudo.query.PackageHold.updateOne({ where: { id: hold.id }, data: { status: disposition === "destroy" ? "disposed" : "released", releasedBy: { connect: { id: approver.id } }, releasedAt: /* @__PURE__ */ new Date(), releaseAuthorityReference: closureReference }, query: "id" });
        settled += 1;
      }
    }
    await sudo.query.RecallCase.updateOne({ where: { id: recall.id }, data: { status: nextStatus, ...closing ? { closedAt: /* @__PURE__ */ new Date() } : {} }, query: "id" });
    return { id: recall.id, status: nextStatus, reference: recall.reference, ...closing ? { disposition, settledPackages: settled } : {} };
  });
}

// features/keystone/mutations/customers.ts
var import_node_crypto11 = require("node:crypto");
var CAPACITIES = /* @__PURE__ */ new Set(["adult_use", "patient", "caregiver"]);
var IDENTITY_METHODS = /* @__PURE__ */ new Set(["drivers_license", "state_id", "passport", "military_id", "tribal_id"]);
var DATE_ONLY3 = /^\d{4}-\d{2}-\d{2}$/;
function dateOnly(value, label) {
  const text8 = assertText(value, label, 10, 10);
  const date2 = /* @__PURE__ */ new Date(`${text8}T00:00:00Z`);
  if (!DATE_ONLY3.test(text8) || !Number.isFinite(date2.getTime()) || date2.toISOString().slice(0, 10) !== text8) throw new Error(`${label} must be a real date`);
  return date2;
}
function documentHash(premisesId2, kind, number) {
  const key = process.env.SESSION_SECRET;
  if (!key) throw new Error("Check-in is unavailable on this server");
  return (0, import_node_crypto11.createHmac)("sha256", key).update(`${premisesId2}:${kind}:${number.replace(/[\s-]/g, "").toUpperCase()}`).digest("hex");
}
async function checkInCannabisCustomer(_root, args, context) {
  const raw = args.input || {};
  const capacity = assertText(raw.capacity, "Buyer type");
  if (!CAPACITIES.has(capacity)) throw new Error("Buyer type must be adult-use, patient or caregiver");
  const identityMethod = assertText(raw.identityMethod, "ID type");
  if (!IDENTITY_METHODS.has(identityMethod)) throw new Error("Choose the ID type");
  const identityNumber = assertText(raw.identityNumber, "ID number", 4, 60);
  const dateOfBirth = dateOnly(raw.dateOfBirth, "Date of birth");
  const identityExpiresAt = dateOnly(raw.identityExpiresAt, "ID expiry");
  if (raw.identityVerified !== true) throw new Error("Confirm you checked the ID in person");
  const medical = capacity !== "adult_use";
  const registryNumber = medical ? assertText(raw.registryNumber, "Registry card number", 3, 60) : null;
  const registryName = medical ? assertText(raw.registryName, "Registry", 2, 120) : "";
  const registryExpiresAt = medical ? dateOnly(raw.registryExpiresAt, "Registry card expiry") : null;
  if (medical && raw.registryVerified !== true) throw new Error("Confirm you checked the registry card");
  const patientNumber = capacity === "caregiver" ? assertText(raw.representedPatientNumber, "Patient's registry number", 3, 60) : null;
  if (capacity === "caregiver" && raw.representedPatientVerified !== true) throw new Error("Confirm the caregiver is authorised for this patient");
  const { identityNumber: _id, registryNumber: _registry, representedPatientNumber: _patient, ...input } = raw;
  return runControlledOperation(context, input, { permission: "canManageSales", activity: "eligibility", scope: "checkInCannabisCustomer", resourceType: "Customer", action: "eligibility.checked_in" }, async (tx, authority) => {
    const sudo = tx.sudo();
    const now = /* @__PURE__ */ new Date();
    const pack = await requireRulePack(tx, authority.organizationId, authority.premisesId);
    assertEffectiveRulePack(pack);
    const timezone = authority.actor.premises?.timezone;
    const age = ageAtPremises(dateOfBirth, now, timezone);
    if (age === null) throw new Error("Date of birth must be a real date that is not in the future");
    const identityValidUntil = endOfLocalDate(identityExpiresAt.toISOString().slice(0, 10), timezone);
    const registryValidUntil = registryExpiresAt ? endOfLocalDate(registryExpiresAt.toISOString().slice(0, 10), timezone) : null;
    assertEligibility({ capacity, age, identityValid: identityValidUntil > now, registryValid: !medical || Boolean(registryValidUntil && registryValidUntil > now), representedPatientValid: capacity !== "caregiver" || Boolean(patientNumber) }, pack);
    const identityReferenceHash = documentHash(authority.premisesId, identityMethod, identityNumber);
    const prior = await sudo.query.EligibilityEvidence.findMany({ where: { organization: { id: { equals: authority.organizationId } }, premises: { id: { equals: authority.premisesId } }, identityReferenceHash: { equals: identityReferenceHash }, capacity: { equals: capacity } }, orderBy: [{ createdAt: "desc" }], take: 1, query: "customer { id reference status }" });
    const known = prior[0]?.customer;
    if (known && known.status === "suspended") throw new Error("This customer is suspended; see a manager");
    const customer = known ?? await sudo.query.Customer.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, reference: `CUS-${(0, import_node_crypto11.randomUUID)().slice(0, 8).toUpperCase()}`, capacity, status: "eligible" }, query: "id reference status" });
    if (known && known.status !== "eligible") await sudo.query.Customer.updateOne({ where: { id: known.id }, data: { status: "eligible" }, query: "id" });
    const evidence = await sudo.query.EligibilityEvidence.createOne({ data: {
      organization: { connect: { id: authority.organizationId } },
      premises: { connect: { id: authority.premisesId } },
      customer: { connect: { id: customer.id } },
      capacity,
      identityMethod,
      identityReferenceHash,
      dateOfBirth,
      identityExpiresAt: identityValidUntil,
      registryName,
      registryReferenceHash: registryNumber ? documentHash(authority.premisesId, `registry:${registryName}`, registryNumber) : "",
      registryVerifiedAt: medical ? now : null,
      registryExpiresAt: registryValidUntil,
      representedPatientReferenceHash: patientNumber ? documentHash(authority.premisesId, "patient", patientNumber) : "",
      result: "eligible",
      reasonCodes: ["checked_in_person"],
      evidenceHash: stableHash({ capacity, identityMethod, identityReferenceHash, verifier: authority.actor.id, rulePack: pack.version }),
      verifiedAt: now
    }, query: "id" });
    return { id: customer.id, status: "eligible", reference: customer.reference, eligibilityEvidenceId: evidence.id, returning: Boolean(known) };
  });
}

// features/keystone/mutations/onlineOrders.ts
var import_node_crypto12 = require("node:crypto");

// features/keystone/domain/pickupWindows.ts
var SLOT_MINUTES = 30;
var LEAD_MINUTES = 45;
var DAYS_AHEAD = 2;
var MAX_SLOTS = 24;
function offsetMs(instant, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(instant));
  const get = (type) => Number(parts.find((part) => part.type === type)?.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - Math.floor(instant / 1e3) * 1e3;
}
function localInstant(year, month, day, minute, timeZone) {
  const wall = Date.UTC(year, month - 1, day, 0, minute);
  let instant = wall - offsetMs(wall, timeZone);
  instant = wall - offsetMs(instant, timeZone);
  return new Date(instant);
}
function localDate(instant, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(instant));
  const get = (type) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}
function pickupSlots(opensMinute, closesMinute, timeZone, now = /* @__PURE__ */ new Date()) {
  const slots = [];
  const today = localDate(now.getTime(), timeZone);
  const earliest = now.getTime() + LEAD_MINUTES * 6e4;
  const closeAbs = closesMinute > opensMinute ? closesMinute : closesMinute + 1440;
  for (let offset = 0; offset <= DAYS_AHEAD && slots.length < MAX_SLOTS; offset += 1) {
    const base2 = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
    const [year, month, day] = [base2.getUTCFullYear(), base2.getUTCMonth() + 1, base2.getUTCDate()];
    for (let minute = opensMinute; minute + SLOT_MINUTES <= closeAbs && slots.length < MAX_SLOTS; minute += SLOT_MINUTES) {
      const start = localInstant(year, month, day, minute, timeZone);
      if (start.getTime() < earliest) continue;
      slots.push({ start: start.toISOString(), end: new Date(start.getTime() + SLOT_MINUTES * 6e4).toISOString() });
    }
  }
  return slots;
}

// features/keystone/mutations/onlineOrders.ts
init_orderConfirmation();
var sha = (value) => (0, import_node_crypto12.createHash)("sha256").update(value).digest("hex");
var MAX_ITEMS = 10;
var MAX_UNITS = 20;
var RESERVED_STATUSES = ["preliminarily_eligible", "reserved", "picking", "staged", "final_verification"];
var HOLD_AFTER_WINDOW_MS = 60 * 6e4;
function guestProof(idempotencyKey) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Online ordering is unavailable on this server");
  return (0, import_node_crypto12.createHmac)("sha256", secret).update(`pickup-proof:${idempotencyKey}`).digest("hex");
}
var orderReference = (idempotencyKey) => `PU-${sha(`pickup-ref:${idempotencyKey}`).slice(0, 12).toUpperCase()}`;
async function releaseExpiredOrders(context) {
  const sudo = context.sudo();
  const expired = await sudo.query.Cart.findMany({ where: { status: { in: [...EXPIRABLE_CART_STATUSES] }, expiresAt: { lt: /* @__PURE__ */ new Date() } }, take: 20, query: "id" });
  for (const cart of expired) {
    try {
      await cancelCannabisCart(null, { input: { cartId: cart.id, system: SYSTEM_CANCEL, idempotencyKey: `expire:${cart.id}`, reasonCode: "order_expired" } }, context);
    } catch {
    }
  }
  const stuck = await sudo.query.Cart.findMany({ where: { status: { equals: "cancelled" }, paymentMethod: { equals: "card" }, paymentStatus: { in: [...RELEASABLE_PAYMENT_STATUSES] } }, take: 10, query: "id" });
  for (const cart of stuck) {
    try {
      await releaseOnlinePayment(context, cart.id);
    } catch {
    }
  }
}
async function cannabisPickupOptions(_root, _args, context) {
  await releaseExpiredOrders(context);
  const authority = await publicAuthority(context);
  const { pack, premises } = authority;
  const timezone = premises.timezone || "UTC";
  const card = pack.pickupEnabled && Array.isArray(pack.allowedTenderTypes) && pack.allowedTenderTypes.includes("debit") ? getPublicPaymentProviderConfig(CARD_PROVIDER_CODE) : null;
  return {
    pickupEnabled: pack.pickupEnabled === true,
    minimumAge: pack.adultMinimumAge,
    currencyCode: premises.currencyCode ?? "USD",
    timezone,
    slots: pack.pickupEnabled ? pickupSlots(pack.operatingStartMinute, pack.operatingEndMinute, timezone) : [],
    card,
    payAtPickup: ["cash", "debit"].some((type) => pack.allowedTenderTypes.includes(type))
  };
}
function parseItems(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_ITEMS) throw new Error(`Add between 1 and ${MAX_ITEMS} items to your bag`);
  const seen = /* @__PURE__ */ new Set();
  return value.map((entry) => {
    if (!entry || typeof entry !== "object") throw new Error("Bag item is invalid");
    const productId = assertText(entry.productId, "Product", 1, 100);
    if (seen.has(productId)) throw new Error("Each product can appear once in the bag");
    seen.add(productId);
    return { productId, units: assertInteger(entry.units, "Quantity", 1, MAX_UNITS) };
  });
}
async function placeCannabisPickupOrder(_root, args, context) {
  const raw = args.input;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Order details are required");
  const idempotencyKey = assertText(raw.idempotencyKey, "Order key", 16, 100);
  const reference = orderReference(idempotencyKey);
  const proof = guestProof(idempotencyKey);
  const replay = await context.sudo().query.Cart.findOne({ where: { reference }, query: "id reference status paymentMethod paymentStatus" });
  if (replay) return { reference, proof, status: replay.status, paymentMethod: replay.paymentMethod, replayed: true };
  const name = assertText(raw.name, "Name", 2, 120);
  const email = assertText(raw.email, "Email", 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address");
  const phone = assertText(raw.phone, "Phone", 7, 30);
  if (!/^[+()\d\s.-]{7,30}$/.test(phone)) throw new Error("Enter a valid phone number");
  const dateOfBirth = assertText(raw.dateOfBirth, "Date of birth", 10, 10);
  if (raw.idNotice !== true) throw new Error("Confirm you will bring a valid government ID to pickup");
  const items = parseItems(raw.items);
  const method = raw.paymentMethod === "card" ? "card" : raw.paymentMethod === "pickup" ? "pickup" : null;
  if (!method) throw new Error("Choose how you will pay");
  await releaseExpiredOrders(context);
  const { organization, premises, pack } = await publicAuthority(context);
  assertEffectiveRulePack(pack);
  if (pack.pickupEnabled !== true) throw new Error("This store is not taking pickup orders right now");
  const age = ageAtPremises(dateOfBirth, /* @__PURE__ */ new Date(), premises.timezone || "UTC");
  if (age === null) throw new Error("Enter your date of birth as a real past date");
  if (age < pack.adultMinimumAge) throw new Error(`You must be ${pack.adultMinimumAge} or older to order`);
  const timezone = premises.timezone || "UTC";
  const window = pickupSlots(pack.operatingStartMinute, pack.operatingEndMinute, timezone).find((slot) => slot.start === raw.pickupStart);
  if (!window) throw new Error("That pickup time is no longer available. Choose another.");
  const scope = { organizationId: organization.id, premisesId: premises.id };
  const allowed2 = pack.allowedTenderTypes;
  let provider = null;
  if (method === "card") {
    if (!allowed2.includes("debit")) throw new Error("Card payment is not available. Choose pay at pickup.");
    provider = await onlineCardProvider(context, scope, true);
    if (!provider) throw new Error("Card payment is not available. Choose pay at pickup.");
    const opaque = raw.opaqueData;
    if (!opaque || typeof opaque.dataDescriptor !== "string" || typeof opaque.dataValue !== "string") throw new Error("Enter your card to continue");
  } else if (!["cash", "debit"].some((type) => allowed2.includes(type))) {
    throw new Error("Pay at pickup is not available. Pay by card instead.");
  }
  const holdUntil = new Date(new Date(window.end).getTime() + HOLD_AFTER_WINDOW_MS);
  const identityHash = documentHash(scope.premisesId, "online", `${email}:${dateOfBirth}`);
  const placed = await serializableTransaction(context, async (tx) => {
    const sudo = tx.sudo();
    await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "cannabis-policy", `${scope.organizationId}:${scope.premisesId}`);
    const prior = await sudo.query.EligibilityEvidence.findMany({ where: { organization: { id: { equals: scope.organizationId } }, premises: { id: { equals: scope.premisesId } }, identityReferenceHash: { equals: identityHash } }, orderBy: [{ createdAt: "desc" }], take: 1, query: "customer { id status }" });
    let customer = prior[0]?.customer ?? null;
    if (customer?.status === "suspended" || customer?.status === "ineligible") throw new Error("We can\u2019t take an online order for this customer. Please visit the store.");
    if (!customer) customer = await sudo.query.Customer.createOne({ data: { organization: { connect: { id: scope.organizationId } }, premises: { connect: { id: scope.premisesId } }, reference: `CUS-${(0, import_node_crypto12.randomUUID)().slice(0, 8).toUpperCase()}`, capacity: "adult_use", status: "pending_verification", intakeProofHash: sha(proof), contact: { name, email, phone } }, query: "id status" });
    else await sudo.query.Customer.updateOne({ where: { id: customer.id }, data: { contact: { name, email, phone } }, query: "id" });
    await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "cannabis-customer-purchase-window", `${scope.organizationId}:${scope.premisesId}:${customer.id}`);
    const now = /* @__PURE__ */ new Date();
    const evidence = await sudo.query.EligibilityEvidence.createOne({ data: {
      organization: { connect: { id: scope.organizationId } },
      premises: { connect: { id: scope.premisesId } },
      customer: { connect: { id: customer.id } },
      capacity: "adult_use",
      identityMethod: "online_declared",
      identityReferenceHash: identityHash,
      dateOfBirth: /* @__PURE__ */ new Date(`${dateOfBirth}T00:00:00.000Z`),
      identityExpiresAt: holdUntil,
      result: "pending",
      reasonCodes: ["declared_online_id_check_at_pickup"],
      evidenceHash: stableHash({ identityHash, rulePack: pack.version, declaredAt: now.toISOString() })
    }, query: "id" });
    const cart = await sudo.query.Cart.createOne({ data: {
      organization: { connect: { id: scope.organizationId } },
      premises: { connect: { id: scope.premisesId } },
      customer: { connect: { id: customer.id } },
      reference,
      source: "pickup",
      status: "reserved",
      guestProofHash: sha(proof),
      expiresAt: holdUntil,
      rulePack: { connect: { id: pack.id } },
      eligibilityEvidence: { connect: { id: evidence.id } },
      pickupWindowStart: new Date(window.start),
      pickupWindowEnd: new Date(window.end),
      pickupName: name,
      pickupPhone: phone,
      paymentMethod: method,
      paymentStatus: "pending"
    }, query: "id version" });
    const categoryTotals = /* @__PURE__ */ Object.create(null);
    const totals = { subtotalCents: 0, discountCents: 0, taxCents: 0, totalCents: 0 };
    for (const item of items) {
      const product = await sudo.query.Product.findOne({ where: { id: item.productId }, query: "id unitQuantityMicrounits organization { id } premises { id }" });
      if (!product || product.organization?.id !== scope.organizationId || product.premises?.id !== scope.premisesId) throw new Error("An item in your bag is no longer on the menu");
      const quantity = item.units * product.unitQuantityMicrounits;
      const candidates = await sudo.query.InventoryPackage.findMany({ where: { organization: { id: { equals: scope.organizationId } }, premises: { id: { equals: scope.premisesId } }, product: { id: { equals: product.id } }, status: { equals: "saleable" } }, orderBy: [{ expiresAt: "asc" }, { id: "asc" }], take: 51, query: ALLOCATION_PACKAGE_SELECTION });
      let packageId;
      try {
        packageId = choosePackageForProduct(candidates, scope, product.id, quantity);
      } catch {
        throw new Error("An item in your bag is no longer available in that quantity");
      }
      await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "cannabis-package", packageId);
      const pkg = await sudo.query.InventoryPackage.findOne({ where: { id: packageId }, query: ALLOCATION_PACKAGE_SELECTION });
      if (!pkg || !pkg.product || pkg.product.status !== "active") throw new Error("An item in your bag is no longer available");
      assertPackageSaleable({ status: pkg.status, testStatus: pkg.testStatus, expiresAt: pkg.expiresAt, premisesId: scope.premisesId, quantityOnHandMicrounits: pkg.quantityOnHandMicrounits, reservedMicrounits: pkg.reservedMicrounits, activeHoldCount: pkg.holds?.length || 0, coaReference: pkg.coaReference, labelVersion: pkg.labelVersion }, scope.premisesId, quantity);
      const quote = calculateAllocationQuote(pkg, { id: cart.id, version: cart.version, customer: { capacity: "adult_use" } }, pack, quantity, null, { actor: { id: "online" }, ...scope });
      const balances = planReservationBalances(pkg.quantityOnHandMicrounits, pkg.reservedMicrounits, quantity);
      const ledger = await sudo.query.CartLine.findMany({ where: { package: { id: { equals: pkg.id } }, cart: { status: { in: RESERVED_STATUSES } } }, take: 501, query: "id quantityMicrounits organization { id } premises { id } package { id } cart { id status organization { id } premises { id } }" });
      assertReservationLedger(ledger, pkg.id, pkg.reservedMicrounits, scope);
      categoryTotals[pkg.product.categoryCode] = (categoryTotals[pkg.product.categoryCode] || 0) + quote.equivalencyMicrounits;
      evaluatePurchaseLimits({ capacity: "adult_use", categoryTotals, priorWindowTotals: await purchaseWindowTotals(sudo, customer.id, pack, now) }, pack);
      const claimed = await tx.prisma.inventoryPackage.updateMany({ where: { id: pkg.id, organizationId: scope.organizationId, premisesId: scope.premisesId, status: "saleable", quantityOnHandMicrounits: balances.beforeQuantityMicrounits, version: pkg.version, reservedMicrounits: balances.beforeReservedMicrounits }, data: { reservedMicrounits: balances.afterReservedMicrounits, version: { increment: 1 } } });
      if (claimed.count !== 1) throw new Error("Stock just changed. Please try again.");
      const lineKey = `${reference}:${product.id}`;
      const line = await sudo.query.CartLine.createOne({ data: {
        organization: { connect: { id: scope.organizationId } },
        premises: { connect: { id: scope.premisesId } },
        cart: { connect: { id: cart.id } },
        idempotencyKey: lineKey,
        package: { connect: { id: pkg.id } },
        product: { connect: { id: pkg.product.id } },
        quantityMicrounits: quantity,
        equivalencyMicrounits: quote.equivalencyMicrounits,
        titleSnapshot: pkg.product.name,
        skuSnapshot: pkg.product.sku,
        categoryCodeSnapshot: pkg.product.categoryCode,
        packageUidSnapshot: pkg.packageUid,
        batchSnapshot: pkg.productionBatchNumber,
        potencySnapshot: pkg.potencySnapshot,
        unitPriceCents: pkg.product.priceCents,
        subtotalCents: quote.subtotalCents,
        discountCents: quote.discountCents,
        discountSnapshot: quote.discountSnapshot,
        taxBasisPoints: quote.taxBasisPoints,
        taxCents: quote.taxCents,
        totalCents: quote.totalCents
      }, query: "id" });
      await sudo.query.InventoryEvent.createOne({ data: {
        organization: { connect: { id: scope.organizationId } },
        premises: { connect: { id: scope.premisesId } },
        package: { connect: { id: pkg.id } },
        eventType: "reserve",
        quantityDeltaMicrounits: 0,
        beforeQuantityMicrounits: balances.beforeQuantityMicrounits,
        afterQuantityMicrounits: balances.afterQuantityMicrounits,
        reasonCode: "cart_reservation",
        sourceType: "CartLine",
        sourceId: line.id,
        idempotencyKey: `${lineKey}:reserve`,
        occurredAt: now,
        evidenceHash: stableHash({ quote, balances, cartLineId: line.id }),
        stateReportStatus: "local_recorded"
      }, query: "id" });
      totals.subtotalCents += quote.subtotalCents;
      totals.discountCents += quote.discountCents;
      totals.taxCents += quote.taxCents;
      totals.totalCents += quote.totalCents;
    }
    if (!Object.values(totals).every((value) => Number.isSafeInteger(value) && value <= 2147483647)) throw new Error("Order total is too large");
    await sudo.query.Cart.updateOne({ where: { id: cart.id }, data: { ...totals, version: 2 }, query: "id" });
    return { cartId: cart.id, ...totals };
  }, 3e4);
  let status5 = "reserved";
  let paymentStatus = "pending";
  if (method === "card") {
    let result = null;
    try {
      result = await createPayment({ provider, amount: placed.totalCents, currency: "USD", opaqueData: raw.opaqueData, cart: { id: reference }, idempotencyKey: reference });
    } catch {
      result = null;
    }
    if (!result || result.status !== "authorized" || !result.paymentIntentId) {
      await cancelCannabisCart(null, { input: { cartId: placed.cartId, proof, idempotencyKey: `${reference}:declined`, reasonCode: "payment_declined" } }, context);
      throw new Error(result?.error ? `Your card was declined: ${String(result.error).slice(0, 120)}` : "We couldn\u2019t authorize your card. Check the details or choose pay at pickup.");
    }
    paymentStatus = "authorized";
    await context.sudo().query.Cart.updateOne({ where: { id: placed.cartId }, data: { paymentStatus, paymentReference: String(result.paymentIntentId) }, query: "id" });
  }
  await context.sudo().query.AuditEvent.createOne({ data: {
    organization: { connect: { id: scope.organizationId } },
    premises: { connect: { id: scope.premisesId } },
    action: "cart.pickup_order_placed",
    resourceType: "Cart",
    resourceId: placed.cartId,
    correlationId: reference,
    reasonCode: "online_pickup_order",
    evidence: { items: items.length, totalCents: placed.totalCents, paymentMethod: method },
    evidenceHash: stableHash({ reference, totals: placed, method }),
    occurredAt: /* @__PURE__ */ new Date()
  }, query: "id" });
  await deliverPickupConfirmation(context, { cartId: placed.cartId, reference, proof, scope, email, name });
  return { reference, proof, status: status5, paymentMethod: method, paymentStatus, totalCents: placed.totalCents, replayed: false };
}
async function cannabisPickupOrder(_root, args, context) {
  const reference = assertText(args.reference, "Order reference", 3, 40);
  const proof = assertText(args.proof, "Order key", 16, 200);
  const cart = await context.sudo().query.Cart.findOne({ where: { reference }, query: "id reference status source guestProofHash subtotalCents taxCents discountCents totalCents pickupWindowStart pickupWindowEnd pickupName paymentMethod paymentStatus premises { timezone currencyCode } lines(take: 50) { titleSnapshot quantityMicrounits totalCents product { unitQuantityMicrounits } }" });
  if (!cart || cart.source !== "pickup" || cart.guestProofHash !== sha(proof)) throw new Error("We couldn\u2019t find that order");
  return {
    reference: cart.reference,
    status: cart.status,
    name: cart.pickupName,
    paymentMethod: cart.paymentMethod,
    paymentStatus: cart.paymentStatus,
    currencyCode: cart.premises?.currencyCode ?? "USD",
    timezone: cart.premises?.timezone ?? "UTC",
    pickupStart: cart.pickupWindowStart,
    pickupEnd: cart.pickupWindowEnd,
    subtotalCents: cart.subtotalCents,
    taxCents: cart.taxCents,
    discountCents: cart.discountCents,
    totalCents: cart.totalCents,
    lines: (cart.lines || []).map((line) => ({ title: line.titleSnapshot, units: Math.round(line.quantityMicrounits / (line.product?.unitQuantityMicrounits || line.quantityMicrounits)), totalCents: line.totalCents }))
  };
}
async function cancelCannabisPickupOrder(_root, args, context) {
  const reference = assertText(args.reference, "Order reference", 3, 40);
  const proof = assertText(args.proof, "Order key", 16, 200);
  const cart = await context.sudo().query.Cart.findOne({ where: { reference }, query: "id source guestProofHash status" });
  if (!cart || cart.source !== "pickup" || cart.guestProofHash !== sha(proof)) throw new Error("We couldn\u2019t find that order");
  if (!["reserved", "preliminarily_eligible"].includes(cart.status) && cart.status !== "cancelled") throw new Error("This order can no longer be cancelled online. Please call the store.");
  const result = await cancelCannabisCart(null, { input: { cartId: cart.id, proof, idempotencyKey: `${reference}:shopper-cancel`, reasonCode: "customer_cancelled" } }, context);
  return { reference, status: result.status };
}

// features/keystone/mutations/index.ts
var graphql = String.raw;
function extendGraphqlSchema(baseSchema) {
  return (0, import_schema.mergeSchemas)({
    schemas: [baseSchema],
    typeDefs: graphql`
      type Query {
        redirectToInit: Boolean
        publicCannabisMenu: JSON!
        cannabisPickupOptions: JSON!
        cannabisPickupOrder(reference: String!, proof: String!): JSON!
        publicCannabisStorefrontSettings: JSON!
        cannabisOperationsWorkspace(section: String!, options: JSON): JSON!
        cannabisStorefrontSettingsWorkspace: JSON!
        cannabisCartPreparation(cartId: ID!): JSON!
        cannabisCartAllocationQuote(input: JSON!): JSON!
        cannabisCommandReceipt(input: JSON!): JSON!
        cannabisSaleReceipt(saleId: ID!): JSON!
      }
      type Mutation {
        placeCannabisPickupOrder(input: JSON!): JSON!
        cancelCannabisPickupOrder(reference: String!, proof: String!): JSON!
        runCannabisOnboarding(input: JSON!): JSON!
        dismissCannabisOnboarding: JSON!
        transitionComplianceIncident(input: JSON!): JSON!
        amendCannabisProduct(input: JSON!, photo: Upload): JSON!
        setCannabisStorefrontCover(input: JSON!, photo: Upload): JSON!
        revokeStaffCredential(input: JSON!): JSON!
        amendRegister(input: JSON!): JSON!
        renewCannabisAuthority(input: JSON!): JSON!
        amendCannabisRulePack(input: JSON!): JSON!
        amendCannabisPremisesDetails(input: JSON!): JSON!
        placePackageHold(input: JSON!): JSON!
        openRecallCase(input: JSON!): JSON!
        advanceRecallCase(input: JSON!): JSON!
        recordPackageLabResult(input: JSON!): JSON!
        releaseCannabisPackage(input: JSON!): JSON!
        recordCannabisCountCorrection(input: JSON!): JSON!
        checkInCannabisCustomer(input: JSON!): JSON!
        setStaffTemporaryPassword(input: JSON!): JSON!
        changeStaffPermissions(input: JSON!): JSON!
        configureCannabisStorefrontSettings(input: JSON!): JSON!
        provisionStaffAuthority(input: JSON!): JSON!
        submitCannabisCustomerIntake(input: JSON!): JSON!
        recordEligibilityDecision(input: JSON!): JSON!
        receiveCannabisPackage(input: JSON!): JSON!
        postCannabisInventoryEvent(input: JSON!): JSON!
        releasePackageHold(input: JSON!): JSON!
        createCustomerPickupCart(input: JSON!): JSON!
        createPosCannabisCart(input: JSON!): JSON!
        transitionCannabisCartPreparation(input: JSON!): JSON!
        addCannabisCartLine(input: JSON!): JSON!
        cancelCannabisCart(input: JSON!): JSON!
        finalizeCannabisSale(input: JSON!): JSON!
        configureCannabisProduct(input: JSON!): JSON!
        configureRegister(input: JSON!): JSON!
        linkTenderPaymentProvider(input: JSON!): JSON!
        openRegisterShift(input: JSON!): JSON!
        closeRegisterShift(input: JSON!): JSON!
        approveCashVariance(input: JSON!): JSON!
        refundCannabisSale(input: JSON!): JSON!
        voidCannabisSale(input: JSON!): JSON!
        recordComplianceIncident(input: JSON!): JSON!
        activateIntegrationInstallation(input: JSON!): JSON!
        recordStateInboxEvent(input: JSON!): JSON!
        recordReconciliationRun(input: JSON!): JSON!
        approveReconciliationRun(input: JSON!): JSON!
      }
    `,
    resolvers: {
      Query: exposeRuleErrors({ cannabisPickupOptions, cannabisPickupOrder, redirectToInit: redirectToInit_default, publicCannabisMenu, publicCannabisStorefrontSettings, cannabisOperationsWorkspace, cannabisStorefrontSettingsWorkspace, cannabisCartPreparation, cannabisCartAllocationQuote, cannabisCommandReceipt, cannabisSaleReceipt }),
      Mutation: exposeRuleErrors({
        placeCannabisPickupOrder,
        cancelCannabisPickupOrder,
        runCannabisOnboarding,
        dismissCannabisOnboarding,
        transitionComplianceIncident,
        amendCannabisProduct,
        revokeStaffCredential,
        amendRegister,
        renewCannabisAuthority,
        amendCannabisRulePack,
        amendCannabisPremisesDetails,
        placePackageHold,
        openRecallCase,
        advanceRecallCase,
        recordPackageLabResult,
        releaseCannabisPackage,
        recordCannabisCountCorrection,
        checkInCannabisCustomer,
        setStaffTemporaryPassword,
        changeStaffPermissions,
        configureCannabisStorefrontSettings,
        setCannabisStorefrontCover,
        provisionStaffAuthority,
        submitCannabisCustomerIntake,
        recordEligibilityDecision,
        receiveCannabisPackage,
        postCannabisInventoryEvent,
        releasePackageHold,
        createCustomerPickupCart,
        createPosCannabisCart,
        transitionCannabisCartPreparation,
        addCannabisCartLine,
        cancelCannabisCart,
        finalizeCannabisSale,
        configureCannabisProduct,
        configureRegister,
        linkTenderPaymentProvider,
        openRegisterShift,
        closeRegisterShift,
        approveCashVariance,
        refundCannabisSale,
        voidCannabisSale,
        recordComplianceIncident,
        activateIntegrationInstallation,
        recordStateInboxEvent,
        recordReconciliationRun,
        approveReconciliationRun
      })
    }
  });
}

// features/keystone/lib/mail.ts
var import_nodemailer2 = require("nodemailer");
init_email_layout();
function getBaseUrlForEmails() {
  if (process.env.SMTP_STORE_LINK) {
    return process.env.SMTP_STORE_LINK;
  }
  console.warn("SMTP_STORE_LINK not set. Please add SMTP_STORE_LINK to your environment variables for email links to work properly.");
  return "";
}
function mailTransport() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_PORT || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    throw new Error("Password reset delivery is not configured");
  }
  const port = Number(process.env.SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Password reset delivery is not configured");
  return (0, import_nodemailer2.createTransport)({
    host: process.env.SMTP_HOST,
    port,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
  });
}
function passwordResetEmail({ url }) {
  return emailLayout({
    preheader: "Use this link to choose a new password.",
    title: "Reset your password",
    body: `${emailParagraph("We received a request to reset the password for your account. Use the button below to choose a new one.")}
${emailButton("Reset password", url)}
${emailMuted("If you did not request this, you can safely ignore this email. Your password will not change.")}`
  });
}
async function sendPasswordResetEmail(resetToken, to, baseUrl) {
  const frontendUrl = baseUrl || getBaseUrlForEmails();
  await mailTransport().sendMail({
    to,
    from: process.env.SMTP_FROM,
    subject: "Your password reset token!",
    html: passwordResetEmail({
      url: `${frontendUrl}/dashboard/reset?token=${resetToken}`
    })
  });
}

// lib/security.ts
var OPERATOR_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

// features/keystone/config/environment.ts
function requiredEnv(env, name) {
  const value = env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}
function productionEnv(env, name, developmentFallback) {
  if (env[name]) return env[name];
  if (env.NODE_ENV === "production") {
    throw new Error(`${name} is required in production`);
  }
  return developmentFallback;
}
function readRuntimeEnvironment(env = process.env) {
  const databaseUrl = requiredEnv(env, "DATABASE_URL");
  const sessionSecret = requiredEnv(env, "SESSION_SECRET");
  if (sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters long");
  }
  return {
    databaseUrl,
    sessionSecret,
    storage: {
      bucketName: productionEnv(env, "S3_BUCKET_NAME", "keystone-test"),
      region: productionEnv(env, "S3_REGION", "ap-southeast-2"),
      accessKeyId: productionEnv(env, "S3_ACCESS_KEY_ID", "keystone"),
      secretAccessKey: productionEnv(env, "S3_SECRET_ACCESS_KEY", "keystone"),
      endpoint: productionEnv(
        env,
        "S3_ENDPOINT",
        "https://sfo3.digitaloceanspaces.com"
      )
    }
  };
}

// features/keystone/database-url.ts
var POOL_SIZES = { web: 15, worker: 5 };
var OVERRIDE_ENV = {
  web: "DATABASE_CONNECTION_LIMIT",
  worker: "DATABASE_CONNECTION_LIMIT_WORKER"
};
function pooledDatabaseUrl(url, role = "web") {
  if (!url || !/^postgres(ql)?:\/\//.test(url)) return url;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (parsed.searchParams.has("connection_limit")) return url;
  const override = Number(process.env[OVERRIDE_ENV[role]]);
  parsed.searchParams.set("connection_limit", String(Number.isInteger(override) && override > 0 ? override : POOL_SIZES[role]));
  return parsed.toString();
}

// features/keystone/lib/keystonePrismaErrors.ts
var RAW_METHOD = /^\$(queryRaw|executeRaw|queryRawUnsafe|executeRawUnsafe|queryRawTyped|runCommandRaw)$/;
var clients = /* @__PURE__ */ new WeakMap();
var delegates = /* @__PURE__ */ new WeakMap();
function isKeystonePrismaError(value) {
  return value instanceof Error && value.extensions?.code === "KS_PRISMA_ERROR";
}
function rethrowKeystonePrismaError(value) {
  if (!isKeystonePrismaError(value)) return value;
  const prisma = value.extensions.prisma ?? {};
  throw Object.assign(value, { code: prisma.code, meta: prisma.meta, clientVersion: prisma.clientVersion });
}
function throwing(result) {
  if (!result || typeof result.then !== "function") return rethrowKeystonePrismaError(result);
  const settled = () => result.then(rethrowKeystonePrismaError);
  return new Proxy(result, {
    get(target, key) {
      if (key === "then") return (ok, fail) => settled().then(ok, fail);
      if (key === "catch") return (fail) => settled().catch(fail);
      if (key === "finally") return (done) => settled().finally(done);
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
}
function throwingDelegate(delegate) {
  const cached = delegates.get(delegate);
  if (cached) return cached;
  const wrapped = new Proxy(delegate, {
    get(target, key) {
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? (...args) => throwing(value.apply(target, args)) : value;
    }
  });
  delegates.set(delegate, wrapped);
  return wrapped;
}
function throwKeystonePrismaErrors(client) {
  const cached = clients.get(client);
  if (cached) return cached;
  const wrapped = new Proxy(client, {
    get(target, key) {
      const value = Reflect.get(target, key, target);
      if (key === "$transaction" && typeof value === "function") {
        return (work, ...options) => {
          if (typeof work === "function") return value.call(target, (tx) => work(throwKeystonePrismaErrors(tx)), ...options);
          return Promise.resolve(value.call(target, work, ...options)).then((results) => Array.isArray(results) ? results.map(rethrowKeystonePrismaError) : results);
        };
      }
      if (key === "$extends" && typeof value === "function") return (...args) => throwKeystonePrismaErrors(value.apply(target, args));
      if (typeof key === "string" && RAW_METHOD.test(key) && typeof value === "function") return (...args) => throwing(value.apply(target, args));
      if (typeof value === "function") return value.bind(target);
      if (typeof key === "string" && !key.startsWith("$") && value && typeof value === "object" && typeof value.findFirst === "function") return throwingDelegate(value);
      return value;
    }
  });
  clients.set(client, wrapped);
  return wrapped;
}

// features/keystone/index.ts
var runtimeEnvironment = readRuntimeEnvironment();
var sessionConfig = {
  maxAge: OPERATOR_SESSION_MAX_AGE_SECONDS,
  secret: runtimeEnvironment.sessionSecret
};
var { withAuth } = (0, import_auth.createAuth)({
  listKey: "User",
  identityField: "email",
  secretField: "password",
  initFirstItem: {
    fields: ["name", "email", "password"],
    itemData: {
      role: {
        create: {
          name: "Admin",
          canManagePeople: true,
          canManageRoles: true,
          canAccessDashboard: true,
          canManageOnboarding: true,
          canManageAuthority: true,
          canManageCompliance: true,
          canManageInventory: true,
          canManageSales: true,
          canManageFinance: true,
          canManageIntegrations: true,
          canViewReports: true
        }
      }
    }
  },
  passwordResetLink: {
    async sendToken(args) {
      await sendPasswordResetEmail(args.token, args.identity);
    }
  },
  sessionData: `
    name
    email
    status
    onboardingStatus
    organization { id }
    premises { id }
    staffCredential { id status effectiveAt expiresAt allowedActivities evidenceHash }
    role {
      id
      name
      canManagePeople
      canManageRoles
      canAccessDashboard
      canManageOnboarding
      canManageAuthority
      canManageCompliance
      canManageInventory
      canManageSales
      canManageFinance
      canManageIntegrations
      canViewReports
    }
  `
});
var keystone_default = withAuth(
  (0, import_core8.config)({
    db: {
      provider: "postgresql",
      url: pooledDatabaseUrl(runtimeEnvironment.databaseUrl),
      // Keystone returns failed queries as values; this makes them throw so transactions roll back.
      extendPrismaClient: throwKeystonePrismaErrors
    },
    lists: withDeleteAwareUi(withCreateAwareUi(models)),
    storage: {
      my_images: {
        kind: "s3",
        type: "image",
        bucketName: runtimeEnvironment.storage.bucketName,
        region: runtimeEnvironment.storage.region,
        accessKeyId: runtimeEnvironment.storage.accessKeyId,
        secretAccessKey: runtimeEnvironment.storage.secretAccessKey,
        endpoint: runtimeEnvironment.storage.endpoint,
        signed: { expiry: 300 },
        forcePathStyle: s3ForcePathStyle(runtimeEnvironment.storage.endpoint)
      }
    },
    ui: {
      isAccessAllowed: ({ session }) => session?.data.role?.canAccessDashboard ?? false
    },
    session: (0, import_session.statelessSessions)(sessionConfig),
    graphql: {
      extendGraphqlSchema
    }
  })
);

// keystone.ts
var keystone_default2 = keystone_default;
//# sourceMappingURL=config.js.map
