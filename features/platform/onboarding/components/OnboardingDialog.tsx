'use client';

import { useActionState, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { confirmDiscard, useUnsavedChangesGuard } from '@/features/platform/lib/useUnsavedChangesGuard';
import { checkCannabisOnboardingStatus, installCannabisAuthorityPack } from '../actions/onboarding';
import { INITIAL_ONBOARDING_STATE, type OnboardingState } from '../lib/state';

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

function AuthorityPackForm({ text, onTextChange }: { text: string; onTextChange: (value: string) => void }) {
  const [state, action, pending] = useActionState(installCannabisAuthorityPack, INITIAL_ONBOARDING_STATE);
  const [checked, setChecked] = useState<OnboardingState | null>(null);
  const [checking, startCheck] = useTransition();
  const shown = checked ?? state;
  const failed = shown.status === 'invalid' || shown.status === 'not_completed' || shown.status === 'unknown';
  return <form action={formData => { setChecked(null); action(formData); }} className="space-y-4">
    <div className="space-y-1.5">
      <Label htmlFor="authority-pack">Setup details (JSON)</Label>
      <p id="authority-pack-help" className="text-xs text-muted-foreground">Your license, premises, staff credential, sales rules, tax, purchase limits, tenders and traceability provider. Use the time zone and currency of the premises. Every key shown is required.</p>
      <Textarea id="authority-pack" name="authorityPack" required rows={18} spellCheck={false} value={text} onChange={event => onTextChange(event.target.value)} placeholder={EXAMPLE}
        aria-describedby={failed ? 'authority-pack-help onboarding-result' : 'authority-pack-help'} aria-invalid={shown.status === 'invalid' || undefined} className="font-mono text-xs" />
    </div>
    <div className="flex flex-wrap gap-2">
      <Button type="submit" disabled={pending || checking}>{pending ? 'Setting up…' : 'Complete setup'}</Button>
      {(shown.status === 'unknown' || shown.status === 'not_completed') && <Button type="button" variant="outline" disabled={pending || checking} onClick={() => startCheck(async () => setChecked(await checkCannabisOnboardingStatus()))}>{checking ? 'Checking…' : 'Check setup status'}</Button>}
    </div>
    {shown.status !== 'idle' && <p id="onboarding-result" data-testid="onboarding-result" role={failed ? 'alert' : 'status'} aria-live="polite" className={failed ? 'text-sm text-destructive' : 'text-sm'}>{shown.message}</p>}
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
  }}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>Set up your dispensary</DialogTitle><DialogDescription>Enter your license, premises and operating rules. Inventory, sales and integrations start empty.</DialogDescription></DialogHeader>{open && <AuthorityPackForm text={text} onTextChange={setText} />}</DialogContent></Dialog>;
}

// The family DashboardLayout renders the vertical dialog as a default export with isOpen/onClose.
export default function DashboardOnboardingDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return <OnboardingDialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }} />;
}
