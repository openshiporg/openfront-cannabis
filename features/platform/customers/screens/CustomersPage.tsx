import Link from 'next/link';
import { formatMinorUnits } from '@/features/lib/money';
import { BandRow, Count, Dot, ListBand, MetricStrip, PillLink, SectionTitle, codeLabel, sentenceCase, statusTone, Track } from '@/features/platform/components/cannabis-ui';
import { Empty, formatWhen, Pager, SearchForm } from '@/features/platform/operations/components/WorkspaceKit';
import { frame, readParams, type Params, type SearchParams } from '@/features/platform/operations/lib/frame';

const FILTERS = [
  { id: 'all', label: 'All' }, { id: 'pending_verification', label: 'Awaiting verification' }, { id: 'eligible', label: 'Eligible' }, { id: 'ineligible', label: 'Ineligible' }, { id: 'suspended', label: 'Suspended' },
] as const;

const filterHref = (id: string, search?: string) => {
  const query = new URLSearchParams(); if (id !== 'all') query.set('filter', id); if (search) query.set('search', search);
  const text = query.toString(); return `/dashboard/platform/customers${text ? `?${text}` : ''}`;
};

export async function CustomersPage({ searchParams }: { searchParams?: SearchParams }) {
  const params = await readParams(searchParams);
  return frame('customers', '/dashboard/platform/customers', 'Customers', params, data => <div className="space-y-8 px-4 pb-28 md:px-6">
    <MetricStrip items={[
      { label: 'Customers', value: data.counts.all },
      { label: 'Awaiting verification', value: data.counts.pending_verification, tone: data.counts.pending_verification ? 'warn' : 'muted', href: filterHref('pending_verification') },
      { label: 'Eligible', value: data.counts.eligible, tone: 'ok', href: filterHref('eligible') },
    ]} />
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <nav aria-label="Customer status"><Track className="max-sm:flex-wrap max-sm:rounded-2xl">{FILTERS.map(item => <PillLink key={item.id} href={filterHref(item.id, params.search)} active={data.filter === item.id}>{item.id !== 'all' && <Dot tone={statusTone(item.id)} className="translate-y-0" />}{item.label} <Count>{data.counts[item.id]}</Count></PillLink>)}</Track></nav>
      <SearchForm basePath="/dashboard/platform/customers" params={params} label="Search customers" placeholder="Customer reference" />
    </div>
    <section>
      <SectionTitle meta={data.customers.total}>Customers</SectionTitle>
      <ListBand>
        {data.customers.items.length ? data.customers.items.map(customer => <Link key={customer.id} href={`/dashboard/platform/customers/${encodeURIComponent(customer.id)}`} className="block transition-colors hover:bg-background/60">
          <BandRow title={<span className="font-mono">{customer.reference}</span>} tone={statusTone(customer.status)} state={sentenceCase(customer.status)}
            detail={<>{sentenceCase(customer.capacity)} · since {formatWhen(customer.createdAt, data.timezone)}{customer.marketingConsent ? ' · marketing consent' : ''}</>} />
        </Link>) : <Empty>{params.search || data.filter !== 'all' ? 'No customers match.' : 'No customers yet.'}</Empty>}
        <Pager basePath="/dashboard/platform/customers" params={params} nextCursor={data.customers.nextCursor} shown={data.customers.items.length} total={data.customers.total} noun="customers" />
      </ListBand>
    </section>
  </div>, data => ({ tone: data.counts.pending_verification ? 'warn' : 'ok', state: data.counts.pending_verification ? `${data.counts.pending_verification} awaiting verification` : 'No one waiting' }));
}

export async function CustomerDetailPage({ params: routeParams, searchParams }: { params: Promise<{ id: string }>; searchParams?: SearchParams }) {
  const { id } = await routeParams;
  const params: Params = { ...(await readParams(searchParams)), id: decodeURIComponent(id) };
  return frame('customer', `/dashboard/platform/customers/${encodeURIComponent(id)}`, 'Customer', params, data => {
    if (!data.customer) return null;
    const customer = data.customer;
    return <div className="space-y-8 px-4 pb-28 md:px-6">
      <ListBand>
        <BandRow title="Capacity" detail={sentenceCase(customer.capacity)} />
        <BandRow title="Status" tone={statusTone(customer.status)} state={sentenceCase(customer.status)} />
        <BandRow title="Since" detail={formatWhen(customer.createdAt, data.timezone)} />
        <BandRow title="Marketing consent" detail={customer.marketingConsent ? 'Yes' : 'No'} />
      </ListBand>
      <section>
        <SectionTitle meta={data.evidence.length}>Eligibility evidence</SectionTitle>
        <ListBand>{data.evidence.length ? data.evidence.map(record => <BandRow key={record.id} title={record.identityMethod} tone={statusTone(record.result)} state={sentenceCase(record.result)}
          detail={<>{sentenceCase(record.capacity)} · ID valid until {formatWhen(record.identityExpiresAt, data.timezone)}{record.registryName ? ` · ${record.registryName}${record.registryExpiresAt ? ` until ${formatWhen(record.registryExpiresAt, data.timezone)}` : ''}` : ''} · {record.verifiedAt ? `verified ${formatWhen(record.verifiedAt, data.timezone)}` : 'not verified'}{record.reasonCodes.length ? <> · {record.reasonCodes.map(codeLabel).join(', ')}</> : null}</>} />) : <Empty>No eligibility evidence.</Empty>}</ListBand>
      </section>
      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <SectionTitle meta={data.carts.length}>Carts</SectionTitle>
          <ListBand>{data.carts.length ? data.carts.map(cart => <BandRow key={cart.id} title={<span className="font-mono">{cart.reference}</span>} tone={statusTone(cart.status)} state={sentenceCase(cart.status)} detail={`${sentenceCase(cart.source)} · ${formatWhen(cart.createdAt, data.timezone)}`} aside={<span className="font-mono">{formatMinorUnits(cart.totalCents, data.currencyCode)}</span>} />) : <Empty>No carts.</Empty>}</ListBand>
        </section>
        <section>
          <SectionTitle meta={data.sales.length}>Purchases</SectionTitle>
          <ListBand>{data.sales.length ? data.sales.map(sale => <Link key={sale.id} href={`/dashboard/platform/sales/${encodeURIComponent(sale.id)}`} className="block transition-colors hover:bg-background/60"><BandRow title={<span className="font-mono">{sale.receiptNumber}</span>} tone={statusTone(sale.status)} state={sentenceCase(sale.status)} detail={formatWhen(sale.finalizedAt, data.timezone)} aside={<span className="font-mono">{formatMinorUnits(sale.totalCents, data.currencyCode)}</span>} /></Link>) : <Empty>No purchases.</Empty>}</ListBand>
        </section>
      </div>
    </div>;
  }, data => data.customer ? { tone: statusTone(data.customer.status), state: sentenceCase(data.customer.status) } : { tone: 'muted', state: '' },
  { crumbs: [{ label: 'Customers', href: '/dashboard/platform/customers' }, { label: 'Customer' }], heading: data => data.customer?.reference ?? 'Customer', missing: data => !data.customer });
}
