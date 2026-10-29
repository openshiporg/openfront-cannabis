import { createHash } from "node:crypto";
import { handleWebhook } from "../utils/paymentProviderAdapter";
import { keystoneContext } from "../context";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export async function reconcilePaymentWebhook(providerId: string, rawBody: string, headers: Record<string, string>) {
  const context = keystoneContext.sudo();
  const provider = await context.query.PaymentProvider.findOne({ where: { id: providerId }, query: "id code isInstalled credentials handleWebhookFunction" });
  if (!provider || !provider.isInstalled) throw new Error("Payment provider is unavailable");
  const verified = await handleWebhook({ provider, headers, rawBody });
  if (!verified?.isValid || !verified.event || typeof verified.event !== "object") throw new Error("Payment webhook signature is invalid");
  const event: any = verified.event; const resource: any = verified.resource || event.resource || event;
  const eventId = String(event.id || event.eventId || ""); const providerReference = String(resource.transactionId || resource.id || resource.transaction?.id || "");
  const amount = resource.amount?.amount ?? resource.amountCents ?? resource.amount;
  const currency = String(resource.amount?.currency || resource.currency || "USD").toUpperCase();
  if (!eventId || !providerReference || !Number.isSafeInteger(Number(amount)) || currency !== "USD") throw new Error("Payment webhook correlation or amount is invalid");
  const tender = await context.query.Tender.findMany({ where: { providerReference: { equals: providerReference }, configuration: { paymentProvider: { id: { equals: providerId } } } }, take: 2, query: "id amountCents status providerReference organization { id } premises { id }" });
  if (tender.length !== 1 || tender[0].amountCents !== Number(amount)) throw new Error("Payment webhook does not match exactly one tender amount");
  const lookupKey = `payment-webhook:${providerId}:${eventId}`; const requestHash = hash(rawBody);
  try {
    await context.query.IdempotencyKey.createOne({ data: { organization: { connect: { id: tender[0].organization.id } }, premises: { connect: { id: tender[0].premises.id } }, scope: "payment-webhook", lookupKey, requestHash, status: "succeeded", responseSnapshot: { tenderId: tender[0].id, providerReference }, startedAt: new Date(), completedAt: new Date(), expiresAt: new Date(Date.now() + 365 * 86400_000) }, query: "id" });
  } catch {
    const existing = await context.query.IdempotencyKey.findOne({ where: { lookupKey }, query: "id requestHash responseSnapshot" });
    if (!existing || existing.requestHash !== requestHash) throw new Error("Payment webhook event was replayed with conflicting evidence");
    return { accepted: true, duplicate: true, tenderId: tender[0].id };
  }
  if (["transaction_completed", "captured", "succeeded"].includes(String(event.type || verified.type))) await context.query.Tender.updateOne({ where: { id: tender[0].id }, data: { status: "captured" }, query: "id" });
  return { accepted: true, duplicate: false, tenderId: tender[0].id };
}
