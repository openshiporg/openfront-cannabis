import { createHash } from "node:crypto";
import { handleWebhook } from "../utils/paymentProviderAdapter";
import { keystoneContext } from "../context";
import { serializableTransaction } from "../domain/transaction";
import { canMoveTender, tenderStatusForWebhook } from "../domain/lifecycles";

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
  const wanted = tenderStatusForWebhook(String(event.type || verified.type));
  // The receipt and the tender change commit together: a failure leaves no receipt, so the provider's retry is applied.
  return await serializableTransaction(context as any, async (tx: any) => {
    const sudo = tx.sudo();
    await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "openfront-cannabis", lookupKey);
    const existing = await sudo.query.IdempotencyKey.findOne({ where: { lookupKey }, query: "id requestHash" });
    if (existing) {
      if (existing.requestHash !== requestHash) throw new Error("Payment webhook event was replayed with conflicting evidence");
      return { accepted: true, duplicate: true, tenderId: tender[0].id };
    }
    const current = await sudo.query.Tender.findOne({ where: { id: tender[0].id }, query: "id status" });
    // Providers deliver out of order and more than once: a late event never moves a tender backwards.
    const apply = Boolean(wanted && current && canMoveTender(current.status, wanted));
    if (apply) await sudo.query.Tender.updateOne({ where: { id: tender[0].id }, data: { status: wanted }, query: "id" });
    await sudo.query.IdempotencyKey.createOne({ data: { organization: { connect: { id: tender[0].organization.id } }, premises: { connect: { id: tender[0].premises.id } }, scope: "payment-webhook", lookupKey, requestHash, status: "succeeded", responseSnapshot: { tenderId: tender[0].id, providerReference, applied: apply ? wanted : null, ignored: apply ? null : (wanted ? "stale" : "unhandled_event") }, startedAt: new Date(), completedAt: new Date(), expiresAt: new Date(Date.now() + 365 * 86400_000) }, query: "id" });
    return { accepted: true, duplicate: false, tenderId: tender[0].id, applied: apply };
  });
}
