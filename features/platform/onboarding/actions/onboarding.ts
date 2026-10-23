'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { runCommandRequest } from '@/features/platform/lib/commandClient';
import { getAuthenticatedUser } from '@/features/dashboard/actions/auth';
import { notCompletedState, parseAuthorityPack, unknownOutcomeState, type OnboardingState } from '../lib/state';

export type { OnboardingState } from '../lib/state';

async function readOnboardingStatus(): Promise<string | null> {
  try {
    const auth = await getAuthenticatedUser();
    const status = auth.success ? auth.data?.authenticatedItem?.onboardingStatus : null;
    return typeof status === 'string' ? status : null;
  } catch {
    return null;
  }
}

export async function installCannabisAuthorityPack(_state: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const parsed = parseAuthorityPack(String(formData.get('authorityPack') || ''));
  if (!parsed.success) return parsed.state;
  const response = await runCommandRequest<{ runCannabisOnboarding: { status: string } }>(
    'mutation InstallCannabisAuthorityPack($input: JSON!) { runCannabisOnboarding(input: $input) }', { input: parsed.input });
  if (!response.success || response.data.runCannabisOnboarding?.status !== 'completed') {
    // The server installs everything in one transaction; confirm what actually happened.
    const status = await readOnboardingStatus();
    if (status === 'completed') { revalidatePath('/dashboard', 'layout'); return { status: 'success', message: 'Setup complete.' }; }
    if (status === null) return unknownOutcomeState();
    return !response.success && response.message ? { status: 'not_completed', message: `Setup was not completed: ${response.message}` } : notCompletedState();
  }
  revalidatePath('/dashboard', 'layout');
  return { status: 'success', message: 'Setup complete.' };
}

export async function checkCannabisOnboardingStatus(): Promise<OnboardingState> {
  const status = await readOnboardingStatus();
  if (status === 'completed') { revalidatePath('/dashboard', 'layout'); return { status: 'success', message: 'Setup complete.' }; }
  return status === null ? unknownOutcomeState() : notCompletedState();
}

/** "Skip for now": persisted for the current user only; it grants nothing. */
export async function dismissOnboarding(): Promise<{ success: boolean; persisted: boolean; error?: string }> {
  try {
    const response = await keystoneClient<{ dismissCannabisOnboarding: { status: string } }>('mutation DismissCannabisOnboarding { dismissCannabisOnboarding }');
    if (!response.success) return { success: false, persisted: false, error: 'Could not save. The setup card will return next time you sign in.' };
    revalidatePath('/dashboard', 'layout');
    return { success: true, persisted: true };
  } catch {
    return { success: false, persisted: false, error: 'Could not save. The setup card will return next time you sign in.' };
  }
}
