'use client';

import { useId, useState, type ReactNode } from 'react';
import { Actions, buttonClass, inputClass, labelClass, Button } from '@/features/platform/components/cannabis-ui';
import { parseQuantityToMicrounits } from '@/features/lib/quantity';
import { amendRulePackFromDesk } from '@/features/platform/workspaces/actions/workflows';
import { LimitsEditor, TaxEditor } from '@/features/platform/onboarding/components/RuleEditors';
import { buildLimits, buildTaxes, emptyLimit, emptyTax, limitsToRows, minuteToTime, taxesToRows, TENDER_TYPES, timeToMinute, type RuleErrors } from '@/features/platform/onboarding/lib/pack';
import { CommandStatus, useCommand } from './useCommand';

type Rules = {
  version: string; adultMinimumAge: number; medicalMinimumAge: number; medicalEnabled: boolean; operatingStartMinute: number; operatingEndMinute: number;
  purchaseLimits: Array<Record<string, unknown>>; taxRules: Array<Record<string, unknown>>; allowedTenderTypes: string[];
};

/** Owner-only: supersede the current sales rules with a corrected version, effective now. */
export function RulePackForm({ rules, approvalLimitCents }: { rules: Rules; approvalLimitCents: number }) {
  const { state, onSubmit, pending, key, summary, markDirty } = useCommand(amendRulePackFromDesk);
  const [limits, setLimits] = useState(() => { const rows = limitsToRows(rules.purchaseLimits); return rows.length ? rows : [emptyLimit()]; });
  const [taxes, setTaxes] = useState(() => { const rows = taxesToRows(rules.taxRules); return rows.length ? rows : [emptyTax()]; });
  const [errors, setErrors] = useState<RuleErrors>({});
  const [opensAt, setOpensAt] = useState(minuteToTime(rules.operatingStartMinute));
  const [closesAt, setClosesAt] = useState(minuteToTime(rules.operatingEndMinute));
  const [adultAge, setAdultAge] = useState(String(rules.adultMinimumAge));
  const [medicalAge, setMedicalAge] = useState(String(rules.medicalMinimumAge));
  const [limit, setLimit] = useState((approvalLimitCents / 100).toFixed(2));
  const [tenders, setTenders] = useState<string[]>(rules.allowedTenderTypes);
  const [medical, setMedical] = useState(rules.medicalEnabled);

  function prepare(formData: FormData) {
    const found: RuleErrors = {};
    const purchaseLimits = buildLimits(limits, found); const taxRules = buildTaxes(taxes, found);
    const operatingStartMinute = timeToMinute(opensAt); const operatingEndMinute = timeToMinute(closesAt);
    if (operatingStartMinute == null) found.opensAt = 'Enter a time'; if (operatingEndMinute == null) found.closesAt = 'Enter a time';
    const adultMinimumAge = Number(adultAge); const medicalMinimumAge = Number(medicalAge);
    if (!Number.isInteger(adultMinimumAge) || adultMinimumAge < 0 || adultMinimumAge > 120) found.adultAge = 'Whole number of years';
    if (!Number.isInteger(medicalMinimumAge) || medicalMinimumAge < 0 || medicalMinimumAge > 120) found.medicalAge = 'Whole number of years';
    const micro = limit.trim() === '0' ? 0 : parseQuantityToMicrounits(limit);
    if (micro == null) found.limit = 'Enter an amount, e.g. 50.00';
    if (!tenders.length) found.tenders = 'Choose at least one payment type';
    setErrors(found);
    if (Object.keys(found).length) return false;
    formData.set('payload', JSON.stringify({ purchaseLimits, taxRules, operatingStartMinute, operatingEndMinute, adultMinimumAge, medicalMinimumAge, ownerApprovalLimitCents: Math.round(micro! / 10_000), allowedTenderTypes: tenders, medicalEnabled: medical }));
  }

  const err = (name: string) => errors[name] ? <span className="mt-1 block font-normal text-destructive">{errors[name]}</span> : null;
  return <form onSubmit={onSubmit(prepare)} onChange={markDirty} className="space-y-5" aria-label="Amend sales rules">
    <input type="hidden" name="idempotencyKey" value={key} />
    <fieldset disabled={pending} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className={labelClass}>New rule version<input name="version" required placeholder={`${rules.version}-2`} className={`${inputClass} font-mono`} />{state.fieldErrors?.version && <span className="mt-1 block font-normal text-destructive">{state.fieldErrors.version}</span>}</label>
        <label className={labelClass}>Opens<input type="time" value={opensAt} onChange={event => setOpensAt(event.target.value)} className={inputClass} />{err('opensAt')}</label>
        <label className={labelClass}>Closes<input type="time" value={closesAt} onChange={event => setClosesAt(event.target.value)} className={inputClass} />{err('closesAt')}</label>
        <label className={labelClass}>Adult-use minimum age<input value={adultAge} onChange={event => setAdultAge(event.target.value)} inputMode="numeric" className={`${inputClass} font-mono`} />{err('adultAge')}</label>
        {medical && <label className={labelClass}>Medical minimum age<input value={medicalAge} onChange={event => setMedicalAge(event.target.value)} inputMode="numeric" className={`${inputClass} font-mono`} />{err('medicalAge')}</label>}
        <label className={labelClass}>Your variance approval limit<input value={limit} onChange={event => setLimit(event.target.value)} inputMode="decimal" className={`${inputClass} font-mono`} />{err('limit')}</label>
      </div>
      <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
        <label className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-[5px] border bg-background px-3 text-sm"><input type="checkbox" checked={medical} onChange={event => setMedical(event.target.checked)} className="size-4 accent-green-700 dark:accent-green-400" />Medical sales</label>
        <fieldset className="space-y-2"><legend className="text-xs font-medium">Payment types</legend>
          <div className="flex flex-wrap gap-2">{TENDER_TYPES.map(option => <label key={option.value} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-[5px] border bg-background px-3 text-sm has-[:checked]:border-foreground/30 has-[:checked]:bg-muted/60"><input type="checkbox" checked={tenders.includes(option.value)} onChange={event => setTenders(current => event.target.checked ? [...current, option.value] : current.filter(type => type !== option.value))} className="size-4 accent-green-700 dark:accent-green-400" />{option.label}</label>)}</div>
          {err('tenders')}
        </fieldset>
      </div>
      <section className="space-y-2"><h3 className="text-xs font-medium">Purchase limits</h3><LimitsEditor rows={limits} onChange={setLimits} errors={errors} /></section>
      <section className="space-y-2"><h3 className="text-xs font-medium">Tax rules</h3><TaxEditor rows={taxes} onChange={setTaxes} errors={errors} /></section>
    </fieldset>
    <div className="flex flex-wrap items-center gap-3">
      <Actions><Button type="submit" tone="primary" disabled={pending}>{pending ? 'Saving…' : 'Save as new version'}</Button></Actions>
      <CommandStatus state={state} summary={summary} />
    </div>
  </form>;
}

/** Open state lives here, not in the server render, so the form and its result stay open after the save refreshes the page. */
export function AmendRulesDisclosure({ initiallyOpen, label = 'Amend sales rules', children }: { initiallyOpen: boolean; label?: string; children: ReactNode }) {
  const [open, setOpen] = useState(initiallyOpen);
  const id = useId();
  return <div className="bg-muted/30">
    <div className="px-3 py-2.5"><button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)} className={buttonClass(open ? 'quiet' : 'default')}>{open ? 'Close' : label}</button></div>
    <div id={id} hidden={!open} className="px-4 pb-4">{children}</div>
  </div>;
}
