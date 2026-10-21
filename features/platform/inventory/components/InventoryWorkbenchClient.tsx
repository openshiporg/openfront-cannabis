'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { formatMicrounits } from '@/features/lib/quantity';
import type { WorkspaceData } from '@/features/platform/workspaces/lib/contract';
import { AsOf, formatWhen, Pager, SearchForm } from '@/features/platform/operations/components/WorkspaceKit';
import { hasDiscrepancy, readable, readinessReasons, type CustodyPackage } from '../lib/custody';

type Props = { data: WorkspaceData<'inventory'>; params: Record<string, string | undefined> };
const FILTERS: Array<{ id: keyof WorkspaceData<'inventory'>['counts']; label: string }> = [
  { id: 'all', label: 'All' }, { id: 'ready', label: 'Ready to sell' }, { id: 'receiving', label: 'Receiving' }, { id: 'held', label: 'Held or recalled' }, { id: 'closed', label: 'Depleted or destroyed' },
];

function Quantity({ pkg }: { pkg: CustodyPackage }) {
  if (pkg.balance.state === 'discrepancy') return <span className="font-medium text-destructive">Balance discrepancy</span>;
  return <span className="tabular-nums">{formatMicrounits(pkg.balance.availableMicrounits, pkg.unitOfMeasure)} <span className="text-muted-foreground">free of {formatMicrounits(pkg.balance.onHandMicrounits, pkg.unitOfMeasure)}</span></span>;
}

function PackageDetail({ pkg, release, timezone }: { pkg: CustodyPackage; release: WorkspaceData<'inventory'>['actions']['release']; timezone: string | null }) {
  const reasons = readinessReasons(pkg);
  return <aside id="package-detail" className="min-w-0 space-y-4 rounded-xl border bg-card p-4" aria-label={`Package ${pkg.packageUid}`} data-testid="package-detail-drill-in">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-all font-mono text-base font-semibold">{pkg.packageUid}</h2><p className="mt-1 text-sm text-muted-foreground">{pkg.product ? `${pkg.product.name} · ${pkg.product.sku}` : 'Product not recorded'} · Lot {pkg.lotNumber}</p></div><Badge variant="outline" className="capitalize">{readable(pkg.status)}</Badge></div>
    <dl className="grid grid-cols-2 gap-x-3 gap-y-3 border-y py-3 text-sm">
      <div><dt className="text-muted-foreground">Quantity</dt><dd><Quantity pkg={pkg} /></dd></div>
      <div><dt className="text-muted-foreground">Lab result</dt><dd className="capitalize">{readable(pkg.testStatus)}</dd></div>
      <div><dt className="text-muted-foreground">Batch</dt><dd className="break-all">{pkg.productionBatchNumber}</dd></div>
      <div><dt className="text-muted-foreground">Expires</dt><dd>{formatWhen(pkg.expiresAt, timezone)}</dd></div>
      <div><dt className="text-muted-foreground">COA reference</dt><dd className="break-all">{pkg.coaReference || 'Not recorded'}</dd></div>
      <div><dt className="text-muted-foreground">Source package</dt><dd className="break-all">{pkg.sourcePackageUid || 'Not recorded'}</dd></div>
    </dl>
    {pkg.balance.state === 'discrepancy' && <p role="alert" className="text-sm text-destructive">On-hand and reserved quantities don’t reconcile ({String(pkg.quantityOnHandMicrounits)} on hand, {String(pkg.reservedMicrounits)} reserved, stored microunits). Record an inventory discrepancy incident.</p>}
    <section><h3 className="text-sm font-semibold">Ready to sell</h3>{pkg.readiness.ready ? <p className="mt-1 text-sm">Yes</p> : <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">{reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>}
      {!pkg.readiness.ready && pkg.status === 'receiving_hold' && !release.available && <p className="mt-2 text-xs text-muted-foreground">{release.reason}</p>}
    </section>
    <section><h3 className="text-sm font-semibold">Active holds{pkg.holdsCount > pkg.holds.length ? ` (latest ${pkg.holds.length} of ${pkg.holdsCount})` : ''}</h3>{pkg.holds.length ? <ul className="mt-2 space-y-2">{pkg.holds.map(hold => <li key={hold.id} className="rounded-md border p-2 text-xs"><p className="font-medium capitalize">{readable(hold.type)} · {hold.reasonCode}</p>{hold.reason && <p className="mt-1 text-muted-foreground">{hold.reason}</p>}</li>)}</ul> : <p className="mt-1 text-xs text-muted-foreground">No active holds.</p>}</section>
    <section><h3 className="text-sm font-semibold">History{pkg.eventsCount > pkg.events.length ? ` (latest ${pkg.events.length} of ${pkg.eventsCount})` : ''}</h3><ol className="mt-2 space-y-3 border-l pl-3">{pkg.events.length ? pkg.events.map(event => <li key={event.id} className="text-xs"><p className="font-medium capitalize">{readable(event.eventType)} · {event.quantityDeltaMicrounits >= 0 ? '+' : ''}{formatMicrounits(event.quantityDeltaMicrounits, pkg.unitOfMeasure)}</p><p className="mt-1 text-muted-foreground">{formatWhen(event.occurredAt, timezone)} · {event.manifest?.manifestNumber || 'No manifest'} · state report {readable(event.stateReportStatus)}</p></li>) : <li className="text-xs text-muted-foreground">No events recorded.</li>}</ol>
      {pkg.eventsCount > pkg.events.length && <Link className="mt-2 inline-block text-xs underline" href={`/dashboard/inventory-events`}>All inventory events</Link>}
    </section>
  </aside>;
}

export function InventoryWorkbenchClient({ data, params }: Props) {
  const packages = data.packages.items;
  const [selectedId, setSelectedId] = useState(packages[0]?.id || '');
  const selected = packages.find(pkg => pkg.id === selectedId) ?? packages[0];
  const filterHref = (id: string) => { const query = new URLSearchParams(); if (id !== 'all') query.set('filter', id); if (params.search) query.set('search', params.search); const text = query.toString(); return `/dashboard/platform/inventory${text ? `?${text}` : ''}`; };
  return <div className="space-y-4 p-4 md:p-6" data-testid="inventory-custody-workbench">
    <AsOf generatedAt={data.generatedAt} timezone={data.timezone} />
    <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Package filters">{FILTERS.map(item => <Link key={item.id} href={filterHref(item.id)} aria-current={data.filter === item.id ? 'page' : undefined} className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${data.filter === item.id ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}>{item.label} <span className="ml-1 tabular-nums opacity-70">{data.counts[item.id]}</span></Link>)}</nav>
    <SearchForm basePath="/dashboard/platform/inventory" params={params} label="Search packages" placeholder="Package UID, lot or product" />
    <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_25rem]">
      <div className="overflow-hidden rounded-xl border bg-card">
        <div role="listbox" aria-label="Packages" aria-controls="package-detail" className="divide-y">{packages.length ? packages.map(pkg => <button type="button" role="option" aria-selected={selected?.id === pkg.id} key={pkg.id} onClick={() => setSelectedId(pkg.id)} className={`grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 p-4 text-left hover:bg-muted/70 sm:grid-cols-[minmax(0,1.5fr)_minmax(8rem,1fr)_minmax(10rem,1fr)] ${selected?.id === pkg.id ? 'bg-muted ring-1 ring-inset ring-ring' : ''}`}>
          <div className="min-w-0"><p className="truncate font-mono text-sm font-medium">{pkg.packageUid}</p><p className="mt-1 truncate text-xs text-muted-foreground">{pkg.product?.name || 'Product not recorded'} · Lot {pkg.lotNumber}</p></div>
          <div><Badge variant="outline" className="capitalize">{readable(pkg.status)}</Badge><p className="mt-1 text-xs text-muted-foreground">{pkg.readiness.ready ? 'Ready to sell' : hasDiscrepancy(pkg) ? 'Discrepancy' : 'Not ready'}</p></div>
          <div className="col-span-2 text-sm sm:col-span-1"><Quantity pkg={pkg} /></div>
        </button>) : <p className="p-10 text-center text-sm text-muted-foreground">{params.search || data.filter !== 'all' ? 'No packages match.' : 'No packages yet. Receive one on the Receiving page.'}</p>}</div>
        <Pager basePath="/dashboard/platform/inventory" params={params} nextCursor={data.packages.nextCursor} shown={packages.length} total={data.packages.total} noun="packages" />
      </div>
      {selected ? <PackageDetail pkg={selected} release={data.actions.release} timezone={data.timezone} /> : <aside className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Select a package.</aside>}
    </section>
  </div>;
}
