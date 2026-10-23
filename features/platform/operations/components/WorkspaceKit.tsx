import type React from 'react';
import { WORKSPACE_STATE_COPY, type WorkspaceClosedState } from '@/features/platform/workspaces/lib/boundary';
import { ActionTrack, BandEmpty, Dot, DotLabel, inputClass, MetricStrip, PillAnchor, PillButton, PillLink, statusTone, Track, type DotTone } from '@/features/platform/components/cannabis-ui';

export const readable = (value: string) => value.replaceAll('_', ' ');

export function formatWhen(value: string | null | undefined, timeZone?: string | null) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Unknown';
  try { return date.toLocaleString('en-US', { timeZone: timeZone || undefined, dateStyle: 'medium', timeStyle: 'short', timeZoneName: 'short' }); }
  catch { return date.toLocaleString('en-US'); }
}

export function WorkspaceStateNotice({ result, retryHref }: { result: WorkspaceClosedState; retryHref: string }) {
  const copy = WORKSPACE_STATE_COPY[result.state];
  const tone: DotTone = result.state === 'unavailable' || result.state === 'operating_closed' ? 'danger' : 'warn';
  return <div data-testid={`workspace-${result.state}`} role="status" className="mx-4 rounded-xl bg-muted/40 p-4 ring-1 ring-inset ring-border/60 md:mx-6">
    <p className="flex items-baseline gap-2 text-sm font-medium text-foreground"><Dot tone={tone} />{copy.title}</p>
    <p className="mt-1 pl-4 text-sm text-muted-foreground">{result.state === 'operating_closed' ? result.reason : copy.detail}</p>
    {result.state === 'operating_closed' && <p className="mt-1 pl-4 text-sm text-muted-foreground">{copy.detail}</p>}
    <div className="mt-3 pl-4">
      {result.state === 'operating_closed' && <ActionTrack><PillAnchor href="/dashboard/platform/authority">Open Authority</PillAnchor></ActionTrack>}
      {result.state === 'signed_out' && <ActionTrack><PillAnchor href="/dashboard/signin" tone="ink">Sign in</PillAnchor></ActionTrack>}
      {result.state === 'unavailable' && <ActionTrack><PillAnchor href={retryHref}>Try again</PillAnchor></ActionTrack>}
    </div>
  </div>;
}

export function Workboard({ children }: { children: React.ReactNode }) { return <div className="space-y-8 px-4 pb-10 md:px-6">{children}</div>; }

export function Metric({ label, value, href }: { label: string; value: string | number; href?: string }) {
  return <MetricStrip items={[{ label, value, href }]} />;
}

/** A record status as a dot and its label. */
export function Status({ value, tone }: { value: string; tone?: DotTone }) {
  return <DotLabel tone={tone ?? statusTone(value)} className="text-xs capitalize text-muted-foreground">{readable(value)}</DotLabel>;
}

export function Empty({ children }: { children: React.ReactNode }) { return <BandEmpty>{children}</BandEmpty>; }

export function AsOf({ generatedAt, timezone }: { generatedAt: string; timezone: string | null }) {
  return <span>As of {formatWhen(generatedAt, timezone)}</span>;
}

/** Continuation for one cursor-paged collection; other query parameters are kept. */
export function Pager({ basePath, params, nextCursor, shown, total, noun }: { basePath: string; params: Record<string, string | undefined>; nextCursor: string | null; shown: number; total: number; noun: string }) {
  const href = (cursor?: string) => {
    const query = new URLSearchParams(Object.entries({ ...params, cursor }).filter(([, value]) => value) as Array<[string, string]>);
    const text = query.toString();
    return text ? `${basePath}?${text}` : basePath;
  };
  return <nav aria-label={`${noun} pages`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs">
    <span className="font-mono tabular-nums text-muted-foreground">{shown} of {total} {noun}</span>
    {(params.cursor || nextCursor) && <Track label="Pages">
      {params.cursor && <PillLink href={href()}>First page</PillLink>}
      {nextCursor && <PillLink href={href(nextCursor)} active>Next page</PillLink>}
    </Track>}
  </nav>;
}

export function SearchForm({ basePath, params, name = 'search', label, placeholder }: { basePath: string; params: Record<string, string | undefined>; name?: string; label: string; placeholder?: string }) {
  const kept = Object.entries(params).filter(([key, value]) => value && key !== name && key !== 'cursor') as Array<[string, string]>;
  const clearQuery = new URLSearchParams(kept).toString();
  return <form action={basePath} className="flex w-full min-w-0 flex-wrap items-end gap-2 sm:w-auto" role="search">
    {kept.map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
    <label className="min-w-0 flex-1 text-xs font-medium sm:flex-none"><span className="sr-only">{label}</span><input aria-label={label} name={name} defaultValue={params[name] || ''} maxLength={100} placeholder={placeholder} className={`${inputClass} mt-0 h-9 rounded-full px-4 sm:w-64`} /></label>
    <ActionTrack><PillButton type="submit">Search</PillButton>{params[name] && <PillAnchor href={clearQuery ? `${basePath}?${clearQuery}` : basePath}>Clear</PillAnchor>}</ActionTrack>
  </form>;
}
