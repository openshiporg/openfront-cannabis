'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import type { PreparationDetail } from '../types';
import { PREPARATION_SCOPE, preparationKey, REASON_CODE_PATTERN } from '../preparationIntent';

export async function getCartPreparation(cartId: string): Promise<{ data: PreparationDetail } | { error: string }> {
  if (typeof cartId !== 'string' || !cartId.trim() || cartId.length > 500) return { error: 'Select a cart.' };
  try {
    const result = await keystoneClient<{ cannabisCartPreparation: PreparationDetail }>(
      'query CartPreparation($cartId: ID!) { cannabisCartPreparation(cartId: $cartId) }', { cartId });
    if (!result.success || !result.data.cannabisCartPreparation) return { error: 'Cart details are unavailable.' };
    return { data: result.data.cannabisCartPreparation };
  } catch { return { error: 'Cart details are unavailable.' }; }
}

export async function prepareCart(formData: FormData): Promise<{ success: string } | { error: string; outcome?: 'unknown' }> {
  const cartId = String(formData.get('cartId') || '').trim();
  const nextStatus = String(formData.get('nextStatus') || '');
  const expectedVersion = Number(formData.get('expectedVersion'));
  const reasonCode = String(formData.get('reasonCode') || '').trim();
  if (!cartId || cartId.length > 100 || !['reserved', 'picking', 'staged'].includes(nextStatus) ||
      !Number.isSafeInteger(expectedVersion) || expectedVersion < 1 || expectedVersion >= 2_147_483_647) return { error: 'Select a current cart step.' };
  if (!REASON_CODE_PATTERN.test(reasonCode)) return { error: 'Reason code must be lowercase letters, digits and underscores, such as picking_started.' };
  const idempotencyKey = preparationKey(cartId, expectedVersion, nextStatus);
  if (formData.has('idempotencyKey') && formData.get('idempotencyKey') !== idempotencyKey) return { error: 'This saved command does not match its cart step.' };
  try {
    const input = { cartId, nextStatus, expectedVersion, reasonCode, idempotencyKey };
    const result = await keystoneClient<{ transitionCannabisCartPreparation: { replayed?: boolean } }>(
      'mutation PrepareCart($input: JSON!) { transitionCannabisCartPreparation(input: $input) }', { input });
    if (!result.success) return { error: 'The step could not be confirmed. Check the recorded outcome before retrying.', outcome: 'unknown' };
    revalidatePath('/dashboard/platform/pos');
    return { success: result.data.transitionCannabisCartPreparation.replayed ? 'This step was already recorded.' : 'Step recorded.' };
  } catch { return { error: 'The step could not be confirmed. Check the recorded outcome before retrying.', outcome: 'unknown' }; }
}

export type RecordedOutcome = { state: 'not_found' | 'processing' | 'succeeded' | 'failed' } | { state: 'unavailable' };

export async function getPreparationOutcome(idempotencyKey: string): Promise<RecordedOutcome> {
  if (typeof idempotencyKey !== 'string' || !/^preparation:[^:]{1,100}:\d{1,10}:(reserved|picking|staged)$/.test(idempotencyKey)) return { state: 'unavailable' };
  try {
    const result = await keystoneClient<{ cannabisCommandReceipt: { state?: string } }>(
      'query PreparationOutcome($input: JSON!) { cannabisCommandReceipt(input: $input) }', { input: { scope: PREPARATION_SCOPE, idempotencyKey } });
    const state = result.success ? result.data.cannabisCommandReceipt?.state : undefined;
    if (state === 'not_found' || state === 'processing' || state === 'succeeded' || state === 'failed') return { state };
    return { state: 'unavailable' };
  } catch { return { state: 'unavailable' }; }
}
