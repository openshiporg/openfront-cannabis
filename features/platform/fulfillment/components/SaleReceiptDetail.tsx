import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMinorUnits } from '@/features/lib/money';
import { formatMicrounits } from '@/features/lib/quantity';
import { getSaleReceipt } from '../actions/receipt';

const readable = (value: string | null | undefined) => (value || '').replaceAll('_', ' ');

/**
 * Read-only receipt. Amounts use the currency recorded on the sale itself;
 * `currencyCode` (the premises' current currency) is never applied to history.
 */
export async function SaleReceiptDetail({ saleId }: { saleId: string; currencyCode?: string | null }) {
  const result = await getSaleReceipt(saleId);
  const close = <Link href="/dashboard/platform/pos" className="text-sm underline underline-offset-4">Close receipt</Link>;
  if (result.state !== 'ok') {
    const text = result.state === 'forbidden' ? 'You do not have access to sales receipts.' : result.state === 'not_found' ? 'Receipt not found.' : 'Receipt is unavailable right now.';
    return <Card data-testid="sale-receipt-detail"><CardContent className="flex items-center justify-between gap-3 p-4"><p role="status" className="text-sm">{text}</p>{close}</CardContent></Card>;
  }
  const sale = result.sale;
  const money = (cents: number) => sale.currencyCode ? formatMinorUnits(cents, sale.currencyCode) : `${(cents / 100).toFixed(2)}`;
  return <Card data-testid="sale-receipt-detail">
    <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
      <div><CardTitle className="font-mono">{sale.receiptNumber}</CardTitle><p className="mt-1 text-sm text-muted-foreground">Finalized {new Date(sale.finalizedAt).toLocaleString()} · {readable(sale.customerCapacitySnapshot)} · policy {sale.rulePackVersion}</p>{!sale.currencyCode && <p className="mt-1 text-xs text-muted-foreground">Currency not recorded</p>}</div>
      <div className="flex items-center gap-3"><Badge variant="outline" className="capitalize">{readable(sale.status)}</Badge>{close}</div>
    </CardHeader>
    <CardContent className="space-y-4 text-sm">
      <section aria-label="Lines"><h3 className="font-medium">Lines</h3>
        <ul className="mt-2 divide-y rounded-md border">{sale.lines.map(line => <li key={line.id} className="grid gap-1 p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0"><p className="font-medium">{line.titleSnapshot}</p><p className="break-all text-xs text-muted-foreground">{line.skuSnapshot} · package {line.packageUidSnapshot} · batch {line.batchSnapshot}</p>
            <p className="text-xs text-muted-foreground">{formatMicrounits(line.quantityMicrounits, line.package?.unitOfMeasure)} · unit price {money(line.unitPriceCents)} · discount {money(line.discountCents)} · tax {money(line.taxCents)}</p></div>
          <p className="tabular-nums sm:text-right">{money(line.totalCents)}</p>
        </li>)}</ul>
        {sale.linesHasMore && <p className="mt-1 text-xs text-muted-foreground">Showing the first 100 lines.</p>}
      </section>
      <dl className="grid grid-cols-2 gap-1 sm:max-w-sm">
        <dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{money(sale.subtotalCents)}</dd>
        <dt className="text-muted-foreground">Discount</dt><dd className="tabular-nums">{money(sale.discountCents)}</dd>
        <dt className="text-muted-foreground">Tax</dt><dd className="tabular-nums">{money(sale.taxCents)}</dd>
        <dt className="font-medium">Total</dt><dd className="font-medium tabular-nums">{money(sale.totalCents)}</dd>
        <dt className="text-muted-foreground">Refunded</dt><dd className="tabular-nums">{money(sale.refundedCents)}</dd>
      </dl>
      <section aria-label="Tenders"><h3 className="font-medium">Tenders</h3>
        {sale.tenders.length ? <ul className="mt-2 space-y-1">{sale.tenders.map(tender => <li key={tender.id} className="flex justify-between gap-3"><span className="capitalize">{readable(tender.typeSnapshot)} · {readable(tender.status)}</span><span className="tabular-nums">{money(tender.amountCents)}{tender.changeCents ? ` (change ${money(tender.changeCents)})` : ''}</span></li>)}</ul> : <p className="mt-1 text-muted-foreground">No tenders recorded.</p>}
      </section>
      <section aria-label="Refunds"><h3 className="font-medium">Refunds</h3>
        {sale.refunds.length ? <ul className="mt-2 space-y-1">{sale.refunds.map(refund => <li key={refund.id} className="flex justify-between gap-3"><span>{new Date(refund.occurredAt).toLocaleString()} · {refund.reasonCode} · {readable(refund.status)}</span><span className="tabular-nums">{money(refund.amountCents)}</span></li>)}</ul> : <p className="mt-1 text-muted-foreground">No refunds.</p>}
      </section>
    </CardContent>
  </Card>;
}
