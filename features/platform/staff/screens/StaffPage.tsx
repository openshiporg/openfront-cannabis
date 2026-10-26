import { formatMinorUnits } from '@/features/lib/money';
import { Disclosure, RecordList, RecordRow, Ref, StatusText, INTERVAL_LABEL, sentenceCase, statusTone } from '@/features/platform/components/cannabis-ui';
import { Empty, formatWhen, Pager, SearchForm } from '@/features/platform/operations/components/WorkspaceKit';
import { ProvisionStaffForm, RevokeCredentialForm, TemporaryPasswordForm } from '@/features/platform/operations/components/OperatorForms';
import { frame, readParams, type SearchParams } from '@/features/platform/operations/lib/frame';

const PERMISSION_LABEL: Array<[string, string]> = [
  ['canManageOnboarding', 'Owner'], ['canManagePeople', 'Staff'], ['canManageAuthority', 'Authority'], ['canManageCompliance', 'Compliance'], ['canManageInventory', 'Inventory'],
  ['canManageSales', 'POS'], ['canManageFinance', 'Cash'], ['canManageIntegrations', 'State reporting'], ['canViewReports', 'Reports'],
];

const STAFF_COLUMNS = 'minmax(0,1.3fr) minmax(0,1.3fr) minmax(0,1.2fr) minmax(0,0.6fr) minmax(0,1fr)';
const STAFF_HEADERS = [{ label: 'Person' }, { label: 'Role' }, { label: 'Credential' }, { label: 'Limit', align: 'right' as const }, { label: 'Status' }];

export async function StaffPage({ searchParams }: { searchParams?: SearchParams }) {
  const params = await readParams(searchParams);
  return frame('staff', '/dashboard/platform/staff', 'Staff', params, data => {
    const people = data.people.items;
    const current = people.filter(person => person.credential && ['current', 'expiring_soon'].includes(person.credential.intervalState)).length;
    const expiring = people.filter(person => person.credential?.intervalState === 'expiring_soon').length;
    return <div className="space-y-4 px-4 pb-28 md:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex flex-wrap gap-x-4 text-[13px] text-muted-foreground"><span><span className="font-semibold tabular-nums text-foreground">{data.people.total}</span> people</span><StatusText tone="ok">{current}{data.people.nextCursor ? ` of the first ${people.length}` : ''} credential current</StatusText>{expiring > 0 && <StatusText tone="warn">{expiring} expiring within 30 days</StatusText>}</p>
        <SearchForm basePath="/dashboard/platform/staff" params={params} label="Search staff" placeholder="Name or email" />
      </div>
      <RecordList label="People" columns={STAFF_COLUMNS} headers={STAFF_HEADERS}>
        {people.length ? people.map(person => {
          const credential = person.credential;
          const grants = PERMISSION_LABEL.filter(([key]) => (person.role as Record<string, unknown> | null)?.[key] === true).map(([, label]) => label);
          const tone = person.status !== 'active' ? 'muted' as const : credential ? statusTone(credential.intervalState === 'current' ? credential.status : credential.intervalState) : 'warn' as const;
          return <RecordRow key={person.id} id={`person-${person.id}`} columns={STAFF_COLUMNS} headers={STAFF_HEADERS} cells={[
            <span key="n" className="block min-w-0"><span className="font-medium">{person.name}</span>{person.id === data.selfId && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}<span className="block truncate text-xs text-muted-foreground">{person.email}</span></span>,
            <span key="r">{person.role?.name ?? 'No role'}<span className="block text-xs text-muted-foreground">{grants.join(', ') || 'No permissions'}</span></span>,
            credential ? <span key="c">{credential.credentialType.toLowerCase() !== person.role?.name?.toLowerCase() && <>{sentenceCase(credential.credentialType)} </>}<Ref>{credential.credentialReference}</Ref><span className="block text-xs text-muted-foreground">until {formatWhen(credential.expiresAt, data.timezone)}</span></span> : <span key="c" className="text-muted-foreground">None</span>,
            <span key="l">{credential ? formatMinorUnits(credential.approvalLimitCents ?? 0, data.currencyCode) : '—'}</span>,
            <StatusText key="s" tone={tone}>{person.status !== 'active' ? sentenceCase(person.status) : credential ? (credential.intervalState === 'current' ? sentenceCase(credential.status) : INTERVAL_LABEL[credential.intervalState] ?? sentenceCase(credential.intervalState)) : 'No credential'}</StatusText>,
          ]}>
            {credential && credential.allowedActivities.length > 0 && <p className="mt-1.5 text-xs text-muted-foreground">Activities: {credential.allowedActivities.map(sentenceCase).join(', ')}</p>}
            {data.operating.open && <div className="mt-2 flex flex-wrap items-start gap-2">
              <TemporaryPasswordForm userId={person.id} name={person.name} />
              {credential && person.id !== data.selfId && <RevokeCredentialForm credentialId={credential.id} status={credential.status} name={person.name} />}
            </div>}
          </RecordRow>;
        }) : <Empty>{params.search ? 'No staff match this search.' : 'No staff yet.'}</Empty>}
        <Pager basePath="/dashboard/platform/staff" params={params} nextCursor={data.people.nextCursor} shown={people.length} total={data.people.total} noun="people" />
      </RecordList>
      {data.operating.open && <Disclosure label="Add a staff member"><ProvisionStaffForm /></Disclosure>}
    </div>;
  }, data => ({ ...(data.operating.open ? { tone: 'ok' as const, state: `${data.people.total} people` } : { tone: data.operating.limited ? 'info' as const : 'danger' as const, state: data.operating.limited ? 'Limited access' : 'Authority lapsed' }) }));
}
