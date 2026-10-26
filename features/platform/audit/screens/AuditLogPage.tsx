import Link from 'next/link';
import { codeLabel, Table, TabBar, TabLink, Tabs, TEmpty, Td, Th, THead, Tr, sentenceCase } from '@/features/platform/components/cannabis-ui';
import { formatWhen, Pager, SearchForm } from '@/features/platform/operations/components/WorkspaceKit';
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
  const text = <>{noun}{label ? <> <span className="font-mono text-[12px]">{label}</span></> : null}</>;
  if (!page) return text;
  return <Link href={`/dashboard/platform/${page}${DETAIL_PAGES.has(page) ? `/${encodeURIComponent(id)}` : ''}`} className="underline decoration-border underline-offset-2 hover:decoration-foreground">{text}</Link>;
}

export async function AuditLogPage({ searchParams }: { searchParams?: SearchParams }) {
  const params = await readParams(searchParams);
  const href = (filter?: string) => { const query = new URLSearchParams(); if (filter) query.set('filter', filter); if (params.search) query.set('search', params.search); const text = query.toString(); return `/dashboard/platform/audit${text ? `?${text}` : ''}`; };
  return frame('audit', '/dashboard/platform/audit', 'Audit log', params, data => <div className="space-y-4 px-4 pb-28 md:px-6">
    <TabBar aside={<SearchForm basePath="/dashboard/platform/audit" params={params} label="Search actions" placeholder="Action, e.g. hold" />}>
      <Tabs label="Record type">
        <TabLink href={href()} active={!data.filter}>All</TabLink>
        {RESOURCES.map(([key, label]) => <TabLink key={key} href={href(key)} active={data.filter === key}>{label}</TabLink>)}
      </Tabs>
    </TabBar>
    <Table label="Events" minWidth={720}>
      <THead><Th>When</Th><Th>Action</Th><Th>Record</Th><Th>By</Th><Th>Reason</Th></THead>
      <tbody>{data.events.items.length ? data.events.items.map(event => <Tr key={event.id}>
        <Td className="whitespace-nowrap text-muted-foreground">{formatWhen(event.occurredAt, data.timezone)}</Td>
        <Td className="font-medium">{actionLabel(event.action)}</Td>
        <Td><ResourceLink type={event.resourceType} id={event.resourceId} label={event.resourceLabel} /></Td>
        <Td className="text-muted-foreground">{event.actor?.name || 'System'}</Td>
        <Td className="text-muted-foreground">{codeLabel(event.reasonCode)}</Td>
      </Tr>) : <TEmpty colSpan={5}>{params.search || data.filter ? 'No events match.' : 'No events yet.'}</TEmpty>}</tbody>
    </Table>
    <Pager basePath="/dashboard/platform/audit" params={params} nextCursor={data.events.nextCursor} shown={data.events.items.length} total={data.events.total} noun="events" />
  </div>, data => ({ tone: 'info', state: `${data.events.total} events` }));
}
