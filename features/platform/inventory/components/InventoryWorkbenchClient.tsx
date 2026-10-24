'use client';

import { useState } from 'react';
import { formatMicrounits } from '@/features/lib/quantity';
import type { WorkspaceData } from '@/features/platform/workspaces/lib/contract';
import { formatUsableThrough, formatWhen, Pager, SearchForm } from '@/features/platform/operations/components/WorkspaceKit';
import { Count, Dot, DotLabel, ListBand, MetricStrip, Panel, PillLink, SectionTitle, statusTone, Track, type DotTone, sentenceCase } from '@/features/platform/components/cannabis-ui';
import { hasDiscrepancy, readable, readinessReasons, type CustodyPackage } from '../lib/custody';

type Props = { data: WorkspaceData<'inventory'>; params: Record<string, string | undefined> };
const FILTERS: Array<{ id: keyof WorkspaceData<'inventory'>['counts']; label: string; tone?: DotTone }> = [
  { id: 'all', label: 'All' }, { id: 'ready', label: 'Ready to sell', tone: 'ok' }, { id: 'receiving', label: 'Receiving', tone: 'warn' }, { id: 'held', label: 'Held or recalled', tone: 'danger' }, { id: 'closed', label: 'Depleted or destroyed', tone: 'muted' },
];

function packageTone(pkg: CustodyPackage): DotTone {
  if (hasDiscrepancy(pkg)) return 'danger';
  if (pkg.readiness.ready) return 'ok';
  return statusTone(pkg.status);
}

function Quantity({ pkg }: { pkg: CustodyPackage }) {
  if (pkg.balance.state === 'discrepancy') return <span className="font-medium text-destructive">Balance discrepancy</span>;
  return <span className="font-mono tabular-nums">{formatMicrounits(pkg.balance.availableMicrounits, pkg.unitOfMeasure)} <span className="font-sans text-muted-foreground">free of</span> {formatMicrounits(pkg.balance.onHandMicrounits, pkg.unitOfMeasure)}</span>;
}

function PackageDetail({ pkg, release, timezone }: { pkg: CustodyPackage; release: WorkspaceData<'inventory'>['actions']['release']; timezone: string | null }) {
  const reasons = readinessReasons(pkg);
  return <Panel id="package-detail" aria-label={`Package ${pkg.packageUid}`} data-testid="package-detail-drill-in" className="space-y-5 xl:sticky xl:top-4">
    <div className="min-w-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><h2 className="break-all font-mono text-base font-semibold">{pkg.packageUid}</h2><DotLabel tone={packageTone(pkg)} className="text-xs text-muted-foreground">{sentenceCase(pkg.status)}</DotLabel></div>
      <p className="mt-1 text-sm text-muted-foreground">{pkg.product ? <>{pkg.product.name} · <span className="font-mono">{pkg.product.sku}</span></> : 'Product not recorded'} · Lot <span className="font-mono">{pkg.lotNumber}</span></p>
    </div>
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-muted/40 p-3 text-sm ring-1 ring-inset ring-border/60">
      <div className="col-span-2"><dt className="text-xs text-muted-foreground">Quantity</dt><dd className="mt-0.5"><Quantity pkg={pkg} /></dd></div>
      <div><dt className="text-xs text-muted-foreground">Lab result</dt><dd className="mt-0.5"><DotLabel tone={statusTone(pkg.testStatus)} >{sentenceCase(pkg.testStatus)}</DotLabel></dd></div>
      <div><dt className="text-xs text-muted-foreground">Usable through</dt><dd className="mt-0.5">{formatUsableThrough(pkg.expiresAt, timezone)}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Batch</dt><dd className="mt-0.5 break-all font-mono text-xs">{pkg.productionBatchNumber}</dd></div>
      <div><dt className="text-xs text-muted-foreground">COA reference</dt><dd className="mt-0.5 break-all font-mono text-xs">{pkg.coaReference || 'Not recorded'}</dd></div>
      <div className="col-span-2"><dt className="text-xs text-muted-foreground">Source package</dt><dd className="mt-0.5 break-all font-mono text-xs">{pkg.sourcePackageUid || 'Not recorded'}</dd></div>
    </dl>
    {pkg.balance.state === 'discrepancy' && <p role="alert" className="flex items-baseline gap-2 text-sm text-destructive"><Dot tone="danger" />On-hand and reserved quantities don’t reconcile ({String(pkg.quantityOnHandMicrounits)} on hand, {String(pkg.reservedMicrounits)} reserved, stored microunits). Record an inventory discrepancy incident.</p>}
    <section>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Ready to sell</h3>
      {pkg.readiness.ready ? <p className="mt-1.5"><DotLabel tone="ok" className="text-sm">Ready</DotLabel></p> : <ul className="mt-1.5 space-y-1 text-sm">{reasons.map(reason => <li key={reason} className="flex items-baseline gap-2"><Dot tone="warn" />{reason}</li>)}</ul>}
      {!pkg.readiness.ready && pkg.status === 'receiving_hold' && !release.available && <p className="mt-2 text-xs text-muted-foreground">{release.reason}</p>}
    </section>
    <section>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Active holds {pkg.holdsCount > pkg.holds.length && <span className="font-mono normal-case tracking-normal">· latest {pkg.holds.length} of {pkg.holdsCount}</span>}</h3>
      {pkg.holds.length ? <ul className="mt-1.5 space-y-2">{pkg.holds.map(hold => <li key={hold.id} className="text-sm"><DotLabel tone="danger" >{sentenceCase(hold.type)} · <span className="font-mono normal-case">{hold.reasonCode}</span></DotLabel>{hold.reason && <p className="mt-0.5 pl-3.5 text-xs text-muted-foreground">{hold.reason}</p>}</li>)}</ul> : <p className="mt-1.5 text-sm text-muted-foreground">No active holds.</p>}
    </section>
    <section>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">History {pkg.eventsCount > pkg.events.length && <span className="font-mono normal-case tracking-normal">· latest {pkg.events.length} of {pkg.eventsCount}</span>}</h3>
      <ol className="mt-2 space-y-3 border-l border-border pl-3">{pkg.events.length ? pkg.events.map(event => <li key={event.id} className="text-xs">
        <p className="flex flex-wrap items-baseline gap-x-2"><span className="font-medium text-foreground">{sentenceCase(event.eventType)}</span><span className="font-mono">{event.quantityDeltaMicrounits >= 0 ? '+' : ''}{formatMicrounits(event.quantityDeltaMicrounits, pkg.unitOfMeasure)}</span></p>
        <p className="mt-0.5 text-muted-foreground">{formatWhen(event.occurredAt, timezone)} · <span className="font-mono">{event.manifest?.manifestNumber || 'No manifest'}</span> · state report {readable(event.stateReportStatus)}</p>
      </li>) : <li className="text-xs text-muted-foreground">No events recorded.</li>}</ol>
      {pkg.eventsCount > pkg.events.length && <Track className="mt-3"><PillLink href="/dashboard/inventory-events">All inventory events</PillLink></Track>}
    </section>
  </Panel>;
}

export function InventoryWorkbenchClient({ data, params }: Props) {
  const packages = data.packages.items;
  const [selectedId, setSelectedId] = useState(packages[0]?.id || '');
  const selected = packages.find(pkg => pkg.id === selectedId) ?? packages[0];
  const filterHref = (id: string) => { const query = new URLSearchParams(); if (id !== 'all') query.set('filter', id); if (params.search) query.set('search', params.search); const text = query.toString(); return `/dashboard/platform/inventory${text ? `?${text}` : ''}`; };
  return <div className="space-y-8 px-4 pb-28 md:px-6" data-testid="inventory-custody-workbench">
    <MetricStrip items={[
      { label: 'Ready to sell', value: data.counts.ready, href: filterHref('ready'), tone: 'ok' },
      { label: 'Receiving hold', value: data.counts.receiving, href: filterHref('receiving'), tone: data.counts.receiving ? 'warn' : 'muted' },
      { label: 'Held or recalled', value: data.counts.held, href: filterHref('held'), tone: data.counts.held ? 'danger' : 'muted' },
    ]} />
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <nav aria-label="Package filters"><Track className="max-sm:flex-wrap max-sm:rounded-2xl">{FILTERS.map(item => <PillLink key={item.id} href={filterHref(item.id)} active={data.filter === item.id}>{item.tone && <Dot tone={item.tone} className="translate-y-0" />}{item.label} <Count>{data.counts[item.id]}</Count></PillLink>)}</Track></nav>
      <SearchForm basePath="/dashboard/platform/inventory" params={params} label="Search packages" placeholder="Package UID, lot or product" />
    </div>
    <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
      <div className="min-w-0">
        <SectionTitle meta={data.packages.total}>Packages</SectionTitle>
        <ListBand>
          <div role="listbox" aria-label="Packages" aria-controls="package-detail" className="divide-y divide-border">{packages.length ? packages.map(pkg => <button type="button" role="option" aria-selected={selected?.id === pkg.id} key={pkg.id} onClick={() => setSelectedId(pkg.id)} className="grid w-full gap-1.5 px-4 py-3 text-left transition-colors hover:bg-background/60 aria-selected:bg-background aria-selected:shadow-[inset_3px_0_0_var(--color-foreground)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline sm:gap-4">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5"><span className="truncate font-mono text-sm font-medium">{pkg.packageUid}</span><DotLabel tone={packageTone(pkg)} className="text-xs text-muted-foreground">{pkg.readiness.ready ? 'Ready to sell' : hasDiscrepancy(pkg) ? 'Discrepancy' : <span >{sentenceCase(pkg.status)}</span>}</DotLabel></div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{pkg.product?.name || 'Product not recorded'} · Lot <span className="font-mono">{pkg.lotNumber}</span></p>
            </div>
            <div className="text-xs sm:text-right"><Quantity pkg={pkg} /></div>
          </button>) : <p className="px-4 py-10 text-center text-sm text-muted-foreground">{params.search || data.filter !== 'all' ? 'No packages match.' : 'No packages yet.'}</p>}</div>
          <Pager basePath="/dashboard/platform/inventory" params={params} nextCursor={data.packages.nextCursor} shown={packages.length} total={data.packages.total} noun="packages" />
        </ListBand>
      </div>
      {selected ? <PackageDetail pkg={selected} release={data.actions.release} timezone={data.timezone} /> : <aside className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No package selected</aside>}
    </section>
    {!packages.length && !params.search && data.filter === 'all' && <Track><PillLink href="/dashboard/platform/receiving" active>Receive a package</PillLink></Track>}
  </div>;
}
