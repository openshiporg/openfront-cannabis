'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { parseQuantityToMicrounits } from '@/features/lib/quantity';
import type { FieldErrors, FormState } from '@/features/platform/lib/formErrors';

export type CommandState = FormState & { result?: Record<string, unknown> };

const REASON_CODE = /^[a-z][a-z0-9_]{2,99}$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const text = (formData: FormData, name: string) => String(formData.get(name) ?? '').trim();
const commandKey = (formData: FormData) => { const key = text(formData, 'idempotencyKey'); return key.length >= 8 && key.length <= 99 ? key : null; };

async function commandReceipt(scope: string, idempotencyKey: string) {
  const response = await keystoneClient<{ cannabisCommandReceipt: { state: string; result?: Record<string, unknown> | null } }>(
    'query CannabisCommandReceipt($input: JSON!) { cannabisCommandReceipt(input: $input) }', { input: { scope, idempotencyKey } },
  );
  return response.success ? response.data.cannabisCommandReceipt : null;
}

/**
 * Run one controlled command. The form keeps its idempotency key until a confirmed
 * success, so a retry after a lost response acknowledges the original instead of
 * applying it twice. After a failure the receipt is read back to tell "not recorded"
 * apart from "outcome unknown".
 */
async function runCommand(mutation: string, scope: string, input: Record<string, unknown>, success: string): Promise<CommandState> {
  const response = await keystoneClient<Record<string, Record<string, unknown>>>(`mutation ControlledCannabisCommand($input: JSON!) { ${mutation}(input: $input) }`, { input });
  if (response.success) {
    revalidatePath('/dashboard/platform', 'layout');
    const result = response.data[mutation];
    return { success: result?.replayed ? `${success} (already recorded)` : success, result };
  }
  const receipt = typeof input.idempotencyKey === 'string' ? await commandReceipt(scope, input.idempotencyKey) : null;
  if (receipt?.state === 'succeeded') {
    revalidatePath('/dashboard/platform', 'layout');
    return { success: `${success} (already recorded)`, result: receipt.result ?? undefined };
  }
  if (receipt?.state === 'not_found') return { error: 'Not recorded. Check the details and current authority, then try again.' };
  return { error: 'The outcome could not be confirmed. Try again: the same command will not be applied twice.', outcome: 'unknown' };
}

function invalid(fieldErrors: FieldErrors): CommandState {
  return { error: 'Correct the highlighted fields.', fieldErrors };
}

export async function receivePackageFromWorkbench(_state: CommandState, formData: FormData): Promise<CommandState> {
  const errors: FieldErrors = {};
  for (const [name, label] of [['productId', 'Select a product'], ['packageUid', 'Enter the package UID'], ['manifestNumber', 'Enter the manifest number'], ['sourceLicenseNumber', 'Enter the supplier license'], ['productionBatchNumber', 'Enter the production batch'], ['lotNumber', 'Enter the lot number'], ['labelVersion', 'Enter the label version']] as const) {
    if (!text(formData, name)) errors[name] = label;
  }
  const quantityMicrounits = parseQuantityToMicrounits(text(formData, 'quantity'));
  if (!quantityMicrounits) errors.quantity = 'Enter a positive quantity with up to 6 decimal places';
  if (!DATE_ONLY.test(text(formData, 'expiresAt'))) errors.expiresAt = 'Enter the expiry date';
  const manufacturedAt = text(formData, 'manufacturedAt');
  if (manufacturedAt && !DATE_ONLY.test(manufacturedAt)) errors.manufacturedAt = 'Enter a valid date';
  if (!REASON_CODE.test(text(formData, 'reasonCode'))) errors.reasonCode = 'Use a lowercase code such as manifest_receipt';
  const idempotencyKey = commandKey(formData);
  if (Object.keys(errors).length || !idempotencyKey) return invalid(errors);
  const optional = (name: string) => text(formData, name) || null;
  return runCommand('receiveCannabisPackage', 'receiveCannabisPackage', {
    idempotencyKey, productId: text(formData, 'productId'), packageUid: text(formData, 'packageUid'), manifestNumber: text(formData, 'manifestNumber'),
    sourceLicenseNumber: text(formData, 'sourceLicenseNumber'), regulatorManifestId: optional('regulatorManifestId'), sourcePackageUid: optional('sourcePackageUid'),
    productionBatchNumber: text(formData, 'productionBatchNumber'), lotNumber: text(formData, 'lotNumber'), quantityMicrounits,
    expiresAt: text(formData, 'expiresAt'), manufacturedAt: manufacturedAt || null, labelVersion: text(formData, 'labelVersion'), reasonCode: text(formData, 'reasonCode'),
    coaReference: optional('coaReference'), labName: optional('labName'), labResultReference: optional('labResultReference'),
  }, 'Package received into receiving hold.');
}

export async function configureProductFromMenu(_state: CommandState, formData: FormData): Promise<CommandState> {
  const errors: FieldErrors = {};
  for (const [name, label] of [['sku', 'Enter a SKU'], ['name', 'Enter a product name'], ['form', 'Enter the product form'], ['categoryCode', 'Enter the category code'], ['unitOfMeasure', 'Enter the unit of measure'], ['taxCategoryCode', 'Enter the tax category']] as const) {
    if (!text(formData, name)) errors[name] = label;
  }
  const unitQuantityMicrounits = parseQuantityToMicrounits(text(formData, 'unitQuantity'));
  if (!unitQuantityMicrounits) errors.unitQuantity = 'Enter the sale increment, e.g. 1 or 3.5';
  const equivalencyMicrounits = parseQuantityToMicrounits(text(formData, 'equivalency'));
  if (!equivalencyMicrounits) errors.equivalency = 'Enter the purchase-limit equivalency per increment';
  const price = text(formData, 'price');
  const priceCents = /^\d{1,7}(\.\d{1,2})?$/.test(price) ? Math.round(Number(price) * 100) : null;
  if (priceCents == null) errors.price = 'Enter a price such as 12.50';
  const adultUseEligible = formData.get('adultUseEligible') === 'on'; const medicalEligible = formData.get('medicalEligible') === 'on';
  if (!adultUseEligible && !medicalEligible) errors.adultUseEligible = 'Select at least one sales channel';
  const idempotencyKey = commandKey(formData);
  if (Object.keys(errors).length || !idempotencyKey) return invalid(errors);
  return runCommand('configureCannabisProduct', 'configureCannabisProduct', {
    idempotencyKey, sku: text(formData, 'sku'), name: text(formData, 'name'), brand: text(formData, 'brand') || null, form: text(formData, 'form'), categoryCode: text(formData, 'categoryCode'),
    unitOfMeasure: text(formData, 'unitOfMeasure'), unitQuantityMicrounits, equivalencyMicrounits, priceCents, taxCategoryCode: text(formData, 'taxCategoryCode'),
    adultUseEligible, medicalEligible, publicDescription: text(formData, 'publicDescription') || null,
  }, 'Product added.');
}

export async function amendProductFromMenu(_state: CommandState, formData: FormData): Promise<CommandState> {
  const errors: FieldErrors = {};
  if (!text(formData, 'name')) errors.name = 'Enter a product name';
  const price = text(formData, 'price');
  const priceCents = /^\d{1,7}(\.\d{1,2})?$/.test(price) ? Math.round(Number(price) * 100) : null;
  if (priceCents == null) errors.price = 'Enter a price such as 12.50';
  const status = text(formData, 'status');
  if (!['active', 'inactive'].includes(status)) errors.status = 'Choose active or inactive';
  const adultUseEligible = formData.get('adultUseEligible') === 'on'; const medicalEligible = formData.get('medicalEligible') === 'on';
  if (!adultUseEligible && !medicalEligible) errors.adultUseEligible = 'Select at least one sales channel';
  const idempotencyKey = commandKey(formData);
  if (Object.keys(errors).length || !idempotencyKey) return invalid(errors);
  return runCommand('amendCannabisProduct', 'amendCannabisProduct', {
    idempotencyKey, productId: text(formData, 'productId'), expectedUpdatedAt: text(formData, 'expectedUpdatedAt'), name: text(formData, 'name'), priceCents, status,
    adultUseEligible, medicalEligible, publicDescription: text(formData, 'publicDescription'),
  }, 'Product updated.');
}

const INCIDENT_TYPES = ['refusal_of_sale', 'identity', 'patient_registry_outage', 'traceability_outage', 'payment_ambiguity', 'inventory_discrepancy', 'theft', 'loss', 'diversion', 'recall', 'privacy', 'security', 'system_outage', 'offline_attempt'];

export async function recordIncidentFromDesk(_state: CommandState, formData: FormData): Promise<CommandState> {
  const errors: FieldErrors = {};
  const type = text(formData, 'type'); const severity = text(formData, 'severity');
  if (!INCIDENT_TYPES.includes(type)) errors.type = 'Select an incident type';
  if (!['low', 'medium', 'high', 'critical'].includes(severity)) errors.severity = 'Select a severity';
  const description = text(formData, 'description');
  if (description.length < 4 || description.length > 5000) errors.description = 'Describe what happened (4–5000 characters)';
  const occurredAt = text(formData, 'occurredAt'); const notificationDueAt = text(formData, 'notificationDueAt');
  if (!occurredAt || !Number.isFinite(new Date(occurredAt).getTime())) errors.occurredAt = 'Enter when it happened';
  if (notificationDueAt && !Number.isFinite(new Date(notificationDueAt).getTime())) errors.notificationDueAt = 'Enter a valid date and time';
  const idempotencyKey = commandKey(formData);
  if (Object.keys(errors).length || !idempotencyKey) return invalid(errors);
  // datetime-local values are interpreted in the operator's browser zone and sent as instants.
  return runCommand('recordComplianceIncident', 'recordComplianceIncident', {
    idempotencyKey, type, severity, description, occurredAt: text(formData, 'occurredAtInstant') || new Date(occurredAt).toISOString(),
    notificationDueAt: notificationDueAt ? text(formData, 'notificationDueAtInstant') || new Date(notificationDueAt).toISOString() : null,
    outageMode: type === 'offline_attempt' ? 'fail_closed' : 'none', authorityReference: text(formData, 'authorityReference') || null,
  }, 'Incident recorded.');
}

export async function transitionIncidentFromDesk(_state: CommandState, formData: FormData): Promise<CommandState> {
  const errors: FieldErrors = {};
  if (!REASON_CODE.test(text(formData, 'reasonCode'))) errors.reasonCode = 'Use a lowercase code such as contained_on_site';
  if (text(formData, 'nextStatus') === 'reported' && !text(formData, 'authorityReference')) errors.authorityReference = 'Enter the report reference';
  const idempotencyKey = commandKey(formData);
  if (Object.keys(errors).length || !idempotencyKey) return invalid(errors);
  return runCommand('transitionComplianceIncident', 'transitionComplianceIncident', {
    idempotencyKey, incidentId: text(formData, 'incidentId'), expectedStatus: text(formData, 'expectedStatus'), nextStatus: text(formData, 'nextStatus'),
    reasonCode: text(formData, 'reasonCode'), authorityReference: text(formData, 'authorityReference') || null,
  }, 'Incident updated.');
}

export async function retryOutboxEventFromDesk(_state: CommandState, formData: FormData): Promise<CommandState> {
  const idempotencyKey = commandKey(formData); const outboxEventId = text(formData, 'outboxEventId');
  if (!idempotencyKey || !outboxEventId) return { error: 'Select an event to requeue.' };
  return runCommand('retryStateOutboxEvent', 'retryStateOutboxEvent', { idempotencyKey, outboxEventId }, 'Event requeued.');
}

export async function configureRegisterFromDesk(_state: CommandState, formData: FormData): Promise<CommandState> {
  const errors: FieldErrors = {};
  if (!text(formData, 'code')) errors.code = 'Enter a register code';
  if (!text(formData, 'name')) errors.name = 'Enter a register name';
  const idempotencyKey = commandKey(formData);
  if (Object.keys(errors).length || !idempotencyKey) return invalid(errors);
  return runCommand('configureRegister', 'configureRegister', { idempotencyKey, code: text(formData, 'code'), name: text(formData, 'name') }, 'Register added.');
}

export async function openShiftFromDesk(_state: CommandState, formData: FormData): Promise<CommandState> {
  const errors: FieldErrors = {};
  if (!text(formData, 'registerId')) errors.registerId = 'Select a register';
  const float = text(formData, 'openingFloat');
  const openingFloatCents = /^\d{1,7}(\.\d{1,2})?$/.test(float) ? Math.round(Number(float) * 100) : null;
  if (openingFloatCents == null) errors.openingFloat = 'Enter the counted opening float, e.g. 200.00';
  const idempotencyKey = commandKey(formData);
  if (Object.keys(errors).length || !idempotencyKey) return invalid(errors);
  return runCommand('openRegisterShift', 'openRegisterShift', { idempotencyKey, registerId: text(formData, 'registerId'), openingFloatCents }, 'Shift opened.');
}

export async function approveVarianceFromDesk(_state: CommandState, formData: FormData): Promise<CommandState> {
  const errors: FieldErrors = {};
  if (!REASON_CODE.test(text(formData, 'reasonCode'))) errors.reasonCode = 'Use a lowercase code such as counting_error';
  const idempotencyKey = commandKey(formData);
  if (Object.keys(errors).length || !idempotencyKey) return invalid(errors);
  return runCommand('approveCashVariance', 'approveCashVariance', { idempotencyKey, shiftId: text(formData, 'shiftId'), reasonCode: text(formData, 'reasonCode') }, 'Variance approved and shift closed.');
}

const ACTIVITIES = ['authority', 'eligibility', 'inventory', 'sale', 'cash', 'state_reporting', 'incident'];
const PERMISSIONS = ['canManagePeople', 'canManageAuthority', 'canManageCompliance', 'canManageInventory', 'canManageSales', 'canManageFinance', 'canManageIntegrations', 'canViewReports'];

export async function provisionStaffFromDesk(_state: CommandState, formData: FormData): Promise<CommandState> {
  const errors: FieldErrors = {};
  for (const [name, label] of [['name', 'Enter the staff member’s name'], ['email', 'Enter an email address'], ['roleName', 'Enter a role name'], ['credentialType', 'Enter the credential type'], ['credentialReference', 'Enter the credential number']] as const) {
    if (!text(formData, name)) errors[name] = label;
  }
  if (text(formData, 'temporaryPassword').length < 10) errors.temporaryPassword = 'Use at least 10 characters';
  const activities = ACTIVITIES.filter(activity => formData.get(`activity:${activity}`) === 'on');
  if (!activities.length) errors.activities = 'Select at least one activity';
  if (!DATE_ONLY.test(text(formData, 'effectiveAt'))) errors.effectiveAt = 'Enter the start date';
  if (!DATE_ONLY.test(text(formData, 'expiresAt'))) errors.expiresAt = 'Enter the expiry date';
  const limit = text(formData, 'approvalLimit') || '0';
  const approvalLimitCents = /^\d{1,7}(\.\d{1,2})?$/.test(limit) ? Math.round(Number(limit) * 100) : null;
  if (approvalLimitCents == null) errors.approvalLimit = 'Enter an amount such as 50.00';
  const idempotencyKey = commandKey(formData);
  if (Object.keys(errors).length || !idempotencyKey) return invalid(errors);
  const permissions = Object.fromEntries(PERMISSIONS.map(permission => [permission, formData.get(`permission:${permission}`) === 'on']));
  return runCommand('provisionStaffAuthority', 'provisionStaffAuthority', {
    idempotencyKey, name: text(formData, 'name'), email: text(formData, 'email'), temporaryPassword: String(formData.get('temporaryPassword') ?? ''), roleName: text(formData, 'roleName'),
    permissions, allowedActivities: activities, credentialType: text(formData, 'credentialType'), credentialReference: text(formData, 'credentialReference'),
    effectiveAt: new Date(`${text(formData, 'effectiveAt')}T00:00:00Z`).toISOString(), expiresAt: new Date(`${text(formData, 'expiresAt')}T00:00:00Z`).toISOString(), approvalLimitCents,
  }, 'Staff member added.');
}

export async function revokeCredentialFromDesk(_state: CommandState, formData: FormData): Promise<CommandState> {
  const errors: FieldErrors = {};
  if (!REASON_CODE.test(text(formData, 'reasonCode'))) errors.reasonCode = 'Use a lowercase code such as left_employment';
  const idempotencyKey = commandKey(formData);
  if (Object.keys(errors).length || !idempotencyKey) return invalid(errors);
  return runCommand('revokeStaffCredential', 'revokeStaffCredential', { idempotencyKey, credentialId: text(formData, 'credentialId'), nextStatus: text(formData, 'nextStatus'), reasonCode: text(formData, 'reasonCode') }, 'Credential updated.');
}

export async function amendRegisterFromDesk(_state: CommandState, formData: FormData): Promise<CommandState> {
  const idempotencyKey = commandKey(formData); const status = text(formData, 'status');
  if (!idempotencyKey || !['active', 'inactive', 'maintenance'].includes(status)) return invalid({ status: 'Choose a status' });
  return runCommand('amendRegister', 'amendRegister', { idempotencyKey, registerId: text(formData, 'registerId'), status }, 'Register updated.');
}

export async function renewAuthorityFromDesk(_state: CommandState, formData: FormData): Promise<CommandState> {
  const errors: FieldErrors = {};
  if (!DATE_ONLY.test(text(formData, 'effectiveAt'))) errors.effectiveAt = 'Enter the start date';
  if (!DATE_ONLY.test(text(formData, 'expiresAt'))) errors.expiresAt = 'Enter the expiry date';
  if (text(formData, 'reference').length < 2) errors.reference = 'Enter the renewal reference';
  const idempotencyKey = commandKey(formData);
  if (Object.keys(errors).length || !idempotencyKey) return invalid(errors);
  return runCommand('renewCannabisAuthority', 'renewCannabisAuthority', {
    idempotencyKey, kind: text(formData, 'kind'), id: text(formData, 'id'), reference: text(formData, 'reference'),
    effectiveAt: new Date(`${text(formData, 'effectiveAt')}T00:00:00Z`).toISOString(), expiresAt: new Date(`${text(formData, 'expiresAt')}T00:00:00Z`).toISOString(),
  }, 'Renewed.');
}
