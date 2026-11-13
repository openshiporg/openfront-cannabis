export function isPaymentProviderConfigured(code: string): boolean {
  if (code.startsWith("pp_manual")) return true;
  if (code.startsWith("pp_aeropay")) return Boolean(process.env.AEROPAY_API_KEY && process.env.AEROPAY_API_SECRET && process.env.AEROPAY_MERCHANT_ID && process.env.AEROPAY_WEBHOOK_SECRET && process.env.AEROPAY_BANK_ACCOUNT_ID);
  if (code.startsWith("pp_authorizenet")) return Boolean(process.env.AUTHORIZENET_API_LOGIN_ID && process.env.AUTHORIZENET_TRANSACTION_KEY && process.env.NEXT_PUBLIC_AUTHORIZENET_CLIENT_KEY && process.env.NEXT_PUBLIC_AUTHORIZENET_API_LOGIN_ID === process.env.AUTHORIZENET_API_LOGIN_ID);
  return false;
}
export type PublicCardConfig = { provider: "authorizenet"; apiLoginId: string; clientKey: string; env: "test" | "production" };
/** Only public Accept.js identifiers ever leave the server; Aeropay is server-mediated and exposes nothing. */
export function getPublicPaymentProviderConfig(code: string): PublicCardConfig | null {
  if (!isPaymentProviderConfigured(code)) return null;
  if (code.startsWith("pp_authorizenet")) return { provider: "authorizenet", apiLoginId: process.env.AUTHORIZENET_API_LOGIN_ID!, clientKey: process.env.NEXT_PUBLIC_AUTHORIZENET_CLIENT_KEY!, env: process.env.AUTHORIZENET_ENV === "production" ? "production" : "test" };
  return null;
}
