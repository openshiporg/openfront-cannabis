import { createTransport } from "nodemailer";

function pickupMailTransport() {
  const port = Number(process.env.SMTP_PORT);
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Email delivery is not configured");
  return createTransport({ host: process.env.SMTP_HOST, port, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } });
}


const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] as string);

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

export async function sendPickupOrderConfirmationEmail(order: OrderConfirmationEmail): Promise<{ sent: boolean; error?: string; messageId?: string }> {
  if (!order.to) return { sent: false, error: "no_recipient" };
  try {
    const rows = order.lines.map((line) => `<tr><td style="padding:4px 0">${escapeHtml(line.title)} × ${line.units}</td><td align="right" style="padding:4px 0">${escapeHtml(line.total)}</td></tr>`).join("");
    const info = await pickupMailTransport().sendMail({
      to: order.to,
      from: process.env.SMTP_FROM,
      subject: `Your order ${order.reference} at ${order.storeName}`,
      html: `<body style="font-family:Helvetica,Arial,sans-serif;color:#222;max-width:560px;margin:auto">
        <h2>Thanks ${escapeHtml(order.name)}, we have your order</h2>
        <p>Order <strong>${escapeHtml(order.reference)}</strong> at ${escapeHtml(order.storeName)}.<br/>Pickup: ${escapeHtml(order.whenLabel)}</p>
        <table width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #ddd;border-bottom:1px solid #ddd">${rows}
          <tr><td style="padding:8px 0"><strong>Total</strong></td><td align="right"><strong>${escapeHtml(order.total)}</strong></td></tr></table>
        <p><a href="${escapeHtml(order.link)}">View or cancel your order</a></p>
        <p style="color:#666;font-size:13px">Bring a valid government ID to pickup.</p>
      </body>`,
    });
    return { sent: true, messageId: typeof (info as any)?.messageId === "string" ? (info as any).messageId : undefined };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : "send_failed" };
  }
}
