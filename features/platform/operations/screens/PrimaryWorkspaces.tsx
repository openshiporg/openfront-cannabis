import Link from 'next/link';
import { formatMinorUnits } from '@/features/lib/money';
import { formatMicrounits } from '@/features/lib/quantity';
import { CartPreparationClient } from '@/features/platform/fulfillment/components/CartPreparationClient';
import { SaleReceiptDetail } from '@/features/platform/fulfillment/components/SaleReceiptDetail';
import {
  ButtonLink, Disclosure, ListBand, Notice, operatingState, Panel, RecordList, RecordRow, Ref, SectionTitle, StatusText, statusTone, Table, TabLink, Tabs, TEmpty, Td, Th, THead, Tr,
  type DotTone, codeLabel, INTERVAL_LABEL, sentenceCase,
} from '@/features/platform/components/cannabis-ui';
import { Empty, formatUsableThrough, formatWhen, Pager, SearchForm, Workboard } from '../components/WorkspaceKit';
import { CartPanel, CheckInForm, CloseShiftForm } from '../components/SaleForms';
import { AmendRulesDisclosure, RulePackForm } from '../components/RulePackForm';
import { AmendProductForm, ApproveVarianceForm, IncidentTransitionForm, NewProductForm, OpenShiftForm, RecordIncidentForm, RegisterForm, RegisterStatusForm, RenewAuthorityForm, TemporaryPasswordForm, PremisesDetailsForm, RetryOutboxButton, RevokeCredentialForm } from '../components/OperatorForms';

import { frame, readParams, type SearchParams } from '../lib/frame';

function OperatingNotice({ operating }: { operating: { open: boolean; reason: string | null; limited: boolean } }) {
  if (operating.open || operating.limited) return null;
  return <Notice tone="danger" action={<ButtonLink href="/dashboard/platform/authority" tone="primary">Open Authority</ButtonLink>}>Operating authority is not current: {operating.reason}. Read only until renewed.</Notice>;
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

type Access = 'inventory' | 'compliance' | 'authority' | 'sales' | 'finance' | 'reports';
const WORKSPACE_GROUPS: Array<{ title: string; items: Array<{ title: string; detail: string; href: string; access: Access }> }> = [
  { title: 'Sell', items: [
    { title: 'POS', detail: 'Carts, preparation and receipts', href: '/dashboard/platform/pos', access: 'sales' },
    { title: 'Sales', detail: 'Receipts and refunds', href: '/dashboard/platform/sales', access: 'sales' },
    { title: 'Cash', detail: 'Registers and shifts', href: '/dashboard/platform/cash', access: 'finance' },
  ] },
  { title: 'Stock', items: [
    { title: 'Inventory', detail: 'Packages, holds and custody', href: '/dashboard/platform/inventory', access: 'inventory' },
    { title: 'Receiving', detail: 'Packages against manifests', href: '/dashboard/platform/receiving', access: 'inventory' },
    { title: 'Menu', detail: 'Products and readiness', href: '/dashboard/platform/menu', access: 'inventory' },
  ] },
  { title: 'Compliance', items: [
    { title: 'Compliance', detail: 'Holds, verification and recalls', href: '/dashboard/platform/compliance', access: 'compliance' },
    { title: 'Customers', detail: 'Eligibility and history', href: '/dashboard/platform/customers', access: 'compliance' },
    { title: 'Recalls', detail: 'Recall cases and held packages', href: '/dashboard/platform/recalls', access: 'compliance' },
    { title: 'Incidents', detail: 'Incidents and deadlines', href: '/dashboard/platform/incidents', access: 'compliance' },
    { title: 'Reconciliation', detail: 'State reporting queue', href: '/dashboard/platform/reconciliation', access: 'reports' },
    { title: 'Audit log', detail: 'Who did what, and when', href: '/dashboard/platform/audit', access: 'reports' },
  ] },
  { title: 'Store', items: [
    { title: 'Authority', detail: 'Licenses, staff and sales rules', href: '/dashboard/platform/authority', access: 'authority' },
    { title: 'Staff', detail: 'People, roles and access', href: '/dashboard/platform/staff', access: 'authority' },
    { title: 'Store Settings', detail: 'Name, logo and accent', href: '/dashboard/platform/store-settings', access: 'authority' },
  ] },
];

const NOTIFICATION_LABEL: Record<string, string> = { none: 'No deadline', overdue: 'Notification overdue', due_soon: 'Due within 24 hours', upcoming: 'Upcoming deadline', resolved: 'Resolved', unknown: 'Deadline unknown' };
const NOTIFICATION_TONE: Record<string, DotTone> = { none: 'muted', overdue: 'danger', due_soon: 'warn', upcoming: 'info', resolved: 'ok', unknown: 'warn' };
const SEVERITY_TONE: Record<string, DotTone> = { low: 'info', medium: 'warn', high: 'danger', critical: 'danger' };

/** Two columns on wide screens: the main work on the left, the reference on the right. */
function Split({ children, side = '22rem' }: { children: React.ReactNode; side?: string }) {
  return <div className="grid items-start gap-6 [&>*]:min-w-0 xl:[grid-template-columns:minmax(0,1fr)_var(--side)]" style={{ '--side': side } as React.CSSProperties}>{children}</div>;
}

export async function ControlRoomPage({ searchParams }: { searchParams?: SearchParams }) {
  const params = await readParams(searchParams);
  return frame('overview', '/dashboard/platform', 'Control room', params, data => {
    // What needs a person now, most urgent first: regulator deadlines, then stock that can't be sold.
    const queue: Array<{ label: string; count: number; tone: DotTone; href: string; action: string }> = [
      ...(data.incidents ? [
        { label: 'Regulator notifications overdue', count: data.incidents.overdueTotal, tone: 'danger' as const, href: '/dashboard/platform/incidents', action: 'Notify' },
        { label: 'Open incidents', count: data.incidents.openTotal, tone: 'warn' as const, href: '/dashboard/platform/incidents', action: 'Review' },
      ] : []),
      ...(data.inventory ? [
        { label: 'Packages on hold or recalled', count: data.inventory.heldTotal, tone: 'danger' as const, href: '/dashboard/platform/inventory?filter=held', action: 'Review' },
        { label: 'Packages in receiving hold', count: data.inventory.receivingTotal, tone: 'warn' as const, href: '/dashboard/platform/inventory?filter=receiving', action: 'Release' },
      ] : []),
    ].filter(item => item.count > 0);
    const groups = WORKSPACE_GROUPS.map(group => ({ ...group, items: group.items.filter(item => data.access[item.access]) })).filter(group => group.items.length);
    return <Workboard>
      <OperatingNotice operating={data.operating} />
      <section aria-labelledby="queue-title">
        <SectionTitle id="queue-title" meta={queue.length || undefined}>Needs attention</SectionTitle>
        {queue.length ? <Table label="Needs attention" minWidth={420}>
          <THead><Th>Item</Th><Th align="right">Count</Th><Th align="right"><span className="sr-only">Action</span></Th></THead>
          <tbody>{queue.map(item => <Tr key={item.label}>
            <Td><StatusText tone={item.tone}>{item.label}</StatusText></Td>
            <Td align="right" className="font-semibold">{item.count}</Td>
            <Td align="right" className="w-px py-1.5"><ButtonLink href={item.href}>{item.action}</ButtonLink></Td>
          </Tr>)}</tbody>
        </Table> : <Notice tone="ok">Nothing needs attention. {data.inventory ? `${data.inventory.readyTotal} package${data.inventory.readyTotal === 1 ? '' : 's'} ready to sell.` : ''}</Notice>}
      </section>
      <Split side="minmax(0,0.9fr)">
        {data.inventory && <section>
          <SectionTitle meta={data.inventory.readyTotal} action={<ButtonLink href="/dashboard/platform/inventory?filter=ready" tone="quiet">All ready</ButtonLink>}>Ready to sell, soonest expiry</SectionTitle>
          <Table label="Ready to sell" minWidth={520}>
            <THead><Th>Package</Th><Th>Product</Th><Th align="right">Free</Th><Th align="right">Usable through</Th></THead>
            <tbody>{data.inventory.ready.length ? data.inventory.ready.map(pkg => <Tr key={pkg.id}>
              <Td><Link href={`/dashboard/platform/inventory?search=${encodeURIComponent(pkg.packageUid)}`} className="underline-offset-4 hover:underline"><Ref>{pkg.packageUid}</Ref></Link></Td>
              <Td className="text-muted-foreground">{pkg.product?.name || 'Product not recorded'}</Td>
              <Td align="right">{formatMicrounits(pkg.quantityOnHandMicrounits - pkg.reservedMicrounits, pkg.unitOfMeasure)}</Td>
              <Td align="right" className="whitespace-nowrap text-muted-foreground">{formatUsableThrough(pkg.expiresAt, data.timezone)}</Td>
            </Tr>) : <TEmpty colSpan={4}>No packages are ready to sell.</TEmpty>}</tbody>
          </Table>
        </section>}
        {data.incidents && <section>
          <SectionTitle meta={data.incidents.openTotal} action={<ButtonLink href="/dashboard/platform/incidents" tone="quiet">All incidents</ButtonLink>}>Open incidents</SectionTitle>
          <Table label="Open incidents" minWidth={420}>
            <THead><Th>Incident</Th><Th>Type</Th><Th>Notification</Th></THead>
            <tbody>{data.incidents.open.length ? data.incidents.open.map(incident => <Tr key={incident.id}>
              <Td><Link href={`/dashboard/platform/incidents#incident-${incident.id}`} className="underline-offset-4 hover:underline"><Ref>{incident.reference}</Ref></Link></Td>
              <Td className="text-muted-foreground">{sentenceCase(incident.type)} · {sentenceCase(incident.severity)}</Td>
              <Td><StatusText tone={NOTIFICATION_TONE[incident.notificationState] || 'muted'}>{NOTIFICATION_LABEL[incident.notificationState] || sentenceCase(incident.notificationState)}</StatusText></Td>
            </Tr>) : <TEmpty colSpan={3}>No open incidents.</TEmpty>}</tbody>
          </Table>
        </section>}
      </Split>
      <section aria-labelledby="workspaces-title">
        <SectionTitle id="workspaces-title">Your workspaces</SectionTitle>
        <div className="grid gap-x-6 gap-y-5 rounded-md border border-border bg-card p-4 sm:grid-cols-2 xl:grid-cols-4">
          {groups.map(group => <div key={group.title} className="min-w-0">
            <h3 className="text-xs font-medium text-muted-foreground">{group.title}</h3>
            <ul className="mt-1.5 space-y-0.5">{group.items.map(item => <li key={item.href}>
              <Link href={item.href} className="-mx-2 flex min-h-9 flex-col justify-center rounded-[5px] px-2 py-1 transition-colors hover:bg-muted">
                <span className="text-[13px] font-medium text-foreground">{item.title}</span>
                <span className="text-xs text-muted-foreground">{item.detail}</span>
              </Link>
            </li>)}</ul>
          </div>)}
        </div>
      </section>
    </Workboard>;
  });
}

const LICENSE_COLUMNS = 'minmax(0,1.1fr) minmax(0,1.3fr) minmax(0,1.2fr) minmax(0,1fr)';
const LICENSE_HEADERS = [{ label: 'License' }, { label: 'Type and regulator' }, { label: 'Valid' }, { label: 'Status' }];
const CREDENTIAL_COLUMNS = 'minmax(0,1fr) minmax(0,1fr) minmax(0,1.2fr) minmax(0,0.7fr) minmax(0,1fr)';
const CREDENTIAL_HEADERS = [{ label: 'Person' }, { label: 'Credential' }, { label: 'Valid' }, { label: 'Approval limit', align: 'right' as const }, { label: 'Status' }];

export async function AuthorityWorkspacePage({ searchParams }: { searchParams?: SearchParams }) {
  const params = await readParams(searchParams);
  return frame('authority', '/dashboard/platform/authority', 'Authority', params, data => {
    const lapsing = data.licenses.items.filter(license => ['expired', 'expiring_soon'].includes(license.intervalState)).length;
    const rules = data.rules;
    const intervalTone = (item: { intervalState: string; status: string }) => statusTone(item.intervalState === 'current' ? item.status : item.intervalState);
    return <Workboard>
      <OperatingNotice operating={data.operating} />
      {lapsing > 0 && <Notice tone="warn">{lapsing} license{lapsing === 1 ? '' : 's'} expired or expiring within 30 days. Renew below.</Notice>}
      <section data-testid="authority-workbench">
        <SectionTitle meta={data.licenses.total}>Licenses</SectionTitle>
        <RecordList label="Licenses" columns={LICENSE_COLUMNS} headers={LICENSE_HEADERS}>
          {data.licenses.items.length ? data.licenses.items.map(license => <RecordRow key={license.id} columns={LICENSE_COLUMNS} headers={LICENSE_HEADERS} cells={[
            <Ref key="n" className="font-medium">{license.licenseNumber}</Ref>,
            <span key="t">{license.licenseType} <span className="text-muted-foreground">· {license.regulatorName}</span></span>,
            <span key="v" className="text-muted-foreground">{formatWhen(license.effectiveAt, data.timezone)} – {formatWhen(license.expiresAt, data.timezone)}</span>,
            <StatusText key="s" tone={intervalTone(license)}>{license.intervalState === 'current' ? sentenceCase(license.status) : INTERVAL_LABEL[license.intervalState]}</StatusText>,
          ]}>
            {['expired', 'expiring_soon'].includes(license.intervalState) && <RenewAuthorityForm kind="license" id={license.id} />}
          </RecordRow>) : <Empty>No licenses are recorded.</Empty>}
          {data.licenses.nextCursor && <p className="px-3 py-2 text-xs text-muted-foreground">First {data.licenses.items.length} of {data.licenses.total} licenses</p>}
        </RecordList>
      </section>
      <section>
        <SectionTitle meta={data.credentials.total} action={<ButtonLink href="/dashboard/platform/staff" tone="quiet">Staff, roles and access</ButtonLink>}>Staff credentials</SectionTitle>
        <RecordList label="Staff credentials" columns={CREDENTIAL_COLUMNS} headers={CREDENTIAL_HEADERS}>
          {data.credentials.items.length ? data.credentials.items.map(credential => {
            const actions = [
              data.operating.open && credential.user && <TemporaryPasswordForm key="p" userId={credential.user.id} name={credential.user.name} />,
              data.operating.open && credential.id !== data.self.credentialId && <RevokeCredentialForm key="r" credentialId={credential.id} status={credential.status} name={credential.user?.name || 'this person'} />,
              ['expired', 'expiring_soon', 'inactive'].includes(credential.intervalState) && credential.status !== 'terminated' && <RenewAuthorityForm key="n" kind="credential" id={credential.id} />,
            ].filter(Boolean);
            return <RecordRow key={credential.id} columns={CREDENTIAL_COLUMNS} headers={CREDENTIAL_HEADERS} cells={[
              <span key="n" className="font-medium">{credential.user?.name || 'Unassigned'}{credential.id === data.self.credentialId && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>}</span>,
              <span key="t" className="text-muted-foreground">{credential.credentialType}</span>,
              <span key="v" className="text-muted-foreground">{formatWhen(credential.effectiveAt, data.timezone)} – {formatWhen(credential.expiresAt, data.timezone)}</span>,
              <span key="l">{formatMinorUnits(credential.approvalLimitCents ?? 0, data.currencyCode)}</span>,
              <StatusText key="s" tone={intervalTone(credential)}>{credential.intervalState === 'current' ? sentenceCase(credential.status) : INTERVAL_LABEL[credential.intervalState]}</StatusText>,
            ]}>
              {actions.length > 0 && <div className="mt-2 flex flex-wrap items-start gap-2">{actions}</div>}
            </RecordRow>;
          }) : <Empty>No staff credentials are recorded.</Empty>}
          <Pager basePath="/dashboard/platform/authority" params={params} nextCursor={data.credentials.nextCursor} shown={data.credentials.items.length} total={data.credentials.total} noun="credentials" />
        </RecordList>
      </section>
      <Split side="minmax(0,1fr)">
        <section id="sales-rules" className="scroll-mt-20">
          <SectionTitle meta={rules?.version} action={rules ? <StatusText tone={data.salesRules.problem ? 'danger' : 'ok'}>{data.salesRules.problem ? 'Invalid' : 'In effect'}</StatusText> : undefined}>Sales rules</SectionTitle>
          {data.salesRules.problem && <Notice tone="danger" className="mb-3">{data.salesRules.problem}</Notice>}
          {rules ? <ListBand>
            <dl className="divide-y divide-border/70 text-[13px]">
              {([
                ['Validity', `${formatWhen(rules.effectiveAt, data.timezone)} – ${formatWhen(rules.expiresAt, data.timezone)}`],
                ['Hours', <span key="h" className="tabular-nums">{minuteLabel(rules.operatingStartMinute)}–{minuteLabel(rules.operatingEndMinute)}</span>],
                ['Minimum age', <>Adult-use {rules.adultMinimumAge}{rules.medicalEnabled ? <> · medical {rules.medicalMinimumAge}</> : ' · medical sales off'}</>],
                ['Purchase limits', rules.purchaseLimits.length ? rules.purchaseLimits.map((rule, index) => <span key={index} className="block">{describeLimit(rule)}</span>) : 'None'],
                ['Tax rules', rules.taxRules.length ? rules.taxRules.map((rule, index) => <span key={index} className="block">{describeTax(rule)}</span>) : 'None'],
                ['Payment types', rules.allowedTenderTypes.map(type => TENDER_LABEL[type] ?? sentenceCase(type)).join(', ') || 'None'],
              ] as Array<[string, React.ReactNode]>).map(([term, value]) => <div key={term} className="grid gap-1 px-3 py-2 sm:grid-cols-[9rem_minmax(0,1fr)]"><dt className="text-muted-foreground">{term}</dt><dd className="min-w-0 break-words">{value}</dd></div>)}
            </dl>
            {data.self.isOwner && <AmendRulesDisclosure initiallyOpen={Boolean(data.salesRules.problem)}><RulePackForm rules={rules} approvalLimitCents={data.self.approvalLimitCents} /></AmendRulesDisclosure>}
          </ListBand> : <ListBand><Empty>No sales rules installed.</Empty></ListBand>}
          {data.ruleVersions.length > 1 && <div className="mt-4">
            <SectionTitle meta={data.ruleVersions.length}>Sales rule versions</SectionTitle>
            <Table label="Sales rule versions" minWidth={480}>
              <THead><Th>Version</Th><Th>Valid</Th><Th>Approved by</Th><Th>Status</Th></THead>
              <tbody>{data.ruleVersions.map(version => <Tr key={version.id}>
                <Td><Ref>{version.version}</Ref></Td>
                <Td className="text-muted-foreground">{formatWhen(version.effectiveAt, data.timezone)} – {formatWhen(version.expiresAt, data.timezone)}</Td>
                <Td className="text-muted-foreground">{version.approvedBy?.name || '—'}</Td>
                <Td><StatusText tone={version.status === 'effective' ? 'ok' : 'muted'}>{sentenceCase(version.status)}</StatusText></Td>
              </Tr>)}</tbody>
            </Table>
          </div>}
        </section>
        <section id="premises" className="scroll-mt-20">
          <SectionTitle meta={data.premises.name}>Premises</SectionTitle>
          <ListBand>
            <dl className="divide-y divide-border/70 text-[13px]">
              <div className="grid gap-1 px-3 py-2 sm:grid-cols-[6rem_minmax(0,1fr)]"><dt className="text-muted-foreground">Address</dt><dd className="min-w-0 break-words">{[data.premises.line1, [data.premises.city, [data.premises.region, data.premises.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', '), data.premises.country].filter(Boolean).join(' · ') || 'Not recorded'}</dd></div>
              <div className="grid gap-1 px-3 py-2 sm:grid-cols-[6rem_minmax(0,1fr)]"><dt className="text-muted-foreground">Phone</dt><dd>{data.premises.phone || <StatusText tone="warn">Not recorded · not shown on the storefront</StatusText>}</dd></div>
            </dl>
            {data.self.isOwner && <AmendRulesDisclosure initiallyOpen={false} label="Edit address and phone"><PremisesDetailsForm premises={data.premises} /></AmendRulesDisclosure>}
          </ListBand>
          <p className="mt-2 text-xs text-muted-foreground">Your approval limit: {formatMinorUnits(data.self.approvalLimitCents, data.currencyCode)}</p>
        </section>
      </Split>
    </Workboard>;
  });
}

export async function ComplianceWorkspacePage({ searchParams }: { searchParams?: SearchParams }) {
  const params = await readParams(searchParams);
  return frame('compliance', '/dashboard/platform/compliance', 'Compliance', params, data => <Workboard>
    <section data-testid="compliance-workbench">
      <SectionTitle meta={data.holds.total} action={<ButtonLink href="/dashboard/platform/inventory?filter=held" tone="quiet">Held packages in inventory</ButtonLink>}>Active package holds</SectionTitle>
      <Table label="Active package holds" minWidth={560}>
        <THead><Th>Package</Th><Th>Hold</Th><Th>Reason</Th><Th align="right">Placed</Th></THead>
        <tbody>{data.holds.items.length ? data.holds.items.map(hold => <Tr key={hold.id}>
          <Td><Link href={`/dashboard/platform/inventory?search=${encodeURIComponent(hold.package?.packageUid || '')}`} className="underline-offset-4 hover:underline"><Ref>{hold.package?.packageUid || 'Not recorded'}</Ref></Link></Td>
          <Td><StatusText tone="danger">{sentenceCase(hold.type)} hold</StatusText></Td>
          <Td className="text-muted-foreground">{codeLabel(hold.reasonCode)}</Td>
          <Td align="right" className="whitespace-nowrap text-muted-foreground">{formatWhen(hold.placedAt, data.timezone)}</Td>
        </Tr>) : <TEmpty colSpan={4}>No active package holds.</TEmpty>}</tbody>
      </Table>
      {data.holds.nextCursor && <p className="mt-1.5 text-xs text-muted-foreground">Oldest {data.holds.items.length} of {data.holds.total} holds</p>}
    </section>
    <Split side="minmax(0,1fr)">
      <section>
        <SectionTitle meta={data.pendingCustomers.total} action={<ButtonLink href="/dashboard/platform/customers?filter=pending_verification" tone="quiet">All customers</ButtonLink>}>Awaiting verification</SectionTitle>
        <Table label="Customers awaiting verification" minWidth={420}>
          <THead><Th>Customer</Th><Th>Capacity</Th><Th>Since</Th><Th>Status</Th></THead>
          <tbody>{data.pendingCustomers.items.length ? data.pendingCustomers.items.map(customer => <Tr key={`${customer.kind}:${customer.id}`}>
            <Td><Link href={`/dashboard/platform/customers/${encodeURIComponent(customer.id)}`} className="underline-offset-4 hover:underline"><Ref>{customer.reference}</Ref></Link></Td>
            <Td className="text-muted-foreground">{sentenceCase(customer.capacity)}</Td>
            <Td className="whitespace-nowrap text-muted-foreground">{formatWhen(customer.createdAt, data.timezone)}</Td>
            <Td><StatusText tone={statusTone(customer.status)}>{sentenceCase(customer.status)}</StatusText></Td>
          </Tr>) : <TEmpty colSpan={4}>No customers are awaiting verification.</TEmpty>}</tbody>
        </Table>
        <Pager basePath="/dashboard/platform/compliance" params={params} nextCursor={data.pendingCustomers.nextCursor} shown={data.pendingCustomers.items.length} total={data.pendingCustomers.total} noun="customers" />
      </section>
      <section>
        <SectionTitle meta={data.recalls.total} action={<ButtonLink href="/dashboard/platform/recalls" tone="quiet">Recalls</ButtonLink>}>Recall cases</SectionTitle>
        <Table label="Recall cases" minWidth={420}>
          <THead><Th>Recall</Th><Th>Reason</Th><Th>Opened</Th><Th>Status</Th></THead>
          <tbody>{data.recalls.items.length ? data.recalls.items.map(recall => <Tr key={`${recall.kind}:${recall.id}`}>
            <Td><Ref>{recall.reference}</Ref></Td>
            <Td className="text-muted-foreground">{recall.reason}</Td>
            <Td className="whitespace-nowrap text-muted-foreground">{formatWhen(recall.openedAt, data.timezone)}</Td>
            <Td><StatusText tone={statusTone(recall.status)}>{sentenceCase(recall.status)}</StatusText></Td>
          </Tr>) : <TEmpty colSpan={4}>No recall cases.</TEmpty>}</tbody>
        </Table>
        {data.recalls.nextCursor && <p className="mt-1.5 text-xs text-muted-foreground">Latest {data.recalls.items.length} of {data.recalls.total} recalls</p>}
      </section>
    </Split>
  </Workboard>, data => {
    const waiting = data.holds.total + data.pendingCustomers.total;
    return data.holds.total ? { tone: 'danger', state: `${data.holds.total} package hold${data.holds.total === 1 ? '' : 's'}` } : waiting ? { tone: 'warn', state: `${data.pendingCustomers.total} awaiting verification` } : operatingState(data.operating);
  });
}

const MENU_COLUMNS = 'minmax(0,2fr) minmax(0,0.8fr) minmax(0,0.9fr) minmax(0,0.6fr) minmax(0,1fr) minmax(0,1.1fr)';
const MENU_HEADERS = [{ label: 'Product' }, { label: 'Form' }, { label: 'Channel' }, { label: 'Price', align: 'right' as const }, { label: 'Free stock', align: 'right' as const }, { label: 'Status' }];

export async function MenuWorkspacePage({ searchParams }: { searchParams?: SearchParams }) {
  const params = await readParams(searchParams);
  return frame('menu', '/dashboard/platform/menu', 'Menu', params, data => {
    const ready = data.products.items.filter(product => product.readyPackageCount > 0).length;
    return <Workboard>
      <section data-testid="menu-workbench">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-muted-foreground"><span className="font-semibold text-foreground tabular-nums">{data.products.total}</span> active · <span className="tabular-nums">{ready}</span> {data.products.nextCursor ? `of the first ${data.products.items.length} ` : ''}ready to sell · <span className="tabular-nums">{data.inactiveTotal}</span> inactive or draft</p>
          <SearchForm basePath="/dashboard/platform/menu" params={params} label="Search products" placeholder="Name or SKU" />
        </div>
        <RecordList label="Products" columns={MENU_COLUMNS} headers={MENU_HEADERS}>
          {data.products.items.length ? data.products.items.map(product => {
            const missing = [!data.categories.limit.includes(product.categoryCode) && `No purchase limit for ${product.categoryCode}`, !data.categories.tax.includes(product.taxCategoryCode) && `No tax rule for ${product.taxCategoryCode}`].filter(Boolean).join(' · ');
            const tone: DotTone = missing ? 'danger' : product.readyPackageCount > 0 ? 'ok' : product.status === 'active' ? 'warn' : 'muted';
            return <RecordRow key={product.id} columns={MENU_COLUMNS} headers={MENU_HEADERS} cells={[
              <span key="n" className="block min-w-0"><Link href={`/dashboard/platform/menu/${encodeURIComponent(product.id)}`} className="font-medium underline-offset-4 hover:underline">{product.name}</Link><span className="block text-xs text-muted-foreground"><Ref>{product.sku}</Ref> · limit {product.categoryCode} · tax {product.taxCategoryCode}</span></span>,
              <span key="f">{product.form}</span>,
              <span key="c" className="text-muted-foreground">{[product.adultUseEligible && 'Adult-use', product.medicalEligible && 'Medical'].filter(Boolean).join(', ') || 'None'}</span>,
              <span key="p" className="font-medium">{formatMinorUnits(product.priceCents, data.currencyCode)}</span>,
              <span key="s" className={product.readyPackageCount > 0 ? '' : 'text-muted-foreground'}>{product.readyPackageCount > 0 ? <>{formatMicrounits(product.availableMicrounits, product.unitOfMeasure)} <span className="text-xs text-muted-foreground">· {product.readyPackageCount}{product.readyCountComplete ? '' : '+'} pkg</span></> : 'None'}</span>,
              <StatusText key="t" tone={tone}>{missing || (product.readyPackageCount > 0 ? 'Ready to sell' : product.status === 'active' ? 'Not ready' : sentenceCase(product.status))}</StatusText>,
            ]}>
              {data.operating.open && <details className="group mt-1.5">
                <summary className="inline-flex cursor-pointer list-none items-center text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline [&::-webkit-details-marker]:hidden">Edit</summary>
                <div className="mt-2 rounded-md border border-border bg-background p-3"><AmendProductForm product={product} limitCategories={data.categories.limit} taxCategories={data.categories.tax} /></div>
              </details>}
            </RecordRow>;
          }) : <Empty>{params.search ? 'No products match this search.' : 'No active products yet.'}</Empty>}
          <Pager basePath="/dashboard/platform/menu" params={params} nextCursor={data.products.nextCursor} shown={data.products.items.length} total={data.products.total} noun="products" />
        </RecordList>
      </section>
      <Disclosure label="Add a product"><NewProductForm limitCategories={data.categories.limit} taxCategories={data.categories.tax} /></Disclosure>
    </Workboard>;
  });
}

export async function PosFulfillmentWorkspacePage({ searchParams }: { searchParams?: SearchParams }) {
  const params = await readParams(searchParams);
  return frame('pos', '/dashboard/platform/pos', 'POS', params, data => {
    const finalVerification = data.carts.items.filter(cart => cart.status === 'final_verification').length;
    return <Workboard>
      {params.sale && <SaleReceiptDetail saleId={params.sale} currencyCode={data.currencyCode} timezone={data.timezone} />}
      <Split side="minmax(0,1.05fr)">
        <div className="min-w-0 space-y-6">
          {data.operating.open && <Panel title="New sale">{data.myShifts.length ? <CheckInForm shifts={data.myShifts} medicalEnabled={data.medicalEnabled} /> : <Notice tone="warn" action={<ButtonLink href="/dashboard/platform/cash" tone="primary">Open a shift</ButtonLink>}>Open a shift on a register to sell</Notice>}</Panel>}
          <section data-testid="pos-fulfillment-workbench">
            <SectionTitle meta={<>{data.carts.total}{finalVerification ? ` · ${finalVerification} in final verification` : ''}</>}>Open carts</SectionTitle>
            <ListBand>
              {data.carts.items.length ? data.carts.items.map(cart => <div key={cart.id} className="px-3 py-2.5">
                <div className="grid gap-1 text-[13px] sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-baseline sm:gap-4">
                  <span className="min-w-0"><Ref className="font-medium">{cart.reference}</Ref><span className="ml-2 text-xs text-muted-foreground">customer <Ref>{cart.customer?.reference || 'not recorded'}</Ref>{cart.customer ? ` · ${sentenceCase(cart.customer.capacity)}` : ''} · expires {formatWhen(cart.expiresAt, data.timezone)}</span></span>
                  <StatusText tone={statusTone(cart.status)}>{sentenceCase(cart.status)}</StatusText>
                  <span className="font-semibold tabular-nums sm:text-right">{formatMinorUnits(cart.totalCents, data.currencyCode)}</span>
                </div>
                {cart.source === 'pos' && data.operating.open && <div className="mt-3"><CartPanel cart={cart} products={data.products.items} tenderTypes={data.tenderTypes} currencyCode={data.currencyCode} actorId={data.actorId} /></div>}
              </div>) : <Empty>No open carts.</Empty>}
              <Pager basePath="/dashboard/platform/pos" params={params} nextCursor={data.carts.nextCursor} shown={data.carts.items.length} total={data.carts.total} noun="carts" />
            </ListBand>
          </section>
        </div>
        <CartPreparationClient timezone={data.timezone} authorityFingerprint={data.authorityFingerprint} currencyCode={data.currencyCode}
          products={data.products.items} productsHasMore={Boolean(data.products.nextCursor)}
          carts={data.carts.items.map(cart => ({ id: cart.id, reference: cart.reference }))} />
      </Split>
      <section>
        <SectionTitle meta={data.sales.total} action={<ButtonLink href="/dashboard/platform/sales" tone="quiet">All sales</ButtonLink>}>Recent receipts</SectionTitle>
        <Table label="Recent receipts" minWidth={480}>
          <THead><Th>Receipt</Th><Th>Finalized</Th><Th>Status</Th><Th align="right">Total</Th></THead>
          <tbody>{data.sales.items.length ? data.sales.items.map(sale => <Tr key={sale.id} className={params.sale === sale.id ? 'bg-muted/50' : undefined}>
            <Td><Link href={`/dashboard/platform/pos?sale=${encodeURIComponent(sale.id)}`} aria-current={params.sale === sale.id ? 'page' : undefined} className="underline-offset-4 hover:underline"><Ref>{sale.receiptNumber}</Ref></Link></Td>
            <Td className="whitespace-nowrap text-muted-foreground">{formatWhen(sale.finalizedAt, data.timezone)}</Td>
            <Td><StatusText tone={statusTone(sale.status)}>{sentenceCase(sale.status)}</StatusText></Td>
            <Td align="right" className="font-medium">{formatMinorUnits(sale.totalCents, data.currencyCode)}</Td>
          </Tr>) : <TEmpty colSpan={4}>No receipts yet.</TEmpty>}</tbody>
        </Table>
        {data.sales.nextCursor && <p className="mt-1.5 text-xs text-muted-foreground">Latest {data.sales.items.length} of {data.sales.total} receipts</p>}
      </section>
    </Workboard>;
  }, data => data.carts.total ? { tone: 'warn', state: `${data.carts.total} open cart${data.carts.total === 1 ? '' : 's'}` } : operatingState(data.operating));
}

const SHIFT_COLUMNS = 'minmax(0,1.1fr) minmax(0,1fr) minmax(0,1.2fr) minmax(0,0.8fr) minmax(0,0.8fr) minmax(0,1fr)';
const SHIFT_HEADERS = [{ label: 'Register' }, { label: 'Operator' }, { label: 'Opened' }, { label: 'Float', align: 'right' as const }, { label: 'Variance', align: 'right' as const }, { label: 'Status' }];

export async function CashWorkspacePage({ searchParams }: { searchParams?: SearchParams }) {
  const params = await readParams(searchParams);
  return frame('cash', '/dashboard/platform/cash', 'Cash', params, data => <Workboard>
    <Split side="20rem">
      <section data-testid="cash-workbench">
        <SectionTitle meta={data.shifts.total}>Shifts</SectionTitle>
        <RecordList label="Shifts" columns={SHIFT_COLUMNS} headers={SHIFT_HEADERS}>
          {data.shifts.items.length ? data.shifts.items.map(shift => <RecordRow key={shift.id} columns={SHIFT_COLUMNS} headers={SHIFT_HEADERS} cells={[
            <span key="r" className="font-medium">{shift.register?.name || 'Register not recorded'}</span>,
            <span key="o" className="text-muted-foreground">{shift.operator?.name || 'Not recorded'}</span>,
            <span key="t" className="text-muted-foreground">{formatWhen(shift.openedAt, data.timezone)}</span>,
            <span key="f">{formatMinorUnits(shift.openingFloatCents, data.currencyCode)}</span>,
            shift.varianceCents == null ? <span key="v" className="text-xs text-muted-foreground">No count yet</span> : <span key="v" className={shift.varianceCents === 0 ? '' : 'font-medium text-amber-700 dark:text-amber-400'}>{shift.varianceCents > 0 ? '+' : ''}{formatMinorUnits(shift.varianceCents, data.currencyCode)}</span>,
            <StatusText key="s" tone={statusTone(shift.status)}>{sentenceCase(shift.status)}</StatusText>,
          ]}>
            {shift.status === 'variance_review' && <ApproveVarianceForm shiftId={shift.id} />}
            {shift.status === 'open' && shift.operator?.id === data.actorId && data.operating.open && <div className="mt-2"><CloseShiftForm shiftId={shift.id} /></div>}
            {shift.cashEvents.length > 0 && <details className="mt-1.5"><summary className="inline-flex cursor-pointer list-none text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline [&::-webkit-details-marker]:hidden">Drawer ledger ({shift.cashEvents.length})</summary>
              <ul className="mt-2 divide-y divide-border/70 rounded-md border border-border text-xs">{shift.cashEvents.map(event => <li key={event.id} className="flex flex-wrap items-baseline justify-between gap-x-3 px-2.5 py-1.5"><span>{sentenceCase(event.type)} · {codeLabel(event.reasonCode)} · {event.actor?.name || 'System'} · {formatWhen(event.occurredAt, data.timezone)}</span><span className="tabular-nums">{formatMinorUnits(event.amountCents, data.currencyCode)}</span></li>)}</ul>
            </details>}
          </RecordRow>) : <Empty>No shifts yet.</Empty>}
          <Pager basePath="/dashboard/platform/cash" params={params} nextCursor={data.shifts.nextCursor} shown={data.shifts.items.length} total={data.shifts.total} noun="shifts" />
        </RecordList>
      </section>
      <Panel title="Open a shift"><OpenShiftForm registers={data.registers.items} /></Panel>
    </Split>
    <Split side="minmax(0,1fr)">
      <section>
        <SectionTitle meta={data.registers.total}>Registers</SectionTitle>
        <ListBand>
          {data.registers.items.length ? data.registers.items.map(register => <div key={register.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-[13px]">
            <span className="min-w-0"><span className="font-medium">{register.name}</span> <Ref className="ml-1 text-muted-foreground">{register.code}</Ref> <StatusText tone={statusTone(register.status)} className="ml-2 text-xs">{sentenceCase(register.status)}</StatusText></span>
            <RegisterStatusForm register={register} />
          </div>) : <Empty>No registers yet.</Empty>}
          <div className="bg-muted/30 px-3 py-3"><RegisterForm /></div>
        </ListBand>
      </section>
      <section>
        <SectionTitle meta={data.tenders.filter(tender => tender.enabled).length} action={<ButtonLink href="/dashboard/platform/authority#sales-rules" tone="quiet">Change payment types</ButtonLink>}>Payment types</SectionTitle>
        <Table label="Payment types" minWidth={420}>
          <THead><Th>Type</Th><Th>Authority</Th><Th>Until</Th><Th>Status</Th></THead>
          <tbody>{data.tenders.length ? data.tenders.map(tender => <Tr key={tender.id}>
            <Td className="font-medium">{tender.displayName}</Td>
            <Td className="text-muted-foreground">{tender.authorityReference}</Td>
            <Td className="whitespace-nowrap text-muted-foreground">{formatWhen(tender.expiresAt, data.timezone)}</Td>
            <Td><StatusText tone={tender.enabled ? 'ok' : 'muted'}>{tender.enabled ? 'Accepted' : 'Off'}</StatusText></Td>
          </Tr>) : <TEmpty colSpan={4}>No payment types configured.</TEmpty>}</tbody>
        </Table>
      </section>
    </Split>
  </Workboard>, data => {
    const review = data.shifts.items.filter(shift => shift.status === 'variance_review').length;
    const open = data.shifts.items.filter(shift => shift.status === 'open').length;
    return review ? { tone: 'warn', state: `${review} variance review${review === 1 ? '' : 's'}` } : { tone: open ? 'ok' : 'muted', state: `${open}${data.shifts.nextCursor ? '+' : ''} open shift${open === 1 ? '' : 's'}` };
  });
}

export async function ReconciliationWorkspacePage({ searchParams }: { searchParams?: SearchParams }) {
  const params = await readParams(searchParams);
  return frame('reconciliation', '/dashboard/platform/reconciliation', 'Reconciliation', params, data => <Workboard>
    {!data.delivery.workerAvailable && <Notice tone="warn">State reporting not connected. Report through the state system directly.</Notice>}
    <section>
      <SectionTitle meta={data.exceptions.total}>Failed or rejected reports</SectionTitle>
      <Table label="Failed or rejected reports" minWidth={620}>
        <THead><Th>Topic</Th><Th align="right">Attempts</Th><Th>Last attempt</Th><Th>Error</Th><Th>Status</Th><Th align="right"><span className="sr-only">Action</span></Th></THead>
        <tbody>{data.exceptions.items.length ? data.exceptions.items.map(event => <Tr key={event.id}>
          <Td><Ref>{event.topic}</Ref></Td>
          <Td align="right">{event.attempts}</Td>
          <Td className="whitespace-nowrap text-muted-foreground">{formatWhen(event.lastAttemptAt, data.timezone)}</Td>
          <Td><Ref className="text-muted-foreground">{event.lastErrorCode || 'No error code'}</Ref></Td>
          <Td><StatusText tone="danger">{sentenceCase(event.status)}</StatusText></Td>
          <Td align="right" className="w-px py-1.5">{data.operating.open ? <RetryOutboxButton eventId={event.id} /> : null}</Td>
        </Tr>) : <TEmpty colSpan={6}>No failed or rejected reports.</TEmpty>}</tbody>
      </Table>
      {data.exceptions.nextCursor && <p className="mt-1.5 text-xs text-muted-foreground">Oldest {data.exceptions.items.length} of {data.exceptions.total}</p>}
    </section>
    <Split side="minmax(0,1fr)">
      <section>
        <SectionTitle meta={data.pending.total}>Waiting to send</SectionTitle>
        <Table label="Waiting to send" minWidth={380}>
          <THead><Th>Topic</Th><Th>Queued since</Th><Th>Status</Th></THead>
          <tbody>{data.pending.items.length ? data.pending.items.map(event => <Tr key={event.id}>
            <Td><Ref>{event.topic}</Ref></Td>
            <Td className="whitespace-nowrap text-muted-foreground">{formatWhen(event.availableAt, data.timezone)}</Td>
            <Td><StatusText tone={statusTone(event.status)}>{sentenceCase(event.status)}</StatusText></Td>
          </Tr>) : <TEmpty colSpan={3}>Nothing is waiting to send.</TEmpty>}</tbody>
        </Table>
        {data.pending.nextCursor && <p className="mt-1.5 text-xs text-muted-foreground">Oldest {data.pending.items.length} of {data.pending.total}</p>}
      </section>
      <section data-testid="reconciliation-workbench">
        <SectionTitle meta={data.runs.total}>Reconciliation runs</SectionTitle>
        <Table label="Reconciliation runs" minWidth={420}>
          <THead><Th>Run</Th><Th>Started</Th><Th align="right">Discrepancies</Th><Th>Status</Th></THead>
          <tbody>{data.runs.items.length ? data.runs.items.map(run => <Tr key={run.id}>
            <Td className="font-medium">{sentenceCase(run.type)}</Td>
            <Td className="whitespace-nowrap text-muted-foreground">{formatWhen(run.startedAt, data.timezone)}</Td>
            <Td align="right" className={run.discrepancyCount ? 'font-semibold text-amber-700 dark:text-amber-400' : ''}>{run.discrepancyCount}</Td>
            <Td><StatusText tone={run.discrepancyCount ? 'warn' : statusTone(run.status)}>{sentenceCase(run.status)}</StatusText></Td>
          </Tr>) : <TEmpty colSpan={4}>No reconciliation runs.</TEmpty>}</tbody>
        </Table>
        <Pager basePath="/dashboard/platform/reconciliation" params={params} nextCursor={data.runs.nextCursor} shown={data.runs.items.length} total={data.runs.total} noun="runs" />
      </section>
    </Split>
    <Split side="minmax(0,1fr)">
      <section>
        <SectionTitle meta={data.integrations.length}>Integrations</SectionTitle>
        <Table label="Integrations" minWidth={420}>
          <THead><Th>Provider</Th><Th>Facility</Th><Th>Last sync</Th><Th>Status</Th></THead>
          <tbody>{data.integrations.length ? data.integrations.map(integration => <Tr key={integration.id}>
            <Td><Ref>{integration.providerCode}</Ref><span className="block text-xs text-muted-foreground">{sentenceCase(integration.providerType)} · {integration.authorityReference}</span></Td>
            <Td className="text-muted-foreground">{integration.facilityReference || '—'}</Td>
            <Td className="whitespace-nowrap text-muted-foreground">{integration.lastSuccessfulSyncAt ? formatWhen(integration.lastSuccessfulSyncAt, data.timezone) : 'Never'}</Td>
            <Td><StatusText tone={statusTone(integration.status === 'unconfigured' ? 'pending' : integration.status)}>{sentenceCase(integration.status)}</StatusText></Td>
          </Tr>) : <TEmpty colSpan={4}>No integrations.</TEmpty>}</tbody>
        </Table>
      </section>
      <section>
        <SectionTitle meta={data.inbox.total}>Inbound state events</SectionTitle>
        <Table label="Inbound state events" minWidth={420}>
          <THead><Th>Event</Th><Th>Received</Th><Th>Status</Th></THead>
          <tbody>{data.inbox.items.length ? data.inbox.items.map(event => <Tr key={event.id}>
            <Td><Ref>{event.providerEventId}</Ref><span className="block text-xs text-muted-foreground">{event.providerCode}{event.rejectionReason ? ` · ${event.rejectionReason}` : ''}</span></Td>
            <Td className="whitespace-nowrap text-muted-foreground">{formatWhen(event.receivedAt, data.timezone)}</Td>
            <Td><StatusText tone={statusTone(event.status === 'processed' ? 'completed' : event.status)}>{sentenceCase(event.status)}</StatusText></Td>
          </Tr>) : <TEmpty colSpan={3}>No inbound events.</TEmpty>}</tbody>
        </Table>
      </section>
    </Split>
  </Workboard>, data => data.exceptions.total ? { tone: 'danger', state: `${data.exceptions.total} failed report${data.exceptions.total === 1 ? '' : 's'}` } : data.pending.total ? { tone: 'warn', state: `${data.pending.total} waiting to send` } : operatingState(data.operating));
}

const INCIDENT_COLUMNS = 'minmax(0,0.9fr) minmax(0,1.3fr) minmax(0,0.8fr) minmax(0,0.9fr) minmax(0,1.4fr)';
const INCIDENT_HEADERS = [{ label: 'Incident' }, { label: 'Type' }, { label: 'Severity' }, { label: 'Status' }, { label: 'Notification' }];

export async function IncidentsWorkspacePage({ searchParams }: { searchParams?: SearchParams }) {
  const params = await readParams(searchParams);
  return frame('incidents', '/dashboard/platform/incidents', 'Incidents', params, data => <Workboard>
    <OperatingNotice operating={data.operating} />
    {data.overdueTotal > 0 && <Notice tone="danger">{data.overdueTotal} regulator notification{data.overdueTotal === 1 ? ' is' : 's are'} overdue.</Notice>}
    <section data-testid="incident-workbench">
      <div className="mb-3 flex flex-col gap-3 border-b border-border sm:flex-row sm:items-end sm:justify-between">
        <Tabs label="Incident filter">
          <TabLink href="/dashboard/platform/incidents" active={data.filter === 'open'} count={data.openTotal}>Open</TabLink>
          <TabLink href="/dashboard/platform/incidents?filter=all" active={data.filter === 'all'}>All</TabLink>
        </Tabs>
        <p className="pb-2.5 text-xs text-muted-foreground"><span className="tabular-nums">{data.highTotal}</span> open high or critical</p>
      </div>
      <RecordList label="Incidents" columns={INCIDENT_COLUMNS} headers={INCIDENT_HEADERS}>
        {data.incidents.items.length ? data.incidents.items.map(incident => <RecordRow id={`incident-${incident.id}`} key={incident.id} className="scroll-mt-20 target:bg-muted/60" columns={INCIDENT_COLUMNS} headers={INCIDENT_HEADERS} cells={[
          <Ref key="r" className="font-medium">{incident.reference}</Ref>,
          <span key="t">{sentenceCase(incident.type)}<span className="block text-xs text-muted-foreground">occurred {formatWhen(incident.occurredAt, data.timezone)}</span></span>,
          <StatusText key="v" tone={SEVERITY_TONE[incident.severity] || 'muted'}>{sentenceCase(incident.severity)}</StatusText>,
          <span key="s">{sentenceCase(incident.status)}</span>,
          <span key="n"><StatusText tone={NOTIFICATION_TONE[incident.notificationState] || 'muted'}>{NOTIFICATION_LABEL[incident.notificationState] || sentenceCase(incident.notificationState)}</StatusText>{incident.notificationDueAt && <span className="block text-xs text-muted-foreground">by {formatWhen(incident.notificationDueAt, data.timezone)}</span>}</span>,
        ]}>
          <p className="mt-2 max-w-3xl whitespace-pre-line break-words text-[13px] text-foreground">{incident.description}</p>
          {data.operating.open && <IncidentTransitionForm incident={incident} />}
        </RecordRow>) : <Empty>{data.filter === 'open' ? 'No open incidents.' : 'No incidents recorded.'}</Empty>}
        <Pager basePath="/dashboard/platform/incidents" params={params} nextCursor={data.incidents.nextCursor} shown={data.incidents.items.length} total={data.incidents.total} noun="incidents" />
      </RecordList>
    </section>
    {data.operating.open ? <Disclosure label="Record an incident"><RecordIncidentForm timezone={data.timezone} /></Disclosure> : null}
  </Workboard>, data => data.overdueTotal ? { tone: 'danger', state: `${data.overdueTotal} notification${data.overdueTotal === 1 ? '' : 's'} overdue` } : operatingState(data.operating));
}
