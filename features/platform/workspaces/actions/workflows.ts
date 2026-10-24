'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { runCommandRequest } from '@/features/platform/lib/commandClient';
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
/** Server rule messages that belong to one field, shown next to it as well as in the summary. */
const FIELD_MESSAGES: Array<[RegExp, string]> = [[/^SKU /, 'sku'], [/^Register code /, 'code'], [/^Staff email /, 'email'], [/^Package UID|^Package .* already/i, 'packageUid']];

async function runCommand(mutation: string, scope: string, input: Record<string, unknown>, success: string): Promise<CommandState> {
  const response = await runCommandRequest<Record<string, Record<string, unknown>>>(`mutation ControlledCannabisCommand($input: JSON!) { ${mutation}(input: $input) }`, { input });
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
  if (receipt?.state === 'not_found') {
    if (!response.message) return { error: 'Not recorded. Check the details and current authority, then try again.' };
    const field = FIELD_MESSAGES.find(([pattern]) => pattern.test(response.message!))?.[1];
    return { error: `Not recorded: ${response.message}`, ...(field ? { fieldErrors: { [field]: response.message } } : {}) };
  }
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
    // Categories are sent only when changed, so an unrelated edit isn't blocked by a stale code.
    ...(text(formData, 'categoryCode') && text(formData, 'categoryCode') !== text(formData, 'currentCategoryCode') ? { categoryCode: text(formData, 'categoryCode') } : {}),
    ...(text(formData, 'taxCategoryCode') && text(formData, 'taxCategoryCode') !== text(formData, 'currentTaxCategoryCode') ? { taxCategoryCode: text(formData, 'taxCategoryCode') } : {}),
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

/** Owner amendment of the sales rules; the form sends the rows it built as JSON, the server re-validates everything. */
export async function amendRulePackFromDesk(_state: CommandState, formData: FormData): Promise<CommandState> {
  const idempotencyKey = commandKey(formData);
  let payload: Record<string, unknown> | null = null;
  try { const value = JSON.parse(text(formData, 'payload')); payload = value && typeof value === 'object' && !Array.isArray(value) ? value : null; } catch { payload = null; }
  if (!payload || !idempotencyKey) return { error: 'Correct the highlighted fields.' };
  if (!text(formData, 'version')) return invalid({ version: 'Enter a new rule version' });
  return runCommand('amendCannabisRulePack', 'amendCannabisRulePack', { ...payload, version: text(formData, 'version'), idempotencyKey }, `Sales rules ${text(formData, 'version')} are now in effect.`);
}

export async function setTemporaryPasswordFromDesk(_state: CommandState, formData: FormData): Promise<CommandState> {
  const password = String(formData.get('temporaryPassword') ?? '');
  if (password.length < 10) return invalid({ temporaryPassword: 'At least 10 characters' });
  const idempotencyKey = commandKey(formData);
  if (!idempotencyKey) return invalid({});
  return runCommand('setStaffTemporaryPassword', 'setStaffTemporaryPassword', { idempotencyKey, userId: text(formData, 'userId'), temporaryPassword: password }, 'Temporary password set. Share it in person.');
}

export async function amendPremisesDetailsFromDesk(_state: CommandState, formData: FormData): Promise<CommandState> {
  const errors: FieldErrors = {};
  for (const [name, label] of [['line1', 'Enter the street address'], ['city', 'Enter the city'], ['region', 'Enter the state or province']]) if (!text(formData, name)) errors[name] = label;
  const phone = text(formData, 'phone');
  if (phone && !/^[+()\d\s.-]{7,40}$/.test(phone)) errors.phone = 'Digits, spaces, +, -, . and parentheses only';
  const idempotencyKey = commandKey(formData);
  if (Object.keys(errors).length || !idempotencyKey) return invalid(errors);
  return runCommand('amendCannabisPremisesDetails', 'amendCannabisPremisesDetails', {
    idempotencyKey, line1: text(formData, 'line1'), city: text(formData, 'city'), region: text(formData, 'region'), postalCode: text(formData, 'postalCode'), country: text(formData, 'country'), phone,
  }, 'Address and phone saved. The storefront shows them now.');
}

export async function placeHoldFromDesk(_state: CommandState, formData: FormData): Promise<CommandState> {
  const errors: FieldErrors = {};
  const type = text(formData, 'type');
  if (!['quarantine', 'test_hold', 'discrepancy', 'authority', 'expiry'].includes(type)) errors.type = 'Choose a hold type';
  if (!REASON_CODE.test(text(formData, 'reasonCode'))) errors.reasonCode = 'Use a lowercase code such as damaged_seal';
  if (text(formData, 'reason').length < 4) errors.reason = 'Describe why the package is held';
  const idempotencyKey = commandKey(formData);
  if (Object.keys(errors).length || !idempotencyKey) return invalid(errors);
  return runCommand('placePackageHold', 'placePackageHold', { idempotencyKey, packageId: text(formData, 'packageId'), type, reasonCode: text(formData, 'reasonCode'), reason: text(formData, 'reason') }, 'Hold placed. The package is no longer ready to sell.');
}

const codeList = (value: string) => [...new Set(value.split(/[\s,]+/).map(entry => entry.trim()).filter(Boolean))];

export async function openRecallFromDesk(_state: CommandState, formData: FormData): Promise<CommandState> {
  const errors: FieldErrors = {};
  if (text(formData, 'authorityReference').length < 2) errors.authorityReference = 'Enter the recall notice reference';
  if (text(formData, 'reason').length < 4) errors.reason = 'Enter the recall reason';
  const packageUids = codeList(text(formData, 'packageUids')); const batchNumbers = codeList(text(formData, 'batchNumbers'));
  if (!packageUids.length && !batchNumbers.length) errors.packageUids = 'Enter package UIDs or production batches';
  const idempotencyKey = commandKey(formData);
  if (Object.keys(errors).length || !idempotencyKey) return invalid(errors);
  const result = await runCommand('openRecallCase', 'openRecallCase', { idempotencyKey, authorityReference: text(formData, 'authorityReference'), reason: text(formData, 'reason'), packageUids, batchNumbers }, 'Recall opened.');
  const held = typeof result.result?.heldPackages === 'number' ? result.result.heldPackages : null;
  return result.success && held != null ? { ...result, success: `Recall ${String(result.result?.reference ?? '')} opened. ${held} package${held === 1 ? '' : 's'} held.` } : result;
}

const moneyCents = (value: string) => /^\d{1,7}(\.\d{1,2})?$/.test(value) ? Math.round(Number(value) * 100) : null;

/** The second person's own sign-in, checked server-side for this one command. */
function approverFields(formData: FormData, errors: FieldErrors) {
  const approverEmail = text(formData, 'approverEmail'); const approverPassword = String(formData.get('approverPassword') ?? '');
  if (!approverEmail.includes('@')) errors.approverEmail = 'Enter the approver’s email';
  if (!approverPassword) errors.approverPassword = 'The approver enters their password';
  return { approverEmail, approverPassword };
}

export async function recordLabResultFromDesk(_state: CommandState, formData: FormData): Promise<CommandState> {
  const errors: FieldErrors = {};
  const result = text(formData, 'result');
  if (!['passed', 'failed'].includes(result)) errors.result = 'Choose passed or failed';
  for (const [name, label] of [['labName', 'Enter the lab'], ['labResultReference', 'Enter the result reference'], ['coaReference', 'Enter the COA reference']] as const) if (text(formData, name).length < 2) errors[name] = label;
  const idempotencyKey = commandKey(formData);
  if (Object.keys(errors).length || !idempotencyKey) return invalid(errors);
  return runCommand('recordPackageLabResult', 'recordPackageLabResult', { idempotencyKey, packageId: text(formData, 'packageId'), result, labName: text(formData, 'labName'), labResultReference: text(formData, 'labResultReference'), coaReference: text(formData, 'coaReference') },
    result === 'passed' ? 'Lab result recorded: passed.' : 'Lab result recorded: failed. The package is quarantined.');
}

export async function releasePackageFromDesk(_state: CommandState, formData: FormData): Promise<CommandState> {
  const idempotencyKey = commandKey(formData);
  if (!idempotencyKey) return invalid({});
  return runCommand('releaseCannabisPackage', 'releaseCannabisPackage', { idempotencyKey, packageId: text(formData, 'packageId') }, 'Released. The package is ready to sell.');
}

export async function releaseHoldFromDesk(_state: CommandState, formData: FormData): Promise<CommandState> {
  const errors: FieldErrors = {};
  if (text(formData, 'releaseAuthorityReference').length < 2) errors.releaseAuthorityReference = 'Enter the release reference';
  if (!REASON_CODE.test(text(formData, 'reasonCode'))) errors.reasonCode = 'Use a lowercase code such as retest_passed';
  const approver = approverFields(formData, errors);
  const idempotencyKey = commandKey(formData);
  if (Object.keys(errors).length || !idempotencyKey) return invalid(errors);
  return runCommand('releasePackageHold', 'releasePackageHold', { idempotencyKey, holdId: text(formData, 'holdId'), releaseAuthorityReference: text(formData, 'releaseAuthorityReference'), reasonCode: text(formData, 'reasonCode'), ...approver }, 'Hold released.');
}

const RECALL_STAGES = ['scope_confirmed', 'active', 'monitoring', 'disposition', 'regulator_closed'];

export async function advanceRecallFromDesk(_state: CommandState, formData: FormData): Promise<CommandState> {
  const errors: FieldErrors = {};
  const nextStatus = text(formData, 'nextStatus');
  if (!RECALL_STAGES.includes(nextStatus)) errors.nextStatus = 'Choose the next stage';
  const closing = nextStatus === 'regulator_closed';
  const disposition = text(formData, 'disposition');
  if (closing && !['release', 'destroy'].includes(disposition)) errors.disposition = 'Choose release or destroy';
  if (closing && text(formData, 'closureReference').length < 2) errors.closureReference = 'Enter the regulator’s closure reference';
  const approver = closing ? approverFields(formData, errors) : {};
  const idempotencyKey = commandKey(formData);
  if (Object.keys(errors).length || !idempotencyKey) return invalid(errors);
  const result = await runCommand('advanceRecallCase', 'advanceRecallCase', { idempotencyKey, recallId: text(formData, 'recallId'), nextStatus, ...(closing ? { disposition, closureReference: text(formData, 'closureReference'), ...approver } : {}) }, 'Recall updated.');
  const settled = result.result?.settledPackages;
  return result.success && closing && typeof settled === 'number' ? { ...result, success: `Recall closed. ${settled} package${settled === 1 ? '' : 's'} ${disposition === 'destroy' ? 'destroyed' : 'released'}.` } : result;
}

export async function checkInAndStartSaleFromDesk(_state: CommandState, formData: FormData): Promise<CommandState> {
  const errors: FieldErrors = {};
  const capacity = text(formData, 'capacity');
  if (!['adult_use', 'patient', 'caregiver'].includes(capacity)) errors.capacity = 'Choose the buyer type';
  if (!text(formData, 'identityMethod')) errors.identityMethod = 'Choose the ID type';
  if (text(formData, 'identityNumber').length < 4) errors.identityNumber = 'Enter the ID number';
  for (const [name, label] of [['dateOfBirth', 'Enter the date of birth'], ['identityExpiresAt', 'Enter the ID expiry']] as const) if (!DATE_ONLY.test(text(formData, name))) errors[name] = label;
  if (formData.get('identityVerified') !== 'on') errors.identityVerified = 'Confirm you checked the ID';
  const medical = capacity === 'patient' || capacity === 'caregiver';
  if (medical) {
    if (text(formData, 'registryName').length < 2) errors.registryName = 'Enter the registry';
    if (text(formData, 'registryNumber').length < 3) errors.registryNumber = 'Enter the registry card number';
    if (!DATE_ONLY.test(text(formData, 'registryExpiresAt'))) errors.registryExpiresAt = 'Enter the card expiry';
    if (formData.get('registryVerified') !== 'on') errors.registryVerified = 'Confirm you checked the card';
  }
  if (capacity === 'caregiver') {
    if (text(formData, 'representedPatientNumber').length < 3) errors.representedPatientNumber = 'Enter the patient’s registry number';
    if (formData.get('representedPatientVerified') !== 'on') errors.representedPatientVerified = 'Confirm the caregiver authority';
  }
  if (!text(formData, 'shiftId')) errors.shiftId = 'Open a shift on a register first';
  const idempotencyKey = commandKey(formData);
  if (Object.keys(errors).length || !idempotencyKey) return invalid(errors);
  const checkIn = await runCommand('checkInCannabisCustomer', 'checkInCannabisCustomer', {
    idempotencyKey: `${idempotencyKey}:in`, capacity, identityMethod: text(formData, 'identityMethod'), identityNumber: text(formData, 'identityNumber'), dateOfBirth: text(formData, 'dateOfBirth'), identityExpiresAt: text(formData, 'identityExpiresAt'), identityVerified: true,
    ...(medical ? { registryName: text(formData, 'registryName'), registryNumber: text(formData, 'registryNumber'), registryExpiresAt: text(formData, 'registryExpiresAt'), registryVerified: true } : {}),
    ...(capacity === 'caregiver' ? { representedPatientNumber: text(formData, 'representedPatientNumber'), representedPatientVerified: true } : {}),
  }, 'Checked in.');
  if (!checkIn.success) return checkIn;
  const customerId = String(checkIn.result?.id ?? ''); const eligibilityEvidenceId = String(checkIn.result?.eligibilityEvidenceId ?? '');
  const cart = await runCommand('createPosCannabisCart', 'createPosCannabisCart', { idempotencyKey: `${idempotencyKey}:cart`, customerId, eligibilityEvidenceId, shiftId: text(formData, 'shiftId') }, 'Sale started.');
  if (!cart.success) return { ...cart, error: `Customer ${String(checkIn.result?.reference ?? '')} checked in, but the sale was not started: ${cart.error ?? ''}` };
  return { ...cart, success: `Customer ${String(checkIn.result?.reference ?? '')} checked in${checkIn.result?.returning ? ' (returning)' : ''}. Sale ${String(cart.result?.reference ?? '')} started.` };
}

export async function addCartLineFromDesk(_state: CommandState, formData: FormData): Promise<CommandState> {
  const idempotencyKey = commandKey(formData);
  const quantityMicrounits = Number(text(formData, 'quantityMicrounits')); const expectedCartVersion = Number(text(formData, 'expectedCartVersion'));
  const reviewedQuoteHash = text(formData, 'reviewedQuoteHash');
  if (!idempotencyKey || !Number.isSafeInteger(quantityMicrounits) || quantityMicrounits < 1 || !Number.isSafeInteger(expectedCartVersion) || !/^[a-f0-9]{64}$/.test(reviewedQuoteHash)) return { error: 'Get a fresh quote, then add it.' };
  const promotionCode = text(formData, 'promotionCode');
  return runCommand('addCannabisCartLine', 'addCannabisCartLine', { idempotencyKey, cartId: text(formData, 'cartId'), productId: text(formData, 'productId'), quantityMicrounits, expectedCartVersion, reviewedQuoteHash, ...(promotionCode ? { promotionCode } : {}) }, 'Added to the cart.');
}

export async function finalizeSaleFromDesk(_state: CommandState, formData: FormData): Promise<CommandState> {
  const errors: FieldErrors = {};
  const type = text(formData, 'tenderType'); const totalCents = Number(text(formData, 'totalCents'));
  if (!type) errors.tenderType = 'Choose a payment type';
  let tender: Record<string, unknown> = {};
  if (type === 'cash') {
    const tendered = moneyCents(text(formData, 'tendered'));
    if (tendered == null) errors.tendered = 'Enter the cash received, e.g. 60.00';
    else if (tendered < totalCents) errors.tendered = 'Less than the total';
    else tender = { type, amountCents: totalCents, tenderedCents: tendered, changeCents: tendered - totalCents };
  } else if (type) {
    if (text(formData, 'providerReference').length < 2) errors.providerReference = 'Enter the terminal approval code';
    else tender = { type, amountCents: totalCents, tenderedCents: totalCents, changeCents: 0, providerReference: text(formData, 'providerReference') };
  }
  const idempotencyKey = commandKey(formData);
  if (Object.keys(errors).length || !idempotencyKey || !Number.isSafeInteger(totalCents)) return invalid(errors);
  const result = await runCommand('finalizeCannabisSale', 'finalizeCannabisSale', { idempotencyKey, cartId: text(formData, 'cartId'), tenders: [tender], representedPatientVerified: formData.get('representedPatientVerified') === 'on' }, 'Sale complete.');
  const change = Number(tender.changeCents ?? 0);
  return result.success ? { ...result, success: `Sale ${String(result.result?.reference ?? '')} complete.${change > 0 ? ` Change due ${(change / 100).toFixed(2)}.` : ''}` } : result;
}

export async function cancelCartFromDesk(_state: CommandState, formData: FormData): Promise<CommandState> {
  const idempotencyKey = commandKey(formData);
  if (!idempotencyKey) return invalid({});
  return runCommand('cancelCannabisCart', 'cancelCannabisCart', { idempotencyKey, cartId: text(formData, 'cartId'), reasonCode: 'cart_cancelled' }, 'Cart cancelled. Its stock is free again.');
}

export async function closeShiftFromDesk(_state: CommandState, formData: FormData): Promise<CommandState> {
  const errors: FieldErrors = {};
  const actualCashCents = moneyCents(text(formData, 'actualCash'));
  if (actualCashCents == null) errors.actualCash = 'Enter the counted cash, e.g. 412.50';
  const approver = approverFields(formData, errors);
  const idempotencyKey = commandKey(formData);
  if (Object.keys(errors).length || !idempotencyKey) return invalid(errors);
  const result = await runCommand('closeRegisterShift', 'closeRegisterShift', { idempotencyKey, shiftId: text(formData, 'shiftId'), actualCashCents, ...approver }, 'Shift closed.');
  return result.success && result.result?.status === 'variance_review' ? { ...result, success: 'Counted. The drawer is off, so the shift waits for variance approval.' } : result;
}

export async function refundSaleFromDesk(_state: CommandState, formData: FormData): Promise<CommandState> {
  const errors: FieldErrors = {};
  const amountCents = moneyCents(text(formData, 'amount'));
  if (amountCents == null || amountCents < 1) errors.amount = 'Enter the refund amount';
  if (!text(formData, 'originalTenderId')) errors.originalTenderId = 'Choose the original payment';
  if (!REASON_CODE.test(text(formData, 'reasonCode'))) errors.reasonCode = 'Use a lowercase code such as damaged_product';
  const inventoryDisposition = text(formData, 'inventoryDisposition');
  if (!['none', 'quarantine', 'waste', 'returned_to_authority'].includes(inventoryDisposition)) errors.inventoryDisposition = 'Choose what happens to returned product';
  const approver = approverFields(formData, errors);
  const idempotencyKey = commandKey(formData);
  if (Object.keys(errors).length || !idempotencyKey) return invalid(errors);
  const providerReference = text(formData, 'providerReference');
  return runCommand('refundCannabisSale', 'refundCannabisSale', { idempotencyKey, saleId: text(formData, 'saleId'), originalTenderId: text(formData, 'originalTenderId'), amountCents, reasonCode: text(formData, 'reasonCode'), inventoryDisposition, ...(providerReference ? { providerReference } : {}), ...approver }, 'Refund recorded.');
}
