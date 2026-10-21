import Link from 'next/link';
import type React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { formatMinorUnits } from '@/features/lib/money';
import { formatMicrounits } from '@/features/lib/quantity';
import { getCannabisWorkspace, type WorkspaceOptions } from '@/features/platform/workspaces/actions/workspaces';
import type { CannabisWorkspaceResult } from '@/features/platform/workspaces/lib/boundary';
import type { WorkspaceData, WorkspaceSection } from '@/features/platform/workspaces/lib/contract';
import { CartPreparationClient } from '@/features/platform/fulfillment/components/CartPreparationClient';
import { SaleReceiptDetail } from '@/features/platform/fulfillment/components/SaleReceiptDetail';
import { AsOf, Empty, formatWhen, Metric, Pager, readable, SearchForm, Status, Workboard, WorkspaceStateNotice } from '../components/WorkspaceKit';
import { AmendProductForm, ApproveVarianceForm, IncidentTransitionForm, NewProductForm, OpenShiftForm, ProvisionStaffForm, RecordIncidentForm, RegisterForm, RegisterStatusForm, RenewAuthorityForm, RetryOutboxButton, RevokeCredentialForm } from '../components/OperatorForms';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type Params = Record<string, string | undefined>;

async function readParams(searchParams?: SearchParams): Promise<Params> {
  const raw = (await searchParams) || {};
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
}

async function frame<S extends WorkspaceSection>(section: S, path: string, title: string, params: Params, render: (data: WorkspaceData<S>) => React.ReactNode) {
  const options: WorkspaceOptions = { cursor: params.cursor, search: params.search, filter: params.filter, productSearch: params.productSearch };
  const result: CannabisWorkspaceResult<WorkspaceData<S>> = await getCannabisWorkspace(section, options);
  const header = <h1 className="text-xl font-semibold">{title}</h1>;
  const breadcrumbs = [{ type: 'link' as const, label: 'Platform', href: '/dashboard/platform' }, { type: 'page' as const, label: title }];
  return <PageContainer header={header} breadcrumbs={breadcrumbs}>{result.state === 'ok' ? render(result.data) : <WorkspaceStateNotice result={result} retryHref={path} />}</PageContainer>;
}

function OperatingNotice({ operating }: { operating: { open: boolean; reason: string | null } }) {
  if (operating.open) return null;
  return <p role="status" className="rounded-md border bg-muted/40 p-3 text-sm">Operating authority is not current: {operating.reason}. Records are shown for review; changes are unavailable until it is renewed.</p>;
}

const INTERVAL_LABEL: Record<string, string> = { current: 'Current', expiring_soon: 'Expires within 30 days', expired: 'Expired', not_yet_effective: 'Not yet effective', inactive: 'Inactive' };
const NOTIFICATION_LABEL: Record<string, string> = { none: 'No deadline', overdue: 'Notification overdue', due_soon: 'Due within 24 hours', upcoming: 'Upcoming deadline', resolved: 'Resolved', unknown: 'Deadline unknown' };

export async function ControlRoomPage({ searchParams }: { searchParams?: SearchParams }) {
  const params = await readParams(searchParams);
  return frame('overview', '/dashboard/platform', 'Control room', params, data => <Workboard>
    <AsOf generatedAt={data.generatedAt} timezone={data.timezone} />
    <OperatingNotice operating={data.operating} />
    <div className="grid gap-3 sm:grid-cols-3">
      {data.inventory && <Metric label="Packages ready to sell" value={data.inventory.readyTotal} href="/dashboard/platform/inventory?filter=ready" />}
      {data.inventory && <Metric label="Packages on hold" value={data.inventory.heldTotal} href="/dashboard/platform/inventory?filter=held" />}
      {data.incidents && <Metric label="Open incidents" value={data.incidents.openTotal} href="/dashboard/platform/incidents" />}
      {data.incidents && <Metric label="Notifications overdue" value={data.incidents.overdueTotal} href="/dashboard/platform/incidents" />}
      {data.inventory && <Metric label="Packages in receiving hold" value={data.inventory.receivingTotal} href="/dashboard/platform/inventory?filter=receiving" />}
      <Metric label="Jurisdiction" value={data.jurisdictionCode || 'Not set'} />
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      {data.inventory && <Card><CardHeader><CardTitle className="text-base">Ready to sell, soonest expiry</CardTitle></CardHeader><CardContent className="space-y-1">
        {data.inventory.ready.length ? data.inventory.ready.map(pkg => <Link key={pkg.id} href={`/dashboard/platform/inventory?search=${encodeURIComponent(pkg.packageUid)}`} className="flex justify-between gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted"><span className="min-w-0 truncate"><span className="font-mono">{pkg.packageUid}</span> · {pkg.product?.name || 'Product not recorded'}</span><span className="shrink-0 text-muted-foreground">expires {formatWhen(pkg.expiresAt, data.timezone)}</span></Link>) : <Empty>No packages are ready to sell.</Empty>}
      </CardContent></Card>}
      {data.incidents && <Card><CardHeader><CardTitle className="text-base">Open incidents</CardTitle></CardHeader><CardContent className="space-y-1">
        {data.incidents.open.length ? data.incidents.open.map(incident => <Link key={incident.id} href={`/dashboard/platform/incidents#incident-${incident.id}`} className="flex justify-between gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted"><span className="min-w-0 truncate"><span className="font-mono">{incident.reference}</span> · {readable(incident.type)}</span><span className="shrink-0 text-muted-foreground">{NOTIFICATION_LABEL[incident.notificationState] || readable(incident.notificationState)}</span></Link>) : <Empty>No open incidents.</Empty>}
      </CardContent></Card>}
    </div>
    {!data.inventory && !data.incidents && <Empty>Your role has no inventory or compliance access. Use the pages available to you in the sidebar.</Empty>}
  </Workboard>);
}

export async function AuthorityWorkspacePage({ searchParams }: { searchParams?: SearchParams }) {
  const params = await readParams(searchParams);
  return frame('authority', '/dashboard/platform/authority', 'Authority', params, data => {
    const current = data.credentials.items.filter(credential => ['current', 'expiring_soon'].includes(credential.intervalState)).length;
    return <Workboard>
      <AsOf generatedAt={data.generatedAt} timezone={data.timezone} />
      <OperatingNotice operating={data.operating} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Licenses" value={data.licenses.total} />
        <Metric label="Credentials (all)" value={data.credentials.total} />
        <Metric label="Current credentials on this page" value={current} />
      </div>
      <Card data-testid="authority-workbench"><CardHeader><CardTitle className="text-base">Licenses</CardTitle></CardHeader><CardContent className="space-y-2">
        {data.licenses.items.length ? data.licenses.items.map(license => <div key={license.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"><div><p className="font-mono font-medium">{license.licenseNumber}</p><p className="text-xs text-muted-foreground">{license.licenseType} · {license.regulatorName} · {formatWhen(license.effectiveAt, data.timezone)} – {formatWhen(license.expiresAt, data.timezone)}</p></div><div className="flex gap-2"><Status value={license.status} /><span className="text-xs text-muted-foreground">{INTERVAL_LABEL[license.intervalState]}</span></div>{['expired', 'expiring_soon'].includes(license.intervalState) && <div className="w-full"><RenewAuthorityForm kind="license" id={license.id} /></div>}</div>) : <Empty>No licenses are recorded.</Empty>}
        {data.licenses.nextCursor && <p className="text-xs text-muted-foreground">Showing the first {data.licenses.items.length} of {data.licenses.total} licenses.</p>}
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">Staff credentials</CardTitle></CardHeader><CardContent className="space-y-2 p-0">
        <div className="space-y-2 px-6">{data.credentials.items.length ? data.credentials.items.map(credential => <div key={credential.id} className="rounded-lg border p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium">{credential.user?.name || 'Unassigned'}</p><p className="text-xs text-muted-foreground">{credential.credentialType} · valid {formatWhen(credential.effectiveAt, data.timezone)} – {formatWhen(credential.expiresAt, data.timezone)} · approval limit {formatMinorUnits(credential.approvalLimitCents ?? 0, data.currencyCode)}</p></div><div className="flex gap-2"><Status value={credential.status} /><span className="text-xs text-muted-foreground">{INTERVAL_LABEL[credential.intervalState]}</span></div></div>{data.operating.open && <RevokeCredentialForm credentialId={credential.id} status={credential.status} />}{['expired', 'expiring_soon', 'inactive'].includes(credential.intervalState) && credential.status !== 'terminated' && <RenewAuthorityForm kind="credential" id={credential.id} />}</div>) : <Empty>No staff credentials are recorded.</Empty>}</div>
        <Pager basePath="/dashboard/platform/authority" params={params} nextCursor={data.credentials.nextCursor} shown={data.credentials.items.length} total={data.credentials.total} noun="credentials" />
      </CardContent></Card>
      {data.operating.open && <Card><CardHeader><CardTitle className="text-base">Add a staff member</CardTitle></CardHeader><CardContent><ProvisionStaffForm /></CardContent></Card>}
    </Workboard>;
  });
}

export async function ComplianceWorkspacePage({ searchParams }: { searchParams?: SearchParams }) {
  const params = await readParams(searchParams);
  return frame('compliance', '/dashboard/platform/compliance', 'Compliance', params, data => <Workboard>
    <AsOf generatedAt={data.generatedAt} timezone={data.timezone} />
    <div className="grid gap-3 sm:grid-cols-3">
      <Metric label="Customers awaiting verification" value={data.pendingCustomers.total} />
      <Metric label="Active package holds" value={data.holds.total} />
      <Metric label="Recall cases" value={data.recalls.total} />
    </div>
    <p role="status" className="rounded-md border bg-muted/40 p-3 text-sm">Recording eligibility decisions and releasing holds are not available yet.</p>
    <Card data-testid="compliance-workbench"><CardHeader><CardTitle className="text-base">Active package holds</CardTitle></CardHeader><CardContent className="space-y-2">
      {data.holds.items.length ? data.holds.items.map(hold => <Link key={hold.id} href={`/dashboard/platform/inventory?search=${encodeURIComponent(hold.package?.packageUid || '')}`} className="block rounded-lg border p-3 text-sm hover:bg-muted"><p className="font-medium capitalize">{readable(hold.type)} hold · {hold.reasonCode}</p><p className="text-xs text-muted-foreground">Package {hold.package?.packageUid || 'not recorded'} · placed {formatWhen(hold.placedAt, data.timezone)}</p></Link>) : <Empty>No active package holds.</Empty>}
      {data.holds.nextCursor && <p className="text-xs text-muted-foreground">Showing the oldest {data.holds.items.length} of {data.holds.total} holds.</p>}
    </CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Customers awaiting verification</CardTitle></CardHeader><CardContent className="space-y-2 p-0">
      <div className="space-y-2 px-6">{data.pendingCustomers.items.length ? data.pendingCustomers.items.map(customer => <div key={`${customer.kind}:${customer.id}`} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"><div><p className="font-mono font-medium">{customer.reference}</p><p className="text-xs text-muted-foreground">Eligibility review · {readable(customer.capacity)} · since {formatWhen(customer.createdAt, data.timezone)}</p></div><Status value={customer.status} /></div>) : <Empty>No customers are awaiting verification.</Empty>}</div>
      <Pager basePath="/dashboard/platform/compliance" params={params} nextCursor={data.pendingCustomers.nextCursor} shown={data.pendingCustomers.items.length} total={data.pendingCustomers.total} noun="customers" />
    </CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Recall cases</CardTitle></CardHeader><CardContent className="space-y-2">
      {data.recalls.items.length ? data.recalls.items.map(recall => <div key={`${recall.kind}:${recall.id}`} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"><div><p className="font-mono font-medium">{recall.reference}</p><p className="text-xs text-muted-foreground">Recall · {recall.reason} · opened {formatWhen(recall.openedAt, data.timezone)}</p></div><Status value={recall.status} /></div>) : <Empty>No recall cases.</Empty>}
      {data.recalls.nextCursor && <p className="text-xs text-muted-foreground">Showing the latest {data.recalls.items.length} of {data.recalls.total} recalls.</p>}
    </CardContent></Card>
  </Workboard>);
}

export async function MenuWorkspacePage({ searchParams }: { searchParams?: SearchParams }) {
  const params = await readParams(searchParams);
  return frame('menu', '/dashboard/platform/menu', 'Menu', params, data => {
    const ready = data.products.items.filter(product => product.readyPackageCount > 0).length;
    return <Workboard>
      <AsOf generatedAt={data.generatedAt} timezone={data.timezone} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Active products" value={data.products.total} />
        <Metric label="Ready to sell on this page" value={`${ready} of ${data.products.items.length}`} />
        <Metric label="Inactive or draft products" value={data.inactiveTotal} />
      </div>
      <SearchForm basePath="/dashboard/platform/menu" params={params} label="Search products" placeholder="Name or SKU" />
      <Card data-testid="menu-workbench"><CardHeader><CardTitle className="text-base">Products</CardTitle><p className="text-sm text-muted-foreground">A product is ready to sell when it has a released, lab-passed, unexpired package with no hold and free quantity.</p></CardHeader><CardContent className="space-y-2 p-0">
        <div className="space-y-2 px-6">{data.products.items.length ? data.products.items.map(product => <details key={product.id} className="rounded-lg border p-3">
          <summary className="grid cursor-pointer gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"><div className="min-w-0"><p className="font-medium">{product.name}</p><p className="text-xs text-muted-foreground">{product.sku} · {product.form} · {product.categoryCode} · {formatMinorUnits(product.priceCents, data.currencyCode)} per increment</p></div><Status value={product.status} /><p className="text-sm tabular-nums">{product.readyPackageCount > 0 ? `${product.readyPackageCount}${product.readyCountComplete ? '' : '+'} ready · ${formatMicrounits(product.availableMicrounits, product.unitOfMeasure)} free` : 'Not ready to sell'}</p></summary>
          {data.operating.open && <div className="mt-3 border-t pt-3"><AmendProductForm product={product} /></div>}
        </details>) : <Empty>{params.search ? 'No products match this search.' : 'No active products yet. Add one below.'}</Empty>}</div>
        <Pager basePath="/dashboard/platform/menu" params={params} nextCursor={data.products.nextCursor} shown={data.products.items.length} total={data.products.total} noun="products" />
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">Add a product</CardTitle></CardHeader><CardContent><NewProductForm /></CardContent></Card>
    </Workboard>;
  });
}

export async function PosFulfillmentWorkspacePage({ searchParams }: { searchParams?: SearchParams }) {
  const params = await readParams(searchParams);
  return frame('pos', '/dashboard/platform/pos', 'POS', params, data => <Workboard>
    <AsOf generatedAt={data.generatedAt} timezone={data.timezone} />
    <div className="grid gap-3 sm:grid-cols-3">
      <Metric label="Open carts" value={data.carts.total} />
      <Metric label="Carts in final verification on this page" value={data.carts.items.filter(cart => cart.status === 'final_verification').length} />
      <Metric label="Receipts" value={data.sales.total} />
    </div>
    <p role="status" className="rounded-md border bg-muted/40 p-3 text-sm">Creating carts and completing sales are not available yet. Existing carts can be prepared below.</p>
    {params.sale && <SaleReceiptDetail saleId={params.sale} currencyCode={data.currencyCode} />}
    <CartPreparationClient authorityFingerprint={data.authorityFingerprint} currencyCode={data.currencyCode}
      products={data.products.items} productsHasMore={Boolean(data.products.nextCursor)}
      carts={data.carts.items.map(cart => ({ id: cart.id, reference: cart.reference }))} />
    <Card data-testid="pos-fulfillment-workbench"><CardHeader><CardTitle className="text-base">Open carts</CardTitle></CardHeader><CardContent className="space-y-2 p-0">
      <div className="space-y-2 px-6">{data.carts.items.length ? data.carts.items.map(cart => <div key={cart.id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]"><div><p className="font-mono text-sm font-medium">{cart.reference}</p><p className="text-xs text-muted-foreground">Expires {formatWhen(cart.expiresAt, data.timezone)} · customer {cart.customer?.reference || 'not recorded'}</p></div><Status value={cart.status} /><p className="text-sm tabular-nums">{formatMinorUnits(cart.totalCents, data.currencyCode)}</p></div>) : <Empty>No open carts.</Empty>}</div>
      <Pager basePath="/dashboard/platform/pos" params={params} nextCursor={data.carts.nextCursor} shown={data.carts.items.length} total={data.carts.total} noun="carts" />
    </CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Recent receipts</CardTitle></CardHeader><CardContent className="space-y-2">
      {data.sales.items.length ? data.sales.items.map(sale => <Link key={sale.id} href={`/dashboard/platform/pos?sale=${encodeURIComponent(sale.id)}`} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm hover:bg-muted"><div><p className="font-mono font-medium">{sale.receiptNumber}</p><p className="text-xs text-muted-foreground">Finalized {formatWhen(sale.finalizedAt, data.timezone)}</p></div><Status value={sale.status} /></Link>) : <Empty>No receipts yet.</Empty>}
      {data.sales.nextCursor && <p className="text-xs text-muted-foreground">Showing the latest {data.sales.items.length} of {data.sales.total} receipts.</p>}
    </CardContent></Card>
  </Workboard>);
}

export async function CashWorkspacePage({ searchParams }: { searchParams?: SearchParams }) {
  const params = await readParams(searchParams);
  return frame('cash', '/dashboard/platform/cash', 'Cash', params, data => <Workboard>
    <AsOf generatedAt={data.generatedAt} timezone={data.timezone} />
    <div className="grid gap-3 sm:grid-cols-3">
      <Metric label="Shifts" value={data.shifts.total} />
      <Metric label="Open shifts on this page" value={data.shifts.items.filter(shift => shift.status === 'open').length} />
      <Metric label="Variance reviews on this page" value={data.shifts.items.filter(shift => shift.status === 'variance_review').length} />
    </div>
    <p role="status" className="rounded-md border bg-muted/40 p-3 text-sm">Closing a shift with a blind count is not available yet.</p>
    <Card data-testid="cash-workbench"><CardHeader><CardTitle className="text-base">Shifts</CardTitle></CardHeader><CardContent className="space-y-2 p-0">
      <div className="space-y-2 px-6">{data.shifts.items.length ? data.shifts.items.map(shift => <div key={shift.id} className="rounded-lg border p-3 text-sm"><div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]"><div><p className="font-medium">{shift.register?.name || 'Register not recorded'}</p><p className="text-xs text-muted-foreground">Opened {formatWhen(shift.openedAt, data.timezone)} · {shift.operator?.name || 'Operator not recorded'} · float {formatMinorUnits(shift.openingFloatCents, data.currencyCode)}</p></div><Status value={shift.status} /><p className="tabular-nums">{shift.varianceCents == null ? 'No count yet' : `Variance ${formatMinorUnits(shift.varianceCents, data.currencyCode)}`}</p></div>{shift.status === 'variance_review' && <ApproveVarianceForm shiftId={shift.id} />}</div>) : <Empty>No shifts yet.</Empty>}</div>
      <Pager basePath="/dashboard/platform/cash" params={params} nextCursor={data.shifts.nextCursor} shown={data.shifts.items.length} total={data.shifts.total} noun="shifts" />
    </CardContent></Card>
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader><CardTitle className="text-base">Open a shift</CardTitle></CardHeader><CardContent><OpenShiftForm registers={data.registers.items} /></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">Registers</CardTitle></CardHeader><CardContent className="space-y-3">
        {data.registers.items.length ? <ul className="space-y-1 text-sm">{data.registers.items.map(register => <li key={register.id} className="flex flex-wrap items-center justify-between gap-3"><span>{register.name} · {register.code}</span><RegisterStatusForm register={register} /></li>)}</ul> : <Empty>No registers yet.</Empty>}
        <RegisterForm />
      </CardContent></Card>
    </div>
  </Workboard>);
}

export async function ReconciliationWorkspacePage({ searchParams }: { searchParams?: SearchParams }) {
  const params = await readParams(searchParams);
  return frame('reconciliation', '/dashboard/platform/reconciliation', 'Reconciliation', params, data => <Workboard>
    <AsOf generatedAt={data.generatedAt} timezone={data.timezone} />
    <div className="grid gap-3 sm:grid-cols-3">
      <Metric label="Waiting to send" value={data.pending.total} />
      <Metric label="Failed or rejected" value={data.exceptions.total} />
      <Metric label="Reconciliation runs" value={data.runs.total} />
    </div>
    {!data.delivery.workerAvailable && <p role="status" className="rounded-md border bg-muted/40 p-3 text-sm">State reporting is not connected. Queued events are not being sent to the regulator; report through the state system directly.</p>}
    <Card><CardHeader><CardTitle className="text-base">Failed or rejected reports</CardTitle></CardHeader><CardContent className="space-y-2">
      {data.exceptions.items.length ? data.exceptions.items.map(event => <div key={event.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"><div><p className="font-medium">{event.topic}</p><p className="text-xs text-muted-foreground">Delivery attempts {event.attempts} · last {formatWhen(event.lastAttemptAt, data.timezone)} · {event.lastErrorCode || 'no error code'}</p></div><div className="flex items-center gap-2"><Status value={event.status} />{data.operating.open && <RetryOutboxButton eventId={event.id} />}</div></div>) : <Empty>No failed or rejected reports.</Empty>}
      {data.exceptions.nextCursor && <p className="text-xs text-muted-foreground">Showing the oldest {data.exceptions.items.length} of {data.exceptions.total}.</p>}
    </CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Waiting to send</CardTitle></CardHeader><CardContent className="space-y-2">
      {data.pending.items.length ? data.pending.items.map(event => <div key={event.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"><div><p className="font-medium">{event.topic}</p><p className="text-xs text-muted-foreground">Queued since {formatWhen(event.availableAt, data.timezone)}</p></div><Status value={event.status} /></div>) : <Empty>Nothing is waiting to send.</Empty>}
      {data.pending.nextCursor && <p className="text-xs text-muted-foreground">Showing the oldest {data.pending.items.length} of {data.pending.total}.</p>}
    </CardContent></Card>
    <Card data-testid="reconciliation-workbench"><CardHeader><CardTitle className="text-base">Reconciliation runs</CardTitle></CardHeader><CardContent className="space-y-2 p-0">
      <div className="space-y-2 px-6">{data.runs.items.length ? data.runs.items.map(run => <div key={run.id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]"><div><p className="font-medium capitalize">{readable(run.type)}</p><p className="text-xs text-muted-foreground">Started {formatWhen(run.startedAt, data.timezone)}</p></div><Status value={run.status} /><p className="text-sm tabular-nums">{run.discrepancyCount} discrepancies</p></div>) : <Empty>No reconciliation runs.</Empty>}</div>
      <Pager basePath="/dashboard/platform/reconciliation" params={params} nextCursor={data.runs.nextCursor} shown={data.runs.items.length} total={data.runs.total} noun="runs" />
    </CardContent></Card>
  </Workboard>);
}

export async function IncidentsWorkspacePage({ searchParams }: { searchParams?: SearchParams }) {
  const params = await readParams(searchParams);
  return frame('incidents', '/dashboard/platform/incidents', 'Incidents', params, data => <Workboard>
    <AsOf generatedAt={data.generatedAt} timezone={data.timezone} />
    <OperatingNotice operating={data.operating} />
    <div className="grid gap-3 sm:grid-cols-3">
      <Metric label="Open incidents" value={data.openTotal} />
      <Metric label="Notifications overdue" value={data.overdueTotal} />
      <Metric label="Open high or critical" value={data.highTotal} />
    </div>
    <nav aria-label="Incident filter" className="flex gap-2 text-sm">
      <Link href="/dashboard/platform/incidents" aria-current={data.filter === 'open' ? 'page' : undefined} className={`rounded-full border px-3 py-1 ${data.filter === 'open' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>Open</Link>
      <Link href="/dashboard/platform/incidents?filter=all" aria-current={data.filter === 'all' ? 'page' : undefined} className={`rounded-full border px-3 py-1 ${data.filter === 'all' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>All</Link>
    </nav>
    <Card data-testid="incident-workbench"><CardHeader><CardTitle className="text-base">Incidents</CardTitle></CardHeader><CardContent className="space-y-2 p-0">
      <div className="space-y-2 px-6">{data.incidents.items.length ? data.incidents.items.map(incident => <div id={`incident-${incident.id}`} key={incident.id} className="rounded-lg border p-3 text-sm">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]"><div className="min-w-0"><p className="font-mono font-medium">{incident.reference}</p><p className="text-xs text-muted-foreground">{readable(incident.type)} · occurred {formatWhen(incident.occurredAt, data.timezone)} · {NOTIFICATION_LABEL[incident.notificationState] || readable(incident.notificationState)}{incident.notificationDueAt ? ` (${formatWhen(incident.notificationDueAt, data.timezone)})` : ''}</p><p className="mt-1 break-words">{incident.description}</p></div><Status value={incident.severity} /><Status value={incident.status} /></div>
        {data.operating.open && <IncidentTransitionForm incident={incident} />}
      </div>) : <Empty>{data.filter === 'open' ? 'No open incidents.' : 'No incidents recorded.'}</Empty>}</div>
      <Pager basePath="/dashboard/platform/incidents" params={params} nextCursor={data.incidents.nextCursor} shown={data.incidents.items.length} total={data.incidents.total} noun="incidents" />
    </CardContent></Card>
    {data.operating.open ? <Card><CardHeader><CardTitle className="text-base">Record an incident</CardTitle></CardHeader><CardContent><RecordIncidentForm /></CardContent></Card> : null}
  </Workboard>);
}
