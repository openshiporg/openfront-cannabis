import type React from 'react';
import Link from 'next/link';
import { formatMinorUnits } from '@/features/lib/money';
import { Dot, Ref, SectionTitle, StatusText, Table, TabBar, TabLink, Tabs, TEmpty, Td, Th, THead, Tr, codeLabel, sentenceCase, statusTone } from '@/features/platform/components/cannabis-ui';
import { formatWhen, Pager, SearchForm } from '@/features/platform/operations/components/WorkspaceKit';
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
  return frame('customers', '/dashboard/platform/customers', 'Customers', params, data => <div className="space-y-4 px-4 pb-28 md:px-6">
    <TabBar aside={<SearchForm basePath="/dashboard/platform/customers" params={params} label="Search customers" placeholder="Customer reference" />}>
      <Tabs label="Customer status">{FILTERS.map(item => <TabLink key={item.id} href={filterHref(item.id, params.search)} active={data.filter === item.id} count={data.counts[item.id]}>{item.id !== 'all' && <Dot tone={statusTone(item.id)} />}{item.label}</TabLink>)}</Tabs>
    </TabBar>
    <Table label="Customers" minWidth={560}>
      <THead><Th>Customer</Th><Th>Capacity</Th><Th>Since</Th><Th>Marketing</Th><Th>Status</Th></THead>
      <tbody>{data.customers.items.length ? data.customers.items.map(customer => <Tr key={customer.id}>
        <Td><Link href={`/dashboard/platform/customers/${encodeURIComponent(customer.id)}`} className="font-medium underline-offset-4 hover:underline"><Ref>{customer.reference}</Ref></Link></Td>
        <Td className="text-muted-foreground">{sentenceCase(customer.capacity)}</Td>
        <Td className="whitespace-nowrap text-muted-foreground">{formatWhen(customer.createdAt, data.timezone)}</Td>
        <Td className="text-muted-foreground">{customer.marketingConsent ? 'Consented' : '—'}</Td>
        <Td><StatusText tone={statusTone(customer.status)}>{sentenceCase(customer.status)}</StatusText></Td>
      </Tr>) : <TEmpty colSpan={5}>{params.search || data.filter !== 'all' ? 'No customers match.' : 'No customers yet.'}</TEmpty>}</tbody>
    </Table>
    <Pager basePath="/dashboard/platform/customers" params={params} nextCursor={data.customers.nextCursor} shown={data.customers.items.length} total={data.customers.total} noun="customers" />
  </div>, data => ({ tone: data.counts.pending_verification ? 'warn' : 'ok', state: data.counts.pending_verification ? `${data.counts.pending_verification} awaiting verification` : 'No one waiting' }));
}

export async function CustomerDetailPage({ params: routeParams, searchParams }: { params: Promise<{ id: string }>; searchParams?: SearchParams }) {
  const { id } = await routeParams;
  const params: Params = { ...(await readParams(searchParams)), id: decodeURIComponent(id) };
  return frame('customer', `/dashboard/platform/customers/${encodeURIComponent(id)}`, 'Customer', params, data => {
    if (!data.customer) return null;
    const customer = data.customer;
    return <div className="space-y-6 px-4 pb-28 md:px-6">
      <dl className="grid overflow-hidden rounded-[6px] border border-border bg-card text-[13px] sm:grid-cols-4">
        {([['Capacity', sentenceCase(customer.capacity)], ['Status', <StatusText key="s" tone={statusTone(customer.status)}>{sentenceCase(customer.status)}</StatusText>], ['Since', formatWhen(customer.createdAt, data.timezone)], ['Marketing consent', customer.marketingConsent ? 'Yes' : 'No']] as Array<[string, React.ReactNode]>).map(([term, value]) => <div key={term} className="border-b border-border px-3 py-2 sm:border-b-0 sm:border-r sm:last:border-r-0"><dt className="text-xs text-muted-foreground">{term}</dt><dd className="mt-0.5 font-medium">{value}</dd></div>)}
      </dl>
      <section>
        <SectionTitle meta={data.evidence.length}>Eligibility evidence</SectionTitle>
        <Table label="Eligibility evidence" minWidth={720}>
          <THead><Th>Method</Th><Th>Capacity</Th><Th>ID valid until</Th><Th>Registry</Th><Th>Verified</Th><Th>Result</Th></THead>
          <tbody>{data.evidence.length ? data.evidence.map(record => <Tr key={record.id}>
            <Td className="font-medium">{record.identityMethod}{record.reasonCodes.length ? <span className="block text-xs font-normal text-muted-foreground">{record.reasonCodes.map(codeLabel).join(', ')}</span> : null}</Td>
            <Td className="text-muted-foreground">{sentenceCase(record.capacity)}</Td>
            <Td className="whitespace-nowrap text-muted-foreground">{formatWhen(record.identityExpiresAt, data.timezone)}</Td>
            <Td className="text-muted-foreground">{record.registryName ? `${record.registryName}${record.registryExpiresAt ? ` until ${formatWhen(record.registryExpiresAt, data.timezone)}` : ''}` : '—'}</Td>
            <Td className="whitespace-nowrap text-muted-foreground">{record.verifiedAt ? formatWhen(record.verifiedAt, data.timezone) : 'Not verified'}</Td>
            <Td><StatusText tone={statusTone(record.result)}>{sentenceCase(record.result)}</StatusText></Td>
          </Tr>) : <TEmpty colSpan={6}>No eligibility evidence.</TEmpty>}</tbody>
        </Table>
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle meta={data.carts.length}>Carts</SectionTitle>
          <Table label="Carts" minWidth={420}>
            <THead><Th>Cart</Th><Th>Created</Th><Th>Status</Th><Th align="right">Total</Th></THead>
            <tbody>{data.carts.length ? data.carts.map(cart => <Tr key={cart.id}>
              <Td><Ref>{cart.reference}</Ref><span className="block text-xs text-muted-foreground">{sentenceCase(cart.source)}</span></Td>
              <Td className="whitespace-nowrap text-muted-foreground">{formatWhen(cart.createdAt, data.timezone)}</Td>
              <Td><StatusText tone={statusTone(cart.status)}>{sentenceCase(cart.status)}</StatusText></Td>
              <Td align="right">{formatMinorUnits(cart.totalCents, data.currencyCode)}</Td>
            </Tr>) : <TEmpty colSpan={4}>No carts.</TEmpty>}</tbody>
          </Table>
        </section>
        <section>
          <SectionTitle meta={data.sales.length}>Purchases</SectionTitle>
          <Table label="Purchases" minWidth={420}>
            <THead><Th>Receipt</Th><Th>Finalized</Th><Th>Status</Th><Th align="right">Total</Th></THead>
            <tbody>{data.sales.length ? data.sales.map(sale => <Tr key={sale.id}>
              <Td><Link href={`/dashboard/platform/sales/${encodeURIComponent(sale.id)}`} className="underline-offset-4 hover:underline"><Ref>{sale.receiptNumber}</Ref></Link></Td>
              <Td className="whitespace-nowrap text-muted-foreground">{formatWhen(sale.finalizedAt, data.timezone)}</Td>
              <Td><StatusText tone={statusTone(sale.status)}>{sentenceCase(sale.status)}</StatusText></Td>
              <Td align="right">{formatMinorUnits(sale.totalCents, data.currencyCode)}</Td>
            </Tr>) : <TEmpty colSpan={4}>No purchases.</TEmpty>}</tbody>
          </Table>
        </section>
      </div>
    </div>;
  }, data => data.customer ? { tone: statusTone(data.customer.status), state: sentenceCase(data.customer.status) } : { tone: 'muted', state: '' },
  { crumbs: [{ label: 'Customers', href: '/dashboard/platform/customers' }, { label: 'Customer' }], heading: data => data.customer?.reference ?? 'Customer', missing: data => !data.customer });
}
