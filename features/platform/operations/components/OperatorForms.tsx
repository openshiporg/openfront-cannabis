'use client';

import { ActionTrack, inputClass, labelClass, PillButton, textareaClass } from '@/features/platform/components/cannabis-ui';
import { FieldError, fieldProps, type FieldErrors } from '@/features/platform/lib/formErrors';
import {
  amendProductFromMenu, amendRegisterFromDesk, approveVarianceFromDesk, renewAuthorityFromDesk, configureProductFromMenu, configureRegisterFromDesk, openShiftFromDesk,
  provisionStaffFromDesk, recordIncidentFromDesk, retryOutboxEventFromDesk, revokeCredentialFromDesk, transitionIncidentFromDesk,
} from '@/features/platform/workspaces/actions/workflows';
import { CommandStatus, useCommand } from './useCommand';

const input = inputClass;
const label = labelClass;

function Field({ name, title, errors, hint, ...rest }: { name: string; title: string; errors?: FieldErrors; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <label className={label}>{title}<input {...rest} {...fieldProps(name, errors)} className={input} />{hint && <span className="mt-1 block font-normal text-muted-foreground">{hint}</span>}<FieldError name={name} errors={errors} /></label>;
}

function Select({ name, title, errors, children, ...rest }: { name: string; title: string; errors?: FieldErrors; children: React.ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <label className={label}>{title}<select {...rest} {...fieldProps(name, errors)} className={input}>{children}</select><FieldError name={name} errors={errors} /></label>;
}

function Check({ name, title, defaultChecked }: { name: string; title: string; defaultChecked?: boolean }) {
  return <label className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg border bg-background px-3 text-sm capitalize transition-colors has-[:checked]:border-foreground/30 has-[:checked]:bg-muted/60"><input type="checkbox" name={name} id={`field-${name}`} defaultChecked={defaultChecked} className="size-4 accent-green-700 dark:accent-green-400" />{title}</label>;
}

export function NewProductForm() {
  const { state, formAction, pending, key, summary, markDirty } = useCommand(configureProductFromMenu);
  const errors = state.fieldErrors;
  return <form action={formAction} onChange={markDirty} className="space-y-3" aria-label="Add product">
    <input type="hidden" name="idempotencyKey" value={key} />
    <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">
      <Field name="name" title="Product name" errors={errors} required />
      <Field name="sku" title="SKU" errors={errors} required autoComplete="off" />
      <Field name="brand" title="Brand (optional)" errors={errors} />
      <Field name="form" title="Form" errors={errors} required placeholder="Flower, edible, vape…" />
      <Field name="categoryCode" title="Purchase-limit category" errors={errors} required />
      <Field name="taxCategoryCode" title="Tax category" errors={errors} required />
      <Field name="unitOfMeasure" title="Unit of measure" errors={errors} required placeholder="g, each, ml" />
      <Field name="unitQuantity" title="Sale increment" errors={errors} required inputMode="decimal" placeholder="3.5" />
      <Field name="equivalency" title="Limit equivalency per increment" errors={errors} required inputMode="decimal" />
      <Field name="price" title="Price per increment" errors={errors} required inputMode="decimal" placeholder="12.50" />
      <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2"><Check name="adultUseEligible" title="Adult-use" defaultChecked /><Check name="medicalEligible" title="Medical" /><FieldError name="adultUseEligible" errors={errors} /></div>
      <label className={`${label} sm:col-span-2`}>Public description (optional)<textarea name="publicDescription" maxLength={1000} className={textareaClass} /></label>
    </fieldset>
    <ActionTrack><PillButton type="submit" disabled={pending} tone="ink">{pending ? 'Adding…' : 'Add product'}</PillButton></ActionTrack>
    <CommandStatus state={state} summary={summary} />
  </form>;
}

export function AmendProductForm({ product }: { product: { id: string; name: string; priceCents: number; status: string; adultUseEligible: boolean; medicalEligible: boolean; publicDescription: string | null; updatedAt: string } }) {
  const { state, formAction, pending, key, summary, markDirty } = useCommand(amendProductFromMenu);
  const errors = state.fieldErrors;
  return <form action={formAction} onChange={markDirty} className="space-y-3" aria-label={`Edit ${product.name}`}>
    <input type="hidden" name="idempotencyKey" value={key} /><input type="hidden" name="productId" value={product.id} /><input type="hidden" name="expectedUpdatedAt" value={product.updatedAt} />
    <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-3">
      <Field name="name" title="Name" errors={errors} defaultValue={product.name} required />
      <Field name="price" title="Price per increment" errors={errors} defaultValue={(product.priceCents / 100).toFixed(2)} inputMode="decimal" required />
      <Select name="status" title="Status" errors={errors} defaultValue={product.status}><option value="active">Active</option><option value="inactive">Inactive (retired)</option></Select>
      <div className="grid gap-2 sm:col-span-3 sm:grid-cols-2"><Check name="adultUseEligible" title="Adult-use" defaultChecked={product.adultUseEligible} /><Check name="medicalEligible" title="Medical" defaultChecked={product.medicalEligible} /><FieldError name="adultUseEligible" errors={errors} /></div>
      <label className={`${label} sm:col-span-3`}>Public description<textarea name="publicDescription" defaultValue={product.publicDescription || ''} maxLength={1000} className={textareaClass} /></label>
    </fieldset>
    <p className="text-xs text-muted-foreground">Unit, increment and SKU are fixed.</p>
    <ActionTrack><PillButton type="submit" disabled={pending} tone="ink">{pending ? 'Saving…' : 'Save product'}</PillButton></ActionTrack>
    <CommandStatus state={state} summary={summary} />
  </form>;
}

const INCIDENT_TYPES = ['refusal_of_sale', 'identity', 'patient_registry_outage', 'traceability_outage', 'payment_ambiguity', 'inventory_discrepancy', 'theft', 'loss', 'diversion', 'recall', 'privacy', 'security', 'system_outage', 'offline_attempt'];

export function RecordIncidentForm() {
  const { state, formAction, pending, key, summary, markDirty } = useCommand(recordIncidentFromDesk);
  const errors = state.fieldErrors;
  // datetime-local has no zone; convert in the browser so the server receives the instant the operator meant.
  function withInstants(formData: FormData) {
    for (const name of ['occurredAt', 'notificationDueAt']) {
      const value = String(formData.get(name) || '');
      if (value && Number.isFinite(new Date(value).getTime())) formData.set(`${name}Instant`, new Date(value).toISOString());
    }
    formAction(formData);
  }
  return <form action={withInstants} onChange={markDirty} className="space-y-3" aria-label="Record incident">
    <input type="hidden" name="idempotencyKey" value={key} />
    <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">
      <Select name="type" title="Type" errors={errors} required defaultValue=""><option value="" disabled>Select type</option>{INCIDENT_TYPES.map(type => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}</Select>
      <Select name="severity" title="Severity" errors={errors} required defaultValue=""><option value="" disabled>Select severity</option>{['low', 'medium', 'high', 'critical'].map(value => <option key={value} value={value}>{value}</option>)}</Select>
      <Field name="occurredAt" title="Occurred at" type="datetime-local" errors={errors} required />
      <Field name="notificationDueAt" title="Notify regulator by (optional)" type="datetime-local" errors={errors} />
      <label className={`${label} sm:col-span-2`}>What happened<textarea {...fieldProps('description', errors)} required minLength={4} maxLength={5000} className={textareaClass} /><FieldError name="description" errors={errors} /></label>
      <Field name="authorityReference" title="Regulator or police reference (optional)" errors={errors} />
    </fieldset>
    <ActionTrack><PillButton type="submit" disabled={pending} tone="ink">{pending ? 'Recording…' : 'Record incident'}</PillButton></ActionTrack>
    <CommandStatus state={state} summary={summary} />
  </form>;
}

const NEXT_INCIDENT: Record<string, Array<{ status: string; label: string }>> = {
  open: [{ status: 'contained', label: 'Mark contained' }, { status: 'investigating', label: 'Start investigation' }, { status: 'resolved', label: 'Resolve' }],
  contained: [{ status: 'investigating', label: 'Start investigation' }, { status: 'resolved', label: 'Resolve' }],
  investigating: [{ status: 'reported', label: 'Record report to regulator' }, { status: 'resolved', label: 'Resolve' }],
  reported: [{ status: 'resolved', label: 'Resolve' }],
  resolved: [{ status: 'closed', label: 'Close' }],
};

export function IncidentTransitionForm({ incident }: { incident: { id: string; reference: string; status: string } }) {
  const { state, formAction, pending, key, summary, markDirty } = useCommand(transitionIncidentFromDesk);
  const options = NEXT_INCIDENT[incident.status] || [];
  if (!options.length) return null;
  const errors = state.fieldErrors;
  return <form action={formAction} onChange={markDirty} className="mt-3 space-y-3 rounded-lg bg-background/70 p-3 ring-1 ring-inset ring-border/60" aria-label={`Update ${incident.reference}`}>
    <input type="hidden" name="idempotencyKey" value={key} /><input type="hidden" name="incidentId" value={incident.id} /><input type="hidden" name="expectedStatus" value={incident.status} />
    <fieldset disabled={pending} className="grid gap-2 sm:grid-cols-3">
      <Select name="nextStatus" title="Next step" errors={errors}>{options.map(option => <option key={option.status} value={option.status}>{option.label}</option>)}</Select>
      <Field name="reasonCode" title="Reason code" errors={errors} required pattern="[a-z][a-z0-9_]{2,99}" placeholder="contained_on_site" />
      <Field name="authorityReference" title="Report reference (when reporting)" errors={errors} />
    </fieldset>
    <ActionTrack><PillButton type="submit" disabled={pending} tone="ink">{pending ? 'Saving…' : 'Update incident'}</PillButton></ActionTrack>
    <CommandStatus state={state} summary={summary} />
  </form>;
}

export function RetryOutboxButton({ eventId }: { eventId: string }) {
  const { state, formAction, pending, key, summary } = useCommand(retryOutboxEventFromDesk);
  return <form action={formAction} className="flex flex-wrap items-center gap-2">
    <input type="hidden" name="idempotencyKey" value={key} /><input type="hidden" name="outboxEventId" value={eventId} />
    <ActionTrack><PillButton type="submit" disabled={pending || Boolean(state.success)} tone="raised">{pending ? 'Requeuing…' : 'Requeue'}</PillButton></ActionTrack>
    <CommandStatus state={state} summary={summary} />
  </form>;
}

export function RegisterForm() {
  const { state, formAction, pending, key, summary, markDirty } = useCommand(configureRegisterFromDesk);
  return <form action={formAction} onChange={markDirty} className="space-y-3" aria-label="Add register">
    <input type="hidden" name="idempotencyKey" value={key} />
    <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">
      <Field name="code" title="Register code" errors={state.fieldErrors} required placeholder="REG-1" />
      <Field name="name" title="Register name" errors={state.fieldErrors} required placeholder="Front counter" />
    </fieldset>
    <ActionTrack><PillButton type="submit" disabled={pending} tone="ink">{pending ? 'Adding…' : 'Add register'}</PillButton></ActionTrack>
    <CommandStatus state={state} summary={summary} />
  </form>;
}

export function OpenShiftForm({ registers }: { registers: Array<{ id: string; code: string; name: string; status: string }> }) {
  const { state, formAction, pending, key, summary, markDirty } = useCommand(openShiftFromDesk);
  const active = registers.filter(register => register.status === 'active');
  if (!active.length) return <p className="text-sm text-muted-foreground">No active registers</p>;
  return <form action={formAction} onChange={markDirty} className="space-y-3" aria-label="Open shift">
    <input type="hidden" name="idempotencyKey" value={key} />
    <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">
      <Select name="registerId" title="Register" errors={state.fieldErrors} required defaultValue=""><option value="" disabled>Select register</option>{active.map(register => <option key={register.id} value={register.id}>{register.name} · {register.code}</option>)}</Select>
      <Field name="openingFloat" title="Counted opening float" errors={state.fieldErrors} required inputMode="decimal" placeholder="200.00" />
    </fieldset>
    <ActionTrack><PillButton type="submit" disabled={pending} tone="ink">{pending ? 'Opening…' : 'Open shift'}</PillButton></ActionTrack>
    <CommandStatus state={state} summary={summary} />
  </form>;
}

export function ApproveVarianceForm({ shiftId }: { shiftId: string }) {
  const { state, formAction, pending, key, summary, markDirty } = useCommand(approveVarianceFromDesk);
  return <form action={formAction} onChange={markDirty} className="mt-2 flex flex-wrap items-end gap-2">
    <input type="hidden" name="idempotencyKey" value={key} /><input type="hidden" name="shiftId" value={shiftId} />
    <Field name="reasonCode" title="Variance reason code" errors={state.fieldErrors} required pattern="[a-z][a-z0-9_]{2,99}" placeholder="counting_error" disabled={pending} />
    <ActionTrack><PillButton type="submit" disabled={pending} tone="ink">{pending ? 'Approving…' : 'Approve variance'}</PillButton></ActionTrack>
    <CommandStatus state={state} summary={summary} />
  </form>;
}

const ACTIVITIES = ['authority', 'eligibility', 'inventory', 'sale', 'cash', 'state_reporting', 'incident'];
const PERMISSIONS: Array<[string, string]> = [['canManagePeople', 'Manage staff'], ['canManageAuthority', 'Licenses, credentials and Store Settings'], ['canManageCompliance', 'Compliance and incidents'], ['canManageInventory', 'Inventory, receiving and products'], ['canManageSales', 'POS and carts'], ['canManageFinance', 'Cash and registers'], ['canManageIntegrations', 'State reporting queue'], ['canViewReports', 'Reports and reconciliation']];

export function ProvisionStaffForm() {
  const { state, formAction, pending, key, summary, markDirty } = useCommand(provisionStaffFromDesk);
  const errors = state.fieldErrors;
  return <form action={formAction} onChange={markDirty} className="space-y-3" aria-label="Add staff member">
    <input type="hidden" name="idempotencyKey" value={key} />
    <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">
      <Field name="name" title="Name" errors={errors} required />
      <Field name="email" title="Email" type="email" errors={errors} required autoComplete="off" />
      <Field name="temporaryPassword" title="Temporary password" type="password" errors={errors} required minLength={10} autoComplete="new-password" />
      <Field name="roleName" title="Role name" errors={errors} required placeholder="Budtender" />
      <Field name="credentialType" title="Credential type" errors={errors} required placeholder="Agent card" />
      <Field name="credentialReference" title="Credential number" errors={errors} required autoComplete="off" />
      <Field name="effectiveAt" title="Valid from" type="date" errors={errors} required />
      <Field name="expiresAt" title="Valid until" type="date" errors={errors} required />
      <Field name="approvalLimit" title="Approval limit (optional)" errors={errors} inputMode="decimal" placeholder="0.00" />
    </fieldset>
    <fieldset disabled={pending} className="grid gap-2 sm:grid-cols-2"><legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Permissions</legend>{PERMISSIONS.map(([permission, title]) => <Check key={permission} name={`permission:${permission}`} title={title} />)}</fieldset>
    <fieldset disabled={pending} className="grid gap-2 sm:grid-cols-3" aria-describedby={errors?.activities ? 'field-activities-error' : undefined}><legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Credential activities</legend>{ACTIVITIES.map(activity => <Check key={activity} name={`activity:${activity}`} title={activity.replaceAll('_', ' ')} />)}<span id="field-activities" tabIndex={-1} /><FieldError name="activities" errors={errors} /></fieldset>
    <ActionTrack><PillButton type="submit" disabled={pending} tone="ink">{pending ? 'Adding…' : 'Add staff member'}</PillButton></ActionTrack>
    <CommandStatus state={state} summary={summary} />
  </form>;
}

export function RevokeCredentialForm({ credentialId, status }: { credentialId: string; status: string }) {
  const { state, formAction, pending, key, summary, markDirty } = useCommand(revokeCredentialFromDesk);
  if (!['active', 'pending', 'suspended'].includes(status)) return null;
  return <form action={formAction} onChange={markDirty} className="mt-2 flex flex-wrap items-end gap-2">
    <input type="hidden" name="idempotencyKey" value={key} /><input type="hidden" name="credentialId" value={credentialId} />
    <Select name="nextStatus" title="Change to" errors={state.fieldErrors} disabled={pending}>{status !== 'suspended' && <option value="suspended">Suspended</option>}<option value="terminated">Terminated</option></Select>
    <Field name="reasonCode" title="Reason code" errors={state.fieldErrors} required pattern="[a-z][a-z0-9_]{2,99}" placeholder="left_employment" disabled={pending} />
    <ActionTrack><PillButton type="submit" disabled={pending} tone="raised">{pending ? 'Saving…' : 'Update credential'}</PillButton></ActionTrack>
    <CommandStatus state={state} summary={summary} />
  </form>;
}

export function RegisterStatusForm({ register }: { register: { id: string; status: string } }) {
  const { state, formAction, pending, key, summary } = useCommand(amendRegisterFromDesk);
  return <form action={formAction} className="flex flex-wrap items-center gap-2">
    <input type="hidden" name="idempotencyKey" value={key} /><input type="hidden" name="registerId" value={register.id} />
    <select name="status" defaultValue={register.status} aria-label="Register status" disabled={pending} className="h-9 rounded-full border bg-background px-3 text-xs"><option value="active">Active</option><option value="maintenance">Maintenance</option><option value="inactive">Inactive</option></select>
    <ActionTrack><PillButton type="submit" disabled={pending} tone="raised">{pending ? 'Saving…' : 'Save'}</PillButton></ActionTrack>
    <CommandStatus state={state} summary={summary} />
  </form>;
}

export function RenewAuthorityForm({ kind, id }: { kind: 'license' | 'credential'; id: string }) {
  const { state, formAction, pending, key, summary, markDirty } = useCommand(renewAuthorityFromDesk);
  const errors = state.fieldErrors;
  return <details className="group mt-3"><summary className="inline-flex min-h-8 cursor-pointer list-none items-center rounded-full bg-muted p-[3px] text-[13px] font-medium shadow-[inset_0_1px_2px_rgb(0_0_0/0.07)] [&::-webkit-details-marker]:hidden"><span className="inline-flex min-h-7 items-center rounded-full bg-background px-3 shadow-[0_1px_2px_rgb(0_0_0/0.12)] dark:bg-zinc-800">Renew (owner)</span></summary>
    <form action={formAction} onChange={markDirty} className="mt-3 space-y-3 rounded-lg bg-background/70 p-3 ring-1 ring-inset ring-border/60">
      <input type="hidden" name="idempotencyKey" value={key} /><input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={id} />
      <fieldset disabled={pending} className="grid gap-2 sm:grid-cols-3">
        <Field name="reference" title={kind === 'license' ? 'Renewal reference' : 'Credential number'} errors={errors} required />
        <Field name="effectiveAt" title="Valid from" type="date" errors={errors} required />
        <Field name="expiresAt" title="Valid until" type="date" errors={errors} required />
      </fieldset>
      <ActionTrack><PillButton type="submit" disabled={pending} tone="ink">{pending ? 'Renewing…' : 'Renew'}</PillButton></ActionTrack>
      <CommandStatus state={state} summary={summary} />
    </form>
  </details>;
}
