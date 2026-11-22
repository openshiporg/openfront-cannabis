import type React from 'react';
import { formatInstant } from '@/features/platform/lib/time';
import { RefreshButton } from './RefreshButton';
import { SetupLauncher } from '@/features/platform/onboarding/components/SetupLauncher';
export { formatUsableThrough } from '@/features/platform/lib/time';
import { WORKSPACE_STATE_COPY, type WorkspaceClosedState } from '@/features/platform/workspaces/lib/boundary';
import { Actions, BandEmpty, Button, ButtonLink, Dot, inputClass, MetricStrip, StatusText, statusTone, type DotTone, sentenceCase } from '@/features/platform/components/cannabis-ui';

export const readable = (value: string) => value.replaceAll('_', ' ');

/** Premises-zone date and time with its zone label. */
export function formatWhen(value: string | null | undefined, timeZone?: string | null) {
  return formatInstant(value, timeZone);
}

export function WorkspaceStateNotice({ result, retryHref }: { result: WorkspaceClosedState; retryHref: string }) {
  const copy = WORKSPACE_STATE_COPY[result.state];
  const tone: DotTone = result.state === 'unavailable' || result.state === 'operating_closed' ? 'danger' : result.state === 'setup_required' ? 'info' : 'warn';
  return <div data-testid={`workspace-${result.state}`} role="status" className="mx-4 max-w-2xl rounded-[6px] border border-border bg-card md:mx-6">
    <p className="flex items-baseline gap-2 border-b border-border px-4 py-2.5 text-[13px] font-semibold text-foreground"><Dot tone={tone} />{copy.title}</p>
    <div className="space-y-1 px-4 py-3 text-[13px] text-muted-foreground">
      <p>{result.state === 'operating_closed' ? result.reason : copy.detail}</p>
      {result.state === 'operating_closed' && <p>{copy.detail}</p>}
    </div>
    <div className="px-4 pb-4">
      {result.state === 'operating_closed' && <ButtonLink href="/dashboard/platform/authority" tone="primary">Open Authority</ButtonLink>}
      {result.state === 'signed_out' && <ButtonLink href="/dashboard/signin" tone="primary">Sign in</ButtonLink>}
      {result.state === 'unavailable' && <ButtonLink href={retryHref}>Try again</ButtonLink>}
      {result.state === 'forbidden' && <ButtonLink href="/dashboard/platform">Your workspaces</ButtonLink>}
      {result.state === 'setup_required' && <SetupLauncher />}
    </div>
  </div>;
}

// Bottom padding keeps the last form clear of the shell's floating assistant button.
export function Workboard({ children }: { children: React.ReactNode }) { return <div className="space-y-6 px-4 pb-28 md:px-6">{children}</div>; }

export function Metric({ label, value, href }: { label: string; value: string | number; href?: string }) {
  return <MetricStrip items={[{ label, value, href }]} />;
}

/** A record status as a dot and its label. */
export function Status({ value, tone }: { value: string; tone?: DotTone }) {
  return <StatusText tone={tone ?? statusTone(value)}>{sentenceCase(value)}</StatusText>;
}

export function Empty({ children }: { children: React.ReactNode }) { return <BandEmpty>{children}</BandEmpty>; }

export function AsOf({ generatedAt, timezone }: { generatedAt: string; timezone: string | null }) {
  return <span>As of {formatWhen(generatedAt, timezone)}<RefreshButton /></span>;
}

/** Continuation for one cursor-paged collection; other query parameters are kept. */
export function Pager({ basePath, params, nextCursor, shown, total, noun }: { basePath: string; params: Record<string, string | undefined>; nextCursor: string | null; shown: number; total: number; noun: string }) {
  const href = (cursor?: string) => {
    const query = new URLSearchParams(Object.entries({ ...params, cursor }).filter(([, value]) => value) as Array<[string, string]>);
    const text = query.toString();
    return text ? `${basePath}?${text}` : basePath;
  };
  return <nav aria-label={`${noun} pages`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
    <span className="tabular-nums text-muted-foreground">{shown} of {total} {noun}</span>
    {(params.cursor || nextCursor) && <Actions label="Pages">
      {params.cursor && <ButtonLink href={href()}>First page</ButtonLink>}
      {nextCursor && <ButtonLink href={href(nextCursor)}>Next page</ButtonLink>}
    </Actions>}
  </nav>;
}

/** Download sales as a spreadsheet file for a range of store dates. A plain GET form: the browser saves the file. */
export function SalesExportForm({ timezone, className }: { timezone: string | null; className?: string }) {
  const day = (offset: number) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() - offset * 86_400_000));
  return <form action="/dashboard/platform/sales/export" method="get" className={`flex flex-wrap items-end gap-2 ${className ?? ''}`}>
    <label className="text-xs font-medium text-foreground">From<input type="date" name="from" required defaultValue={day(6)} max={day(0)} className={`${inputClass} sm:w-40`} /></label>
    <label className="text-xs font-medium text-foreground">To<input type="date" name="to" required defaultValue={day(0)} max={day(0)} className={`${inputClass} sm:w-40`} /></label>
    <Button type="submit">Download sales (CSV)</Button>
  </form>;
}

export function StateReportForm({ kind, timezone }: { kind: 'sales' | 'adjustments'; timezone: string | null }) {
  const day = (offset: number) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() - offset * 86_400_000));
  return <form action="/dashboard/platform/reconciliation/export" method="get" className="mt-2 flex flex-wrap items-end gap-2">
    <input type="hidden" name="kind" value={kind} />
    <label className="text-xs font-medium text-foreground">From<input type="date" name="from" required defaultValue={day(0)} max={day(0)} className={`${inputClass} sm:w-40`} /></label>
    <label className="text-xs font-medium text-foreground">To<input type="date" name="to" required defaultValue={day(0)} max={day(0)} className={`${inputClass} sm:w-40`} /></label>
    <Button type="submit">{kind === 'sales' ? 'Download sales file' : 'Download adjustments file'}</Button>
  </form>;
}

export function SearchForm({ basePath, params, name = 'search', label, placeholder }: { basePath: string; params: Record<string, string | undefined>; name?: string; label: string; placeholder?: string }) {
  const kept = Object.entries(params).filter(([key, value]) => value && key !== name && key !== 'cursor') as Array<[string, string]>;
  const clearQuery = new URLSearchParams(kept).toString();
  return <form action={basePath} className="flex w-full min-w-0 items-center gap-2 sm:w-auto" role="search">
    {kept.map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
    <label className="min-w-0 flex-1 sm:flex-none"><span className="sr-only">{label}</span><input aria-label={label} name={name} type="search" defaultValue={params[name] || ''} maxLength={100} placeholder={placeholder} className={`${inputClass} mt-0 h-8 sm:w-64`} /></label>
    <Button type="submit">Search</Button>
    {params[name] && <ButtonLink href={clearQuery ? `${basePath}?${clearQuery}` : basePath} tone="quiet">Clear</ButtonLink>}
  </form>;
}
