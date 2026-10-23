'use server';

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { getAuthenticatedUser } from '@/features/dashboard/actions/auth';
import type { CannabisWorkspaceResult } from '../lib/boundary';
import { parseWorkspace, type WorkspaceData, type WorkspaceSection } from '../lib/contract';

export type WorkspaceOptions = { cursor?: string; search?: string; filter?: string; productSearch?: string };

function boundedOptions(options: WorkspaceOptions = {}) {
  const out: Record<string, string> = {};
  for (const key of ['cursor', 'search', 'filter', 'productSearch'] as const) {
    const value = options[key];
    if (typeof value === 'string' && value.trim() && value.trim().length <= 100) out[key] = value.trim();
  }
  return out;
}

/** Scope and authority are decided by the domain resolver; this action only types its answer. */
export async function getCannabisWorkspace<S extends WorkspaceSection>(section: S, options?: WorkspaceOptions): Promise<CannabisWorkspaceResult<WorkspaceData<S>>> {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth.success || !auth.data?.authenticatedItem) return { state: 'signed_out' };
    const response = await keystoneClient<{ cannabisOperationsWorkspace: Record<string, unknown> }>(
      'query CannabisOperationsWorkspace($section: String!, $options: JSON) { cannabisOperationsWorkspace(section: $section, options: $options) }',
      { section, options: boundedOptions(options) },
    );
    if (!response.success) return { state: 'unavailable' };
    const payload = response.data.cannabisOperationsWorkspace;
    if (payload?.state === 'forbidden') {
      // Before onboarding the owner has every permission but no premises yet: that is setup, not missing access.
      const user = auth.data.authenticatedItem as { onboardingStatus?: string | null; role?: { canManageOnboarding?: boolean } | null };
      return user.role?.canManageOnboarding === true && user.onboardingStatus !== 'completed' ? { state: 'setup_required' } : { state: 'forbidden' };
    }
    if (payload?.state === 'operating_closed') return { state: 'operating_closed', reason: typeof payload.reason === 'string' ? payload.reason : 'Operating authority is not current' };
    const data = payload?.state === 'ok' ? parseWorkspace(section, payload) : null;
    return data ? { state: 'ok', data } : { state: 'unavailable' };
  } catch {
    return { state: 'unavailable' };
  }
}
