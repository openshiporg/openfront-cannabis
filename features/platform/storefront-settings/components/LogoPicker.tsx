'use client';

import { useEffect, useState } from 'react';
import { LOGO_ICONS } from '@/features/platform/store-settings/lib/untitled-logo-registry';
import { sanitizeStoreLogoSvg } from '@/features/lib/sanitize-store-logo';
import { StoreLogo } from '@/features/storefront/components/StoreLogo';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

/** Restaurant picker contract, adapted to the existing Cannabis settings form. */
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
  return <div className="space-y-4">
    <label className="block space-y-2"><span className="text-sm font-medium">Logo</span>
      <select aria-label="Choose a logo" className="min-h-11 w-full rounded-md border bg-background px-3" value={custom ? 'custom' : selected?.id || 'custom'} onChange={event => {
        const icon = LOGO_ICONS.find(candidate => candidate.id === event.target.value);
        setCustom(!icon);
        if (icon) { onChange(icon.lightSvg); setDraft(icon.lightSvg); }
      }}>
        <option value="custom">Custom SVG</option>
        {LOGO_ICONS.map(icon => <option key={icon.id} value={icon.id}>{icon.name}</option>)}
      </select>
    </label>
    <div className="flex min-w-0 items-center gap-3 rounded-lg border p-3" role="group" aria-label="Selected logo preview">
      <StoreLogo svg={value} hue={hue} name={selected?.name || 'Custom logo'} />
    </div>
    {custom && <div className="space-y-3 rounded-lg border p-3">
      <label className="block space-y-2"><span className="text-sm font-medium">Custom SVG</span>
        <Textarea aria-label="Custom SVG" className="min-h-32 font-mono" maxLength={100000} value={draft} onChange={event => setDraft(event.target.value)} aria-invalid={Boolean(draft && !safe)} />
      </label>
      <div className="flex items-center justify-between gap-3">
        <div aria-label="Draft logo preview" className="min-w-0">{safe && <StoreLogo svg={safe} hue={hue} name="Draft" />}</div>
        <div className="flex shrink-0 gap-2">
          {pending && <Button type="button" variant="outline" onClick={() => setDraft(value)}>Discard</Button>}
          <Button type="button" disabled={!safe || safe === value} onClick={() => { onChange(safe); setDraft(safe); }}>Apply SVG</Button>
        </div>
      </div>
      {draft && !safe && <p role="alert" className="text-sm text-destructive">Invalid or unsafe SVG.</p>}
      {pending && safe && <p role="status" className="text-sm text-muted-foreground">Unapplied logo changes. Apply or discard them before saving.</p>}
    </div>}
    <input type="hidden" name="logoIcon" value={value} />
  </div>;
}
