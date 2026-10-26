import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { formatMinorUnits } from '@/features/lib/money';
import { PageTitle, Ref, SectionTitle, StatusText, Table, TabBar, TabLink, Tabs, TEmpty, Td, Th, THead, Tr, codeLabel, sentenceCase, statusTone } from '@/features/platform/components/cannabis-ui';
import { AsOf, formatWhen, Pager, SearchForm } from '@/features/platform/operations/components/WorkspaceKit';
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
  return frame('sales', '/dashboard/platform/sales', 'Sales', params, data => <div className="space-y-6 px-4 pb-28 md:px-6">
    <section className="space-y-4">
      <TabBar aside={<SearchForm basePath="/dashboard/platform/sales" params={params} label="Search receipts" placeholder="Receipt number" />}>
        <Tabs label="Sale status">{FILTERS.map(item => <TabLink key={item.id} href={filterHref(item.id, params.search)} active={data.filter === item.id} count={data.counts[item.id]}>{item.label}</TabLink>)}</Tabs>
      </TabBar>
      <Table label="Receipts" minWidth={640}>
        <THead><Th>Receipt</Th><Th>Finalized</Th><Th>Customer</Th><Th align="right">Lines</Th><Th>Status</Th><Th align="right">Total</Th></THead>
        <tbody>{data.sales.items.length ? data.sales.items.map(sale => <Tr key={sale.id}>
          <Td><Link href={`/dashboard/platform/sales/${encodeURIComponent(sale.id)}`} className="font-medium underline-offset-4 hover:underline"><Ref>{sale.receiptNumber}</Ref></Link></Td>
          <Td className="whitespace-nowrap text-muted-foreground">{formatWhen(sale.finalizedAt, data.timezone)}</Td>
          <Td className="text-muted-foreground">{sentenceCase(sale.customerCapacitySnapshot)}</Td>
          <Td align="right">{sale.linesCount}</Td>
          <Td><StatusText tone={statusTone(sale.status)}>{sentenceCase(sale.status)}</StatusText></Td>
          <Td align="right"><span className="font-medium">{formatMinorUnits(sale.totalCents, data.currencyCode)}</span>{sale.refundedCents > 0 && <span className="block text-xs text-muted-foreground">refunded {formatMinorUnits(sale.refundedCents, data.currencyCode)}</span>}</Td>
        </Tr>) : <TEmpty colSpan={6}>{params.search || data.filter !== 'all' ? 'No receipts match.' : 'No sales yet.'}</TEmpty>}</tbody>
      </Table>
      <Pager basePath="/dashboard/platform/sales" params={params} nextCursor={data.sales.nextCursor} shown={data.sales.items.length} total={data.sales.total} noun="receipts" />
    </section>
    <section>
      <SectionTitle meta={data.refunds.total}>Recent refunds</SectionTitle>
      <Table label="Recent refunds" minWidth={600}>
        <THead><Th>Receipt</Th><Th>Reason</Th><Th>Inventory</Th><Th>When</Th><Th>Status</Th><Th align="right">Amount</Th></THead>
        <tbody>{data.refunds.items.length ? data.refunds.items.map(refund => <Tr key={refund.id}>
          <Td><Ref>{refund.sale?.receiptNumber ?? 'Not recorded'}</Ref></Td>
          <Td className="text-muted-foreground">{codeLabel(refund.reasonCode)}</Td>
          <Td className="text-muted-foreground">{sentenceCase(refund.inventoryDisposition)}</Td>
          <Td className="whitespace-nowrap text-muted-foreground">{formatWhen(refund.occurredAt, data.timezone)}</Td>
          <Td><StatusText tone={statusTone(refund.status)}>{sentenceCase(refund.status)}</StatusText></Td>
          <Td align="right">{formatMinorUnits(refund.amountCents, data.currencyCode)}</Td>
        </Tr>) : <TEmpty colSpan={6}>No refunds.</TEmpty>}</tbody>
      </Table>
    </section>
  </div>, data => data.counts.reporting ? { tone: 'warn', state: `${data.counts.reporting} awaiting state reporting` } : { tone: 'ok', state: `${data.counts.all} receipts` });
}

export async function SaleDetailPage({ params: routeParams }: { params: Promise<{ id: string }> }) {
  const { id } = await routeParams;
  const saleId = decodeURIComponent(id);
  const breadcrumbs = [{ type: 'link' as const, label: 'Platform', href: '/dashboard/platform' }, { type: 'link' as const, label: 'Sales', href: '/dashboard/platform/sales' }, { type: 'page' as const, label: 'Receipt' }];
  // The receipt query is access-checked on its own; the workspace call supplies the premises zone.
  const [workspace, receipt] = await Promise.all([getCannabisWorkspace('sales', {}), getSaleReceipt(saleId)]);
  if (receipt.state === 'not_found') notFound();
  const timezone = workspace.state === 'ok' ? workspace.data.timezone : null;
  const meta = workspace.state === 'ok' ? <span className="flex flex-wrap gap-x-3"><AsOf generatedAt={workspace.data.generatedAt} timezone={workspace.data.timezone} />{workspace.data.jurisdictionCode && <span>{workspace.data.jurisdictionCode}</span>}</span> : undefined;
  return <PageContainer header={<PageTitle title={receipt.state === 'ok' ? receipt.sale.receiptNumber : 'Receipt'} meta={meta} />} breadcrumbs={breadcrumbs}>
    <div className="space-y-4 px-4 pb-28 md:px-6">
      <SaleReceiptDetail saleId={saleId} timezone={timezone} closeHref="/dashboard/platform/sales" closeLabel="All sales" refundable />
    </div>
  </PageContainer>;
}
