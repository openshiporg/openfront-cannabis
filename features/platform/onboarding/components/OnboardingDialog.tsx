'use client';

import { useActionState, useState, useTransition } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ActionTrack, Dot, PillButton, type DotTone } from '@/features/platform/components/cannabis-ui';
import { confirmDiscard, useUnsavedChangesGuard } from '@/features/platform/lib/useUnsavedChangesGuard';
import { checkCannabisOnboardingStatus, installCannabisAuthorityPack } from '../actions/onboarding';
import { INITIAL_ONBOARDING_STATE, REQUIRED_AUTHORITY_FIELDS, type OnboardingState } from '../lib/state';

const EXAMPLE = `{
  "organizationName": "", "legalName": "", "jurisdictionCode": "",
  "premisesName": "", "premisesCode": "", "addressSnapshot": {}, "timezone": "America/Denver", "currencyCode": "USD",
  "licenseNumber": "", "licenseType": "", "regulatorName": "", "authorityReference": "",
  "licenseEffectiveAt": "2026-01-01T00:00:00Z", "licenseExpiresAt": "2027-01-01T00:00:00Z", "authorizedActivities": [],
  "credentialType": "", "credentialReference": "", "credentialEffectiveAt": "", "credentialExpiresAt": "",
  "staffAllowedActivities": [], "staffEvidenceHash": "",
  "ruleVersion": "", "ruleAuthorityCitations": [], "ruleEffectiveAt": "", "ruleExpiresAt": "",
  "adultMinimumAge": 0, "medicalMinimumAge": 0, "medicalEnabled": false,
  "operatingStartMinute": 0, "operatingEndMinute": 0, "purchaseLimits": [], "taxRules": [], "discountRules": [],
  "allowedTenderTypes": [], "labelRequirements": [], "returnRules": {}, "outagePolicy": {}, "privacyRules": {}, "retentionRules": {},
  "pickupEnabled": false, "traceabilityProviderCode": "", "traceabilityAuthorityReference": "",
  "tenderConfigurations": [], "idempotencyKey": ""
}`;

type Field = (typeof REQUIRED_AUTHORITY_FIELDS)[number];
const SECTIONS: Array<{ title: string; fields: Field[] }> = [
  { title: 'Organization', fields: ['organizationName', 'legalName', 'jurisdictionCode'] },
  { title: 'Premises', fields: ['premisesName', 'premisesCode', 'addressSnapshot', 'timezone', 'currencyCode'] },
  { title: 'License', fields: ['licenseNumber', 'licenseType', 'regulatorName', 'authorityReference', 'licenseEffectiveAt', 'licenseExpiresAt', 'authorizedActivities'] },
  { title: 'Your credential', fields: ['credentialType', 'credentialReference', 'credentialEffectiveAt', 'credentialExpiresAt', 'staffAllowedActivities', 'staffEvidenceHash'] },
  { title: 'Sales rules', fields: ['ruleVersion', 'ruleAuthorityCitations', 'ruleEffectiveAt', 'ruleExpiresAt', 'adultMinimumAge', 'medicalMinimumAge', 'medicalEnabled', 'operatingStartMinute', 'operatingEndMinute', 'purchaseLimits', 'taxRules', 'discountRules', 'labelRequirements', 'returnRules', 'outagePolicy', 'privacyRules', 'retentionRules', 'pickupEnabled'] },
  { title: 'Tenders and traceability', fields: ['allowedTenderTypes', 'tenderConfigurations', 'traceabilityProviderCode', 'traceabilityAuthorityReference', 'idempotencyKey'] },
];

const filled = (value: unknown) => value !== '' && value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0) && !(typeof value === 'object' && !Array.isArray(value) && Object.keys(value as object).length === 0);

/** Which sections the pasted details cover; a reading aid only, the server validates everything. */
function coverage(text: string): { parsed: Record<string, unknown> | null; sections: Array<{ title: string; done: number; total: number; tone: DotTone }> } {
  let parsed: Record<string, unknown> | null = null;
  try { const value = JSON.parse(text); if (value && typeof value === 'object' && !Array.isArray(value)) parsed = value; } catch { parsed = null; }
  return { parsed, sections: SECTIONS.map(section => {
    const done = parsed ? section.fields.filter(field => field in parsed! && (typeof parsed![field] === 'boolean' || typeof parsed![field] === 'number' || filled(parsed![field]))).length : 0;
    const present = parsed ? section.fields.filter(field => field in parsed!).length : 0;
    const tone: DotTone = !present ? 'muted' : done === section.fields.length ? 'ok' : 'warn';
    return { title: section.title, done, total: section.fields.length, tone };
  }) };
}

function AuthorityPackForm({ text, onTextChange }: { text: string; onTextChange: (value: string) => void }) {
  const [state, action, pending] = useActionState(installCannabisAuthorityPack, INITIAL_ONBOARDING_STATE);
  const [checked, setChecked] = useState<OnboardingState | null>(null);
  const [checking, startCheck] = useTransition();
  const shown = checked ?? state;
  const failed = shown.status === 'invalid' || shown.status === 'not_completed' || shown.status === 'unknown';
  const { parsed, sections } = coverage(text);
  const insertTemplate = () => onTextChange(EXAMPLE.replace('"idempotencyKey": ""', `"idempotencyKey": "onboarding:${crypto.randomUUID()}"`));
  return <form action={formData => { setChecked(null); action(formData); }} className="grid gap-5 md:grid-cols-[13rem_minmax(0,1fr)]">
    <ol aria-label="Setup sections" className="space-y-1 self-start rounded-xl bg-muted/50 p-1.5 shadow-[inset_0_1px_2px_rgb(0_0_0/0.06)] max-md:grid max-md:grid-cols-2 max-md:gap-1 max-md:space-y-0">
      {sections.map((section, index) => <li key={section.title} className="flex items-baseline gap-2 rounded-lg px-2.5 py-2 text-sm">
        <span className="w-4 shrink-0 font-mono text-[11px] text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
        <span className="min-w-0 flex-1 leading-tight">{section.title}</span>
        <span className="inline-flex shrink-0 items-baseline gap-1.5 font-mono text-[11px] tabular-nums text-muted-foreground"><Dot tone={section.tone} />{section.done}/{section.total}</span>
      </li>)}
    </ol>
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor="authority-pack" className="text-xs font-medium">Setup details (JSON)</label>
        <span id="authority-pack-help" className="inline-flex items-baseline gap-1.5 text-xs text-muted-foreground">{text.trim() === '' ? 'Every key shown is required' : parsed ? <><Dot tone="ok" />Valid JSON</> : <><Dot tone="danger" />Invalid JSON</>}</span>
      </div>
      <textarea id="authority-pack" name="authorityPack" required rows={18} spellCheck={false} value={text} onChange={event => onTextChange(event.target.value)} placeholder={EXAMPLE}
        aria-describedby={failed ? 'authority-pack-help onboarding-result' : 'authority-pack-help'} aria-invalid={shown.status === 'invalid' || undefined}
        className="block min-h-80 w-full rounded-xl border bg-background p-3 font-mono text-xs leading-5 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 aria-invalid:border-destructive" />
      <div className="flex flex-wrap items-center gap-3">
        <ActionTrack>
          {text.trim() === '' && <PillButton onClick={insertTemplate}>Insert template</PillButton>}
          {(shown.status === 'unknown' || shown.status === 'not_completed') && <PillButton disabled={pending || checking} onClick={() => startCheck(async () => setChecked(await checkCannabisOnboardingStatus()))}>{checking ? 'Checking…' : 'Check setup status'}</PillButton>}
          <PillButton type="submit" tone="ink" disabled={pending || checking}>{pending ? 'Setting up…' : 'Complete setup'}</PillButton>
        </ActionTrack>
      </div>
      {shown.status !== 'idle' && <p id="onboarding-result" data-testid="onboarding-result" role={failed ? 'alert' : 'status'} aria-live="polite" className={`flex items-baseline gap-2 text-sm ${failed ? 'text-destructive' : ''}`}><Dot tone={failed ? 'danger' : 'ok'} />{shown.message}</p>}
    </div>
  </form>;
}

export function OnboardingDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [text, setText] = useState('');
  const dirty = open && text.trim() !== '';
  useUnsavedChangesGuard(dirty);
  return <Dialog open={open} onOpenChange={next => {
    if (!next && !confirmDiscard(dirty)) return;
    if (!next) setText('');
    onOpenChange(next);
  }}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>Set up your dispensary</DialogTitle><DialogDescription>License, premises, staff credential and sales rules</DialogDescription></DialogHeader>{open && <AuthorityPackForm text={text} onTextChange={setText} />}</DialogContent></Dialog>;
}

// The family DashboardLayout renders the vertical dialog as a default export with isOpen/onClose.
export default function DashboardOnboardingDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return <OnboardingDialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }} />;
}
