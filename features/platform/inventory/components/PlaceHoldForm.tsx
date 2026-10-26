'use client';

import { FieldError, fieldProps } from '@/features/platform/lib/formErrors';
import { Actions, buttonClass, inputClass, labelClass, Button } from '@/features/platform/components/cannabis-ui';
import { placeHoldFromDesk } from '@/features/platform/workspaces/actions/workflows';
import { CommandStatus, useCommand } from '@/features/platform/operations/components/useCommand';

const TYPES: Array<[string, string]> = [['quarantine', 'Quarantine'], ['test_hold', 'Test hold'], ['discrepancy', 'Discrepancy'], ['authority', 'Regulator or authority'], ['expiry', 'Expiry']];

/** Restrictive only: the package stops being ready to sell. Release needs the independently approved workflow. */
export function PlaceHoldForm({ packageId, packageUid }: { packageId: string; packageUid: string }) {
  const { state, onSubmit, pending, key, summary, markDirty } = useCommand(placeHoldFromDesk);
  const errors = state.fieldErrors;
  return <details className="group">
    <summary className={buttonClass('danger', 'cursor-pointer list-none [&::-webkit-details-marker]:hidden group-open:bg-muted')}>Place a hold</summary>
    <form onSubmit={onSubmit(() => window.confirm(`Hold package ${packageUid}? It can't be sold until the hold is released.`))} onChange={markDirty} className="mt-3 space-y-3 rounded-[6px] border border-border p-3" aria-label={`Place a hold on ${packageUid}`}>
      <input type="hidden" name="idempotencyKey" value={key} /><input type="hidden" name="packageId" value={packageId} />
      <fieldset disabled={pending} className="grid gap-3">
        <label className={labelClass}>Hold type<select {...fieldProps('type', errors)} required defaultValue="" className={inputClass}><option value="" disabled>Choose</option>{TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><FieldError name="type" errors={errors} /></label>
        <label className={labelClass}>Reason code<input {...fieldProps('reasonCode', errors)} required pattern="[a-z][a-z0-9_]{2,99}" placeholder="damaged_seal" className={`${inputClass} font-mono`} /><FieldError name="reasonCode" errors={errors} /></label>
        <label className={labelClass}>What was found<input {...fieldProps('reason', errors)} required minLength={4} maxLength={1000} className={inputClass} /><FieldError name="reason" errors={errors} /></label>
      </fieldset>
      <Actions><Button type="submit" tone="danger" disabled={pending}>{pending ? 'Placing…' : 'Place hold'}</Button></Actions>
      <CommandStatus state={state} summary={summary} />
    </form>
  </details>;
}
