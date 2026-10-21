'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { submitCustomerIntake } from '../lib/data/menu';

export function CustomerIntakeForm() {
  const [state, action, pending] = useActionState(submitCustomerIntake, {} as any);
  return <form action={action} className="grid gap-4 rounded-xl border bg-background p-5 sm:grid-cols-2"><div className="sm:col-span-2"><h2 className="text-lg font-semibold">Begin customer intake</h2><p className="text-sm text-muted-foreground">Staff verify your identity and eligibility before any purchase.</p></div><div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required/></div><div><Label htmlFor="capacity">Purchase capacity</Label><select id="capacity" name="capacity" required className="h-9 w-full rounded-md border bg-background px-3 text-sm"><option value="adult_use">Adult-use</option><option value="patient">Patient</option><option value="caregiver">Caregiver</option></select></div><div><Label htmlFor="dateOfBirth">Date of birth</Label><Input id="dateOfBirth" name="dateOfBirth" type="date" required/></div><div><Label htmlFor="identityExpiresAt">Identity expiry</Label><Input id="identityExpiresAt" name="identityExpiresAt" type="date" required/></div><div><Label htmlFor="identityMethod">Identity document type</Label><Input id="identityMethod" name="identityMethod" required placeholder="e.g. Driver licence"/></div><div><Label htmlFor="documentReference">Document reference</Label><Input id="documentReference" name="documentReference" required autoComplete="off"/></div><div className="sm:col-span-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="marketingConsent"/>Send me marketing updates (optional)</label></div><Button disabled={pending} className="sm:col-span-2">{pending ? 'Submitting…' : 'Submit for staff verification'}</Button>{state?.error && <p className="text-sm text-destructive sm:col-span-2">{state.error}</p>}{state?.success && <p className="text-sm text-foreground sm:col-span-2">{state.success} Reference: {state.reference}</p>}</form>;
}
