'use client';

import { useState } from 'react';
import { formatMicrounits } from '@/features/lib/quantity';
import { FieldError, fieldProps, type FieldErrors } from '@/features/platform/lib/formErrors';
import { receivePackageFromWorkbench } from '@/features/platform/workspaces/actions/workflows';
import type { WorkspaceData } from '@/features/platform/workspaces/lib/contract';
import { formatWhen, Pager, SearchForm } from '@/features/platform/operations/components/WorkspaceKit';
import { CommandStatus, useCommand } from '@/features/platform/operations/components/useCommand';
import { readable } from '@/features/platform/inventory/lib/custody';
import Link from 'next/link';
import { Actions, Button, ButtonLink, inputClass, labelClass, ListBand, Notice, Panel, Ref, SectionTitle, StatusText, statusTone, sentenceCase } from '@/features/platform/components/cannabis-ui';

type Data = WorkspaceData<'receiving'>;
type Manifest = Data['manifests']['items'][number];

function Field({ name, title, errors, hint, ...rest }: { name: string; title: string; errors?: FieldErrors; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <label className={labelClass}>{title}<input {...rest} {...fieldProps(name, errors)} className={inputClass} />{hint && <span className="mt-1 block font-normal text-muted-foreground">{hint}</span>}<FieldError name={name} errors={errors} /></label>;
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <fieldset className="grid gap-3 sm:grid-cols-2"><legend className="mb-2 text-xs font-semibold text-foreground">{title}</legend>{children}</fieldset>;
}

const manifestHasDiscrepancy = (manifest: Manifest) => manifest.status === 'partially_accepted' || manifest.status === 'rejected';

function ReceivePackageForm({ products, productsHasMore, timezone }: { products: Data['products']['items']; productsHasMore: boolean; timezone: string | null }) {
  const { state, onSubmit, pending, key, summary, markDirty } = useCommand(receivePackageFromWorkbench);
  const [productId, setProductId] = useState('');
  const product = products.find(candidate => candidate.id === productId);
  const errors = state.fieldErrors;
  if (!products.length) return <Notice tone="warn" action={<ButtonLink href="/dashboard/platform/menu" tone="primary">Add a product</ButtonLink>}>No active products</Notice>;
  return <Panel title="Receive a package" meta="Into receiving hold">
    <form onSubmit={onSubmit()} onChange={markDirty} className="space-y-5" data-testid="typed-receiving-form" aria-label="Receive a package">
      <input type="hidden" name="idempotencyKey" value={key} />
      <fieldset disabled={pending} className="space-y-5">
          <Group title="Product">
            <label className={`${labelClass} sm:col-span-2`}>Product<select {...fieldProps('productId', errors)} required value={productId} onChange={event => setProductId(event.target.value)} className={inputClass}><option value="">Select product</option>{products.map(option => <option value={option.id} key={option.id}>{option.name} · {option.sku} · {option.form} ({option.unitOfMeasure})</option>)}</select>{productsHasMore && <span className="mt-1 block font-normal text-muted-foreground">First 100 products shown</span>}<FieldError name="productId" errors={errors} /></label>
            <Field name="packageUid" title="Package UID" errors={errors} required autoComplete="off" />
            <Field name="quantity" title={`Quantity received${product ? ` (${product.unitOfMeasure})` : ''}`} errors={errors} required inputMode="decimal" placeholder="28" />
          </Group>
          <Group title="Manifest and supplier">
            <Field name="manifestNumber" title="Manifest number" errors={errors} required />
            <Field name="sourceLicenseNumber" title="Supplier license" errors={errors} required />
            <Field name="regulatorManifestId" title="State manifest ID (optional)" errors={errors} />
            <Field name="sourcePackageUid" title="Supplier package UID (optional)" errors={errors} />
          </Group>
          <Group title="Batch and label">
            <Field name="productionBatchNumber" title="Production batch" errors={errors} required />
            <Field name="lotNumber" title="Lot number" errors={errors} required />
            <Field name="expiresAt" title={`Usable through${timezone ? ` (${timezone})` : ''}`} type="date" errors={errors} required />
            <Field name="manufacturedAt" title="Manufactured date (optional)" type="date" errors={errors} />
            <Field name="labelVersion" title="Label version" errors={errors} required />
            <Field name="reasonCode" title="Reason code" errors={errors} required defaultValue="manifest_receipt" pattern="[a-z][a-z0-9_]{2,99}" />
          </Group>
          <Group title="Lab (recorded as unverified)">
            <Field name="coaReference" title="COA reference (optional)" errors={errors} />
            <Field name="labName" title="Lab name (optional)" errors={errors} />
            <Field name="labResultReference" title="Lab result reference (optional)" errors={errors} />
          </Group>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Actions><Button type="submit" tone="primary" disabled={pending}>{pending ? 'Receiving…' : 'Receive into hold'}</Button></Actions>
        <CommandStatus state={state} summary={summary} />
      </div>
    </form>
  </Panel>;
}

export function ReceivingWorkbenchClient({ data, params }: { data: Data; params: Record<string, string | undefined> }) {
  const manifests = data.manifests.items;
  const [selectedId, setSelectedId] = useState(manifests[0]?.id || '');
  const selected = manifests.find(manifest => manifest.id === selectedId) || manifests[0];
  return <div className="space-y-4 px-4 pb-28 md:px-6" data-testid="receiving-custody-workbench">
    <section aria-label="Receiving summary" className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px]">
      <Link href="/dashboard/platform/inventory?filter=receiving" className="underline-offset-4 hover:underline"><StatusText tone={data.receivingHoldTotal ? 'warn' : 'muted'}>{data.receivingHoldTotal} in receiving hold</StatusText></Link>
      <StatusText tone={data.discrepancyTotal ? 'danger' : 'muted'}>{data.discrepancyTotal} manifest{data.discrepancyTotal === 1 ? '' : 's'} with discrepancies</StatusText>
      <span className="text-muted-foreground"><span className="tabular-nums">{data.manifests.total}</span> inbound manifests</span>
    </section>
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-3">
        <SearchForm basePath="/dashboard/platform/receiving" params={params} name="productSearch" label="Find product" placeholder="Product name or SKU" />
        <ReceivePackageForm products={data.products.items} productsHasMore={Boolean(data.products.nextCursor)} timezone={data.timezone} />
      </div>
      <div className="min-w-0 space-y-4 xl:sticky xl:top-4">
        <section>
          <SectionTitle meta={data.manifests.total} action={<SearchForm basePath="/dashboard/platform/receiving" params={params} label="Search manifests" placeholder="Manifest number" />}>Inbound manifests</SectionTitle>
          <ListBand>
            <div role="listbox" aria-label="Manifests" aria-controls="manifest-detail" className="divide-y divide-border/70">{manifests.length ? manifests.map(manifest => <button type="button" role="option" aria-selected={selected?.id === manifest.id} onClick={() => setSelectedId(manifest.id)} key={manifest.id} className="grid w-full gap-1 px-3 py-2 text-left text-[13px] transition-colors hover:bg-muted/40 aria-selected:bg-muted sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline sm:gap-3">
              <span className="min-w-0"><Ref className="font-medium">{manifest.manifestNumber}</Ref><span className="block truncate text-xs text-muted-foreground">{manifest.sourceLicenseNumber || 'Supplier not recorded'} to {manifest.destinationLicenseNumber || 'destination not recorded'} · {formatWhen(manifest.occurredAt, data.timezone)}</span></span>
              <StatusText tone={manifestHasDiscrepancy(manifest) ? 'danger' : statusTone(manifest.status)}>{manifestHasDiscrepancy(manifest) ? `${sentenceCase(manifest.status)} · discrepancy` : sentenceCase(manifest.status)}</StatusText>
            </button>) : <p className="px-3 py-8 text-center text-[13px] text-muted-foreground">{params.search ? 'No manifests match.' : 'No inbound manifests yet.'}</p>}</div>
            <Pager basePath="/dashboard/platform/receiving" params={params} nextCursor={data.manifests.nextCursor} shown={manifests.length} total={data.manifests.total} noun="manifests" />
          </ListBand>
        </section>
        <Panel id="manifest-detail" data-testid="manifest-detail-drill-in" aria-label="Manifest detail" title={selected ? <span className="flex flex-wrap items-baseline gap-x-3"><Ref>{selected.manifestNumber}</Ref><StatusText tone={manifestHasDiscrepancy(selected) ? 'danger' : statusTone(selected.status)} className="text-xs">{sentenceCase(selected.status)}</StatusText></span> : 'Manifest'}>{selected ? <div className="space-y-4">
          <dl className="divide-y divide-border/70 rounded-md border border-border text-[13px]">
            {([['Type', sentenceCase(selected.type)], ['Supplier license', selected.sourceLicenseNumber], ['Destination license', selected.destinationLicenseNumber], ['State manifest ID', selected.regulatorManifestId], ['Transporter', selected.transporterReference], ['Reason code', selected.reasonCode]] as Array<[string, React.ReactNode]>).map(([term, value]) => <div key={term} className="flex items-baseline justify-between gap-4 px-3 py-1.5"><dt className="shrink-0 text-xs text-muted-foreground">{term}</dt><dd className="min-w-0 break-all text-right">{value || 'Not recorded'}</dd></div>)}
          </dl>
          <section><h3 className="text-xs font-semibold text-foreground">Packages {selected.packageEventsCount > selected.packageEvents.length && <span className="font-normal text-muted-foreground">· first {selected.packageEvents.length} of {selected.packageEventsCount}</span>}</h3>
            {selected.packageEvents.length ? <ul className="mt-2 divide-y divide-border/70 rounded-md border border-border">{selected.packageEvents.map(event => <li key={event.id} className="flex flex-wrap items-baseline justify-between gap-x-3 px-3 py-1.5 text-xs"><span><span className="font-medium">{sentenceCase(event.eventType)}</span> · <Ref>{event.package?.packageUid || 'Package not recorded'}</Ref></span><span className="tabular-nums">{formatMicrounits(event.quantityDeltaMicrounits, event.package?.unitOfMeasure)}</span></li>)}</ul> : <p className="mt-2 text-xs text-muted-foreground">No packages recorded on this manifest.</p>}</section>
          {manifestHasDiscrepancy(selected) && <Notice tone="danger">Discrepancy: keep goods segregated and record an inventory discrepancy incident.</Notice>}
        </div> : <p className="py-6 text-center text-[13px] text-muted-foreground">No manifest selected</p>}</Panel>
      </div>
    </div>
  </div>;
}
