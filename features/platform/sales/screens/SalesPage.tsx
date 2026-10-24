import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { formatMinorUnits } from '@/features/lib/money';
import { BandRow, Count, ListBand, MetricStrip, Notice, PageTitle, PillLink, SectionTitle, codeLabel, sentenceCase, statusTone, Track } from '@/features/platform/components/cannabis-ui';
import { AsOf, Empty, formatWhen, Pager, SearchForm } from '@/features/platform/operations/components/WorkspaceKit';
import { frame, readParams, type SearchParams } from '@/features/platform/operations/lib/frame';
import { SaleReceiptDetail } from '@/features/platform/fulfillment/components/SaleReceiptDetail';
import { getSaleReceipt } from '@/features/platform/fulfillment/actions/receipt';
import { getCannabisWorkspace } from '@/features/platform/workspaces/actions/workspaces';

const FILTERS = [
  { id: 'all', label: 'All' }, { id: 'finalized', label: 'Finalized' }, { id: 'reporting', label: 'State reporting' }, { id: 'reported', label: 'Reported' }, { id: 'refunds', label: 'Refunds' },
] as const;

const filterHref = (id: string, search?: string) => {
  const query = new URLSearchParams(); if (id !== 'all') query.set('filter', id); if (search) query.set('search', search);
  const text = query.toString(); return `/dashboard/platform/sales${text ? `?${text}` : ''}`;
};

export async function SalesPage({ searchParams }: { searchParams?: SearchParams }) {
  const params = await readParams(searchParams);
  return frame('sales', '/dashboard/platform/sales', 'Sales', params, data => <div className="space-y-8 px-4 pb-28 md:px-6">
    <MetricStrip items={[
      { label: 'Receipts', value: data.counts.all },
      { label: 'Awaiting state reporting', value: data.counts.reporting, tone: data.counts.reporting ? 'warn' : 'muted', href: filterHref('reporting') },
      { label: 'Refunded or reversed', value: data.counts.refunds, href: filterHref('refunds') },
    ]} />
    <Notice tone="muted">Sale completion and refunds unavailable</Notice>
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <nav aria-label="Sale status"><Track className="max-sm:flex-wrap max-sm:rounded-2xl">{FILTERS.map(item => <PillLink key={item.id} href={filterHref(item.id, params.search)} active={data.filter === item.id}>{item.label} <Count>{data.counts[item.id]}</Count></PillLink>)}</Track></nav>
      <SearchForm basePath="/dashboard/platform/sales" params={params} label="Search receipts" placeholder="Receipt number" />
    </div>
    <section>
      <SectionTitle meta={data.sales.total}>Receipts</SectionTitle>
      <ListBand>
        {data.sales.items.length ? data.sales.items.map(sale => <Link key={sale.id} href={`/dashboard/platform/sales/${encodeURIComponent(sale.id)}`} className="block transition-colors hover:bg-background/60">
          <BandRow title={<span className="font-mono">{sale.receiptNumber}</span>} tone={statusTone(sale.status)} state={sentenceCase(sale.status)}
            detail={<>{formatWhen(sale.finalizedAt, data.timezone)} · {sentenceCase(sale.customerCapacitySnapshot)} · {sale.linesCount} line{sale.linesCount === 1 ? '' : 's'}</>}
            aside={<span className="flex flex-col items-start gap-0.5 sm:items-end"><span className="font-mono">{formatMinorUnits(sale.totalCents, data.currencyCode)}</span>{sale.refundedCents > 0 && <span className="font-mono text-xs text-muted-foreground">refunded {formatMinorUnits(sale.refundedCents, data.currencyCode)}</span>}</span>} />
        </Link>) : <Empty>{params.search || data.filter !== 'all' ? 'No receipts match.' : 'No sales yet.'}</Empty>}
        <Pager basePath="/dashboard/platform/sales" params={params} nextCursor={data.sales.nextCursor} shown={data.sales.items.length} total={data.sales.total} noun="receipts" />
      </ListBand>
    </section>
    <section>
      <SectionTitle meta={data.refunds.total}>Recent refunds</SectionTitle>
      <ListBand>{data.refunds.items.length ? data.refunds.items.map(refund => <BandRow key={refund.id} title={<span className="font-mono">{refund.sale?.receiptNumber ?? 'Receipt not recorded'}</span>} tone={statusTone(refund.status)} state={sentenceCase(refund.status)}
        detail={<>{codeLabel(refund.reasonCode)} · inventory {sentenceCase(refund.inventoryDisposition).toLowerCase()} · {formatWhen(refund.occurredAt, data.timezone)}</>} aside={<span className="font-mono">{formatMinorUnits(refund.amountCents, data.currencyCode)}</span>} />) : <Empty>No refunds.</Empty>}</ListBand>
    </section>
  </div>);
}

export async function SaleDetailPage({ params: routeParams }: { params: Promise<{ id: string }> }) {
  const { id } = await routeParams;
  const saleId = decodeURIComponent(id);
  const breadcrumbs = [{ type: 'link' as const, label: 'Platform', href: '/dashboard/platform' }, { type: 'link' as const, label: 'Sales', href: '/dashboard/platform/sales' }, { type: 'page' as const, label: 'Receipt' }];
  // The receipt query is access-checked on its own; the workspace call supplies the premises zone.
  const [workspace, receipt] = await Promise.all([getCannabisWorkspace('sales', {}), getSaleReceipt(saleId)]);
  if (receipt.state === 'not_found') notFound();
  const timezone = workspace.state === 'ok' ? workspace.data.timezone : null;
  const meta = workspace.state === 'ok' ? <span className="flex flex-wrap gap-x-3"><AsOf generatedAt={workspace.data.generatedAt} timezone={workspace.data.timezone} />{workspace.data.jurisdictionCode && <span className="font-mono">{workspace.data.jurisdictionCode}</span>}</span> : undefined;
  return <PageContainer header={<PageTitle title={receipt.state === 'ok' ? receipt.sale.receiptNumber : 'Receipt'} meta={meta} />} breadcrumbs={breadcrumbs}>
    <div className="space-y-4 px-4 pb-28 md:px-6">
      <SaleReceiptDetail saleId={saleId} timezone={timezone} closeHref="/dashboard/platform/sales" closeLabel="All sales" />
    </div>
  </PageContainer>;
}
