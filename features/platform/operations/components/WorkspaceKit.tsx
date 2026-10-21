import Link from 'next/link';
import type React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { WORKSPACE_STATE_COPY, type WorkspaceClosedState } from '@/features/platform/workspaces/lib/boundary';

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
  return <div data-testid={`workspace-${result.state}`} role="status" className="m-4 flex gap-3 rounded-lg border bg-muted/40 p-4 md:m-6">
    <AlertTriangle className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
    <div className="space-y-1">
      <p className="font-medium">{copy.title}</p>
      <p className="text-sm text-muted-foreground">{result.state === 'operating_closed' ? result.reason : copy.detail}</p>
      {result.state === 'operating_closed' && <p className="text-sm text-muted-foreground">{copy.detail} <Link className="underline" href="/dashboard/platform/authority">Open Authority</Link></p>}
      {result.state === 'signed_out' && <Link className="text-sm underline" href="/dashboard/signin">Sign in</Link>}
      {result.state === 'unavailable' && <Link className="text-sm underline" href={retryHref}>Try again</Link>}
    </div>
  </div>;
}

export function Workboard({ children }: { children: React.ReactNode }) { return <div className="space-y-4 p-4 md:p-6">{children}</div>; }

export function Metric({ label, value, href }: { label: string; value: string | number; href?: string }) {
  const body = <Card><CardContent className="p-4"><p className="text-2xl font-semibold tabular-nums">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></CardContent></Card>;
  return href ? <Link href={href} className="block rounded-xl focus-visible:outline-2">{body}</Link> : body;
}

export function Status({ value }: { value: string }) { return <Badge variant="outline" className="capitalize">{readable(value)}</Badge>; }

export function Empty({ children }: { children: React.ReactNode }) { return <p className="p-4 text-sm text-muted-foreground">{children}</p>; }

export function AsOf({ generatedAt, timezone }: { generatedAt: string; timezone: string | null }) {
  return <p className="text-xs text-muted-foreground">As of {formatWhen(generatedAt, timezone)}</p>;
}

/** Continuation for one cursor-paged collection; other query parameters are kept. */
export function Pager({ basePath, params, nextCursor, shown, total, noun }: { basePath: string; params: Record<string, string | undefined>; nextCursor: string | null; shown: number; total: number; noun: string }) {
  const href = (cursor?: string) => {
    const query = new URLSearchParams(Object.entries({ ...params, cursor }).filter(([, value]) => value) as Array<[string, string]>);
    const text = query.toString();
    return text ? `${basePath}?${text}` : basePath;
  };
  return <nav aria-label={`${noun} pages`} className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-sm">
    <span className="text-muted-foreground">Showing {shown} of {total} {noun}</span>
    <span className="flex gap-3">
      {params.cursor && <Link className="underline" href={href()}>First page</Link>}
      {nextCursor && <Link className="underline" href={href(nextCursor)}>Next page</Link>}
    </span>
  </nav>;
}

export function SearchForm({ basePath, params, name = 'search', label, placeholder }: { basePath: string; params: Record<string, string | undefined>; name?: string; label: string; placeholder?: string }) {
  return <form action={basePath} className="flex flex-wrap items-end gap-2" role="search">
    {Object.entries(params).filter(([key, value]) => value && key !== name && key !== 'cursor').map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
    <label className="text-sm">{label}<input name={name} defaultValue={params[name] || ''} maxLength={100} placeholder={placeholder} className="mt-1 block h-9 w-64 max-w-full rounded-md border bg-background px-2 text-sm" /></label>
    <button className="h-9 rounded-md border px-3 text-sm hover:bg-muted" type="submit">Search</button>
  </form>;
}
