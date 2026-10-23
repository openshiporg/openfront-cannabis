'use client';

import { useActionState, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ActionTrack, Dot, inputClass, labelClass, PillButton, textareaClass, Track } from '@/features/platform/components/cannabis-ui';
import { confirmDiscard, useUnsavedChangesGuard } from '@/features/platform/lib/useUnsavedChangesGuard';
import { checkCannabisOnboardingStatus, installCannabisAuthorityPack } from '../actions/onboarding';
import { INITIAL_ONBOARDING_STATE, REQUIRED_AUTHORITY_FIELDS, type OnboardingState } from '../lib/state';
import { buildLimits, buildTaxes, dayStart, emptyLimit, emptyTax, localDate, REQUIRED_ACTIVITIES, TENDER_TYPES, timeToMinute, type LimitRow, type RuleErrors, type TaxRow } from '../lib/pack';
import { parseQuantityToMicrounits } from '@/features/lib/quantity';
import { LimitsEditor, TaxEditor } from './RuleEditors';

const STEPS = ['Business', 'Premises', 'License', 'Your credential', 'Sales rules', 'Payments and reporting'] as const;
type Step = (typeof STEPS)[number];

const TIME_ZONES = (() => {
  try { return Intl.supportedValuesOf('timeZone'); } catch { return ['America/Denver', 'America/Los_Angeles', 'America/Chicago', 'America/New_York', 'America/Toronto', 'America/Vancouver']; }
})();

type Values = {
  organizationName: string; legalName: string; jurisdictionCode: string;
  premisesName: string; premisesCode: string; line1: string; city: string; region: string; postalCode: string; country: string; phone: string; timezone: string; currencyCode: string;
  licenseNumber: string; licenseType: string; regulatorName: string; authorityReference: string; licenseEffectiveAt: string; licenseExpiresAt: string;
  credentialType: string; credentialReference: string; credentialEffectiveAt: string; credentialExpiresAt: string; staffEvidenceHash: string; ownerApprovalLimit: string;
  ruleVersion: string; citations: string; ruleEffectiveAt: string; ruleExpiresAt: string; adultMinimumAge: string; medicalEnabled: boolean; medicalMinimumAge: string;
  opensAt: string; closesAt: string; labelRequirements: string; returnPolicy: string; outagePolicy: string; privacyPolicy: string; retentionPolicy: string; pickupEnabled: boolean;
  tenders: string[]; tenderReference: string; traceabilityProviderCode: string; traceabilityAuthorityReference: string;
};

const initialValues = (): Values => ({
  organizationName: '', legalName: '', jurisdictionCode: '',
  premisesName: '', premisesCode: '', line1: '', city: '', region: '', postalCode: '', country: 'US', phone: '',
  timezone: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Denver'; } catch { return 'America/Denver'; } })(), currencyCode: 'USD',
  licenseNumber: '', licenseType: '', regulatorName: '', authorityReference: '', licenseEffectiveAt: localDate(), licenseExpiresAt: localDate(365),
  credentialType: '', credentialReference: '', credentialEffectiveAt: localDate(), credentialExpiresAt: localDate(365), staffEvidenceHash: '', ownerApprovalLimit: '',
  ruleVersion: '', citations: '', ruleEffectiveAt: localDate(), ruleExpiresAt: localDate(365), adultMinimumAge: '21', medicalEnabled: false, medicalMinimumAge: '18',
  opensAt: '09:00', closesAt: '21:00', labelRequirements: '', returnPolicy: '', outagePolicy: '', privacyPolicy: '', retentionPolicy: '', pickupEnabled: false,
  tenders: ['cash'], tenderReference: '', traceabilityProviderCode: '', traceabilityAuthorityReference: '',
});

const STEP_FIELDS: Record<Step, Array<keyof Values | 'limits' | 'taxes'>> = {
  Business: ['organizationName', 'legalName', 'jurisdictionCode'],
  Premises: ['premisesName', 'premisesCode', 'line1', 'city', 'region', 'postalCode', 'country', 'phone', 'timezone', 'currencyCode'],
  License: ['licenseNumber', 'licenseType', 'regulatorName', 'authorityReference', 'licenseEffectiveAt', 'licenseExpiresAt'],
  'Your credential': ['credentialType', 'credentialReference', 'credentialEffectiveAt', 'credentialExpiresAt', 'staffEvidenceHash', 'ownerApprovalLimit'],
  'Sales rules': ['ruleVersion', 'citations', 'ruleEffectiveAt', 'ruleExpiresAt', 'adultMinimumAge', 'medicalMinimumAge', 'opensAt', 'closesAt', 'limits', 'taxes', 'labelRequirements', 'returnPolicy', 'outagePolicy', 'privacyPolicy', 'retentionPolicy'],
  'Payments and reporting': ['tenders', 'tenderReference', 'traceabilityProviderCode', 'traceabilityAuthorityReference'],
};

const lines = (value: string) => value.split('\n').map(line => line.trim()).filter(Boolean);

/** Assemble the authority pack the server installs, with field errors for anything it would refuse. */
function buildPack(values: Values, limits: LimitRow[], taxes: TaxRow[], idempotencyKey: string) {
  const errors: RuleErrors = {};
  const need = (name: keyof Values, message: string) => { if (!String(values[name]).trim()) errors[name] = message; return String(values[name]).trim(); };
  const required: Array<[keyof Values, string]> = [
    ['organizationName', 'Enter the business name'], ['legalName', 'Enter the legal name'], ['jurisdictionCode', 'Enter the jurisdiction, e.g. US-CO'],
    ['premisesName', 'Enter the premises name'], ['premisesCode', 'Enter a premises code'], ['line1', 'Enter the street address'], ['city', 'Enter the city'], ['region', 'Enter the state or province'], ['postalCode', 'Enter the postal code'],
    ['licenseNumber', 'Enter the license number'], ['licenseType', 'Enter the license type'], ['regulatorName', 'Enter the regulator'], ['authorityReference', 'Enter the license reference'],
    ['credentialType', 'Enter your credential type'], ['credentialReference', 'Enter your credential number'],
    ['ruleVersion', 'Enter a rule version, e.g. 2026.1'], ['citations', 'Enter at least one rule citation'], ['labelRequirements', 'Enter at least one label requirement'],
    ['returnPolicy', 'Enter the return policy'], ['outagePolicy', 'Enter the outage policy'], ['privacyPolicy', 'Enter the privacy policy'], ['retentionPolicy', 'Enter the record retention policy'],
    ['tenderReference', 'Enter the payment authority reference'], ['traceabilityProviderCode', 'Enter the traceability system, e.g. metrc'], ['traceabilityAuthorityReference', 'Enter your traceability account reference'],
  ];
  for (const [name, message] of required) need(name, message);
  if (values.staffEvidenceHash.trim().length < 16) errors.staffEvidenceHash = 'At least 16 characters';
  const dates: Array<[keyof Values, keyof Values, string]> = [['licenseEffectiveAt', 'licenseExpiresAt', 'License'], ['credentialEffectiveAt', 'credentialExpiresAt', 'Credential'], ['ruleEffectiveAt', 'ruleExpiresAt', 'Rules']];
  const instants: Record<string, string> = {};
  for (const [from, to, label] of dates) {
    const start = dayStart(String(values[from])); const end = dayStart(String(values[to]));
    if (!start) errors[from] = 'Enter a date';
    if (!end) errors[to] = 'Enter a date';
    if (start && end && start >= end) errors[to] = `${label} must end after it starts`;
    if (start) instants[from] = start; if (end) instants[to] = end;
  }
  if (instants.ruleEffectiveAt && new Date(instants.ruleEffectiveAt).getTime() > Date.now()) errors.ruleEffectiveAt = 'Rules must already be in effect';
  if (instants.ruleExpiresAt && new Date(instants.ruleExpiresAt).getTime() <= Date.now()) errors.ruleExpiresAt = 'Must be in the future';
  const age = (name: keyof Values) => { const value = Number(values[name]); if (!Number.isInteger(value) || value < 0 || value > 120) errors[name] = 'Whole number of years'; return value; };
  const adultMinimumAge = age('adultMinimumAge'); const medicalMinimumAge = age('medicalMinimumAge');
  const operatingStartMinute = timeToMinute(values.opensAt); const operatingEndMinute = timeToMinute(values.closesAt);
  if (operatingStartMinute == null) errors.opensAt = 'Enter a time'; if (operatingEndMinute == null) errors.closesAt = 'Enter a time';
  const purchaseLimits = buildLimits(limits, errors); const taxRules = buildTaxes(taxes, errors);
  if (!values.tenders.length) errors.tenders = 'Choose at least one payment type';
  const limitText = values.ownerApprovalLimit.trim();
  const approvalMicro = limitText ? parseQuantityToMicrounits(limitText) : 0;
  const ownerApprovalLimitCents = limitText === '0' ? 0 : approvalMicro == null ? null : Math.round(approvalMicro / 10_000);
  if (ownerApprovalLimitCents == null) errors.ownerApprovalLimit = 'Enter an amount, e.g. 50.00';
  const pack = {
    organizationName: values.organizationName.trim(), legalName: values.legalName.trim(), jurisdictionCode: values.jurisdictionCode.trim().toUpperCase(),
    premisesName: values.premisesName.trim(), premisesCode: values.premisesCode.trim(),
    addressSnapshot: { line1: values.line1.trim(), city: values.city.trim(), region: values.region.trim(), postalCode: values.postalCode.trim(), country: values.country.trim(), ...(values.phone.trim() ? { phone: values.phone.trim() } : {}) },
    timezone: values.timezone, currencyCode: values.currencyCode,
    licenseNumber: values.licenseNumber.trim(), licenseType: values.licenseType.trim(), regulatorName: values.regulatorName.trim(), authorityReference: values.authorityReference.trim(),
    licenseEffectiveAt: instants.licenseEffectiveAt, licenseExpiresAt: instants.licenseExpiresAt, authorizedActivities: [...REQUIRED_ACTIVITIES],
    credentialType: values.credentialType.trim(), credentialReference: values.credentialReference.trim(), credentialEffectiveAt: instants.credentialEffectiveAt, credentialExpiresAt: instants.credentialExpiresAt,
    staffAllowedActivities: [...REQUIRED_ACTIVITIES], staffEvidenceHash: values.staffEvidenceHash.trim(), ownerApprovalLimitCents: ownerApprovalLimitCents ?? 0,
    ruleVersion: values.ruleVersion.trim(), ruleAuthorityCitations: lines(values.citations), ruleEffectiveAt: instants.ruleEffectiveAt, ruleExpiresAt: instants.ruleExpiresAt,
    adultMinimumAge, medicalMinimumAge, medicalEnabled: values.medicalEnabled, operatingStartMinute: operatingStartMinute ?? 0, operatingEndMinute: operatingEndMinute ?? 0,
    purchaseLimits, taxRules, discountRules: [], allowedTenderTypes: values.tenders, labelRequirements: lines(values.labelRequirements),
    returnRules: { policy: values.returnPolicy.trim() }, outagePolicy: { policy: values.outagePolicy.trim() }, privacyRules: { policy: values.privacyPolicy.trim() }, retentionRules: { policy: values.retentionPolicy.trim() },
    pickupEnabled: values.pickupEnabled, traceabilityProviderCode: values.traceabilityProviderCode.trim(), traceabilityAuthorityReference: values.traceabilityAuthorityReference.trim(),
    tenderConfigurations: values.tenders.map(type => ({ code: type.toUpperCase(), type, displayName: TENDER_TYPES.find(option => option.value === type)?.label || type, authorityReference: values.tenderReference.trim(), effectiveAt: instants.ruleEffectiveAt, expiresAt: instants.ruleExpiresAt })),
    idempotencyKey,
  };
  return { pack, errors };
}

function stepOf(name: string): Step {
  const field = name.startsWith('limit-') ? 'limits' : name.startsWith('tax-') ? 'taxes' : name;
  return STEPS.find(step => (STEP_FIELDS[step] as string[]).includes(field)) ?? 'Business';
}

function Field({ name, title, values, set, errors, type = 'text', ...rest }: { name: keyof Values; title: string; values: Values; set: (name: keyof Values, value: string) => void; errors: RuleErrors } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'name' | 'value' | 'onChange'>) {
  return <label className={labelClass}>{title}
    <input id={`setup-${name}`} type={type} value={String(values[name])} onChange={event => set(name, event.target.value)} aria-invalid={Boolean(errors[name]) || undefined} aria-describedby={errors[name] ? `setup-${name}-error` : undefined} className={inputClass} {...rest} />
    {errors[name] && <span id={`setup-${name}-error`} className="mt-1 block font-normal text-destructive">{errors[name]}</span>}
  </label>;
}

function Area({ name, title, values, set, errors, placeholder }: { name: keyof Values; title: string; values: Values; set: (name: keyof Values, value: string) => void; errors: RuleErrors; placeholder?: string }) {
  return <label className={labelClass}>{title}
    <textarea id={`setup-${name}`} value={String(values[name])} onChange={event => set(name, event.target.value)} rows={2} placeholder={placeholder} aria-invalid={Boolean(errors[name]) || undefined} className={textareaClass} />
    {errors[name] && <span className="mt-1 block font-normal text-destructive">{errors[name]}</span>}
  </label>;
}

function SetupForm({ onDirtyChange, onDone }: { onDirtyChange: (dirty: boolean) => void; onDone: () => void }) {
  const [state, action, pending] = useActionState(installCannabisAuthorityPack, INITIAL_ONBOARDING_STATE);
  const [checked, setChecked] = useState<OnboardingState | null>(null);
  const [checking, startCheck] = useTransition();
  const [values, setValues] = useState<Values>(initialValues);
  const [limits, setLimits] = useState<LimitRow[]>(() => [emptyLimit()]);
  const [taxes, setTaxes] = useState<TaxRow[]>(() => [emptyTax()]);
  const [step, setStep] = useState<Step>('Business');
  const [errors, setErrors] = useState<RuleErrors>({});
  const [advanced, setAdvanced] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => `onboarding:${crypto.randomUUID()}`);
  const shown = checked ?? state;
  const failed = shown.status === 'invalid' || shown.status === 'not_completed' || shown.status === 'unknown';
  const built = useMemo(() => buildPack(values, limits, taxes, idempotencyKey), [values, limits, taxes, idempotencyKey]);
  const set = (name: keyof Values, value: string | boolean | string[]) => { setValues(current => ({ ...current, [name]: value })); onDirtyChange(true); };
  const stepErrors = (target: Step) => Object.keys(built.errors).filter(name => stepOf(name) === target).length;

  useEffect(() => { if (shown.status === 'success') { const timer = window.setTimeout(onDone, 1200); return () => window.clearTimeout(timer); } }, [shown.status, onDone]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    if (advanced !== null) { setChecked(null); return; }
    const found = built.errors;
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      event.preventDefault();
      setStep(stepOf(first));
      window.setTimeout(() => document.getElementById(`setup-${first}`)?.focus(), 0);
      return;
    }
    setChecked(null);
  }

  const index = STEPS.indexOf(step);
  const field = (name: keyof Values, title: string, extra: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'name' | 'value' | 'onChange'> = {}) => <Field name={name} title={title} values={values} set={set} errors={errors} {...extra} />;
  const area = (name: keyof Values, title: string, placeholder?: string) => <Area name={name} title={title} values={values} set={set} errors={errors} placeholder={placeholder} />;
  const done = shown.status === 'success';

  return <form action={action} onSubmit={submit} className="grid gap-5 md:grid-cols-[12rem_minmax(0,1fr)]">
    <input type="hidden" name="authorityPack" value={advanced ?? JSON.stringify(built.pack)} />
    <nav aria-label="Setup steps" className="self-start">
      <ol className="space-y-1 rounded-xl bg-muted/50 p-1.5 shadow-[inset_0_1px_2px_rgb(0_0_0/0.06)] max-md:grid max-md:grid-cols-2 max-md:gap-1 max-md:space-y-0">
        {STEPS.map((name, at) => {
          const count = Object.keys(errors).length ? stepErrors(name) : 0;
          return <li key={name}><button type="button" disabled={advanced !== null} onClick={() => setStep(name)} aria-current={step === name ? 'step' : undefined}
            className="flex w-full items-baseline gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-background/70 disabled:opacity-50 aria-[current=step]:bg-background aria-[current=step]:shadow-[0_1px_2px_rgb(0_0_0/0.12)] dark:aria-[current=step]:bg-zinc-800">
            <span className="w-4 shrink-0 font-mono text-[11px] text-muted-foreground">{String(at + 1).padStart(2, '0')}</span>
            <span className="min-w-0 flex-1 leading-tight">{name}</span>
            {count > 0 && <span className="inline-flex items-baseline gap-1 font-mono text-[11px] text-destructive"><Dot tone="danger" />{count}</span>}
          </button></li>;
        })}
      </ol>
      <Track className="mt-3"><button type="button" data-active={advanced !== null} onClick={() => setAdvanced(advanced === null ? JSON.stringify(built.pack, null, 2) : null)} className="inline-flex min-h-8 items-center rounded-full px-3 text-[13px] font-medium text-muted-foreground data-[active=true]:bg-background data-[active=true]:text-foreground data-[active=true]:shadow-[0_1px_2px_rgb(0_0_0/0.12)] dark:data-[active=true]:bg-zinc-800">{advanced === null ? 'Edit as JSON' : 'Back to form'}</button></Track>
    </nav>

    <fieldset disabled={pending || done} className="min-w-0 space-y-5">
      {advanced !== null ? <label className={labelClass} htmlFor="authority-pack">Setup details (JSON)
        <textarea id="authority-pack" value={advanced} onChange={event => { setAdvanced(event.target.value); onDirtyChange(true); }} rows={20} spellCheck={false} className={`${textareaClass} min-h-80 font-mono text-xs leading-5`} />
        <span className="mt-1 block font-normal text-muted-foreground">Keys: {REQUIRED_AUTHORITY_FIELDS.length} required, plus optional ownerApprovalLimitCents</span>
      </label> : <>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{String(index + 1).padStart(2, '0')} · {step}</h3>
        {step === 'Business' && <div className="grid gap-4 sm:grid-cols-2">
          {field('organizationName', 'Business name', { autoComplete: 'organization' })}
          {field('legalName', 'Legal name')}
          {field('jurisdictionCode', 'Jurisdiction code', { placeholder: 'US-CO' })}
        </div>}
        {step === 'Premises' && <div className="grid gap-4 sm:grid-cols-2">
          {field('premisesName', 'Premises name', { placeholder: 'Main Street' })}
          {field('premisesCode', 'Premises code', { placeholder: 'MAIN-01' })}
          <div className="sm:col-span-2">{field('line1', 'Street address', { autoComplete: 'address-line1' })}</div>
          {field('city', 'City', { autoComplete: 'address-level2' })}
          {field('region', 'State or province', { autoComplete: 'address-level1' })}
          {field('postalCode', 'Postal code', { autoComplete: 'postal-code' })}
          {field('country', 'Country', { autoComplete: 'country' })}
          {field('phone', 'Phone (optional)', { type: 'tel', autoComplete: 'tel' })}
          <label className={labelClass}>Time zone<select value={values.timezone} onChange={event => set('timezone', event.target.value)} className={inputClass}>{TIME_ZONES.map(zone => <option key={zone} value={zone}>{zone}</option>)}</select></label>
          <label className={labelClass}>Currency<select value={values.currencyCode} onChange={event => set('currencyCode', event.target.value)} className={inputClass}><option value="USD">USD</option><option value="CAD">CAD</option></select></label>
        </div>}
        {step === 'License' && <div className="grid gap-4 sm:grid-cols-2">
          {field('licenseNumber', 'License number', { autoComplete: 'off' })}
          {field('licenseType', 'License type', { placeholder: 'Retail marijuana store' })}
          {field('regulatorName', 'Regulator', { placeholder: 'Marijuana Enforcement Division' })}
          {field('authorityReference', 'License reference')}
          {field('licenseEffectiveAt', 'Valid from', { type: 'date' })}
          {field('licenseExpiresAt', 'Valid until', { type: 'date' })}
          <p className="text-xs text-muted-foreground sm:col-span-2">Activities: {REQUIRED_ACTIVITIES.map(activity => activity.replaceAll('_', ' ')).join(', ')}</p>
        </div>}
        {step === 'Your credential' && <div className="grid gap-4 sm:grid-cols-2">
          {field('credentialType', 'Credential type', { placeholder: 'Owner badge' })}
          {field('credentialReference', 'Credential number', { autoComplete: 'off' })}
          {field('credentialEffectiveAt', 'Valid from', { type: 'date' })}
          {field('credentialExpiresAt', 'Valid until', { type: 'date' })}
          {field('staffEvidenceHash', 'Evidence reference (16+ characters)', { autoComplete: 'off' })}
          {field('ownerApprovalLimit', 'Your cash variance approval limit', { inputMode: 'decimal', placeholder: '50.00' })}
        </div>}
        {step === 'Sales rules' && <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {field('ruleVersion', 'Rule version', { placeholder: '2026.1' })}
            {field('ruleEffectiveAt', 'In effect from', { type: 'date' })}
            {field('ruleExpiresAt', 'Review by', { type: 'date' })}
            {field('adultMinimumAge', 'Adult-use minimum age', { inputMode: 'numeric' })}
            {field('opensAt', 'Opens', { type: 'time' })}
            {field('closesAt', 'Closes', { type: 'time' })}
            <label className="flex min-h-10 items-center gap-2.5 self-end rounded-lg border bg-background px-3 text-sm"><input type="checkbox" checked={values.medicalEnabled} onChange={event => set('medicalEnabled', event.target.checked)} className="size-4 accent-green-700" />Medical sales</label>
            {values.medicalEnabled && field('medicalMinimumAge', 'Medical minimum age', { inputMode: 'numeric' })}
            <label className="flex min-h-10 items-center gap-2.5 self-end rounded-lg border bg-background px-3 text-sm"><input type="checkbox" checked={values.pickupEnabled} onChange={event => set('pickupEnabled', event.target.checked)} className="size-4 accent-green-700" />Order-ahead pickup</label>
          </div>
          <section className="space-y-2"><h4 className="text-xs font-medium">Purchase limits</h4><LimitsEditor rows={limits} onChange={rows => { setLimits(rows); onDirtyChange(true); }} errors={errors} /></section>
          <section className="space-y-2"><h4 className="text-xs font-medium">Tax rules</h4><TaxEditor rows={taxes} onChange={rows => { setTaxes(rows); onDirtyChange(true); }} errors={errors} /></section>
          <div className="grid gap-4 sm:grid-cols-2">
            {area('citations', 'Rule citations (one per line)', '1 CCR 212-3')}
            {area('labelRequirements', 'Label requirements (one per line)', 'universal_symbol')}
            {area('returnPolicy', 'Returns')}
            {area('outagePolicy', 'System outage')}
            {area('privacyPolicy', 'Customer privacy')}
            {area('retentionPolicy', 'Record retention')}
          </div>
        </div>}
        {step === 'Payments and reporting' && <div className="space-y-4">
          <fieldset className="space-y-2"><legend className="text-xs font-medium">Payment types</legend>
            <div className="flex flex-wrap gap-2">{TENDER_TYPES.map(option => <label key={option.value} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 text-sm has-[:checked]:border-foreground/30 has-[:checked]:bg-muted/60"><input type="checkbox" checked={values.tenders.includes(option.value)} onChange={event => set('tenders', event.target.checked ? [...values.tenders, option.value] : values.tenders.filter(type => type !== option.value))} className="size-4 accent-green-700" />{option.label}</label>)}</div>
            {errors.tenders && <p className="text-xs text-destructive">{errors.tenders}</p>}
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            {field('tenderReference', 'Payment authority reference')}
            {field('traceabilityProviderCode', 'Traceability system', { placeholder: 'metrc' })}
            {field('traceabilityAuthorityReference', 'Traceability account reference')}
          </div>
        </div>}
      </>}

      <div className="flex flex-wrap items-center gap-3 border-t pt-4">
        <ActionTrack>
          {advanced === null && index > 0 && <PillButton onClick={() => setStep(STEPS[index - 1])}>Back</PillButton>}
          {advanced === null && index < STEPS.length - 1 && <PillButton onClick={() => setStep(STEPS[index + 1])}>Next</PillButton>}
          {(shown.status === 'unknown' || shown.status === 'not_completed') && <PillButton disabled={pending || checking} onClick={() => startCheck(async () => setChecked(await checkCannabisOnboardingStatus()))}>{checking ? 'Checking…' : 'Check setup status'}</PillButton>}
          <PillButton type="submit" tone="ink" disabled={pending || checking || done}>{pending ? 'Setting up…' : done ? 'Set up' : 'Complete setup'}</PillButton>
        </ActionTrack>
        {Object.keys(errors).length > 0 && advanced === null && <span role="alert" className="inline-flex items-baseline gap-1.5 text-xs text-destructive"><Dot tone="danger" />{Object.keys(errors).length} to fix</span>}
      </div>
      {shown.status !== 'idle' && <p id="onboarding-result" data-testid="onboarding-result" role={failed ? 'alert' : 'status'} aria-live="polite" className={`flex items-baseline gap-2 text-sm ${failed ? 'text-destructive' : ''}`}><Dot tone={failed ? 'danger' : 'ok'} />{shown.message}</p>}
    </fieldset>
  </form>;
}

export function OnboardingDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [dirty, setDirty] = useState(false);
  const [session, setSession] = useState(0);
  useUnsavedChangesGuard(open && dirty);
  const close = () => { setDirty(false); setSession(value => value + 1); onOpenChange(false); };
  return <Dialog open={open} onOpenChange={next => {
    if (!next && !confirmDiscard(dirty)) return;
    if (!next) { close(); return; }
    onOpenChange(next);
  }}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>Set up your dispensary</DialogTitle><DialogDescription>License, premises, your credential and sales rules</DialogDescription></DialogHeader>
    {open && <SetupForm key={session} onDirtyChange={setDirty} onDone={() => { close(); router.refresh(); }} />}
  </DialogContent></Dialog>;
}

// The family DashboardLayout renders the vertical dialog as a default export with isOpen/onClose.
export default function DashboardOnboardingDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return <OnboardingDialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }} />;
}
