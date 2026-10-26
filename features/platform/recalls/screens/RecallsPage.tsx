import Link from 'next/link';
import { Disclosure, ListBand, Ref, StatusText, TabBar, TabLink, Tabs, sentenceCase } from '@/features/platform/components/cannabis-ui';
import { Empty, formatWhen, Pager } from '@/features/platform/operations/components/WorkspaceKit';
import { frame, readParams, type SearchParams } from '@/features/platform/operations/lib/frame';
import { AdvanceRecallForm } from '@/features/platform/operations/components/SaleForms';
import { OpenRecallForm } from '../components/OpenRecallForm';

export async function RecallsPage({ searchParams }: { searchParams?: SearchParams }) {
  const params = await readParams(searchParams);
  const href = (filter: string) => filter === 'open' ? '/dashboard/platform/recalls' : `/dashboard/platform/recalls?filter=${filter}`;
  return frame('recalls', '/dashboard/platform/recalls', 'Recalls', params, data => <div className="space-y-4 px-4 pb-28 md:px-6">
    <TabBar aside={<span className="text-xs text-muted-foreground"><span className="tabular-nums">{data.heldTotal}</span> package{data.heldTotal === 1 ? '' : 's'} on recall hold</span>}>
      <Tabs label="Recall status">
        <TabLink href={href('open')} active={data.filter === 'open'} count={data.openTotal}>Open</TabLink>
        <TabLink href={href('closed')} active={data.filter === 'closed'} count={data.closedTotal}>Closed by regulator</TabLink>
        <TabLink href={href('all')} active={data.filter === 'all'}>All</TabLink>
      </Tabs>
    </TabBar>
    <section aria-label="Recall cases">
      <ListBand>
        {data.recalls.items.length ? data.recalls.items.map(recall => <div key={recall.id} className="px-3 py-3 text-[13px]">
          <div className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-baseline sm:gap-4">
            <span className="min-w-0"><Ref className="font-medium">{recall.reference}</Ref><span className="ml-2 text-muted-foreground">{recall.reason}</span></span>
            <span className="text-xs tabular-nums text-muted-foreground">{recall.activeHolds} held</span>
            <StatusText tone={recall.status === 'regulator_closed' ? 'ok' : 'danger'}>{sentenceCase(recall.status)}</StatusText>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Notice <Ref>{recall.authorityReference}</Ref> · opened {formatWhen(recall.openedAt, data.timezone)}{recall.closedAt ? ` · closed ${formatWhen(recall.closedAt, data.timezone)}` : ''}</p>
          {(recall.packageUids.length > 0 || recall.batchNumbers.length > 0) && <div className="mt-2 flex flex-wrap gap-1.5">
            {recall.packageUids.map(uid => <Link key={uid} href={`/dashboard/platform/inventory?search=${encodeURIComponent(uid)}`} className="rounded-[3px] border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] hover:underline">{uid}</Link>)}
            {recall.batchNumbers.map(batch => <span key={batch} className="rounded-[3px] border border-border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">batch {batch}</span>)}
          </div>}
          {data.operating.open && recall.status !== 'regulator_closed' && <div className="mt-3"><AdvanceRecallForm recallId={recall.id} reference={recall.reference} status={recall.status} /></div>}
        </div>) : <Empty>{data.filter === 'open' ? 'No open recalls.' : 'No recalls.'}</Empty>}
        <Pager basePath="/dashboard/platform/recalls" params={params} nextCursor={data.recalls.nextCursor} shown={data.recalls.items.length} total={data.recalls.total} noun="recalls" />
      </ListBand>
    </section>
    {data.operating.open && <Disclosure label="Open a recall"><OpenRecallForm /></Disclosure>}
  </div>, data => data.openTotal ? { tone: 'danger', state: `${data.openTotal} open` } : { tone: 'ok', state: 'No open recalls' });
}
