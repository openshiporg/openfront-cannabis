import { formatMinorUnits } from '@/features/lib/money';
import { formatMicrounits } from '@/features/lib/quantity';
import { Dot, DotLabel, Panel, PillLink, statusTone, Track, codeLabel, sentenceCase } from '@/features/platform/components/cannabis-ui';
import { getSaleReceipt } from '../actions/receipt';
import { formatInstant } from '@/features/platform/lib/time';

const readable = (value: string | null | undefined) => (value || '').replaceAll('_', ' ');

/**
 * Read-only receipt. Amounts use the currency recorded on the sale itself;
 * `currencyCode` (the premises' current currency) is never applied to history.
 */
export async function SaleReceiptDetail({ saleId, timezone, closeHref = '/dashboard/platform/pos', closeLabel = 'Close receipt' }: { saleId: string; currencyCode?: string | null; timezone?: string | null; closeHref?: string; closeLabel?: string }) {
  const result = await getSaleReceipt(saleId);
  const close = <Track><PillLink href={closeHref}>{closeLabel}</PillLink></Track>;
  if (result.state !== 'ok') {
    const text = result.state === 'forbidden' ? 'You do not have access to sales receipts.' : result.state === 'not_found' ? 'Receipt not found.' : 'Receipt is unavailable right now.';
    return <Panel data-testid="sale-receipt-detail"><div className="flex flex-wrap items-center justify-between gap-3"><p role="status" className="flex items-baseline gap-2 text-sm"><Dot tone={result.state === 'unavailable' ? 'danger' : 'warn'} />{text}</p>{close}</div></Panel>;
  }
  const sale = result.sale;
  const money = (cents: number) => sale.currencyCode ? formatMinorUnits(cents, sale.currencyCode) : `${(cents / 100).toFixed(2)}`;
  const totals: Array<[string, number, boolean?]> = [['Subtotal', sale.subtotalCents], ['Discount', sale.discountCents], ['Tax', sale.taxCents], ['Total', sale.totalCents, true], ['Refunded', sale.refundedCents]];
  return <Panel data-testid="sale-receipt-detail">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><h2 className="font-mono text-base font-semibold">{sale.receiptNumber}</h2><DotLabel tone={statusTone(sale.status)} className="text-xs text-muted-foreground">{sentenceCase(sale.status)}</DotLabel></div>
        <p className="mt-0.5 text-xs text-muted-foreground">Finalized {formatInstant(sale.finalizedAt, timezone)} · <span >{sentenceCase(sale.customerCapacitySnapshot)}</span> · policy <span className="font-mono">{sale.rulePackVersion}</span>{!sale.currencyCode && ' · currency not recorded'}</p>
      </div>
      {close}
    </div>
    <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <section aria-label="Lines">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Lines</h3>
        <ul className="mt-2 divide-y divide-border overflow-hidden rounded-lg bg-muted/40 ring-1 ring-inset ring-border/60">{sale.lines.map(line => <li key={line.id} className="grid gap-1 px-3 py-2.5 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline">
          <div className="min-w-0"><p className="font-medium">{line.titleSnapshot}</p><p className="break-all font-mono text-xs text-muted-foreground">{line.skuSnapshot} · {line.packageUidSnapshot} · {line.batchSnapshot}</p>
            <p className="text-xs text-muted-foreground"><span className="font-mono">{formatMicrounits(line.quantityMicrounits, line.package?.unitOfMeasure)}</span> · unit <span className="font-mono">{money(line.unitPriceCents)}</span> · discount <span className="font-mono">{money(line.discountCents)}</span> · tax <span className="font-mono">{money(line.taxCents)}</span></p></div>
          <p className="font-mono sm:text-right">{money(line.totalCents)}</p>
        </li>)}</ul>
        {sale.linesHasMore && <p className="mt-1 text-xs text-muted-foreground">First 100 lines shown</p>}
      </section>
      <div className="space-y-5">
        <dl className="space-y-1 rounded-lg bg-muted/40 p-3 text-sm ring-1 ring-inset ring-border/60">{totals.map(([term, cents, strong]) => <div key={term} className={`flex items-baseline justify-between gap-4 ${strong ? 'border-y border-border py-1.5 font-semibold' : ''}`}><dt className={strong ? '' : 'text-muted-foreground'}>{term}</dt><dd className="font-mono">{money(cents)}</dd></div>)}</dl>
        <section aria-label="Tenders"><h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Tenders</h3>
          {sale.tenders.length ? <ul className="mt-2 space-y-1 text-sm">{sale.tenders.map(tender => <li key={tender.id} className="flex items-baseline justify-between gap-3"><DotLabel tone={statusTone(tender.status)} >{sentenceCase(tender.typeSnapshot)} · {sentenceCase(tender.status)}</DotLabel><span className="font-mono">{money(tender.amountCents)}{tender.changeCents ? ` (change ${money(tender.changeCents)})` : ''}</span></li>)}</ul> : <p className="mt-1 text-sm text-muted-foreground">No tenders recorded.</p>}
        </section>
        <section aria-label="Refunds"><h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Refunds</h3>
          {sale.refunds.length ? <ul className="mt-2 space-y-1 text-sm">{sale.refunds.map(refund => <li key={refund.id} className="flex items-baseline justify-between gap-3"><span className="min-w-0 text-xs">{formatInstant(refund.occurredAt, timezone)} · {codeLabel(refund.reasonCode)} · {readable(refund.status)}</span><span className="font-mono">{money(refund.amountCents)}</span></li>)}</ul> : <p className="mt-1 text-sm text-muted-foreground">No refunds.</p>}
        </section>
      </div>
    </div>
  </Panel>;
}
