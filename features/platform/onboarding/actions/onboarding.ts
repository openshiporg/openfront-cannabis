'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { runCommandRequest } from '@/features/platform/lib/commandClient';
import { getAuthenticatedUser } from '@/features/dashboard/actions/auth';
import { notCompletedState, parseAuthorityPack, unknownOutcomeState, type OnboardingState } from '../lib/state';
import { parseQuantityToMicrounits } from '@/features/lib/quantity';
import seed from '../lib/seed.json';


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

/*
 * Sample dispensary stocking (the "Sample dispensary" setup). Runs after the authority pack
 * installs, through the same controlled commands staff use from the dashboard, so every
 * permission, credential, license, idempotency and audit check applies. The steps come from
 * lib/seed.json on the server; the client only says which step to run. Each step first reads
 * what already exists, so a retry continues where an earlier attempt stopped.
 */
const SAMPLE_KEY = `sample-store:v${seed.version}`;
type StepResult = { success: true } | { success: false; message: string };

async function sampleCommand(mutation: 'configureCannabisStorefrontSettings' | 'configureRegister' | 'configureCannabisProduct' | 'receiveCannabisPackage' | 'recordPackageLabResult' | 'releaseCannabisPackage', input: Record<string, unknown>) {
  const response = await runCommandRequest<Record<string, { id?: string; status?: string; testStatus?: string } | null>>(`mutation SampleStoreCommand($input: JSON!) { ${mutation}(input: $input) }`, { input });
  if (!response.success) throw new Error(response.message || 'The server did not accept this step.');
  const result = response.data[mutation];
  if (!result?.id) throw new Error('The server did not confirm this step.');
  return result;
}

const micro = (value: number, label: string) => {
  const parsed = parseQuantityToMicrounits(String(value));
  if (parsed == null) throw new Error(`Sample ${label} is invalid`);
  return parsed;
};

async function stockStorefront() {
  const workspace = await keystoneClient<{ cannabisStorefrontSettingsWorkspace: { state: string; revision: string | null; settings: { businessName?: string; tagline?: string } | null } }>('query SampleStoreSettings { cannabisStorefrontSettingsWorkspace }');
  if (!workspace.success || workspace.data.cannabisStorefrontSettingsWorkspace.state !== 'ok') throw new Error('Store settings are not available to you.');
  const { revision, settings } = workspace.data.cannabisStorefrontSettingsWorkspace;
  if (settings?.businessName === seed.storefront.businessName && settings?.tagline === seed.storefront.tagline) return;
  await sampleCommand('configureCannabisStorefrontSettings', { idempotencyKey: `${SAMPLE_KEY}:storefront:${revision ?? 'new'}`, expectedRevision: revision, ...seed.storefront });
}

async function stockProduct(index: number) {
  const item = seed.products[index];
  const { receiving } = seed;
  const number = String(index + 1).padStart(2, '0');
  const existing = await keystoneClient<{ product: { id: string } | null }>('query SampleProduct($sku: String!) { product(where: { sku: $sku }) { id } }', { sku: item.sku });
  if (!existing.success) throw new Error('Products are not available to you.');
  const productId = existing.data.product?.id ?? (await sampleCommand('configureCannabisProduct', {
    idempotencyKey: `${SAMPLE_KEY}:product:${item.sku}`, sku: item.sku, name: item.name, brand: item.brand, form: item.form, categoryCode: item.categoryCode,
    unitOfMeasure: item.unitOfMeasure, unitQuantityMicrounits: micro(item.unitQuantity, 'sale increment'), equivalencyMicrounits: micro(item.equivalency, 'equivalency'),
    priceCents: item.priceCents, taxCategoryCode: seed.authority.taxes[0].categoryCode, adultUseEligible: true, medicalEligible: false, publicDescription: item.publicDescription,
  })).id!;
  const packageUid = `1A40F030000418000000${number}00`;
  const found = await keystoneClient<{ inventoryPackage: { id: string; status: string; testStatus: string } | null }>('query SamplePackage($uid: String!) { inventoryPackage(where: { packageUid: $uid }) { id status testStatus } }', { uid: packageUid });
  if (!found.success) throw new Error('Inventory is not available to you.');
  let pkg = found.data.inventoryPackage;
  if (!pkg) {
    const expiresAt = new Date(Date.now() + receiving.shelfLifeDays * 86_400_000).toISOString().slice(0, 10);
    const received = await sampleCommand('receiveCannabisPackage', {
      idempotencyKey: `${SAMPLE_KEY}:receive:${item.sku}:${expiresAt}`, productId, packageUid, manifestNumber: receiving.manifestNumber, sourceLicenseNumber: receiving.sourceLicenseNumber,
      regulatorManifestId: null, sourcePackageUid: null, productionBatchNumber: `FW-B2610-${number}`, lotNumber: `FW-L2610-${number}`, quantityMicrounits: micro(item.receivedQuantity, 'received quantity'),
      expiresAt, manufacturedAt: null, labelVersion: receiving.labelVersion, reasonCode: receiving.reasonCode, coaReference: null, labName: null, labResultReference: null,
    });
    pkg = { id: received.id!, status: String(received.status), testStatus: String(received.testStatus ?? 'unknown') };
  }
  if (pkg.testStatus !== 'passed') {
    await sampleCommand('recordPackageLabResult', { idempotencyKey: `${SAMPLE_KEY}:lab:${item.sku}`, packageId: pkg.id, result: 'passed', labName: receiving.labName, labResultReference: `CRL-2610-${number}`, coaReference: `COA-CRL-2610-${number}` });
  }
  if (pkg.status !== 'saleable') await sampleCommand('releaseCannabisPackage', { idempotencyKey: `${SAMPLE_KEY}:release:${item.sku}`, packageId: pkg.id });
}

/** Run one stocking step: 0 store details, 1 register, 2+ one menu item each (see SAMPLE_STEPS). */
export async function stockCannabisSampleStore(step: number): Promise<StepResult> {
  if (!Number.isInteger(step) || step < 0 || step >= seed.products.length + 2) return { success: false, message: 'Unknown setup step.' };
  try {
    if (step === 0) await stockStorefront();
    else if (step === 1) {
      const registers = await keystoneClient<{ register: { id: string } | null }>('query SampleRegister($code: String!) { register(where: { code: $code }) { id } }', { code: seed.register.code });
      if (!registers.success) throw new Error('Registers are not available to you.');
      if (!registers.data.register) await sampleCommand('configureRegister', { idempotencyKey: `${SAMPLE_KEY}:register:${seed.register.code}`, ...seed.register });
    } else await stockProduct(step - 2);
    if (step === seed.products.length + 1) { revalidatePath('/dashboard', 'layout'); revalidatePath('/'); }
    return { success: true };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'This step did not complete.' };
  }
}
