import { createHash } from "node:crypto";

/** One confirmation email per order, sent after the order is committed. The AuditEvent row is the dedupe record and carries the status. */
export async function deliverPickupConfirmation(context: any, args: { cartId: string; reference: string; proof: string; scope: { organizationId: string; premisesId: string }; email: string; name: string }, send?: (order: any) => Promise<{ sent: boolean; error?: string; messageId?: string; response?: string }>) {
  try {
    const sudo = context.sudo();
    const existing = await sudo.query.AuditEvent.findMany({ where: { action: { equals: "cart.confirmation_email" }, resourceId: { equals: args.cartId } }, take: 1, query: "id" });
    if (existing.length) return;
    let status = "skipped_not_configured";
    let error: string | undefined;
    let messageId: string | undefined;
    let response: string | undefined;
    const base = process.env.SMTP_STORE_LINK;
    if (process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASSWORD && base) {
      try {
        const cart = await sudo.query.Cart.findOne({ where: { id: args.cartId }, query: "pickupWindowStart pickupWindowEnd totalCents premises { name timezone currencyCode } lines(take: 50) { titleSnapshot quantityMicrounits totalCents product { unitQuantityMicrounits } }" });
        const zone = cart.premises?.timezone || "UTC";
        const currency = cart.premises?.currencyCode || "USD";
        const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format((cents || 0) / 100);
        const when = (value: string | Date) => new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
        const end = new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(cart.pickupWindowEnd));
        // Loaded lazily so the mail module never joins the keystone import graph at build time.
        const deliver = send || (await import("../lib/orderMail")).sendPickupOrderConfirmationEmail;
        const result = await deliver({
          to: args.email, storeName: cart.premises?.name || "Our store", reference: args.reference, name: args.name,
          whenLabel: `${when(cart.pickupWindowStart)} to ${end}`,
          lines: (cart.lines || []).map((line: any) => ({ title: line.titleSnapshot, units: Math.round(line.quantityMicrounits / (line.product?.unitQuantityMicrounits || line.quantityMicrounits)), total: money(line.totalCents) })),
          total: money(cart.totalCents),
          link: `${base.replace(/\/$/, "")}/order/${encodeURIComponent(args.reference)}#${encodeURIComponent(args.proof)}`,
        });
        status = result.sent ? "sent" : "failed";
        error = result.error;
        messageId = result.messageId;
        response = result.response;
      } catch (caught) { status = "failed"; error = caught instanceof Error ? caught.message : "send_failed"; }
    }
    await sudo.query.AuditEvent.createOne({ data: { organization: { connect: { id: args.scope.organizationId } }, premises: { connect: { id: args.scope.premisesId } }, action: "cart.confirmation_email", resourceType: "Cart", resourceId: args.cartId, correlationId: args.reference, reasonCode: status,
      evidence: { status, ...(messageId ? { messageId: messageId.slice(0, 200) } : {}), ...(response ? { smtpResponse: response.slice(0, 300) } : {}), ...(error ? { error: error.slice(0, 200) } : {}) }, evidenceHash: createHash("sha256").update(`${args.reference}:${status}`).digest("hex"), occurredAt: new Date() }, query: "id" });
  } catch (caught) {
    console.error("Order confirmation email bookkeeping failed:", caught instanceof Error ? caught.message : "unknown");
  }
}


/**
 * "Your order is ready" when staff stage an online pickup order (Dutchie / Jane). One email per cart:
 * a unique claim AuditEvent is written first, then the result. Never throws; staging stands regardless.
 */
export async function deliverPickupReadyNotice(context: any, cartId: string, send?: (order: any) => Promise<{ sent: boolean; error?: string; messageId?: string; response?: string }>) {
  try {
    const sudo = context.sudo();
    const cart = await sudo.query.Cart.findOne({ where: { id: cartId }, query: "id reference source status pickupName pickupWindowStart pickupWindowEnd organization { id } premises { id name timezone addressSnapshot } customer { contact }" });
    if (!cart || cart.source !== "pickup" || cart.status !== "staged" || !cart.organization?.id || !cart.premises?.id) return;
    const prior = await sudo.query.AuditEvent.findMany({ where: { action: { equals: "cart.ready_email" }, resourceId: { equals: cartId } }, take: 1, query: "id" });
    if (prior.length) return;
    const record = (status: string, evidence: Record<string, unknown> = {}) => sudo.query.AuditEvent.createOne({ data: { organization: { connect: { id: cart.organization.id } }, premises: { connect: { id: cart.premises.id } }, action: "cart.ready_email", resourceType: "Cart", resourceId: cartId, correlationId: cart.reference, reasonCode: status,
      evidence: { status, ...evidence }, evidenceHash: createHash("sha256").update(`${cart.reference}:ready:${status}`).digest("hex"), occurredAt: new Date() }, query: "id" });
    const contact = (cart.customer?.contact || {}) as Record<string, unknown>;
    const to = typeof contact.email === "string" ? contact.email : "";
    if (!to) { await record("skipped_no_recipient"); return; }
    if (!(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASSWORD)) { await record("skipped_not_configured"); return; }
    const zone = cart.premises.timezone || "UTC";
    const when = (value: string | Date) => new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
    const end = cart.pickupWindowEnd ? new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(cart.pickupWindowEnd)) : "";
    const address = cart.premises.addressSnapshot && typeof cart.premises.addressSnapshot === "object" ? [cart.premises.addressSnapshot.line1, cart.premises.addressSnapshot.city].filter(Boolean).join(", ") : "";
    let result: { sent: boolean; error?: string; messageId?: string; response?: string };
    try {
      const deliver = send || (await import("../lib/orderMail")).sendPickupOrderReadyEmail;
      result = await deliver({ to, storeName: cart.premises.name || "Our store", reference: cart.reference, name: cart.pickupName || (typeof contact.name === "string" ? contact.name : ""),
        whenLabel: cart.pickupWindowStart ? `${when(cart.pickupWindowStart)}${end ? ` to ${end}` : ""}` : "during store hours", address });
    } catch (caught) { result = { sent: false, error: caught instanceof Error ? caught.message : "send_failed" }; }
    await record(result.sent ? "sent" : "failed", { ...(result.messageId ? { messageId: result.messageId.slice(0, 200) } : {}), ...(result.response ? { smtpResponse: result.response.slice(0, 300) } : {}), ...(result.error ? { error: result.error.slice(0, 200) } : {}) });
  } catch (caught) {
    console.error("Order ready email bookkeeping failed:", caught instanceof Error ? caught.message : "unknown");
  }
}
