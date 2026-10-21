'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { normalizeLogoSettings } from '@/features/keystone/domain/storefrontSettings';
import type { FieldErrors } from '@/features/platform/lib/formErrors';

const SAVE_SCOPE = 'configureCannabisStorefrontSettings';

export type StoreSettingsValues = {
  businessName: string;
  tagline: string;
  description: string;
  brandHue: number;
  logoIcon: string;
  logoColor: string;
};

export type StoreSettingsSetup = {
  canSave: boolean;
  revision: string | null;
  publicationStatus: 'draft' | 'published' | null;
  storefrontMode: 'demo' | 'configured' | null;
  values: StoreSettingsValues | null;
};

export type StoreSettingsSetupResult =
  | { state: 'ok'; data: StoreSettingsSetup }
  | { state: 'forbidden' }
  | { state: 'unavailable' };

export type SaveStoreSettingsInput = { values: StoreSettingsValues; expectedRevision: string | null; idempotencyKey: string };

export type SaveStoreSettingsResult =
  | { status: 'saved'; revision: string | null; recovered?: boolean }
  | { status: 'invalid'; fieldErrors: FieldErrors }
  | { status: 'conflict' }
  | { status: 'rejected' }
  | { status: 'unknown' };

type WorkspaceResponse = {
  state: 'ok' | 'forbidden';
  canSave?: boolean;
  revision?: string | null;
  settings?: (StoreSettingsValues & { publicationStatus: 'draft' | 'published'; storefrontMode: 'demo' | 'configured'; tagline: string | null; description: string | null }) | null;
};

async function readWorkspace(): Promise<StoreSettingsSetupResult> {
  try {
    const response = await keystoneClient<{ cannabisStorefrontSettingsWorkspace: WorkspaceResponse }>(
      'query CannabisStorefrontSettingsWorkspace { cannabisStorefrontSettingsWorkspace }',
    );
    if (!response.success) return { state: 'unavailable' };
    const workspace = response.data.cannabisStorefrontSettingsWorkspace;
    if (!workspace || typeof workspace !== 'object') return { state: 'unavailable' };
    if (workspace.state === 'forbidden') return { state: 'forbidden' };
    if (workspace.state !== 'ok' || typeof workspace.canSave !== 'boolean') return { state: 'unavailable' };
    const row = workspace.settings;
    return { state: 'ok', data: {
      canSave: workspace.canSave,
      revision: typeof workspace.revision === 'string' ? workspace.revision : null,
      publicationStatus: row?.publicationStatus ?? null,
      storefrontMode: row?.storefrontMode ?? null,
      values: row ? {
        businessName: String(row.businessName || ''), tagline: String(row.tagline || ''), description: String(row.description || ''),
        brandHue: Number.isInteger(row.brandHue) ? row.brandHue : 215, logoIcon: String(row.logoIcon || ''), logoColor: String(row.logoColor || '0'),
      } : null,
    } };
  } catch {
    return { state: 'unavailable' };
  }
}

export async function getStoreSettingsSetup(): Promise<StoreSettingsSetupResult> {
  return readWorkspace();
}

function validate(values: StoreSettingsValues): FieldErrors {
  const errors: FieldErrors = {};
  const name = values.businessName.trim();
  if (!name) errors.businessName = 'Enter a business name.';
  else if (name.length > 120) errors.businessName = 'Business name must be 120 characters or fewer.';
  if (values.tagline.trim().length > 180) errors.tagline = 'Tagline must be 180 characters or fewer.';
  if (values.description.trim().length > 240) errors.description = 'Description must be 240 characters or fewer.';
  if (!Number.isInteger(values.brandHue) || values.brandHue < 0 || values.brandHue > 359) errors.brandHue = 'Accent hue must be a whole number from 0 to 359.';
  const color = Number(values.logoColor);
  if (!Number.isInteger(color) || color < 0 || color > 359) errors.logoColor = 'Logo colour must be a whole number from 0 to 359.';
  try { normalizeLogoSettings(values); } catch { errors.logoIcon = 'Logo must be a valid, safe SVG document.'; }
  return errors;
}

type ReceiptLookup = { state: 'succeeded' | 'processing' | 'failed' | 'not_found'; result?: { revision?: string } | null } | null;

async function lookupReceipt(idempotencyKey: string): Promise<ReceiptLookup> {
  try {
    const response = await keystoneClient<{ cannabisCommandReceipt: ReceiptLookup }>(
      'query StoreSettingsSaveReceipt($input: JSON!) { cannabisCommandReceipt(input: $input) }',
      { input: { scope: SAVE_SCOPE, idempotencyKey } },
    );
    return response.success ? response.data.cannabisCommandReceipt : null;
  } catch {
    return null;
  }
}

/** Resolve an unconfirmed save from the server's own record of the original command. */
async function resolveOutcome(input: SaveStoreSettingsInput): Promise<SaveStoreSettingsResult> {
  const receipt = await lookupReceipt(input.idempotencyKey);
  if (!receipt) return { status: 'unknown' };
  if (receipt.state === 'succeeded') {
    revalidatePath('/');
    return { status: 'saved', revision: typeof receipt.result?.revision === 'string' ? receipt.result.revision : null, recovered: true };
  }
  if (receipt.state === 'processing') return { status: 'unknown' };
  if (receipt.state === 'failed') return { status: 'rejected' };
  // No receipt: the command did not commit. Tell a stale form apart from other rejections.
  const current = await readWorkspace();
  if (current.state !== 'ok') return { status: 'rejected' };
  return current.data.revision !== input.expectedRevision ? { status: 'conflict' } : { status: 'rejected' };
}

export async function saveStoreSettings(input: SaveStoreSettingsInput): Promise<SaveStoreSettingsResult> {
  const values = input.values;
  if (typeof input.idempotencyKey !== 'string' || input.idempotencyKey.length < 8 || input.idempotencyKey.length > 200) return { status: 'rejected' };
  const fieldErrors = validate(values);
  if (Object.keys(fieldErrors).length) return { status: 'invalid', fieldErrors };
  const logo = normalizeLogoSettings(values);
  const body = {
    businessName: values.businessName.trim(), tagline: values.tagline.trim(), description: values.description.trim(), brandHue: values.brandHue,
    ...logo, expectedRevision: input.expectedRevision, idempotencyKey: input.idempotencyKey,
  };
  try {
    const response = await keystoneClient<{ configureCannabisStorefrontSettings: { revision?: string } }>(
      'mutation ConfigureCannabisStorefrontSettings($input: JSON!) { configureCannabisStorefrontSettings(input: $input) }',
      { input: body },
    );
    if (!response.success) return resolveOutcome(input);
    revalidatePath('/');
    revalidatePath('/dashboard/platform/store-settings');
    const revision = response.data.configureCannabisStorefrontSettings?.revision;
    return { status: 'saved', revision: typeof revision === 'string' ? revision : null };
  } catch {
    return resolveOutcome(input);
  }
}

export async function checkStoreSettingsSave(input: SaveStoreSettingsInput): Promise<SaveStoreSettingsResult> {
  return resolveOutcome(input);
}
