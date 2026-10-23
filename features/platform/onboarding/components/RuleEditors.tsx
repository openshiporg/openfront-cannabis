'use client';

import { Plus, X } from 'lucide-react';
import { ActionTrack, inputClass, labelClass, PillButton } from '@/features/platform/components/cannabis-ui';
import { CAPACITIES, emptyLimit, emptyTax, LIMIT_WINDOWS, type LimitRow, type RuleErrors, type TaxRow } from '../lib/pack';

const select = `${inputClass} pr-8`;

function RowError({ errors, name }: { errors?: RuleErrors; name: string }) {
  return errors?.[name] ? <span className="mt-1 block font-normal text-destructive">{errors[name]}</span> : null;
}

function RemoveButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="mt-6 inline-flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-40"><X className="size-4" aria-hidden="true" /></button>;
}

export function LimitsEditor({ rows, onChange, errors, unitLabel = 'g' }: { rows: LimitRow[]; onChange: (rows: LimitRow[]) => void; errors?: RuleErrors; unitLabel?: string }) {
  const set = (index: number, patch: Partial<LimitRow>) => onChange(rows.map((row, at) => at === index ? { ...row, ...patch } : row));
  return <div className="space-y-2">
    {rows.map((row, index) => <div key={index} className="flex gap-2 rounded-lg bg-background/70 p-3 ring-1 ring-inset ring-border/60">
      <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[1fr_1fr_1fr_0.8fr]">
        <label className={labelClass}>Buyer<select value={row.capacity} onChange={event => set(index, { capacity: event.target.value })} className={select}>{CAPACITIES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label className={labelClass}>Category code<input value={row.categoryCode} onChange={event => set(index, { categoryCode: event.target.value })} placeholder="flower" aria-invalid={Boolean(errors?.[`limit-${index}-categoryCode`]) || undefined} className={`${inputClass} font-mono`} /><RowError errors={errors} name={`limit-${index}-categoryCode`} /></label>
        <label className={labelClass}>Window<select value={row.window} onChange={event => set(index, { window: event.target.value })} className={select}>{LIMIT_WINDOWS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
          {row.window === 'rolling' && <input value={row.windowDays} onChange={event => set(index, { windowDays: event.target.value })} inputMode="numeric" placeholder="Days" aria-label="Rolling window days" className={`${inputClass} font-mono`} />}<RowError errors={errors} name={`limit-${index}-windowDays`} /></label>
        <label className={labelClass}>Max ({unitLabel} equiv.)<input value={row.max} onChange={event => set(index, { max: event.target.value })} inputMode="decimal" placeholder="28" aria-invalid={Boolean(errors?.[`limit-${index}-max`]) || undefined} className={`${inputClass} font-mono`} /><RowError errors={errors} name={`limit-${index}-max`} /></label>
      </div>
      <RemoveButton label="Remove limit" onClick={() => onChange(rows.filter((_, at) => at !== index))} disabled={rows.length === 1} />
    </div>)}
    {errors?.limits && <p className="text-xs text-destructive">{errors.limits}</p>}
    <ActionTrack><PillButton onClick={() => onChange([...rows, emptyLimit()])}><Plus className="size-3.5" aria-hidden="true" />Add limit</PillButton></ActionTrack>
  </div>;
}

export function TaxEditor({ rows, onChange, errors }: { rows: TaxRow[]; onChange: (rows: TaxRow[]) => void; errors?: RuleErrors }) {
  const set = (index: number, patch: Partial<TaxRow>) => onChange(rows.map((row, at) => at === index ? { ...row, ...patch } : row));
  return <div className="space-y-2">
    {rows.map((row, index) => <div key={index} className="flex gap-2 rounded-lg bg-background/70 p-3 ring-1 ring-inset ring-border/60">
      <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-3">
        <label className={labelClass}>Category code<input value={row.categoryCode} onChange={event => set(index, { categoryCode: event.target.value })} placeholder="flower" aria-invalid={Boolean(errors?.[`tax-${index}-categoryCode`]) || undefined} className={`${inputClass} font-mono`} /><RowError errors={errors} name={`tax-${index}-categoryCode`} /></label>
        <label className={labelClass}>Buyer<select value={row.capacity} onChange={event => set(index, { capacity: event.target.value })} className={select}><option value="all">All buyers</option>{CAPACITIES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label className={labelClass}>Rate (%)<input value={row.rate} onChange={event => set(index, { rate: event.target.value })} inputMode="decimal" placeholder="15" aria-invalid={Boolean(errors?.[`tax-${index}-rate`]) || undefined} className={`${inputClass} font-mono`} /><RowError errors={errors} name={`tax-${index}-rate`} /></label>
      </div>
      <RemoveButton label="Remove tax rule" onClick={() => onChange(rows.filter((_, at) => at !== index))} disabled={rows.length === 1} />
    </div>)}
    {errors?.taxes && <p className="text-xs text-destructive">{errors.taxes}</p>}
    <ActionTrack><PillButton onClick={() => onChange([...rows, emptyTax()])}><Plus className="size-3.5" aria-hidden="true" />Add tax rule</PillButton></ActionTrack>
  </div>;
}
