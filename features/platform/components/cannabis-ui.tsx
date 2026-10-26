// Cannabis platform kit: operator controls on the dashboard's own tokens. Underline tabs for
// filters, flat 5px buttons, bordered tables with a status column, and sections with a
// one-line header, so pages read as dense dispensary back-office software in light and dark.

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

const TEXT_TONES = {
  ok: 'text-emerald-700 dark:text-emerald-400',
  warn: 'text-amber-700 dark:text-amber-400',
  danger: 'text-red-700 dark:text-red-400',
  info: 'text-sky-700 dark:text-sky-400',
  accent: 'text-green-800 dark:text-green-400',
  muted: 'text-muted-foreground',
} as const;

export type DotTone = keyof typeof DOT_TONES;

/** 6px status mark: give the parent `items-baseline` so it sits on the text line. */
export function Dot({ tone = 'muted', className }: { tone?: DotTone; className?: string }) {
  return <span aria-hidden="true" className={cn('inline-block size-1.5 shrink-0 translate-y-[-0.15em] rounded-full', DOT_TONES[tone], className)} />;
}

/** Text with its status mark, for a status cell or a title line. */
export function DotLabel({ tone, children, className }: { tone: DotTone; children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-baseline gap-1.5', className)}><Dot tone={tone} />{children}</span>;
}

/** Status text in its tone colour: for a table's status column. */
export function StatusText({ tone, children, className }: { tone: DotTone; children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-baseline gap-1.5 whitespace-nowrap text-[13px] font-medium', TEXT_TONES[tone], className)}><Dot tone={tone} />{children}</span>;
}

// ---------------------------------------------------------------------------------------------
// Controls

const buttonBase = 'inline-flex min-h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[5px] px-3 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 max-sm:min-h-10';

const BUTTON_TONES = {
  default: 'border border-border bg-background text-foreground shadow-xs hover:bg-muted',
  primary: 'border border-foreground bg-foreground text-background hover:bg-foreground/85',
  danger: 'border border-border bg-background text-red-700 shadow-xs hover:border-red-300 hover:bg-red-50 dark:text-red-400 dark:hover:border-red-900 dark:hover:bg-red-950/40',
  quiet: 'text-muted-foreground hover:bg-muted hover:text-foreground',
} as const;

export type ButtonTone = keyof typeof BUTTON_TONES;

export function buttonClass(tone: ButtonTone = 'default', className?: string) {
  return cn(buttonBase, BUTTON_TONES[tone], className);
}

export function Button({ tone = 'default', className, type = 'button', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: ButtonTone }) {
  return <button type={type} className={buttonClass(tone, className)} {...props} />;
}

export function ButtonLink({ href, tone = 'default', className, children }: { href: string; tone?: ButtonTone; className?: string; children: ReactNode }) {
  return <Link href={href} className={buttonClass(tone, className)}>{children}</Link>;
}

/** A row of buttons. */
export function Actions({ className, children, label }: { className?: string; children: ReactNode; label?: string }) {
  return <div role="group" aria-label={label} className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>;
}

/** Underline tab bar for filters and page switches. */
export function Tabs({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return <nav aria-label={label} className={cn('-mb-px flex min-w-0 gap-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)}>{children}</nav>;
}

export function TabLink({ href, active, count, className, children }: { href: string; active?: boolean; count?: ReactNode; className?: string; children: ReactNode }) {
  return <Link href={href} aria-current={active ? 'page' : undefined} className={cn('inline-flex shrink-0 items-baseline gap-1.5 whitespace-nowrap border-b-2 border-transparent pb-2.5 pt-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring aria-[current=page]:border-foreground aria-[current=page]:text-foreground max-sm:pb-3', className)}>
    {children}{count != null && <span className="tabular-nums text-xs font-normal text-muted-foreground">{count}</span>}
  </Link>;
}

/** The tab bar's baseline rule, with search or actions at its right end. */
export function TabBar({ children, aside, className }: { children: ReactNode; aside?: ReactNode; className?: string }) {
  return <div className={cn('flex flex-col gap-3 border-b border-border lg:flex-row lg:items-end lg:justify-between', className)}>
    <div className="min-w-0">{children}</div>
    {aside && <div className="pb-2.5 max-lg:order-first">{aside}</div>}
  </div>;
}

export function Count({ children }: { children: ReactNode }) {
  return <span className="tabular-nums text-xs text-muted-foreground">{children ?? 0}</span>;
}

// ---------------------------------------------------------------------------------------------
// Page structure

/** Page title with its state on the same line. */
export function PageTitle({ title, tone, state, meta }: { title: string; tone?: DotTone; state?: ReactNode; meta?: ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-1">
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
      <h1 className="text-lg font-semibold tracking-tight text-foreground">{title}</h1>
      {state && (tone ? <StatusText tone={tone}>{state}</StatusText> : <span className="text-[13px] text-muted-foreground">{state}</span>)}
    </div>
    {meta && <div className="text-xs text-muted-foreground">{meta}</div>}
  </div>;
}

export function SectionTitle({ children, meta, action, id }: { children: ReactNode; meta?: ReactNode; action?: ReactNode; id?: string }) {
  return <div className="mb-2 flex min-h-8 flex-wrap items-center justify-between gap-x-3 gap-y-2">
    <div className="flex items-baseline gap-2">
      <h2 id={id} className="text-[13px] font-semibold text-foreground">{children}</h2>
      {meta != null && <span className="tabular-nums text-xs text-muted-foreground">{meta}</span>}
    </div>
    {action}
  </div>;
}

/** Bordered surface for a table or list. */
export function Frame({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn('min-w-0 overflow-hidden rounded-[6px] border border-border bg-card', className)}>{children}</div>;
}

/** A bordered list with ruled rows. */
export function ListBand({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn('min-w-0 divide-y divide-border overflow-hidden rounded-[6px] border border-border bg-card', className)}>{children}</div>;
}

/** A list row: title line with its status, a muted detail line, and an aside on the right on wide screens. */
export function BandRow({ title, tone, state, detail, aside, children, className, id }: { title: ReactNode; tone?: DotTone; state?: ReactNode; detail?: ReactNode; aside?: ReactNode; children?: ReactNode; className?: string; id?: string }) {
  return <div id={id} className={cn('px-3 py-2.5', className)}>
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <span className="min-w-0 break-words text-[13px] font-medium text-foreground">{title}</span>
          {state && (tone ? <StatusText tone={tone} className="text-xs">{state}</StatusText> : <span className="text-xs text-muted-foreground">{state}</span>)}
        </div>
        {detail && <div className="mt-0.5 break-words text-xs text-muted-foreground">{detail}</div>}
      </div>
      {aside && <div className="shrink-0 text-[13px] tabular-nums sm:text-right">{aside}</div>}
    </div>
    {children}
  </div>;
}

export function BandEmpty({ children }: { children: ReactNode }) {
  return <div className="px-3 py-6 text-center text-[13px] text-muted-foreground">{children}</div>;
}

// ---------------------------------------------------------------------------------------------
// Tables

/** A dense table in a bordered frame; scrolls sideways on a phone instead of squeezing columns. */
export function Table({ label, className, children, minWidth = 640 }: { label?: string; className?: string; children: ReactNode; minWidth?: number }) {
  return <div className={cn('min-w-0 overflow-x-auto rounded-[6px] border border-border bg-card', className)}>
    <table aria-label={label} className="w-full border-collapse text-[13px]" style={{ minWidth }}>{children}</table>
  </div>;
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="bg-muted/50"><tr className="border-b border-border">{children}</tr></thead>;
}

export function Th({ children, align = 'left', className }: { children?: ReactNode; align?: 'left' | 'right'; className?: string }) {
  return <th scope="col" className={cn('h-8 whitespace-nowrap px-3 text-xs font-medium text-muted-foreground', align === 'right' ? 'text-right' : 'text-left', className)}>{children}</th>;
}

export function Tr({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return <tr id={id} className={cn('border-b border-border/70 last:border-b-0 transition-colors hover:bg-muted/30', className)}>{children}</tr>;
}

export function Td({ children, align = 'left', className, colSpan }: { children?: ReactNode; align?: 'left' | 'right'; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={cn('px-3 py-2 align-baseline', align === 'right' && 'text-right tabular-nums', className)}>{children}</td>;
}

/** The whole-row empty state for a table. */
export function TEmpty({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return <tr><td colSpan={colSpan} className="px-3 py-8 text-center text-[13px] text-muted-foreground">{children}</td></tr>;
}

/**
 * Records in table columns whose rows also carry actions (renew, close a shift, edit a product):
 * a header row on wide screens, labelled cells on a phone, and an action area under each row.
 */
export function RecordList({ columns, headers, label, children, className }: { columns: string; headers: Array<{ label: string; align?: 'right' }>; label?: string; children: ReactNode; className?: string }) {
  return <div role="list" aria-label={label} className={cn('min-w-0 overflow-hidden rounded-[6px] border border-border bg-card', className)}>
    <div aria-hidden="true" className="hidden h-8 items-center gap-4 border-b border-border bg-muted/50 px-3 text-xs font-medium text-muted-foreground md:grid" style={{ gridTemplateColumns: columns }}>
      {headers.map(header => <span key={header.label} className={cn('truncate', header.align === 'right' && 'text-right')}>{header.label}</span>)}
    </div>
    <div className="divide-y divide-border/70">{children}</div>
  </div>;
}

export function RecordRow({ columns, headers, cells, children, id, className }: { columns: string; headers: Array<{ label: string; align?: 'right' }>; cells: ReactNode[]; children?: ReactNode; id?: string; className?: string }) {
  return <div role="listitem" id={id} className={cn('px-3 py-2.5 text-[13px] transition-colors hover:bg-muted/20', className)}>
    <div className="grid grid-cols-1 gap-1 md:items-baseline md:gap-4 md:[grid-template-columns:var(--cols)]" style={{ '--cols': columns } as React.CSSProperties}>
      {cells.map((cell, index) => <div key={headers[index]?.label ?? index} className={cn('min-w-0 break-words', index > 0 && 'max-md:flex max-md:gap-2', headers[index]?.align === 'right' && 'md:text-right md:tabular-nums')}>
        {index > 0 && <span className="w-28 shrink-0 text-xs text-muted-foreground md:hidden">{headers[index]?.label}</span>}
        <div className="min-w-0">{cell}</div>
      </div>)}
    </div>
    {children}
  </div>;
}

/** An identifier: package UID, SKU, receipt or license number. */
export function Ref({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('font-mono text-[12px] tracking-tight', className)}>{children}</span>;
}

// ---------------------------------------------------------------------------------------------
// Summary, notices and panels

const METRIC_COLUMNS: Record<number, string> = {
  0: 'grid-cols-1', 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-2 sm:grid-cols-4', 5: 'grid-cols-2 sm:grid-cols-5', 6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
};

export type MetricItem = { label: string; value: ReactNode; href?: string; tone?: DotTone };

/** Compact counts in one ruled strip; each links to its filtered list when it has one. */
export function MetricStrip({ items, className }: { items: MetricItem[]; className?: string }) {
  return <div className={cn('overflow-hidden rounded-[6px] border border-border bg-card', className)}><div className={cn('-mb-px -mr-px grid', METRIC_COLUMNS[Math.min(items.length, 6)])}>
    {items.map(item => {
      const body = <>
        <span className="flex items-baseline gap-1.5 text-xs text-muted-foreground">{item.tone && <Dot tone={item.tone} />}{item.label}</span>
        <span className="mt-0.5 block text-lg font-semibold tabular-nums text-foreground">{item.value}</span>
      </>;
      const cell = cn('block min-w-0 border-b border-r border-border px-3 py-2', items.length > 3 && items.length % 2 === 1 && 'last:max-sm:col-span-2');
      return item.href
        ? <Link key={item.label} href={item.href} className={cn(cell, 'transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring')}>{body}</Link>
        : <div key={item.label} className={cell}>{body}</div>;
    })}
  </div></div>;
}

const NOTICE_TONES: Record<DotTone, string> = {
  ok: 'border-border bg-card',
  warn: 'border-amber-300/70 bg-amber-50 dark:border-amber-900/70 dark:bg-amber-950/30',
  danger: 'border-red-300/70 bg-red-50 dark:border-red-900/70 dark:bg-red-950/30',
  info: 'border-border bg-card',
  accent: 'border-border bg-card',
  muted: 'border-border bg-card',
};

/** A state line: the reason a page is read-only, a missing connection, a blocked step. */
export function Notice({ tone = 'warn', children, action, className }: { tone?: DotTone; children: ReactNode; action?: ReactNode; className?: string }) {
  return <div role="status" className={cn('flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[6px] border px-3 py-2.5 text-[13px]', NOTICE_TONES[tone], className)}>
    <span className="inline-flex min-w-0 items-baseline gap-2 font-medium text-foreground"><Dot tone={tone} /><span className="min-w-0 break-words">{children}</span></span>
    {action}
  </div>;
}

/** A form or detail surface: a bordered block with a header bar. */
export function Panel({ title, meta, children, className, ...props }: { title?: ReactNode; meta?: ReactNode } & Omit<React.HTMLAttributes<HTMLElement>, 'title'>) {
  return <section {...props} className={cn('min-w-0 rounded-[6px] border border-border bg-card', className)}>
    {title && <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2"><h2 className="text-[13px] font-semibold text-foreground">{title}</h2>{meta && <span className="text-xs tabular-nums text-muted-foreground">{meta}</span>}</div>}
    <div className="p-4">{children}</div>
  </section>;
}

/** A small heading inside a panel. */
export function SubHeading({ children, meta }: { children: ReactNode; meta?: ReactNode }) {
  return <h3 className="flex items-baseline gap-2 text-xs font-semibold text-foreground">{children}{meta && <span className="font-normal text-muted-foreground">{meta}</span>}</h3>;
}

/** A disclosure that opens a form below its button: the secondary task on a page. */
export function Disclosure({ label, children, open, className }: { label: ReactNode; children: ReactNode; open?: boolean; className?: string }) {
  return <details open={open} className={cn('group min-w-0', className)}>
    <summary className={buttonClass('default', 'list-none [&::-webkit-details-marker]:hidden group-open:bg-muted')}>{label}</summary>
    <div className="mt-3 rounded-[6px] border border-border bg-card p-4">{children}</div>
  </details>;
}

export const inputClass = 'mt-1 block h-9 w-full min-w-0 rounded-[5px] border border-input bg-background px-2.5 text-[13px] shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 aria-invalid:border-destructive disabled:opacity-60 max-sm:h-10 max-sm:text-base';
export const textareaClass = 'mt-1 block min-h-20 w-full min-w-0 rounded-[5px] border border-input bg-background p-2.5 text-[13px] shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 aria-invalid:border-destructive disabled:opacity-60 max-sm:text-base';
export const labelClass = 'block min-w-0 text-xs font-medium text-foreground';

// ---------------------------------------------------------------------------------------------
// State mapping

/** Operating authority as a title-line state. */
export function operatingState(operating: { open: boolean; limited?: boolean }) {
  if (operating.open) return { tone: 'ok' as const, state: 'Operating' };
  return operating.limited ? { tone: 'info' as const, state: 'Limited access' } : { tone: 'danger' as const, state: 'Authority lapsed' };
}

const OK = ['active', 'current', 'passed', 'saleable', 'released', 'accepted', 'completed', 'finalized', 'delivered', 'eligible', 'resolved', 'closed', 'open', 'published', 'staged', 'reconciled'];
const WARN = ['pending', 'pending_verification', 'pending_validation', 'receiving_hold', 'expiring_soon', 'due_soon', 'investigating', 'contained', 'variance_review', 'reserved', 'picking', 'final_verification', 'queued', 'processing', 'partially_accepted', 'maintenance', 'medium', 'upcoming', 'draft', 'not_yet_effective', 'unconfigured', 'suspended'];
const DANGER = ['expired', 'failed', 'rejected', 'recalled', 'held', 'on_hold', 'destroyed', 'terminated', 'overdue', 'high', 'critical', 'discrepancy', 'dead_letter', 'voided', 'revoked', 'inactive_expired'];

/** One mapping from any record status to a tone. */
export function statusTone(value: string | null | undefined): DotTone {
  const key = (value || '').toLowerCase();
  if (DANGER.includes(key)) return 'danger';
  if (WARN.includes(key)) return 'warn';
  if (OK.includes(key)) return 'ok';
  if (key === 'low' || key === 'reported') return 'info';
  return 'muted';
}

// ---------------------------------------------------------------------------------------------
// Names kept for the onboarding dialog, which is out of scope for page redesigns.

export const trackClass = 'flex flex-wrap items-center gap-2';
export const pillClass = buttonClass('default');
export const PillButton = ({ tone = 'raised', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'raised' | 'ink' | 'danger' }) =>
  <Button tone={tone === 'ink' ? 'primary' : tone === 'danger' ? 'danger' : 'default'} {...props} />;
export const PillAnchor = ({ tone = 'raised', ...props }: { href: string; tone?: 'raised' | 'ink' | 'danger'; className?: string; children: ReactNode }) =>
  <ButtonLink tone={tone === 'ink' ? 'primary' : tone === 'danger' ? 'danger' : 'default'} {...props} />;
export const ActionTrack = Actions;
export function Track({ label, className, children }: { label?: string; className?: string; children: ReactNode }) {
  return <div role="group" aria-label={label} className={cn(trackClass, className)}>{children}</div>;
}
