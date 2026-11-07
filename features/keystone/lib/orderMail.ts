import { createTransport } from "nodemailer";
import { emailButton, emailItems, emailLayout, emailMuted, emailPanel, emailParagraph, emailTotals, escapeHtml } from "./email-layout";

function pickupMailTransport() {
  const port = Number(process.env.SMTP_PORT);
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Email delivery is not configured");
  return createTransport({ host: process.env.SMTP_HOST, port, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } });
}



export type OrderConfirmationEmail = {
  to: string;
  storeName: string;
  reference: string;
  name: string;
  whenLabel: string;
  lines: Array<{ title: string; units: number; total: string }>;
  total: string;
  link: string;
};

export async function sendPickupOrderConfirmationEmail(order: OrderConfirmationEmail): Promise<{ sent: boolean; error?: string; messageId?: string; response?: string }> {
  if (!order.to) return { sent: false, error: "no_recipient" };
  try {
    const rows = order.lines.map((line) => `<tr><td style="padding:4px 0">${escapeHtml(line.title)} × ${line.units}</td><td align="right" style="padding:4px 0">${escapeHtml(line.total)}</td></tr>`).join("");
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
${emailMuted("Bring a valid government ID to pickup.")}`,
      }),
    });
    return { sent: true, messageId: typeof (info as any)?.messageId === "string" ? (info as any).messageId : undefined, response: typeof (info as any)?.response === "string" ? (info as any).response : undefined };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : "send_failed" };
  }
}

export type OrderReadyEmail = { to: string; storeName: string; reference: string; name: string; whenLabel: string; address?: string };

/** "Your order is ready" (Dutchie / Jane): sent once when staff stage a pickup order. */
export async function sendPickupOrderReadyEmail(order: OrderReadyEmail): Promise<{ sent: boolean; error?: string; messageId?: string; response?: string }> {
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
${emailMuted("Use the link in your order confirmation email to view or cancel the order.")}`,
      }),
    });
    return { sent: true, messageId: typeof (info as any)?.messageId === "string" ? (info as any).messageId : undefined, response: typeof (info as any)?.response === "string" ? (info as any).response : undefined };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : "send_failed" };
  }
}
