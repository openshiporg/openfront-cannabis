import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';

export const dynamic = 'force-dynamic';

// Spreadsheet-safe cell: quoted, and a leading = + @ is kept as text so it can never run as a formula. Negative numbers stay numbers.
const cell = (value: string) => `"${(/^[=+@\t\r]/.test(value) || /^-(?!\d)/.test(value) ? `'${value}` : value).replace(/"/g, '""')}"`;

/** Sales receipts or package adjustments as a CSV in the state system's import layout. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const kind = url.searchParams.get('kind') === 'adjustments' ? 'adjustments' : 'sales';
  const from = url.searchParams.get('from') ?? ''; const to = url.searchParams.get('to') ?? '';
  const response = await keystoneClient<{ cannabisStateReportExport: { header: string[]; rows: string[][] } }>('query($kind: String!, $from: String!, $to: String!) { cannabisStateReportExport(kind: $kind, from: $from, to: $to) }', { kind, from, to }, { cache: 'no-store' });
  if (!response.success) return new Response('The file could not be made. Check the dates and that you can open State reporting, then try again.', { status: 400, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  const { header, rows } = response.data.cannabisStateReportExport;
  const body = [header, ...rows].map(row => row.map(cell).join(',')).join('\r\n');
  return new Response(`${body}\r\n`, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="state-${kind}-${from}-to-${to}.csv"`, 'cache-control': 'no-store' } });
}
