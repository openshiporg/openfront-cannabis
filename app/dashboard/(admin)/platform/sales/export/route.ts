import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';

export const dynamic = 'force-dynamic';

type Row = { finalizedAt: string | null; receiptNumber: string; status: string; customerType: string; packageUid: string; batch: string; product: string; sku: string; category: string; quantityMicrounits: number; unit: string; unitPriceCents: number; discountCents: number; taxCents: number; totalCents: number; saleRefundedCents: number };

// Spreadsheet-safe cell: quoted, and a leading = + - @ is kept as text so it can never run as a formula.
const cell = (value: unknown) => { const text = String(value ?? ''); return `"${(/^[=+\-@\t\r]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`; };
const amount = (cents: number) => (cents / 100).toFixed(2);

/** Sales as a CSV file, one row per package sold. The same permission as the Sales page; nothing is stored. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = url.searchParams.get('from') ?? ''; const to = url.searchParams.get('to') ?? '';
  const response = await keystoneClient<{ cannabisSalesExport: { timezone: string; rows: Row[] } }>('query($from: String!, $to: String!) { cannabisSalesExport(from: $from, to: $to) }', { from, to }, { cache: 'no-store' });
  if (!response.success) return new Response('The export could not be made. Check the dates and that you can open Sales, then try again.', { status: 400, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  const { timezone, rows } = response.data.cannabisSalesExport;
  const when = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const header = ['Sold at (store time)', 'Receipt', 'Sale status', 'Customer type', 'Package tag', 'Batch', 'Product', 'SKU', 'Category', 'Quantity', 'Unit', 'Unit price', 'Discount', 'Tax', 'Line total', 'Refunded on this sale'];
  const body = rows.map(row => [row.finalizedAt ? when.format(new Date(row.finalizedAt)).replace(',', '') : '', row.receiptNumber, row.status.replace(/_/g, ' '), row.customerType.replace(/_/g, ' '), row.packageUid, row.batch, row.product, row.sku, row.category, (row.quantityMicrounits / 1_000_000).toString(), row.unit, amount(row.unitPriceCents), amount(row.discountCents), amount(row.taxCents), amount(row.totalCents), amount(row.saleRefundedCents)].map(cell).join(','));
  return new Response(`\uFEFF${[header.map(cell).join(','), ...body].join('\r\n')}\r\n`, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="sales-${from}-to-${to}.csv"`, 'cache-control': 'no-store' } });
}
