import { paymentProviderAdapters } from "../../integrations/payment";

const ADAPTERS = new Set(Object.keys(paymentProviderAdapters));
const OPERATIONS = new Set(["createPaymentFunction", "capturePaymentFunction", "refundPaymentFunction", "getPaymentStatusFunction", "generatePaymentLinkFunction", "handleWebhookFunction"]);
export function paymentAdapterPayload(provider: any, args: any) {
  const input: Record<string, any> = {};
  for (const key of ["cart", "order", "amount", "currency", "idempotencyKey", "paymentId", "refundId", "event", "headers", "rawBody"]) if (args?.[key] !== undefined) input[key] = args[key];
  if (input.headers && typeof input.headers === "object") input.headers = Object.fromEntries(Object.entries(input.headers).filter(([key]) => key.toLowerCase().startsWith("x-aeropay-") || key.toLowerCase().startsWith("stripe-") || key.toLowerCase().startsWith("paypal-")));
  return { ...input, provider: { id: provider.id, code: provider.code, credentials: provider.credentials || {} } };
}
export async function executeAdapterFunction({ provider, functionName, args }: { provider: any; functionName: string; args: any }) {
  if (!OPERATIONS.has(functionName)) throw new Error("Unknown payment adapter operation");
  const selected = provider?.[functionName]; if (typeof selected !== "string") throw new Error("Payment adapter is not configured");
  if (/^https?:/i.test(selected)) throw new Error("External payment adapters are not enabled for this vertical");
  if (!ADAPTERS.has(selected)) throw new Error("Unknown registered payment adapter");
  const adapter: any = await paymentProviderAdapters[selected as keyof typeof paymentProviderAdapters]();
  if (typeof adapter[functionName] !== "function") throw new Error("Payment adapter operation is unavailable");
  try { return await adapter[functionName](paymentAdapterPayload(provider, args)); }
  catch { throw new Error(`Payment adapter ${functionName} failed; reconcile the original attempt before retrying`); }
}
export const createPayment = (p: any) => executeAdapterFunction({ provider: p.provider, functionName: "createPaymentFunction", args: p });
export const capturePayment = (p: any) => executeAdapterFunction({ provider: p.provider, functionName: "capturePaymentFunction", args: p });
export const refundPayment = (p: any) => executeAdapterFunction({ provider: p.provider, functionName: "refundPaymentFunction", args: p });
export const getPaymentStatus = (p: any) => executeAdapterFunction({ provider: p.provider, functionName: "getPaymentStatusFunction", args: p });
export const generatePaymentLink = (p: any) => executeAdapterFunction({ provider: p.provider, functionName: "generatePaymentLinkFunction", args: p });
export const handleWebhook = (p: any) => executeAdapterFunction({ provider: p.provider, functionName: "handleWebhookFunction", args: p });
