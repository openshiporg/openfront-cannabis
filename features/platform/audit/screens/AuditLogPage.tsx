import Link from 'next/link';
import { BandRow, codeLabel, ListBand, PillLink, SectionTitle, sentenceCase, Track } from '@/features/platform/components/cannabis-ui';
import { Empty, formatWhen, Pager, SearchForm } from '@/features/platform/operations/components/WorkspaceKit';
import { frame, readParams, type SearchParams } from '@/features/platform/operations/lib/frame';

const RESOURCES: Array<[string, string]> = [
  ['InventoryPackage', 'Packages'], ['PackageHold', 'Holds'], ['RecallCase', 'Recalls'], ['Product', 'Products'], ['StaffCredential', 'Credentials'], ['CannabisLicense', 'Licenses'],
  ['JurisdictionRulePack', 'Sales rules'], ['Premises', 'Premises'], ['RegisterShift', 'Shifts'], ['Register', 'Registers'], ['ComplianceIncident', 'Incidents'], ['User', 'Staff'], ['StorefrontSettings', 'Store Settings'],
];

const ACTION_WORDS: Record<string, string> = {
  'authority_pack.installed': 'Sales rules installed', 'authority.rule_pack.amended': 'Sales rules amended', 'staff.authority.provisioned': 'Staff added',
  'cart.pos.created': 'POS cart created', 'cart.line.reserved': 'Cart line reserved', 'state.inbox.recorded': 'State event recorded',
  'state.outbox.requeued': 'State report requeued', 'storefront.settings.configured': 'Store settings saved',
};

/** "catalog.product.amended" → "Product amended". */
function actionLabel(action: string) {
  return ACTION_WORDS[action] ?? sentenceCase(action.split('.').slice(-2).join(' '));
}

const RESOURCE_WORDS: Record<string, [noun: string, page: string]> = {
  Product: ['Product', 'menu'], Customer: ['Customer', 'customers'], Sale: ['Receipt', 'sales'], InventoryPackage: ['Package', 'inventory'], PackageHold: ['Hold on package', 'inventory'],
  RecallCase: ['Recall', 'recalls'], StaffCredential: ['Credential', 'staff'], User: ['Staff member', 'staff'], CannabisLicense: ['License', 'authority'],
  JurisdictionRulePack: ['Sales rules', 'authority'], Premises: ['Premises', 'authority'], Register: ['Register', 'cash'], RegisterShift: ['Shift', 'cash'],
  ComplianceIncident: ['Incident', 'incidents'], StorefrontSettings: ['Store settings', 'store-settings'], RegulatedManifest: ['Manifest', 'receiving'],
};
const DETAIL_PAGES = new Set(['menu', 'customers', 'sales']);

function ResourceLink({ type, id, label }: { type: string; id: string; label: string | null }) {
  const [noun, page] = RESOURCE_WORDS[type] ?? [sentenceCase(type.replace(/([a-z])([A-Z])/g, '$1 $2')), null];
  const text = <>{noun}{label ? <> <span className="font-mono">{label}</span></> : null}</>;
  if (!page) return text;
  return <Link href={`/dashboard/platform/${page}${DETAIL_PAGES.has(page) ? `/${encodeURIComponent(id)}` : ''}`} className="underline decoration-border underline-offset-2 hover:decoration-foreground">{text}</Link>;
}

export async function AuditLogPage({ searchParams }: { searchParams?: SearchParams }) {
  const params = await readParams(searchParams);
  const href = (filter?: string) => { const query = new URLSearchParams(); if (filter) query.set('filter', filter); if (params.search) query.set('search', params.search); const text = query.toString(); return `/dashboard/platform/audit${text ? `?${text}` : ''}`; };
  return frame('audit', '/dashboard/platform/audit', 'Audit log', params, data => <div className="space-y-6 px-4 pb-28 md:px-6">
    <div className="space-y-3">
      <nav aria-label="Record type"><Track className="flex-wrap rounded-2xl">
        <PillLink href={href()} active={!data.filter}>All</PillLink>
        {RESOURCES.map(([key, label]) => <PillLink key={key} href={href(key)} active={data.filter === key}>{label}</PillLink>)}
      </Track></nav>
      <SearchForm basePath="/dashboard/platform/audit" params={params} label="Search actions" placeholder="Action, e.g. hold" />
    </div>
    <section>
      <SectionTitle meta={data.events.total}>Events</SectionTitle>
      <ListBand>
        {data.events.items.length ? data.events.items.map(event => <BandRow key={event.id} title={actionLabel(event.action)}
          detail={<><ResourceLink type={event.resourceType} id={event.resourceId} label={event.resourceLabel} /> · {event.actor?.name || 'System'} · {codeLabel(event.reasonCode)}</>}
          aside={<span className="text-xs text-muted-foreground">{formatWhen(event.occurredAt, data.timezone)}</span>} />) : <Empty>{params.search || data.filter ? 'No events match.' : 'No events yet.'}</Empty>}
        <Pager basePath="/dashboard/platform/audit" params={params} nextCursor={data.events.nextCursor} shown={data.events.items.length} total={data.events.total} noun="events" />
      </ListBand>
    </section>
  </div>, data => ({ tone: 'info', state: `${data.events.total} events` }));
}
