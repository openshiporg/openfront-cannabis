'use client';

import { useEffect, useState } from 'react';
import { LOGO_ICONS } from '@/features/platform/store-settings/lib/untitled-logo-registry';
import { sanitizeStoreLogoSvg } from '@/features/lib/sanitize-store-logo';
import { StoreLogo } from '@/features/storefront/components/StoreLogo';
import { ActionTrack, PillButton, textareaClass } from '@/features/platform/components/cannabis-ui';
import { cn } from '@/lib/utils';

/** Restaurant picker contract, adapted to the Cannabis settings form: the Untitled UI registry as a grid, or a custom SVG. */
export function LogoPicker({ value, hue, onChange, onDraftPendingChange }: {
  value: string;
  hue: string;
  onChange: (svg: string) => void;
  onDraftPendingChange?: (pending: boolean) => void;
}) {
  const selected = LOGO_ICONS.find(icon => icon.lightSvg === value);
  const [custom, setCustom] = useState(!selected);
  const [draft, setDraft] = useState(value);
  const safe = sanitizeStoreLogoSvg(draft);
  const pending = custom && draft.trim() !== '' && draft !== value && safe !== value;
  useEffect(() => { onDraftPendingChange?.(pending); }, [pending, onDraftPendingChange]);
  const choose = (svg: string) => { setCustom(false); onChange(svg); setDraft(svg); };
  return <div className="space-y-4">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <span id="logo-picker-label" className="text-xs font-medium text-foreground">Logo</span>
      <span className="text-xs text-muted-foreground">{custom ? 'Custom SVG' : selected?.name}</span>
    </div>
    <div role="radiogroup" aria-labelledby="logo-picker-label" className="grid grid-cols-6 gap-1.5 rounded-xl bg-muted/50 p-1.5 shadow-[inset_0_1px_2px_rgb(0_0_0/0.06)] sm:grid-cols-8 lg:grid-cols-10">
      {LOGO_ICONS.map(icon => {
        const active = !custom && selected?.id === icon.id;
        return <button key={icon.id} type="button" role="radio" aria-checked={active} aria-label={icon.name} title={icon.name} onClick={() => choose(icon.lightSvg)}
          className={cn('flex aspect-square items-center justify-center rounded-lg p-2 transition-colors hover:bg-background/70 focus-visible:outline-2 focus-visible:outline-ring', active && 'bg-background shadow-[0_1px_2px_rgb(0_0_0/0.12),0_0_0_0.5px_rgb(0_0_0/0.06)] dark:bg-zinc-800')}>
          <span aria-hidden="true" className="block size-full [&>svg]:block [&>svg]:size-full" style={{ filter: `hue-rotate(${hue}deg)` }} dangerouslySetInnerHTML={{ __html: icon.lightSvg }} />
        </button>;
      })}
      <button type="button" role="radio" aria-checked={custom} onClick={() => setCustom(true)} className={cn('col-span-2 flex items-center justify-center rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring', custom && 'bg-background text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.12),0_0_0_0.5px_rgb(0_0_0/0.06)] dark:bg-zinc-800')}>Custom SVG</button>
    </div>
    {custom && <div className="space-y-3 rounded-xl bg-muted/40 p-3 ring-1 ring-inset ring-border/60">
      <label className="block text-xs font-medium">Custom SVG
        <textarea aria-label="Custom SVG" className={`${textareaClass} min-h-32 font-mono text-xs`} maxLength={100000} value={draft} onChange={event => setDraft(event.target.value)} aria-invalid={Boolean(draft && !safe)} />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div aria-label="Draft logo preview" className="min-w-0">{safe && <StoreLogo svg={safe} hue={hue} name="Draft" size="sm" />}</div>
        <ActionTrack>
          {pending && <PillButton onClick={() => setDraft(value)}>Discard</PillButton>}
          <PillButton tone="ink" disabled={!safe || safe === value} onClick={() => { onChange(safe); setDraft(safe); }}>Apply SVG</PillButton>
        </ActionTrack>
      </div>
      {draft && !safe && <p role="alert" className="text-sm text-destructive">Invalid or unsafe SVG.</p>}
      {pending && safe && <p role="status" className="text-sm text-muted-foreground">Unapplied logo changes</p>}
    </div>}
    <input type="hidden" name="logoIcon" value={value} />
  </div>;
}
