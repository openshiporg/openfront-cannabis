'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatMicrounits } from '@/features/lib/quantity';
import { FieldError, fieldProps, type FieldErrors } from '@/features/platform/lib/formErrors';
import { receivePackageFromWorkbench } from '@/features/platform/workspaces/actions/workflows';
import type { WorkspaceData } from '@/features/platform/workspaces/lib/contract';
import { AsOf, formatWhen, Pager, SearchForm } from '@/features/platform/operations/components/WorkspaceKit';
import { CommandStatus, useCommand } from '@/features/platform/operations/components/useCommand';
import { readable } from '@/features/platform/inventory/lib/custody';

type Data = WorkspaceData<'receiving'>;
type Manifest = Data['manifests']['items'][number];
const input = 'mt-1 block h-9 w-full rounded-md border bg-background px-2 text-sm aria-invalid:border-destructive';

function Field({ name, title, errors, hint, ...rest }: { name: string; title: string; errors?: FieldErrors; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <label className="block text-xs font-medium">{title}<input {...rest} {...fieldProps(name, errors)} className={input} />{hint && <span className="mt-1 block font-normal text-muted-foreground">{hint}</span>}<FieldError name={name} errors={errors} /></label>;
}

const manifestHasDiscrepancy = (manifest: Manifest) => manifest.status === 'partially_accepted' || manifest.status === 'rejected';

function ReceivePackageForm({ products, productsHasMore, timezone }: { products: Data['products']['items']; productsHasMore: boolean; timezone: string | null }) {
  const { state, formAction, pending, key, summary, markDirty } = useCommand(receivePackageFromWorkbench);
  const [productId, setProductId] = useState('');
  const product = products.find(candidate => candidate.id === productId);
  const errors = state.fieldErrors;
  if (!products.length) return <div className="rounded-xl border bg-card p-4 text-sm"><p className="font-medium">No active products</p><p className="mt-1 text-muted-foreground">Add a product on the Menu page before receiving packages.</p></div>;
  return <form action={formAction} onChange={markDirty} className="space-y-4 rounded-xl border bg-card p-4" data-testid="typed-receiving-form" aria-label="Receive a package">
    <div><h2 className="font-semibold">Receive a package</h2><p className="mt-1 text-sm text-muted-foreground">Received packages go into receiving hold. Entered lab and source details are recorded as unverified.</p></div>
    <input type="hidden" name="idempotencyKey" value={key} />
    <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">
      <label className="block text-xs font-medium">Product<select {...fieldProps('productId', errors)} required value={productId} onChange={event => setProductId(event.target.value)} className={input}><option value="">Select product</option>{products.map(option => <option value={option.id} key={option.id}>{option.name} · {option.sku} · {option.form} ({option.unitOfMeasure})</option>)}</select>{productsHasMore && <span className="mt-1 block font-normal text-muted-foreground">Showing the first 100 products. Search to narrow the list.</span>}<FieldError name="productId" errors={errors} /></label>
      <Field name="packageUid" title="Package UID" errors={errors} required autoComplete="off" />
      <Field name="manifestNumber" title="Manifest number" errors={errors} required hint="Packages on the same manifest are added to it." />
      <Field name="sourceLicenseNumber" title="Supplier license" errors={errors} required />
      <Field name="regulatorManifestId" title="State manifest ID (optional)" errors={errors} />
      <Field name="sourcePackageUid" title="Supplier package UID (optional)" errors={errors} />
      <Field name="productionBatchNumber" title="Production batch" errors={errors} required />
      <Field name="lotNumber" title="Lot number" errors={errors} required />
      <Field name="quantity" title={`Quantity received${product ? ` (${product.unitOfMeasure})` : ''}`} errors={errors} required inputMode="decimal" placeholder="28" hint="Up to 6 decimal places." />
      <Field name="expiresAt" title="Expiry date" type="date" errors={errors} required hint={`Usable through this date${timezone ? ` (${timezone})` : ''}; expires at the start of the next day.`} />
      <Field name="manufacturedAt" title="Manufactured date (optional)" type="date" errors={errors} />
      <Field name="labelVersion" title="Label version" errors={errors} required />
      <Field name="coaReference" title="COA reference (optional)" errors={errors} />
      <Field name="labName" title="Lab name (optional)" errors={errors} />
      <Field name="labResultReference" title="Lab result reference (optional)" errors={errors} />
      <Field name="reasonCode" title="Reason code" errors={errors} required defaultValue="manifest_receipt" pattern="[a-z][a-z0-9_]{2,99}" />
    </fieldset>
    <Button type="submit" disabled={pending}>{pending ? 'Receiving…' : 'Receive into hold'}</Button>
    <CommandStatus state={state} summary={summary} />
  </form>;
}

export function ReceivingWorkbenchClient({ data, params }: { data: Data; params: Record<string, string | undefined> }) {
  const manifests = data.manifests.items;
  const [selectedId, setSelectedId] = useState(manifests[0]?.id || '');
  const selected = manifests.find(manifest => manifest.id === selectedId) || manifests[0];
  return <div className="space-y-4 p-4 md:p-6" data-testid="receiving-custody-workbench">
    <AsOf generatedAt={data.generatedAt} timezone={data.timezone} />
    <section className="grid gap-3 sm:grid-cols-3" aria-label="Receiving summary">
      {[{ label: 'Packages in receiving hold', value: data.receivingHoldTotal }, { label: 'Manifests with discrepancies', value: data.discrepancyTotal }, { label: 'Inbound manifests', value: data.manifests.total }].map(metric => <div key={metric.label} className="rounded-lg border bg-card p-4"><p className="text-2xl font-semibold tabular-nums">{metric.value}</p><p className="text-xs text-muted-foreground">{metric.label}</p></div>)}
    </section>
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_25rem]">
      <div className="space-y-4">
        <SearchForm basePath="/dashboard/platform/receiving" params={params} name="productSearch" label="Find product" placeholder="Name or SKU" />
        <ReceivePackageForm products={data.products.items} productsHasMore={Boolean(data.products.nextCursor)} timezone={data.timezone} />
        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="space-y-2 border-b px-4 py-3"><h2 className="font-semibold">Inbound manifests</h2><SearchForm basePath="/dashboard/platform/receiving" params={params} label="Search manifests" placeholder="Manifest number" /></div>
          <div role="listbox" aria-label="Manifests" aria-controls="manifest-detail" className="divide-y">{manifests.length ? manifests.map(manifest => <button type="button" role="option" aria-selected={selected?.id === manifest.id} onClick={() => setSelectedId(manifest.id)} key={manifest.id} className={`grid w-full grid-cols-[minmax(0,1fr)_auto] gap-4 p-4 text-left hover:bg-muted/70 ${selected?.id === manifest.id ? 'bg-muted ring-1 ring-inset ring-ring' : ''}`}><div className="min-w-0"><p className="truncate font-mono text-sm font-medium">{manifest.manifestNumber}</p><p className="mt-1 text-xs text-muted-foreground">{manifest.sourceLicenseNumber || 'Supplier not recorded'} → {manifest.destinationLicenseNumber || 'Destination not recorded'} · {formatWhen(manifest.occurredAt, data.timezone)}</p></div><Badge variant="outline" className="capitalize">{manifestHasDiscrepancy(manifest) ? `${readable(manifest.status)} · discrepancy` : readable(manifest.status)}</Badge></button>) : <p className="p-8 text-center text-sm text-muted-foreground">{params.search ? 'No manifests match.' : 'No inbound manifests yet.'}</p>}</div>
          <Pager basePath="/dashboard/platform/receiving" params={params} nextCursor={data.manifests.nextCursor} shown={manifests.length} total={data.manifests.total} noun="manifests" />
        </section>
      </div>
      <aside id="manifest-detail" className="min-w-0 rounded-xl border bg-card p-4" data-testid="manifest-detail-drill-in" aria-label="Manifest detail">{selected ? <>
        <div className="flex items-start justify-between gap-3"><h2 className="break-all font-mono text-base font-semibold">{selected.manifestNumber}</h2><Badge variant="outline" className="capitalize">{readable(selected.status)}</Badge></div>
        <dl className="mt-4 space-y-3 border-y py-3 text-sm">
          <div><dt className="text-muted-foreground">Type</dt><dd className="capitalize">{readable(selected.type)}</dd></div>
          <div><dt className="text-muted-foreground">Supplier license</dt><dd className="break-all">{selected.sourceLicenseNumber || 'Not recorded'}</dd></div>
          <div><dt className="text-muted-foreground">Destination license</dt><dd className="break-all">{selected.destinationLicenseNumber || 'Not recorded'}</dd></div>
          <div><dt className="text-muted-foreground">State manifest ID</dt><dd className="break-all">{selected.regulatorManifestId || 'Not recorded'}</dd></div>
          <div><dt className="text-muted-foreground">Transporter</dt><dd>{selected.transporterReference || 'Not recorded'}</dd></div>
          <div><dt className="text-muted-foreground">Reason code</dt><dd>{selected.reasonCode}</dd></div>
        </dl>
        <section className="mt-4"><h3 className="text-sm font-semibold">Packages{selected.packageEventsCount > selected.packageEvents.length ? ` (first ${selected.packageEvents.length} of ${selected.packageEventsCount})` : ''}</h3>{selected.packageEvents.length ? <ul className="mt-2 space-y-2">{selected.packageEvents.map(event => <li key={event.id} className="rounded-md bg-muted p-2 text-xs"><span className="font-medium capitalize">{readable(event.eventType)}</span><span className="text-muted-foreground"> · {event.package?.packageUid || 'Package not recorded'} · {formatMicrounits(event.quantityDeltaMicrounits, event.package?.unitOfMeasure)}</span></li>)}</ul> : <p className="mt-2 text-xs text-muted-foreground">No packages recorded on this manifest.</p>}</section>
        {manifestHasDiscrepancy(selected) && <p role="status" className="mt-4 rounded-md border p-3 text-xs">This manifest has a discrepancy. Keep the goods segregated and record an inventory discrepancy incident.</p>}
      </> : <p className="p-6 text-sm text-muted-foreground">Select a manifest.</p>}</aside>
    </div>
  </div>;
}
