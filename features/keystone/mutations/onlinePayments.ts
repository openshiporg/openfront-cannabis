import { createHash, randomUUID } from "node:crypto";
import type { Context } from ".keystone/types";
import { refundPayment } from "../utils/paymentProviderAdapter";
import { isPaymentProviderConfigured } from "../utils/paymentProviderConfig";

export const CARD_PROVIDER_CODE = "pp_authorizenet_authorizenet";
const PROVIDER_SELECTION = "id code isInstalled credentials createPaymentFunction capturePaymentFunction refundPaymentFunction getPaymentStatusFunction generatePaymentLinkFunction handleWebhookFunction";

/**
 * The card provider for online orders, or null when card payment is not available.
 * Authorize.net is configured by the host's environment; its provider record and the link from the
 * debit tender are created here (idempotently) so staff can capture the authorization at pickup.
 */
export async function onlineCardProvider(context: Context, scope: { organizationId: string; premisesId: string }, ensure: boolean) {
  if (!isPaymentProviderConfigured(CARD_PROVIDER_CODE)) return null;
  const sudo = context.sudo();
  let provider = await sudo.query.PaymentProvider.findOne({ where: { code: CARD_PROVIDER_CODE }, query: PROVIDER_SELECTION });
  if (!provider && ensure) {
    provider = await sudo.query.PaymentProvider.createOne({ data: { name: "Authorize.net", code: CARD_PROVIDER_CODE, isInstalled: true, credentials: {}, metadata: {},
      createPaymentFunction: "authorizenet", capturePaymentFunction: "authorizenet", refundPaymentFunction: "authorizenet", getPaymentStatusFunction: "authorizenet", generatePaymentLinkFunction: "authorizenet", handleWebhookFunction: "authorizenet" }, query: PROVIDER_SELECTION });
  }
  if (provider && !provider.isInstalled) return null;
  if (!ensure) return provider ?? { code: CARD_PROVIDER_CODE };
  const now = new Date();
  const debit = await sudo.query.TenderConfiguration.findMany({ where: { organization: { id: { equals: scope.organizationId } }, premises: { id: { equals: scope.premisesId } }, type: { equals: "debit" }, enabled: { equals: true }, effectiveAt: { lte: now }, expiresAt: { gt: now } }, take: 2, query: "id paymentProvider { id }" });
  if (debit.length !== 1) return null;
  if (!debit[0].paymentProvider) await sudo.query.TenderConfiguration.updateOne({ where: { id: debit[0].id }, data: { paymentProvider: { connect: { id: provider!.id } }, providerCode: CARD_PROVIDER_CODE }, query: "id" });
  else if (debit[0].paymentProvider.id !== provider!.id) return null;
  return provider;
}

/**
 * Releases the card authorization of an online order (void, or refund once settled). Safe to call
 * repeatedly: only an authorization that is still held is touched. A void that cannot be confirmed is
 * recorded as an incident for staff to reconcile instead of being silently dropped.
 */
export async function releaseOnlinePayment(context: Context, cartId: string) {
  const sudo = context.sudo();
  const cart = await sudo.query.Cart.findOne({ where: { id: cartId }, query: "id reference paymentMethod paymentStatus paymentReference totalCents organization { id } premises { id }" });
  if (!cart || cart.paymentMethod !== "card" || cart.paymentStatus !== "authorized" || !cart.paymentReference) return null;
  const provider = await sudo.query.PaymentProvider.findOne({ where: { code: CARD_PROVIDER_CODE }, query: PROVIDER_SELECTION });
  let released = false;
  try {
    if (provider) {
      const result: any = await refundPayment({ provider, paymentId: cart.paymentReference, amount: cart.totalCents, currency: "USD", idempotencyKey: `release${cart.reference}` });
      released = ["refunded", "canceled", "voided"].includes(String(result?.status));
    }
  } catch { released = false; }
  await sudo.query.Cart.updateOne({ where: { id: cart.id }, data: { paymentStatus: released ? "voided" : "void_failed" }, query: "id" });
  if (!released) {
    await sudo.query.ComplianceIncident.createOne({ data: { organization: { connect: { id: cart.organization.id } }, premises: { connect: { id: cart.premises.id } }, reference: `INC-PAY-${randomUUID()}`, type: "payment_ambiguity", severity: "high", status: "open",
      occurredAt: new Date(), detectedAt: new Date(), description: `Card authorization for online order ${cart.reference} could not be released; void it in the card processor and reconcile.`, affectedPackageUids: [],
      customerReferenceHash: createHash("sha256").update(cart.id).digest("hex"), evidenceHash: createHash("sha256").update(`${cart.id}:${cart.paymentReference}:release_failed`).digest("hex") }, query: "id" });
  }
  return released ? "voided" : "void_failed";
}
