import Link from 'next/link';
import { formatMinorUnits } from '@/features/lib/money';
import { formatMicrounits } from '@/features/lib/quantity';
import { CartPreparationClient } from '@/features/platform/fulfillment/components/CartPreparationClient';
import { SaleReceiptDetail } from '@/features/platform/fulfillment/components/SaleReceiptDetail';
import { BandRow, ListBand, MetricStrip, Notice, operatingState, Panel, PillLink, SectionTitle, statusTone, Track, type DotTone, sentenceCase } from '@/features/platform/components/cannabis-ui';
import { Empty, formatUsableThrough, formatWhen, Pager, readable, SearchForm, Status, Workboard } from '../components/WorkspaceKit';
import { AmendRulesDisclosure, RulePackForm } from '../components/RulePackForm';
import { AmendProductForm, ApproveVarianceForm, IncidentTransitionForm, NewProductForm, OpenShiftForm, RecordIncidentForm, RegisterForm, RegisterStatusForm, RenewAuthorityForm, TemporaryPasswordForm, PremisesDetailsForm, RetryOutboxButton, RevokeCredentialForm } from '../components/OperatorForms';

import { frame, readParams, type SearchParams } from '../lib/frame';

function OperatingNotice({ operating }: { operating: { open: boolean; reason: string | null; limited: boolean } }) {
  if (operating.open || operating.limited) return null;
  return <Notice tone="danger" action={<Track><PillLink href="/dashboard/platform/authority" active>Open Authority</PillLink></Track>}>Operating authority is not current: {operating.reason}. Read only until renewed.</Notice>;
}

const minuteLabel = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
const TENDER_LABEL: Record<string, string> = { cash: 'Cash', debit: 'Debit', ach: 'ACH', wallet: 'Wallet', other: 'Other' };
const CAPACITY_LABEL: Record<string, string> = { adult_use: 'adult-use', patient: 'patient', caregiver: 'caregiver', all: 'all buyers' };
function describeLimit(rule: Record<string, unknown>) {
  const max = typeof rule.maxEquivalencyMicrounits === 'number' ? formatMicrounits(rule.maxEquivalencyMicrounits) : '?';
  const window = rule.window === 'rolling' ? `${rule.windowDays} days` : String(rule.window ?? '?');
  return `${String(rule.categoryCode ?? '?')} · ${CAPACITY_LABEL[String(rule.capacity)] ?? String(rule.capacity ?? '?')} · ${max} per ${window}`;
}
function describeTax(rule: Record<string, unknown>) {
  const rate = typeof rule.basisPoints === 'number' ? `${rule.basisPoints / 100}%` : '?';
  return `${String(rule.categoryCode ?? '?')} · ${CAPACITY_LABEL[String(rule.capacity)] ?? String(rule.capacity ?? '?')} · ${rate}`;
}
const WORKSPACES: Array<{ title: string; detail: string; href: string; access: 'inventory' | 'compliance' | 'authority' | 'sales' | 'finance' | 'reports' }> = [
  { title: 'POS', detail: 'Carts, preparation and receipts', href: '/dashboard/platform/pos', access: 'sales' },
  { title: 'Inventory', detail: 'Packages, holds and custody', href: '/dashboard/platform/inventory', access: 'inventory' },
  { title: 'Receiving', detail: 'Packages against manifests', href: '/dashboard/platform/receiving', access: 'inventory' },
  { title: 'Menu', detail: 'Products and readiness', href: '/dashboard/platform/menu', access: 'inventory' },
  { title: 'Cash', detail: 'Registers and shifts', href: '/dashboard/platform/cash', access: 'finance' },
  { title: 'Compliance', detail: 'Holds, verification and recalls', href: '/dashboard/platform/compliance', access: 'compliance' },
  { title: 'Incidents', detail: 'Incidents and deadlines', href: '/dashboard/platform/incidents', access: 'compliance' },
  { title: 'Reconciliation', detail: 'State reporting queue', href: '/dashboard/platform/reconciliation', access: 'reports' },
  { title: 'Authority', detail: 'Licenses, staff and sales rules', href: '/dashboard/platform/authority', access: 'authority' },
  { title: 'Store Settings', detail: 'Name, logo and accent', href: '/dashboard/platform/store-settings', access: 'authority' },
  { title: 'Staff', detail: 'People, roles and access', href: '/dashboard/platform/staff', access: 'authority' },
  { title: 'Customers', detail: 'Eligibility and history', href: '/dashboard/platform/customers', access: 'compliance' },
  { title: 'Recalls', detail: 'Recall cases and held packages', href: '/dashboard/platform/recalls', access: 'compliance' },
  { title: 'Sales', detail: 'Receipts and refunds', href: '/dashboard/platform/sales', access: 'sales' },
  { title: 'Audit log', detail: 'Who did what, and when', href: '/dashboard/platform/audit', access: 'reports' },
];

const INTERVAL_LABEL: Record<string, string> = { current: 'Current', expiring_soon: 'Expires within 30 days', expired: 'Expired', not_yet_effective: 'Not yet effective', inactive: 'Inactive' };
const NOTIFICATION_LABEL: Record<string, string> = { none: 'No deadline', overdue: 'Notification overdue', due_soon: 'Due within 24 hours', upcoming: 'Upcoming deadline', resolved: 'Resolved', unknown: 'Deadline unknown' };
const NOTIFICATION_TONE: Record<string, DotTone> = { none: 'muted', overdue: 'danger', due_soon: 'warn', upcoming: 'info', resolved: 'ok', unknown: 'warn' };
const SEVERITY_TONE: Record<string, DotTone> = { low: 'info', medium: 'warn', high: 'danger', critical: 'danger' };

export async function ControlRoomPage({ searchParams }: { searchParams?: SearchParams }) {
  const params = await readParams(searchParams);
  return frame('overview', '/dashboard/platform', 'Control room', params, data => <Workboard>
    <OperatingNotice operating={data.operating} />
    <MetricStrip items={[
      ...(data.inventory ? [
        { label: 'Ready to sell', value: data.inventory.readyTotal, href: '/dashboard/platform/inventory?filter=ready', tone: 'ok' as const },
        { label: 'On hold', value: data.inventory.heldTotal, href: '/dashboard/platform/inventory?filter=held', tone: data.inventory.heldTotal ? 'danger' as const : 'muted' as const },
        { label: 'In receiving hold', value: data.inventory.receivingTotal, href: '/dashboard/platform/inventory?filter=receiving', tone: data.inventory.receivingTotal ? 'warn' as const : 'muted' as const },
      ] : []),
      ...(data.incidents ? [
        { label: 'Open incidents', value: data.incidents.openTotal, href: '/dashboard/platform/incidents', tone: data.incidents.openTotal ? 'warn' as const : 'muted' as const },
        { label: 'Notifications overdue', value: data.incidents.overdueTotal, href: '/dashboard/platform/incidents', tone: data.incidents.overdueTotal ? 'danger' as const : 'muted' as const },
      ] : []),
      { label: 'Jurisdiction', value: data.jurisdictionCode || 'Not set' },
    ]} />
    <div className="grid gap-8 lg:grid-cols-2">
      {data.inventory && <section>
        <SectionTitle meta={data.inventory.readyTotal} action={<Track><PillLink href="/dashboard/platform/inventory?filter=ready">All ready</PillLink></Track>}>Ready to sell, soonest expiry</SectionTitle>
        <ListBand>{data.inventory.ready.length ? data.inventory.ready.map(pkg => <Link key={pkg.id} href={`/dashboard/platform/inventory?search=${encodeURIComponent(pkg.packageUid)}`} className="block transition-colors hover:bg-background/60">
          <BandRow title={<span className="font-mono">{pkg.packageUid}</span>} detail={pkg.product?.name || 'Product not recorded'} aside={<span className="text-xs text-muted-foreground">Usable through {formatUsableThrough(pkg.expiresAt, data.timezone)}</span>} />
        </Link>) : <Empty>No packages are ready to sell.</Empty>}</ListBand>
      </section>}
      {data.incidents && <section>
        <SectionTitle meta={data.incidents.openTotal} action={<Track><PillLink href="/dashboard/platform/incidents">All incidents</PillLink></Track>}>Open incidents</SectionTitle>
        <ListBand>{data.incidents.open.length ? data.incidents.open.map(incident => <Link key={incident.id} href={`/dashboard/platform/incidents#incident-${incident.id}`} className="block transition-colors hover:bg-background/60">
          <BandRow title={<span className="font-mono">{incident.reference}</span>} tone={NOTIFICATION_TONE[incident.notificationState] || 'muted'} state={NOTIFICATION_LABEL[incident.notificationState] || sentenceCase(incident.notificationState)} detail={<span >{sentenceCase(incident.type)} · {sentenceCase(incident.severity)}</span>} />
        </Link>) : <Empty>No open incidents.</Empty>}</ListBand>
      </section>}
    </div>
    <section>
      <SectionTitle>Your workspaces</SectionTitle>
      <ListBand>{WORKSPACES.filter(item => data.access[item.access]).map(item => <Link key={item.href} href={item.href} className="block transition-colors hover:bg-background/60"><BandRow title={item.title} detail={item.detail} /></Link>)}</ListBand>
    </section>
  </Workboard>);
}

export async function AuthorityWorkspacePage({ searchParams }: { searchParams?: SearchParams }) {
  const params = await readParams(searchParams);
  return frame('authority', '/dashboard/platform/authority', 'Authority', params, data => {
    const lapsing = data.licenses.items.filter(license => ['expired', 'expiring_soon'].includes(license.intervalState)).length;
    const rules = data.rules;
    return <Workboard>
      <OperatingNotice operating={data.operating} />
      <MetricStrip items={[
        { label: 'Licenses', value: data.licenses.total },
        { label: 'Licenses expiring or expired', value: lapsing, tone: lapsing ? 'warn' : 'muted' },
        { label: 'Staff credentials', value: data.credentials.total },
        { label: 'Your approval limit', value: formatMinorUnits(data.self.approvalLimitCents, data.currencyCode) },
      ]} />
      <section id="premises" className="scroll-mt-20">
        <SectionTitle meta={data.premises.name}>Premises</SectionTitle>
        <ListBand>
          <BandRow title="Address" detail={[data.premises.line1, [data.premises.city, [data.premises.region, data.premises.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', '), data.premises.country].filter(Boolean).join(' · ') || 'Not recorded'} />
          <BandRow title="Phone" detail={data.premises.phone || 'Not recorded'} tone={data.premises.phone ? undefined : 'warn'} state={data.premises.phone ? undefined : 'Not shown on the storefront'} />
          {data.self.isOwner && <AmendRulesDisclosure initiallyOpen={false} label="Edit address and phone"><PremisesDetailsForm premises={data.premises} /></AmendRulesDisclosure>}
        </ListBand>
      </section>
      <section id="sales-rules" className="scroll-mt-20">
        <SectionTitle meta={rules?.version} action={rules ? <Status value={data.salesRules.problem ? 'Invalid' : 'In effect'} tone={data.salesRules.problem ? 'danger' : 'ok'} /> : undefined}>Sales rules</SectionTitle>
        {data.salesRules.problem && <Notice tone="danger" className="mb-3">{data.salesRules.problem}</Notice>}
        {rules ? <ListBand>
          <BandRow title="Validity" detail={`${formatWhen(rules.effectiveAt, data.timezone)} – ${formatWhen(rules.expiresAt, data.timezone)}`} />
          <BandRow title="Hours" detail={<span className="font-mono">{minuteLabel(rules.operatingStartMinute)}–{minuteLabel(rules.operatingEndMinute)}</span>} />
          <BandRow title="Minimum age" detail={<>Adult-use <span className="font-mono">{rules.adultMinimumAge}</span>{rules.medicalEnabled ? <> · medical <span className="font-mono">{rules.medicalMinimumAge}</span></> : ' · medical sales off'}</>} />
          <BandRow title="Purchase limits" detail={rules.purchaseLimits.length ? rules.purchaseLimits.map((rule, index) => <span key={index} className="block font-mono">{describeLimit(rule)}</span>) : 'None'} />
          <BandRow title="Tax rules" detail={rules.taxRules.length ? rules.taxRules.map((rule, index) => <span key={index} className="block font-mono">{describeTax(rule)}</span>) : 'None'} />
          <BandRow title="Payment types" detail={rules.allowedTenderTypes.map(type => TENDER_LABEL[type] ?? sentenceCase(type)).join(', ') || 'None'} />
          {data.self.isOwner && <AmendRulesDisclosure initiallyOpen={Boolean(data.salesRules.problem)}><RulePackForm rules={rules} approvalLimitCents={data.self.approvalLimitCents} /></AmendRulesDisclosure>}
        </ListBand> : <ListBand><Empty>No sales rules installed.</Empty></ListBand>}
      </section>
      {data.ruleVersions.length > 1 && <section>
        <SectionTitle meta={data.ruleVersions.length}>Sales rule versions</SectionTitle>
        <ListBand>{data.ruleVersions.map(version => <BandRow key={version.id} title={<span className="font-mono">{version.version}</span>} tone={version.status === 'effective' ? 'ok' : 'muted'} state={sentenceCase(version.status)}
          detail={<>{formatWhen(version.effectiveAt, data.timezone)} – {formatWhen(version.expiresAt, data.timezone)}{version.approvedBy?.name ? ` · approved by ${version.approvedBy.name}` : ''}</>} />)}</ListBand>
      </section>}
      <section data-testid="authority-workbench">
        <SectionTitle meta={data.licenses.total}>Licenses</SectionTitle>
        <ListBand>
          {data.licenses.items.length ? data.licenses.items.map(license => <BandRow key={license.id} title={<span className="font-mono">{license.licenseNumber}</span>} tone={statusTone(license.intervalState === 'current' ? license.status : license.intervalState)} state={<span >{sentenceCase(license.status)} · {INTERVAL_LABEL[license.intervalState]}</span>}
            detail={`${license.licenseType} · ${license.regulatorName} · ${formatWhen(license.effectiveAt, data.timezone)} – ${formatWhen(license.expiresAt, data.timezone)}`}>
            {['expired', 'expiring_soon'].includes(license.intervalState) && <RenewAuthorityForm kind="license" id={license.id} />}
          </BandRow>) : <Empty>No licenses are recorded.</Empty>}
          {data.licenses.nextCursor && <p className="px-4 py-2.5 font-mono text-xs text-muted-foreground">First {data.licenses.items.length} of {data.licenses.total} licenses</p>}
        </ListBand>
      </section>
      <section>
        <SectionTitle meta={data.credentials.total}>Staff credentials</SectionTitle>
        <ListBand>
          {data.credentials.items.length ? data.credentials.items.map(credential => <BandRow key={credential.id} title={<>{credential.user?.name || 'Unassigned'}{credential.id === data.self.credentialId && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>}</>} tone={statusTone(credential.intervalState === 'current' ? credential.status : credential.intervalState)} state={<span >{sentenceCase(credential.status)} · {INTERVAL_LABEL[credential.intervalState]}</span>}
            detail={<>{credential.credentialType} · valid {formatWhen(credential.effectiveAt, data.timezone)} – {formatWhen(credential.expiresAt, data.timezone)} · approval limit <span className="font-mono">{formatMinorUnits(credential.approvalLimitCents ?? 0, data.currencyCode)}</span></>}>
            {data.operating.open && credential.user && <TemporaryPasswordForm userId={credential.user.id} name={credential.user.name} />}
            {data.operating.open && credential.id !== data.self.credentialId && <RevokeCredentialForm credentialId={credential.id} status={credential.status} name={credential.user?.name || 'this person'} />}
            {['expired', 'expiring_soon', 'inactive'].includes(credential.intervalState) && credential.status !== 'terminated' && <RenewAuthorityForm kind="credential" id={credential.id} />}
          </BandRow>) : <Empty>No staff credentials are recorded.</Empty>}
          <Pager basePath="/dashboard/platform/authority" params={params} nextCursor={data.credentials.nextCursor} shown={data.credentials.items.length} total={data.credentials.total} noun="credentials" />
        </ListBand>
      </section>
      <Track><PillLink href="/dashboard/platform/staff" active>Staff, roles and access</PillLink></Track>
    </Workboard>;
  });
}

export async function ComplianceWorkspacePage({ searchParams }: { searchParams?: SearchParams }) {
  const params = await readParams(searchParams);
  return frame('compliance', '/dashboard/platform/compliance', 'Compliance', params, data => <Workboard>
    <MetricStrip items={[
      { label: 'Awaiting verification', value: data.pendingCustomers.total, tone: data.pendingCustomers.total ? 'warn' : 'muted' },
      { label: 'Active package holds', value: data.holds.total, tone: data.holds.total ? 'danger' : 'muted', href: '/dashboard/platform/inventory?filter=held' },
      { label: 'Recall cases', value: data.recalls.total, tone: data.recalls.total ? 'danger' : 'muted' },
    ]} />
    <Notice tone="muted">Eligibility decisions and hold releases unavailable</Notice>
    <section data-testid="compliance-workbench">
      <SectionTitle meta={data.holds.total}>Active package holds</SectionTitle>
      <ListBand>
        {data.holds.items.length ? data.holds.items.map(hold => <Link key={hold.id} href={`/dashboard/platform/inventory?search=${encodeURIComponent(hold.package?.packageUid || '')}`} className="block transition-colors hover:bg-background/60">
          <BandRow title={<span >{sentenceCase(hold.type)} hold</span>} tone="danger" state={<span className="font-mono">{hold.reasonCode}</span>} detail={<>Package <span className="font-mono">{hold.package?.packageUid || 'not recorded'}</span> · placed {formatWhen(hold.placedAt, data.timezone)}</>} />
        </Link>) : <Empty>No active package holds.</Empty>}
        {data.holds.nextCursor && <p className="px-4 py-2.5 font-mono text-xs text-muted-foreground">Oldest {data.holds.items.length} of {data.holds.total} holds</p>}
      </ListBand>
    </section>
    <div className="grid gap-8 lg:grid-cols-2">
      <section>
        <SectionTitle meta={data.pendingCustomers.total} action={<Track><PillLink href="/dashboard/platform/customers">All customers</PillLink></Track>}>Customers awaiting verification</SectionTitle>
        <ListBand>
          {data.pendingCustomers.items.length ? data.pendingCustomers.items.map(customer => <BandRow key={`${customer.kind}:${customer.id}`} title={<span className="font-mono">{customer.reference}</span>} tone={statusTone(customer.status)} state={<span >{sentenceCase(customer.status)}</span>} detail={<span >{sentenceCase(customer.capacity)} · since {formatWhen(customer.createdAt, data.timezone)}</span>} />) : <Empty>No customers are awaiting verification.</Empty>}
          <Pager basePath="/dashboard/platform/compliance" params={params} nextCursor={data.pendingCustomers.nextCursor} shown={data.pendingCustomers.items.length} total={data.pendingCustomers.total} noun="customers" />
        </ListBand>
      </section>
      <section>
        <SectionTitle meta={data.recalls.total} action={<Track><PillLink href="/dashboard/platform/recalls">Recalls</PillLink></Track>}>Recall cases</SectionTitle>
        <ListBand>
          {data.recalls.items.length ? data.recalls.items.map(recall => <BandRow key={`${recall.kind}:${recall.id}`} title={<span className="font-mono">{recall.reference}</span>} tone={statusTone(recall.status)} state={<span >{sentenceCase(recall.status)}</span>} detail={`${recall.reason} · opened ${formatWhen(recall.openedAt, data.timezone)}`} />) : <Empty>No recall cases.</Empty>}
          {data.recalls.nextCursor && <p className="px-4 py-2.5 font-mono text-xs text-muted-foreground">Latest {data.recalls.items.length} of {data.recalls.total} recalls</p>}
        </ListBand>
      </section>
    </div>
  </Workboard>);
}

export async function MenuWorkspacePage({ searchParams }: { searchParams?: SearchParams }) {
  const params = await readParams(searchParams);
  return frame('menu', '/dashboard/platform/menu', 'Menu', params, data => {
    const ready = data.products.items.filter(product => product.readyPackageCount > 0).length;
    return <Workboard>
      <MetricStrip items={[
        { label: 'Active products', value: data.products.total },
        { label: data.products.nextCursor ? `Ready to sell (first ${data.products.items.length})` : 'Ready to sell', value: ready, tone: ready ? 'ok' : 'muted' },
        { label: 'Inactive or draft', value: data.inactiveTotal },
      ]} />
      <section data-testid="menu-workbench">
        <SectionTitle meta={data.products.total} action={<SearchForm basePath="/dashboard/platform/menu" params={params} label="Search products" placeholder="Name or SKU" />}>Products</SectionTitle>
        <ListBand>
          {data.products.items.length ? data.products.items.map(product => {
            const missing = [!data.categories.limit.includes(product.categoryCode) && `No purchase limit for ${product.categoryCode}`, !data.categories.tax.includes(product.taxCategoryCode) && `No tax rule for ${product.taxCategoryCode}`].filter(Boolean).join(' · ');
            return <details key={product.id} className="group">
            <summary className="cursor-pointer list-none transition-colors hover:bg-background/60 [&::-webkit-details-marker]:hidden">
              <BandRow title={product.name} tone={missing ? 'danger' : product.readyPackageCount > 0 ? 'ok' : product.status === 'active' ? 'warn' : 'muted'} state={missing || (product.readyPackageCount > 0 ? 'Ready to sell' : product.status === 'active' ? 'Not ready' : sentenceCase(product.status))}
                detail={<><span className="font-mono">{product.sku}</span> · {product.form} · limit <span className="font-mono">{product.categoryCode}</span> · tax <span className="font-mono">{product.taxCategoryCode}</span>{product.adultUseEligible ? ' · adult-use' : ''}{product.medicalEligible ? ' · medical' : ''}</>}
                aside={<span className="flex flex-col items-start gap-0.5 sm:items-end"><span className="font-mono">{formatMinorUnits(product.priceCents, data.currencyCode)}</span><span className="text-xs text-muted-foreground">{product.readyPackageCount > 0 ? <>{product.readyPackageCount}{product.readyCountComplete ? '' : '+'} pkg · <span className="font-mono">{formatMicrounits(product.availableMicrounits, product.unitOfMeasure)}</span> free</> : 'No saleable package'}</span></span>} />
            </summary>
            <div className="border-t border-border/70 bg-background/50 px-4 py-4 space-y-4">
              <Track><PillLink href={`/dashboard/platform/menu/${encodeURIComponent(product.id)}`} active>Packages and sales</PillLink></Track>
              {data.operating.open && <AmendProductForm product={product} limitCategories={data.categories.limit} taxCategories={data.categories.tax} />}
            </div>
          </details>;
          }) : <Empty>{params.search ? 'No products match this search.' : 'No active products yet.'}</Empty>}
          <Pager basePath="/dashboard/platform/menu" params={params} nextCursor={data.products.nextCursor} shown={data.products.items.length} total={data.products.total} noun="products" />
        </ListBand>
      </section>
      <Panel title="Add a product"><NewProductForm limitCategories={data.categories.limit} taxCategories={data.categories.tax} /></Panel>
    </Workboard>;
  });
}

export async function PosFulfillmentWorkspacePage({ searchParams }: { searchParams?: SearchParams }) {
  const params = await readParams(searchParams);
  return frame('pos', '/dashboard/platform/pos', 'POS', params, data => {
    const finalVerification = data.carts.items.filter(cart => cart.status === 'final_verification').length;
    return <Workboard>
      <MetricStrip items={[
        { label: 'Open carts', value: data.carts.total, tone: data.carts.total ? 'warn' : 'muted' },
        { label: 'In final verification', value: finalVerification },
        { label: 'Receipts', value: data.sales.total },
      ]} />
      <Notice tone="muted">New carts and sale completion unavailable</Notice>
      {params.sale && <SaleReceiptDetail saleId={params.sale} currencyCode={data.currencyCode} timezone={data.timezone} />}
      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-8">
          <section data-testid="pos-fulfillment-workbench">
            <SectionTitle meta={data.carts.total}>Open carts</SectionTitle>
            <ListBand>
              {data.carts.items.length ? data.carts.items.map(cart => <BandRow key={cart.id} title={<span className="font-mono">{cart.reference}</span>} tone={statusTone(cart.status)} state={<span >{sentenceCase(cart.status)}</span>} detail={<>Expires {formatWhen(cart.expiresAt, data.timezone)} · customer <span className="font-mono">{cart.customer?.reference || 'not recorded'}</span></>} aside={<span className="font-mono">{formatMinorUnits(cart.totalCents, data.currencyCode)}</span>} />) : <Empty>No open carts.</Empty>}
              <Pager basePath="/dashboard/platform/pos" params={params} nextCursor={data.carts.nextCursor} shown={data.carts.items.length} total={data.carts.total} noun="carts" />
            </ListBand>
          </section>
          <section>
            <SectionTitle meta={data.sales.total} action={<Track><PillLink href="/dashboard/platform/sales">All sales</PillLink></Track>}>Recent receipts</SectionTitle>
            <ListBand>
              {data.sales.items.length ? data.sales.items.map(sale => <Link key={sale.id} href={`/dashboard/platform/pos?sale=${encodeURIComponent(sale.id)}`} aria-current={params.sale === sale.id ? 'page' : undefined} className="block transition-colors hover:bg-background/60 aria-[current=page]:bg-background/80">
                <BandRow title={<span className="font-mono">{sale.receiptNumber}</span>} tone={statusTone(sale.status)} state={<span >{sentenceCase(sale.status)}</span>} detail={`Finalized ${formatWhen(sale.finalizedAt, data.timezone)}`} aside={<span className="font-mono">{formatMinorUnits(sale.totalCents, data.currencyCode)}</span>} />
              </Link>) : <Empty>No receipts yet.</Empty>}
              {data.sales.nextCursor && <p className="px-4 py-2.5 font-mono text-xs text-muted-foreground">Latest {data.sales.items.length} of {data.sales.total} receipts</p>}
            </ListBand>
          </section>
        </div>
        <CartPreparationClient timezone={data.timezone} authorityFingerprint={data.authorityFingerprint} currencyCode={data.currencyCode}
          products={data.products.items} productsHasMore={Boolean(data.products.nextCursor)}
          carts={data.carts.items.map(cart => ({ id: cart.id, reference: cart.reference }))} />
      </div>
    </Workboard>;
  });
}

export async function CashWorkspacePage({ searchParams }: { searchParams?: SearchParams }) {
  const params = await readParams(searchParams);
  return frame('cash', '/dashboard/platform/cash', 'Cash', params, data => {
    const open = data.shifts.items.filter(shift => shift.status === 'open').length;
    const review = data.shifts.items.filter(shift => shift.status === 'variance_review').length;
    return <Workboard>
      <MetricStrip items={[
        { label: 'Shifts', value: data.shifts.total },
        { label: data.shifts.nextCursor ? `Open (first ${data.shifts.items.length})` : 'Open shifts', value: open, tone: open ? 'ok' : 'muted' },
        { label: 'Variance reviews', value: review, tone: review ? 'warn' : 'muted' },
        { label: 'Registers', value: data.registers.total },
      ]} />
      <Notice tone="muted">Blind-count shift close unavailable</Notice>
      <section data-testid="cash-workbench">
        <SectionTitle meta={data.shifts.total}>Shifts</SectionTitle>
        <ListBand>
          {data.shifts.items.length ? data.shifts.items.map(shift => <BandRow key={shift.id} title={shift.register?.name || 'Register not recorded'} tone={statusTone(shift.status)} state={<span >{sentenceCase(shift.status)}</span>}
            detail={<>Opened {formatWhen(shift.openedAt, data.timezone)} · {shift.operator?.name || 'Operator not recorded'} · float <span className="font-mono">{formatMinorUnits(shift.openingFloatCents, data.currencyCode)}</span></>}
            aside={shift.varianceCents == null ? <span className="text-xs text-muted-foreground">No count yet</span> : <span className={shift.varianceCents === 0 ? 'font-mono' : 'font-mono text-amber-700 dark:text-amber-400'}>{shift.varianceCents > 0 ? '+' : ''}{formatMinorUnits(shift.varianceCents, data.currencyCode)}</span>}>
            {shift.status === 'variance_review' && <ApproveVarianceForm shiftId={shift.id} />}
            {shift.cashEvents.length > 0 && <details className="mt-2"><summary className="inline-flex cursor-pointer list-none text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline [&::-webkit-details-marker]:hidden">Drawer ledger ({shift.cashEvents.length})</summary>
              <ul className="mt-2 space-y-1 border-l border-border pl-3 text-xs">{shift.cashEvents.map(event => <li key={event.id} className="flex flex-wrap items-baseline justify-between gap-x-3"><span>{sentenceCase(event.type)} · <span className="font-mono">{event.reasonCode}</span> · {event.actor?.name || 'System'} · {formatWhen(event.occurredAt, data.timezone)}</span><span className="font-mono">{formatMinorUnits(event.amountCents, data.currencyCode)}</span></li>)}</ul>
            </details>}
          </BandRow>) : <Empty>No shifts yet.</Empty>}
          <Pager basePath="/dashboard/platform/cash" params={params} nextCursor={data.shifts.nextCursor} shown={data.shifts.items.length} total={data.shifts.total} noun="shifts" />
        </ListBand>
      </section>
      <div className="grid items-start gap-8 lg:grid-cols-2">
        <Panel title="Open a shift"><OpenShiftForm registers={data.registers.items} /></Panel>
        <section>
          <SectionTitle meta={data.registers.total}>Registers</SectionTitle>
          <ListBand>
            {data.registers.items.length ? data.registers.items.map(register => <BandRow key={register.id} title={register.name} tone={statusTone(register.status)} state={<span >{sentenceCase(register.status)}</span>} detail={<span className="font-mono">{register.code}</span>} aside={<RegisterStatusForm register={register} />} />) : <Empty>No registers yet.</Empty>}
            <div className="bg-background/50 px-4 py-4"><RegisterForm /></div>
          </ListBand>
        </section>
        <section className="lg:col-span-2">
          <SectionTitle meta={data.tenders.filter(tender => tender.enabled).length} action={<Track><PillLink href="/dashboard/platform/authority#sales-rules">Change payment types</PillLink></Track>}>Payment types</SectionTitle>
          <ListBand>{data.tenders.length ? data.tenders.map(tender => <BandRow key={tender.id} title={tender.displayName} tone={tender.enabled ? 'ok' : 'muted'} state={tender.enabled ? 'Accepted' : 'Off'} detail={<><span className="font-mono">{tender.code}</span> · {tender.authorityReference} · until {formatWhen(tender.expiresAt, data.timezone)}</>} />) : <Empty>No payment types configured.</Empty>}</ListBand>
        </section>
      </div>
    </Workboard>;
  });
}

export async function ReconciliationWorkspacePage({ searchParams }: { searchParams?: SearchParams }) {
  const params = await readParams(searchParams);
  return frame('reconciliation', '/dashboard/platform/reconciliation', 'Reconciliation', params, data => <Workboard>
    <MetricStrip items={[
      { label: 'Waiting to send', value: data.pending.total, tone: data.pending.total ? 'warn' : 'muted' },
      { label: 'Failed or rejected', value: data.exceptions.total, tone: data.exceptions.total ? 'danger' : 'muted' },
      { label: 'Reconciliation runs', value: data.runs.total },
    ]} />
    {!data.delivery.workerAvailable && <Notice tone="warn">State reporting not connected. Report through the state system directly.</Notice>}
    <section>
      <SectionTitle meta={data.exceptions.total}>Failed or rejected reports</SectionTitle>
      <ListBand>
        {data.exceptions.items.length ? data.exceptions.items.map(event => <BandRow key={event.id} title={<span className="font-mono">{event.topic}</span>} tone="danger" state={<span >{sentenceCase(event.status)}</span>} detail={<>Attempts <span className="font-mono">{event.attempts}</span> · last {formatWhen(event.lastAttemptAt, data.timezone)} · <span className="font-mono">{event.lastErrorCode || 'no error code'}</span></>} aside={data.operating.open ? <RetryOutboxButton eventId={event.id} /> : undefined} />) : <Empty>No failed or rejected reports.</Empty>}
        {data.exceptions.nextCursor && <p className="px-4 py-2.5 font-mono text-xs text-muted-foreground">Oldest {data.exceptions.items.length} of {data.exceptions.total}</p>}
      </ListBand>
    </section>
    <div className="grid gap-8 lg:grid-cols-2">
      <section>
        <SectionTitle meta={data.pending.total}>Waiting to send</SectionTitle>
        <ListBand>
          {data.pending.items.length ? data.pending.items.map(event => <BandRow key={event.id} title={<span className="font-mono">{event.topic}</span>} tone={statusTone(event.status)} state={<span >{sentenceCase(event.status)}</span>} detail={`Queued since ${formatWhen(event.availableAt, data.timezone)}`} />) : <Empty>Nothing is waiting to send.</Empty>}
          {data.pending.nextCursor && <p className="px-4 py-2.5 font-mono text-xs text-muted-foreground">Oldest {data.pending.items.length} of {data.pending.total}</p>}
        </ListBand>
      </section>
      <section data-testid="reconciliation-workbench">
        <SectionTitle meta={data.runs.total}>Reconciliation runs</SectionTitle>
        <ListBand>
          {data.runs.items.length ? data.runs.items.map(run => <BandRow key={run.id} title={<span >{sentenceCase(run.type)}</span>} tone={run.discrepancyCount ? 'warn' : statusTone(run.status)} state={<span >{sentenceCase(run.status)}</span>} detail={`Started ${formatWhen(run.startedAt, data.timezone)}`} aside={<span className="font-mono text-xs">{run.discrepancyCount} discrepancies</span>} />) : <Empty>No reconciliation runs.</Empty>}
          <Pager basePath="/dashboard/platform/reconciliation" params={params} nextCursor={data.runs.nextCursor} shown={data.runs.items.length} total={data.runs.total} noun="runs" />
        </ListBand>
      </section>
    </div>
    <div className="grid gap-8 lg:grid-cols-2">
      <section>
        <SectionTitle meta={data.integrations.length}>Integrations</SectionTitle>
        <ListBand>{data.integrations.length ? data.integrations.map(integration => <BandRow key={integration.id} title={<span className="font-mono">{integration.providerCode}</span>} tone={statusTone(integration.status === 'unconfigured' ? 'pending' : integration.status)} state={sentenceCase(integration.status)}
          detail={<>{sentenceCase(integration.providerType)} · {integration.authorityReference}{integration.facilityReference ? ` · facility ${integration.facilityReference}` : ''} · {integration.lastSuccessfulSyncAt ? `last sync ${formatWhen(integration.lastSuccessfulSyncAt, data.timezone)}` : 'never synced'}</>} />) : <Empty>No integrations.</Empty>}</ListBand>
      </section>
      <section>
        <SectionTitle meta={data.inbox.total}>Inbound state events</SectionTitle>
        <ListBand>{data.inbox.items.length ? data.inbox.items.map(event => <BandRow key={event.id} title={<span className="font-mono">{event.providerEventId}</span>} tone={statusTone(event.status === 'processed' ? 'completed' : event.status)} state={sentenceCase(event.status)}
          detail={<>{event.providerCode} · received {formatWhen(event.receivedAt, data.timezone)}{event.rejectionReason ? ` · ${event.rejectionReason}` : ''}</>} />) : <Empty>No inbound events.</Empty>}</ListBand>
      </section>
    </div>
  </Workboard>);
}

export async function IncidentsWorkspacePage({ searchParams }: { searchParams?: SearchParams }) {
  const params = await readParams(searchParams);
  return frame('incidents', '/dashboard/platform/incidents', 'Incidents', params, data => <Workboard>
    <OperatingNotice operating={data.operating} />
    <MetricStrip items={[
      { label: 'Open incidents', value: data.openTotal, tone: data.openTotal ? 'warn' : 'muted' },
      { label: 'Notifications overdue', value: data.overdueTotal, tone: data.overdueTotal ? 'danger' : 'muted' },
      { label: 'Open high or critical', value: data.highTotal, tone: data.highTotal ? 'danger' : 'muted' },
    ]} />
    <section data-testid="incident-workbench">
      <SectionTitle meta={data.incidents.total} action={<nav aria-label="Incident filter"><Track>
        <PillLink href="/dashboard/platform/incidents" active={data.filter === 'open'}>Open</PillLink>
        <PillLink href="/dashboard/platform/incidents?filter=all" active={data.filter === 'all'}>All</PillLink>
      </Track></nav>}>Incidents</SectionTitle>
      <ListBand>
        {data.incidents.items.length ? data.incidents.items.map(incident => <BandRow id={`incident-${incident.id}`} key={incident.id} className="scroll-mt-20 target:bg-background/70"
          title={<span className="font-mono">{incident.reference}</span>} tone={SEVERITY_TONE[incident.severity] || 'muted'} state={<span >{sentenceCase(incident.severity)} · {sentenceCase(incident.status)}</span>}
          detail={<><span >{sentenceCase(incident.type)}</span> · occurred {formatWhen(incident.occurredAt, data.timezone)}</>}
          aside={<Status value={NOTIFICATION_LABEL[incident.notificationState] || readable(incident.notificationState)} tone={NOTIFICATION_TONE[incident.notificationState] || 'muted'} />}>
          {incident.notificationDueAt && <p className="mt-1 text-xs text-muted-foreground">Notify by {formatWhen(incident.notificationDueAt, data.timezone)}</p>}
          <p className="mt-2 max-w-3xl whitespace-pre-line break-words text-sm text-foreground">{incident.description}</p>
          {data.operating.open && <IncidentTransitionForm incident={incident} />}
        </BandRow>) : <Empty>{data.filter === 'open' ? 'No open incidents.' : 'No incidents recorded.'}</Empty>}
        <Pager basePath="/dashboard/platform/incidents" params={params} nextCursor={data.incidents.nextCursor} shown={data.incidents.items.length} total={data.incidents.total} noun="incidents" />
      </ListBand>
    </section>
    {data.operating.open ? <Panel title="Record an incident"><RecordIncidentForm timezone={data.timezone} /></Panel> : null}
  </Workboard>, data => data.overdueTotal ? { tone: 'danger', state: `${data.overdueTotal} notification${data.overdueTotal === 1 ? '' : 's'} overdue` } : operatingState(data.operating));
}
