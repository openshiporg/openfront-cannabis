const unavailable = () =>
  Response.json(
    { error: "The generic MCP data tool is disabled until a bounded, owner-approved integration is available." },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );

export async function GET() {
  return unavailable();
}

export async function POST() {
  return unavailable();
}
