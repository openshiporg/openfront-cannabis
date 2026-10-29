export function isPaymentProviderConfigured(code: string): boolean {
  if (code.startsWith("pp_manual")) return true;
  if (code.startsWith("pp_aeropay")) return Boolean(process.env.AEROPAY_API_KEY && process.env.AEROPAY_API_SECRET && process.env.AEROPAY_MERCHANT_ID && process.env.AEROPAY_WEBHOOK_SECRET);
  return false;
}
export function getPublicPaymentProviderConfig(code: string): null {
  // Aeropay is server-mediated; no credentials or tokens are exposed to clients.
  if (!isPaymentProviderConfigured(code)) return null;
  return null;
}
