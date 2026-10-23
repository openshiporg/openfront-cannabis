'use client';

import { useState } from 'react';
import { ActionTrack, inputClass, labelClass, PillButton } from '@/features/platform/components/cannabis-ui';
import { parseQuantityToMicrounits } from '@/features/lib/quantity';
import { amendRulePackFromDesk } from '@/features/platform/workspaces/actions/workflows';
import { LimitsEditor, TaxEditor } from '@/features/platform/onboarding/components/RuleEditors';
import { buildLimits, buildTaxes, emptyLimit, emptyTax, limitsToRows, minuteToTime, taxesToRows, timeToMinute, type RuleErrors } from '@/features/platform/onboarding/lib/pack';
import { CommandStatus, useCommand } from './useCommand';

type Rules = {
  version: string; adultMinimumAge: number; medicalMinimumAge: number; medicalEnabled: boolean; operatingStartMinute: number; operatingEndMinute: number;
  purchaseLimits: Array<Record<string, unknown>>; taxRules: Array<Record<string, unknown>>;
};

/** Owner-only: supersede the current sales rules with a corrected version, effective now. */
export function RulePackForm({ rules, approvalLimitCents }: { rules: Rules; approvalLimitCents: number }) {
  const { state, formAction, pending, key, summary, markDirty } = useCommand(amendRulePackFromDesk);
  const [limits, setLimits] = useState(() => { const rows = limitsToRows(rules.purchaseLimits); return rows.length ? rows : [emptyLimit()]; });
  const [taxes, setTaxes] = useState(() => { const rows = taxesToRows(rules.taxRules); return rows.length ? rows : [emptyTax()]; });
  const [errors, setErrors] = useState<RuleErrors>({});
  const [opensAt, setOpensAt] = useState(minuteToTime(rules.operatingStartMinute));
  const [closesAt, setClosesAt] = useState(minuteToTime(rules.operatingEndMinute));
  const [adultAge, setAdultAge] = useState(String(rules.adultMinimumAge));
  const [medicalAge, setMedicalAge] = useState(String(rules.medicalMinimumAge));
  const [limit, setLimit] = useState((approvalLimitCents / 100).toFixed(2));

  function submit(formData: FormData) {
    const found: RuleErrors = {};
    const purchaseLimits = buildLimits(limits, found); const taxRules = buildTaxes(taxes, found);
    const operatingStartMinute = timeToMinute(opensAt); const operatingEndMinute = timeToMinute(closesAt);
    if (operatingStartMinute == null) found.opensAt = 'Enter a time'; if (operatingEndMinute == null) found.closesAt = 'Enter a time';
    const adultMinimumAge = Number(adultAge); const medicalMinimumAge = Number(medicalAge);
    if (!Number.isInteger(adultMinimumAge) || adultMinimumAge < 0 || adultMinimumAge > 120) found.adultAge = 'Whole number of years';
    if (!Number.isInteger(medicalMinimumAge) || medicalMinimumAge < 0 || medicalMinimumAge > 120) found.medicalAge = 'Whole number of years';
    const micro = limit.trim() === '0' ? 0 : parseQuantityToMicrounits(limit);
    if (micro == null) found.limit = 'Enter an amount, e.g. 50.00';
    setErrors(found);
    if (Object.keys(found).length) return;
    formData.set('payload', JSON.stringify({ purchaseLimits, taxRules, operatingStartMinute, operatingEndMinute, adultMinimumAge, medicalMinimumAge, ownerApprovalLimitCents: Math.round(micro! / 10_000) }));
    formAction(formData);
  }

  const err = (name: string) => errors[name] ? <span className="mt-1 block font-normal text-destructive">{errors[name]}</span> : null;
  return <form action={submit} onChange={markDirty} className="space-y-5" aria-label="Amend sales rules">
    <input type="hidden" name="idempotencyKey" value={key} />
    <fieldset disabled={pending} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className={labelClass}>New rule version<input name="version" required placeholder={`${rules.version}-2`} className={`${inputClass} font-mono`} />{state.fieldErrors?.version && <span className="mt-1 block font-normal text-destructive">{state.fieldErrors.version}</span>}</label>
        <label className={labelClass}>Opens<input type="time" value={opensAt} onChange={event => setOpensAt(event.target.value)} className={inputClass} />{err('opensAt')}</label>
        <label className={labelClass}>Closes<input type="time" value={closesAt} onChange={event => setClosesAt(event.target.value)} className={inputClass} />{err('closesAt')}</label>
        <label className={labelClass}>Adult-use minimum age<input value={adultAge} onChange={event => setAdultAge(event.target.value)} inputMode="numeric" className={`${inputClass} font-mono`} />{err('adultAge')}</label>
        {rules.medicalEnabled && <label className={labelClass}>Medical minimum age<input value={medicalAge} onChange={event => setMedicalAge(event.target.value)} inputMode="numeric" className={`${inputClass} font-mono`} />{err('medicalAge')}</label>}
        <label className={labelClass}>Your variance approval limit<input value={limit} onChange={event => setLimit(event.target.value)} inputMode="decimal" className={`${inputClass} font-mono`} />{err('limit')}</label>
      </div>
      <section className="space-y-2"><h3 className="text-xs font-medium">Purchase limits</h3><LimitsEditor rows={limits} onChange={setLimits} errors={errors} /></section>
      <section className="space-y-2"><h3 className="text-xs font-medium">Tax rules</h3><TaxEditor rows={taxes} onChange={setTaxes} errors={errors} /></section>
    </fieldset>
    <div className="flex flex-wrap items-center gap-3">
      <ActionTrack><PillButton type="submit" tone="ink" disabled={pending}>{pending ? 'Saving…' : 'Save as new version'}</PillButton></ActionTrack>
      <CommandStatus state={state} summary={summary} />
    </div>
  </form>;
}
