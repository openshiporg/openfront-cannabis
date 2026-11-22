'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { changeCustomerPassword, saveCustomerProfile, signInCustomer, signUpCustomer, type AccountFormState } from '../lib/data/account';
import { BIRTH_DATE_PATTERN, formatBirthDateInput } from '../lib/birth-date';
import { useBag } from '../lib/bag';

const label = 'mb-1 block text-[14px] text-cn-ink-2';
const Problem = ({ state }: { state: AccountFormState }) => state.error ? <p role="alert" className="text-[16px] font-semibold text-cn-warn">{state.error}</p> : null;

export function SignInForm({ next }: { next?: string }) {
  const [state, action, busy] = useActionState(signInCustomer, {});
  return <form action={action} className="space-y-4">
    {next && <input type="hidden" name="next" value={next} />}
    <label className="block"><span className={label}>Email</span><input name="email" type="email" autoComplete="email" required maxLength={254} defaultValue={state.values?.email} className="cn-field" /></label>
    <label className="block"><span className={label}>Password</span><input name="password" type="password" autoComplete="current-password" required maxLength={200} className="cn-field" /></label>
    <Problem state={state} />
    <button type="submit" data-tone="ink" className="cn-btn min-h-12 w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    <p className="text-[15px] text-cn-ink-2">New here? <Link href={next ? `/account/signup?next=${encodeURIComponent(next)}` : '/account/signup'} className="cn-link">Create an account</Link></p>
    <p className="text-[15px] text-cn-ink-2"><Link href="/dashboard/reset" className="cn-link">Forgot your password?</Link></p>
  </form>;
}

export function SignUpForm({ next, minimumAge }: { next?: string; minimumAge: number }) {
  const [state, action, busy] = useActionState(signUpCustomer, {});
  const values = state.values ?? {};
  return <form action={action} className="space-y-4">
    {next && <input type="hidden" name="next" value={next} />}
    <label className="block"><span className={label}>Full name</span><input name="name" autoComplete="name" required minLength={2} maxLength={120} defaultValue={values.name} className="cn-field" /></label>
    <label className="block"><span className={label}>Email</span><input name="email" type="email" autoComplete="email" required maxLength={254} defaultValue={values.email} className="cn-field" /></label>
    <label className="block"><span className={label}>Phone</span><input name="phone" type="tel" autoComplete="tel" required maxLength={30} defaultValue={values.phone} className="cn-field" /></label>
    <label className="block"><span className={label}>Date of birth ({minimumAge}+ only)</span><input name="dateOfBirth" type="text" inputMode="numeric" placeholder="MM/DD/YYYY" maxLength={10} pattern={BIRTH_DATE_PATTERN} title="Month/day/year, for example 04/09/1986" autoComplete="bday" required defaultValue={values.dateOfBirth} onChange={event => formatBirthDateInput(event.currentTarget)} className="cn-field" /></label>
    <label className="block"><span className={label}>Password (10 characters or more)</span><input name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={200} className="cn-field" /></label>
    <Problem state={state} />
    <button type="submit" data-tone="ink" className="cn-btn min-h-12 w-full" disabled={busy}>{busy ? 'Creating your account…' : 'Create account'}</button>
    <p className="text-[15px] text-cn-ink-2">Already have one? <Link href={next ? `/account/signin?next=${encodeURIComponent(next)}` : '/account/signin'} className="cn-link">Sign in</Link></p>
  </form>;
}

export function ProfileForm({ name, phone, email }: { name: string; phone: string; email: string }) {
  const [state, action, busy] = useActionState(saveCustomerProfile, {});
  return <form action={action} className="space-y-4">
    <label className="block"><span className={label}>Full name</span><input name="name" autoComplete="name" required minLength={2} maxLength={120} defaultValue={state.values?.name ?? name} className="cn-field" /></label>
    <label className="block"><span className={label}>Phone</span><input name="phone" type="tel" autoComplete="tel" required maxLength={30} defaultValue={state.values?.phone ?? phone} className="cn-field" /></label>
    <p className="text-[15px] text-cn-ink-2">Email <span className="text-cn-ink">{email}</span></p>
    <Problem state={state} />
    <div className="flex items-center gap-4"><button type="submit" className="cn-btn min-h-12" disabled={busy}>{busy ? 'Saving…' : 'Save details'}</button>{state.saved && <span role="status" className="text-[15px] text-cn-ok">{state.saved}</span>}</div>
  </form>;
}

export function PasswordForm() {
  const [state, action, busy] = useActionState(changeCustomerPassword, {});
  return <form action={action} className="space-y-4">
    <label className="block"><span className={label}>Current password</span><input name="currentPassword" type="password" autoComplete="current-password" required maxLength={200} className="cn-field" /></label>
    <label className="block"><span className={label}>New password (10 characters or more)</span><input name="newPassword" type="password" autoComplete="new-password" required minLength={10} maxLength={200} className="cn-field" /></label>
    <Problem state={state} />
    <div className="flex items-center gap-4"><button type="submit" className="cn-btn min-h-12" disabled={busy}>{busy ? 'Changing…' : 'Change password'}</button>{state.saved && <span role="status" className="text-[15px] text-cn-ok">{state.saved}</span>}</div>
  </form>;
}

/** Puts a past order's items back in the bag at today's menu price; items no longer sold are left out. */
export function OrderAgain({ lines }: { lines: Array<{ id: string; name: string; priceCents: number; units: number }> }) {
  const bag = useBag();
  if (!lines.length) return null;
  return <Link href="/bag" className="cn-btn" onClick={() => { for (const line of lines) bag.add({ id: line.id, name: line.name, priceCents: line.priceCents }, line.units); }}>Order again</Link>;
}
