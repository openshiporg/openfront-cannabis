'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { runCommandRequest } from '@/features/platform/lib/commandClient';

const SESSION_COOKIE = 'keystonejs-session';

export type AccountOrder = {
  reference: string; status: string; totalCents: number; placedAt: string; pickupStart: string | null; pickupEnd: string | null;
  paymentMethod: string | null; paymentStatus: string | null;
  lines: Array<{ productId: string | null; title: string; units: number; unitPriceCents: number }>;
};
export type CustomerAccount = { name: string; email: string; phone: string; dateOfBirth: string; customerReference: string; timezone: string; currencyCode: string; orders: AccountOrder[] };
export type AccountFormState = { error?: string; saved?: string; values?: Record<string, string> };

/** The signed-in shopper, or null for a guest (and for a staff session, which has no shopper account). */
export async function getCustomerAccount(): Promise<CustomerAccount | null> {
  if (!(await cookies()).get(SESSION_COOKIE)?.value) return null;
  const response = await keystoneClient<{ cannabisCustomerAccount: CustomerAccount | null }>('query CustomerAccount { cannabisCustomerAccount }', {}, undefined,
    // @ts-expect-error The restored E-commerce keystoneClient has no privacy option and logs failures; kept until the family upstreams it.
    { logErrors: false });
  return response.success ? response.data?.cannabisCustomerAccount ?? null : null;
}

/** Only this site's own account, bag and order pages are valid places to land after signing in. */
function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === 'string' ? value : '';
  return /^\/(account|bag|order\/PU-[0-9A-F]{12})$/.test(next) ? next : '/account';
}

async function startSession(email: string, password: string) {
  const response = await keystoneClient<{ authenticate: { sessionToken?: string; message?: string } }>(`
    mutation($email: String!, $password: String!) {
      authenticate: authenticateUserWithPassword(email: $email, password: $password) {
        ... on UserAuthenticationWithPasswordSuccess { sessionToken }
        ... on UserAuthenticationWithPasswordFailure { message }
      }
    }`, { email, password });
  const token = response.success ? response.data?.authenticate?.sessionToken : undefined;
  if (!token) return false;
  (await cookies()).set(SESSION_COOKIE, token, { secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', httpOnly: true, maxAge: 60 * 60 * 12 });
  return true;
}

export async function signInCustomer(_state: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  if (!(await startSession(email, password))) return { error: 'That email and password don’t match. Check them and try again.', values: { email } };
  revalidatePath('/', 'layout');
  // A staff login has no shopper account: send it to the staff side instead of an empty account page.
  redirect((await getCustomerAccount()) ? safeNext(formData.get('next')) : '/dashboard');
}

export async function signUpCustomer(_state: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const field = (name: string) => String(formData.get(name) || '').trim();
  const values = { name: field('name'), email: field('email').toLowerCase(), phone: field('phone'), dateOfBirth: field('dateOfBirth') };
  const password = String(formData.get('password') || '');
  const born = values.dateOfBirth.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const response = await runCommandRequest('mutation($input: JSON!) { registerCannabisCustomer(input: $input) }',
    { input: { ...values, dateOfBirth: born ? `${born[3]}-${born[1]}-${born[2]}` : values.dateOfBirth, password } });
  if (!response.success) return { error: response.message ?? 'We couldn’t create your account. Please try again.', values };
  if (!(await startSession(values.email, password))) redirect('/account/signin');
  revalidatePath('/', 'layout');
  redirect(safeNext(formData.get('next')));
}

export async function signOutCustomer() {
  await keystoneClient('mutation { endSession }');
  (await cookies()).set(SESSION_COOKIE, '', { maxAge: -1, path: '/' });
  revalidatePath('/', 'layout');
  redirect('/');
}

export async function saveCustomerProfile(_state: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const values = { name: String(formData.get('name') || '').trim(), phone: String(formData.get('phone') || '').trim() };
  const response = await runCommandRequest('mutation($input: JSON!) { updateCannabisCustomerProfile(input: $input) }', { input: values });
  if (!response.success) return { error: response.message ?? 'We couldn’t save your details. Please try again.', values };
  revalidatePath('/account');
  return { saved: 'Saved', values };
}

export async function changeCustomerPassword(_state: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const response = await runCommandRequest('mutation($current: String!, $next: String!) { changeCannabisCustomerPassword(currentPassword: $current, newPassword: $next) }',
    { current: String(formData.get('currentPassword') || ''), next: String(formData.get('newPassword') || '') });
  if (!response.success) return { error: response.message ?? 'We couldn’t change your password. Please try again.' };
  return { saved: 'Password changed' };
}
