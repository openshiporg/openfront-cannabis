import { NextRequest, NextResponse } from "next/server";
import { reconcilePaymentWebhook } from "@/features/keystone/mutations/paymentWebhook";

export const runtime = "nodejs";
const MAX_BODY_BYTES = 1_000_000;
export async function POST(request: NextRequest, { params }: { params: Promise<{ providerId: string }> }) {
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > MAX_BODY_BYTES) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  const rawBody = new TextDecoder().decode(bytes);
  try {
    const { providerId } = await params;
    const headers = Object.fromEntries(request.headers.entries());
    const result = await reconcilePaymentWebhook(providerId, rawBody, headers);
    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Webhook rejected" }, { status: 400 });
  }
}
