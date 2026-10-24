// Cannabis platform kit: the raised-pill-in-recessed-track control, title-line
// status dots, metric strips and list bands from the storefront, built on the
// dashboard's own tokens so pages sit naturally in the shared shell in light and dark.

import Link from 'next/link';
import type React from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** A stored code as sentence-case text: "inventory_discrepancy" → "Inventory discrepancy". */
export function sentenceCase(value: string | null | undefined) {
  const text = (value || '').replaceAll('_', ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : '';
}

const ACRONYMS = new Set(['qa', 'id', 'ach', 'pos', 'uid', 'sku', 'pin']);

/** A reason or event code as words, keeping acronyms: "qa_test" → "QA test", "recall_notice" → "Recall notice". */
export function codeLabel(value: string | null | undefined) {
  return sentenceCase(value).split(' ').map(word => ACRONYMS.has(word.toLowerCase()) ? word.toUpperCase() : word).join(' ');
}

/** A license or credential's place in its effective interval, as shown everywhere. */
export const INTERVAL_LABEL: Record<string, string> = { current: 'Current', expiring_soon: 'Expires within 30 days', expired: 'Expired', not_yet_effective: 'Not yet effective', inactive: 'Inactive' };

export const DOT_TONES = {
  ok: 'bg-emerald-600 dark:bg-emerald-400',
  warn: 'bg-amber-500 dark:bg-amber-400',
  danger: 'bg-red-600 dark:bg-red-400',
  info: 'bg-sky-600 dark:bg-sky-400',
  accent: 'bg-green-700 dark:bg-green-400',
  muted: 'bg-zinc-400 dark:bg-zinc-500',
} as const;

export type DotTone = keyof typeof DOT_TONES;

/** 8px dot meant to sit on a title line: give the parent `items-baseline`. */
export function Dot({ tone = 'muted', className }: { tone?: DotTone; className?: string }) {
  return <span aria-hidden="true" className={cn('inline-block size-2 shrink-0 translate-y-[-0.1em] rounded-full', DOT_TONES[tone], className)} />;
}

/** Text with its dot, for a title line or a row's first line. */
export function DotLabel({ tone, children, className }: { tone: DotTone; children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-baseline gap-1.5', className)}><Dot tone={tone} />{children}</span>;
}

export const trackClass =
  'inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-muted p-[3px] shadow-[inset_0_1px_2px_rgb(0_0_0/0.07)] [scrollbar-width:none] dark:bg-muted/60 [&::-webkit-scrollbar]:hidden';

export const pillClass =
  'inline-flex min-h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 aria-[current=page]:bg-background aria-[current=page]:text-foreground aria-[current=page]:shadow-[0_1px_2px_rgb(0_0_0/0.12),0_0_0_0.5px_rgb(0_0_0/0.06)] data-[active=true]:bg-background data-[active=true]:text-foreground data-[active=true]:shadow-[0_1px_2px_rgb(0_0_0/0.12),0_0_0_0.5px_rgb(0_0_0/0.06)] dark:aria-[current=page]:bg-zinc-800 dark:data-[active=true]:bg-zinc-800 max-sm:min-h-10';

const PILL_TONES = {
  raised: 'bg-background text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.12),0_0_0_0.5px_rgb(0_0_0/0.06)] dark:bg-zinc-800',
  ink: 'bg-foreground text-background shadow-[0_1px_2px_rgb(0_0_0/0.24)] hover:text-background hover:bg-foreground/90',
  danger: 'bg-background text-red-700 shadow-[0_1px_2px_rgb(0_0_0/0.12),0_0_0_0.5px_rgb(0_0_0/0.06)] hover:text-red-800 dark:bg-zinc-800 dark:text-red-400',
} as const;

export function Track({ label, className, children }: { label?: string; className?: string; children: ReactNode }) {
  return <div role="group" aria-label={label} className={cn(trackClass, className)}>{children}</div>;
}

/** Link pill for filters and page switches; `active` marks the current one. */
export function PillLink({ href, active, className, children }: { href: string; active?: boolean; className?: string; children: ReactNode }) {
  return <Link href={href} aria-current={active ? 'page' : undefined} className={cn(pillClass, className)}>{children}</Link>;
}

/** In-page button: always a raised pill. Wrap one or more in <ActionTrack>. */
export function PillButton({ tone = 'raised', className, type = 'button', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: keyof typeof PILL_TONES }) {
  return <button type={type} className={cn(pillClass, 'min-h-9 px-4', PILL_TONES[tone], className)} {...props} />;
}

export function PillAnchor({ href, tone = 'raised', className, children }: { href: string; tone?: keyof typeof PILL_TONES; className?: string; children: ReactNode }) {
  return <Link href={href} className={cn(pillClass, 'min-h-9 px-4', PILL_TONES[tone], className)}>{children}</Link>;
}

/** The recessed track that holds in-page buttons. */
export function ActionTrack({ className, children, label }: { className?: string; children: ReactNode; label?: string }) {
  return <div role="group" aria-label={label} className={cn(trackClass, 'gap-1', className)}>{children}</div>;
}

export function Count({ children }: { children: ReactNode }) {
  return <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{children ?? 0}</span>;
}

/** Page title with an optional state dot on the same line. */
export function PageTitle({ title, tone, state, meta }: { title: string; tone?: DotTone; state?: ReactNode; meta?: ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-0.5">
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
      {state && <span className="inline-flex items-baseline gap-1.5 text-sm text-muted-foreground">{tone && <Dot tone={tone} />}{state}</span>}
    </div>
    {meta && <div className="text-xs text-muted-foreground">{meta}</div>}
  </div>;
}

/** One recessed band with hairline rows, instead of stacked cards. */
export function ListBand({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn('divide-y divide-border overflow-hidden rounded-xl bg-muted/40 shadow-[inset_0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-inset ring-border/60', className)}>{children}</div>;
}

/** A band row: title line (with its dot) and a muted detail line; `aside` sits right on wide screens. */
export function BandRow({ title, tone, state, detail, aside, children, className, id }: { title: ReactNode; tone?: DotTone; state?: ReactNode; detail?: ReactNode; aside?: ReactNode; children?: ReactNode; className?: string; id?: string }) {
  return <div id={id} className={cn('px-4 py-3', className)}>
    <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <span className="min-w-0 break-words text-sm font-medium text-foreground">{title}</span>
          {state && <span className="inline-flex items-baseline gap-1.5 text-xs text-muted-foreground">{tone && <Dot tone={tone} />}{state}</span>}
        </div>
        {detail && <div className="mt-0.5 break-words text-xs text-muted-foreground">{detail}</div>}
      </div>
      {aside && <div className="shrink-0 text-sm tabular-nums sm:text-right">{aside}</div>}
    </div>
    {children}
  </div>;
}

export function BandEmpty({ children }: { children: ReactNode }) {
  return <div className="px-4 py-6 text-center text-sm text-muted-foreground">{children}</div>;
}

export function SectionTitle({ children, meta, action, id }: { children: ReactNode; meta?: ReactNode; action?: ReactNode; id?: string }) {
  return <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2">
    <div className="flex items-baseline gap-2">
      <h2 id={id} className="text-sm font-semibold text-foreground">{children}</h2>
      {meta != null && <span className="font-mono text-xs tabular-nums text-muted-foreground">{meta}</span>}
    </div>
    {action}
  </div>;
}

const METRIC_COLUMNS: Record<number, string> = {
  0: 'grid-cols-1', 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-2 sm:grid-cols-4', 5: 'grid-cols-2 sm:grid-cols-5', 6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
};

export type MetricItem = { label: string; value: ReactNode; href?: string; tone?: DotTone };

/** Mono figures in one recessed band; each links to its filtered list when it has one. */
export function MetricStrip({ items, className }: { items: MetricItem[]; className?: string }) {
  return <div className={cn('overflow-hidden rounded-xl bg-muted/40 shadow-[inset_0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-inset ring-border/60', className)}><div className={cn('-mb-px -mr-px grid', METRIC_COLUMNS[Math.min(items.length, 6)])}>
    {items.map(item => {
      const body = <>
        <span className="flex items-baseline gap-1.5 text-xs text-muted-foreground">{item.tone && <Dot tone={item.tone} />}{item.label}</span>
        <span className="mt-1.5 block font-mono text-2xl font-medium tabular-nums text-foreground">{item.value}</span>
      </>;
      // An odd count on the two-column phone grid lets the last figure take the full row instead of leaving a hole.
      const cell = cn('block min-w-0 border-b border-r border-border/70 px-4 py-3', items.length > 3 && items.length % 2 === 1 && 'last:max-sm:col-span-2');
      return item.href
        ? <Link key={item.label} href={item.href} className={cn(cell, 'transition-colors hover:bg-background/70 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring')}>{body}</Link>
        : <div key={item.label} className={cell}>{body}</div>;
    })}
  </div></div>;
}

/** A state line in a band: the reason a page is read-only, a missing connection, a blocked step. */
export function Notice({ tone = 'warn', children, action, className }: { tone?: DotTone; children: ReactNode; action?: ReactNode; className?: string }) {
  return <div role="status" className={cn('flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 rounded-xl bg-muted/40 px-4 py-3 text-sm ring-1 ring-inset ring-border/60', className)}>
    <span className="inline-flex min-w-0 items-baseline gap-2 text-foreground"><Dot tone={tone} /><span className="min-w-0 break-words">{children}</span></span>
    {action}
  </div>;
}

/** A form or detail surface: raised card with an uppercase eyebrow. */
export function Panel({ title, meta, children, className, ...props }: { title?: ReactNode; meta?: ReactNode } & React.HTMLAttributes<HTMLElement>) {
  return <section {...props} className={cn('min-w-0 rounded-xl border bg-card p-4 shadow-xs sm:p-5', className)}>
    {title && <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</h2>{meta && <span className="font-mono text-xs tabular-nums text-muted-foreground">{meta}</span>}</div>}
    {children}
  </section>;
}

export const inputClass = 'mt-1.5 block h-10 w-full min-w-0 rounded-lg border bg-background px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 aria-invalid:border-destructive disabled:opacity-60';
export const textareaClass = 'mt-1.5 block min-h-20 w-full min-w-0 rounded-lg border bg-background p-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 aria-invalid:border-destructive disabled:opacity-60';
export const labelClass = 'block min-w-0 text-xs font-medium text-foreground';

/** Operating authority as a title-line state. */
export function operatingState(operating: { open: boolean; limited?: boolean }) {
  if (operating.open) return { tone: 'ok' as const, state: 'Operating' };
  return operating.limited ? { tone: 'info' as const, state: 'Limited access' } : { tone: 'danger' as const, state: 'Authority lapsed' };
}

const OK = ['active', 'current', 'passed', 'saleable', 'released', 'accepted', 'completed', 'finalized', 'delivered', 'eligible', 'resolved', 'closed', 'open', 'published', 'staged', 'reconciled'];
const WARN = ['pending', 'pending_verification', 'pending_validation', 'receiving_hold', 'expiring_soon', 'due_soon', 'investigating', 'contained', 'variance_review', 'reserved', 'picking', 'final_verification', 'queued', 'processing', 'partially_accepted', 'maintenance', 'medium', 'upcoming', 'draft', 'not_yet_effective', 'unconfigured', 'suspended'];
const DANGER = ['expired', 'failed', 'rejected', 'recalled', 'held', 'on_hold', 'destroyed', 'terminated', 'overdue', 'high', 'critical', 'discrepancy', 'dead_letter', 'voided', 'revoked', 'inactive_expired'];

/** One mapping from any record status to a dot tone. */
export function statusTone(value: string | null | undefined): DotTone {
  const key = (value || '').toLowerCase();
  if (DANGER.includes(key)) return 'danger';
  if (WARN.includes(key)) return 'warn';
  if (OK.includes(key)) return 'ok';
  if (key === 'low' || key === 'reported') return 'info';
  return 'muted';
}
