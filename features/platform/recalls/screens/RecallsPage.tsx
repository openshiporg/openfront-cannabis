import Link from 'next/link';
import { BandRow, Count, ListBand, MetricStrip, Panel, PillLink, SectionTitle, sentenceCase, Track } from '@/features/platform/components/cannabis-ui';
import { Empty, formatWhen, Pager } from '@/features/platform/operations/components/WorkspaceKit';
import { frame, readParams, type SearchParams } from '@/features/platform/operations/lib/frame';
import { OpenRecallForm } from '../components/OpenRecallForm';

export async function RecallsPage({ searchParams }: { searchParams?: SearchParams }) {
  const params = await readParams(searchParams);
  const href = (filter: string) => filter === 'open' ? '/dashboard/platform/recalls' : `/dashboard/platform/recalls?filter=${filter}`;
  return frame('recalls', '/dashboard/platform/recalls', 'Recalls', params, data => <div className="space-y-8 px-4 pb-28 md:px-6">
    <MetricStrip items={[
      { label: 'Open recalls', value: data.openTotal, tone: data.openTotal ? 'danger' : 'muted', href: href('open') },
      { label: 'Closed by regulator', value: data.closedTotal, href: href('closed') },
      { label: 'Packages held on this page', value: data.recalls.items.reduce((sum, recall) => sum + recall.activeHolds, 0) },
    ]} />
    <section>
      <SectionTitle meta={data.recalls.total} action={<nav aria-label="Recall status"><Track>
        <PillLink href={href('open')} active={data.filter === 'open'}>Open <Count>{data.openTotal}</Count></PillLink>
        <PillLink href={href('closed')} active={data.filter === 'closed'}>Closed <Count>{data.closedTotal}</Count></PillLink>
        <PillLink href={href('all')} active={data.filter === 'all'}>All</PillLink>
      </Track></nav>}>Recall cases</SectionTitle>
      <ListBand>
        {data.recalls.items.length ? data.recalls.items.map(recall => <BandRow key={recall.id} title={<span className="font-mono">{recall.reference}</span>} tone={recall.status === 'regulator_closed' ? 'ok' : 'danger'} state={sentenceCase(recall.status)}
          detail={<>Notice <span className="font-mono">{recall.authorityReference}</span> · opened {formatWhen(recall.openedAt, data.timezone)}{recall.closedAt ? ` · closed ${formatWhen(recall.closedAt, data.timezone)}` : ''} · {recall.reason}</>}
          aside={<span className="font-mono text-xs">{recall.activeHolds} held</span>}>
          {(recall.packageUids.length > 0 || recall.batchNumbers.length > 0) && <div className="mt-2 flex flex-wrap gap-1.5">
            {recall.packageUids.map(uid => <Link key={uid} href={`/dashboard/platform/inventory?search=${encodeURIComponent(uid)}`} className="rounded-full bg-background px-2 py-0.5 font-mono text-[11px] shadow-[0_0_0_0.5px_rgb(0_0_0/0.12)] hover:underline dark:bg-zinc-800">{uid}</Link>)}
            {recall.batchNumbers.map(batch => <span key={batch} className="rounded-full px-2 py-0.5 font-mono text-[11px] text-muted-foreground ring-1 ring-inset ring-border">batch {batch}</span>)}
          </div>}
        </BandRow>) : <Empty>{data.filter === 'open' ? 'No open recalls.' : 'No recalls.'}</Empty>}
        <Pager basePath="/dashboard/platform/recalls" params={params} nextCursor={data.recalls.nextCursor} shown={data.recalls.items.length} total={data.recalls.total} noun="recalls" />
      </ListBand>
    </section>
    {data.operating.open && <Panel title="Open a recall"><OpenRecallForm /></Panel>}
  </div>, data => data.openTotal ? { tone: 'danger', state: `${data.openTotal} open` } : { tone: 'ok', state: 'No open recalls' });
}
