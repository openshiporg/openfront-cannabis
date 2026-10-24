import { formatMinorUnits } from '@/features/lib/money';
import { BandRow, ListBand, MetricStrip, Panel, SectionTitle, INTERVAL_LABEL, sentenceCase, statusTone } from '@/features/platform/components/cannabis-ui';
import { Empty, formatWhen, Pager, SearchForm } from '@/features/platform/operations/components/WorkspaceKit';
import { ProvisionStaffForm, RevokeCredentialForm, TemporaryPasswordForm } from '@/features/platform/operations/components/OperatorForms';
import { frame, readParams, type SearchParams } from '@/features/platform/operations/lib/frame';

const PERMISSION_LABEL: Array<[string, string]> = [
  ['canManageOnboarding', 'Owner'], ['canManagePeople', 'Staff'], ['canManageAuthority', 'Authority'], ['canManageCompliance', 'Compliance'], ['canManageInventory', 'Inventory'],
  ['canManageSales', 'POS'], ['canManageFinance', 'Cash'], ['canManageIntegrations', 'State reporting'], ['canViewReports', 'Reports'],
];

export async function StaffPage({ searchParams }: { searchParams?: SearchParams }) {
  const params = await readParams(searchParams);
  return frame('staff', '/dashboard/platform/staff', 'Staff', params, data => {
    const people = data.people.items;
    const current = people.filter(person => person.credential && ['current', 'expiring_soon'].includes(person.credential.intervalState)).length;
    const expiring = people.filter(person => person.credential?.intervalState === 'expiring_soon').length;
    return <div className="space-y-8 px-4 pb-28 md:px-6">
      <MetricStrip items={[
        { label: 'Staff', value: data.people.total },
        { label: data.people.nextCursor ? `Credential current (first ${people.length})` : 'Credential current', value: current, tone: 'ok' },
        { label: 'Expiring within 30 days', value: expiring, tone: expiring ? 'warn' : 'muted' },
      ]} />
      <section>
        <SectionTitle meta={data.people.total} action={<SearchForm basePath="/dashboard/platform/staff" params={params} label="Search staff" placeholder="Name or email" />}>People</SectionTitle>
        <ListBand>
          {people.length ? people.map(person => {
            const credential = person.credential;
            const grants = PERMISSION_LABEL.filter(([key]) => (person.role as Record<string, unknown> | null)?.[key] === true).map(([, label]) => label);
            return <BandRow key={person.id} id={`person-${person.id}`}
              title={<>{person.name}{person.id === data.selfId && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>}</>}
              tone={person.status !== 'active' ? 'muted' : credential ? statusTone(credential.intervalState === 'current' ? credential.status : credential.intervalState) : 'warn'}
              state={person.status !== 'active' ? sentenceCase(person.status) : credential ? `${sentenceCase(credential.status)} · ${INTERVAL_LABEL[credential.intervalState] ?? sentenceCase(credential.intervalState)}` : 'No credential'}
              detail={<>{person.email} · {person.role?.name ?? 'No role'}{credential && <> · {credential.credentialType.toLowerCase() !== person.role?.name?.toLowerCase() && <>{sentenceCase(credential.credentialType)} </>}<span className="font-mono">{credential.credentialReference}</span> · until {formatWhen(credential.expiresAt, data.timezone)}</>}</>}
              aside={credential ? <span className="font-mono text-xs">limit {formatMinorUnits(credential.approvalLimitCents ?? 0, data.currencyCode)}</span> : undefined}>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {grants.map(label => <span key={label} className="rounded-full bg-background px-2 py-0.5 text-[11px] font-medium shadow-[0_0_0_0.5px_rgb(0_0_0/0.12)] dark:bg-zinc-800">{label}</span>)}
                {credential?.allowedActivities.map(activity => <span key={activity} className="rounded-full px-2 py-0.5 text-[11px] text-muted-foreground ring-1 ring-inset ring-border">{sentenceCase(activity)}</span>)}
              </div>
              {data.operating.open && <TemporaryPasswordForm userId={person.id} name={person.name} />}
              {data.operating.open && credential && person.id !== data.selfId && <RevokeCredentialForm credentialId={credential.id} status={credential.status} name={person.name} />}
            </BandRow>;
          }) : <Empty>{params.search ? 'No staff match this search.' : 'No staff yet.'}</Empty>}
          <Pager basePath="/dashboard/platform/staff" params={params} nextCursor={data.people.nextCursor} shown={people.length} total={data.people.total} noun="people" />
        </ListBand>
      </section>
      {data.operating.open && <Panel title="Add a staff member"><ProvisionStaffForm /></Panel>}
    </div>;
  }, data => ({ ...(data.operating.open ? { tone: 'ok' as const, state: `${data.people.total} people` } : { tone: data.operating.limited ? 'info' as const : 'danger' as const, state: data.operating.limited ? 'Limited access' : 'Authority lapsed' }) }));
}
