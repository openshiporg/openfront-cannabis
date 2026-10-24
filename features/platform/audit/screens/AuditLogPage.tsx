import { BandRow, ListBand, PillLink, SectionTitle, Track } from '@/features/platform/components/cannabis-ui';
import { Empty, formatWhen, Pager, SearchForm } from '@/features/platform/operations/components/WorkspaceKit';
import { frame, readParams, type SearchParams } from '@/features/platform/operations/lib/frame';

const RESOURCES: Array<[string, string]> = [
  ['InventoryPackage', 'Packages'], ['PackageHold', 'Holds'], ['RecallCase', 'Recalls'], ['Product', 'Products'], ['StaffCredential', 'Credentials'], ['CannabisLicense', 'Licenses'],
  ['JurisdictionRulePack', 'Sales rules'], ['Premises', 'Premises'], ['RegisterShift', 'Shifts'], ['Register', 'Registers'], ['ComplianceIncident', 'Incidents'], ['User', 'Staff'], ['StorefrontSettings', 'Store Settings'],
];

export async function AuditLogPage({ searchParams }: { searchParams?: SearchParams }) {
  const params = await readParams(searchParams);
  const href = (filter?: string) => { const query = new URLSearchParams(); if (filter) query.set('filter', filter); if (params.search) query.set('search', params.search); const text = query.toString(); return `/dashboard/platform/audit${text ? `?${text}` : ''}`; };
  return frame('audit', '/dashboard/platform/audit', 'Audit log', params, data => <div className="space-y-6 px-4 pb-28 md:px-6">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <nav aria-label="Record type"><Track className="max-sm:flex-wrap max-sm:rounded-2xl">
        <PillLink href={href()} active={!data.filter}>All</PillLink>
        {RESOURCES.map(([key, label]) => <PillLink key={key} href={href(key)} active={data.filter === key}>{label}</PillLink>)}
      </Track></nav>
      <SearchForm basePath="/dashboard/platform/audit" params={params} label="Search actions" placeholder="Action, e.g. hold" />
    </div>
    <section>
      <SectionTitle meta={data.events.total}>Events</SectionTitle>
      <ListBand>
        {data.events.items.length ? data.events.items.map(event => <BandRow key={event.id} title={<span className="font-mono">{event.action}</span>}
          detail={<>{event.actor?.name || 'System'} · {event.resourceType} <span className="font-mono">{event.resourceId}</span> · <span className="font-mono">{event.reasonCode}</span></>}
          aside={<span className="text-xs text-muted-foreground">{formatWhen(event.occurredAt, data.timezone)}</span>} />) : <Empty>{params.search || data.filter ? 'No events match.' : 'No events yet.'}</Empty>}
        <Pager basePath="/dashboard/platform/audit" params={params} nextCursor={data.events.nextCursor} shown={data.events.items.length} total={data.events.total} noun="events" />
      </ListBand>
    </section>
  </div>, data => ({ tone: 'info', state: `${data.events.total} events` }));
}
