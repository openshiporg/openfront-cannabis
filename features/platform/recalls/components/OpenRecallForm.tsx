'use client';

import { FieldError, fieldProps } from '@/features/platform/lib/formErrors';
import { ActionTrack, inputClass, labelClass, PillButton, textareaClass } from '@/features/platform/components/cannabis-ui';
import { openRecallFromDesk } from '@/features/platform/workspaces/actions/workflows';
import { CommandStatus, useCommand } from '@/features/platform/operations/components/useCommand';

export function OpenRecallForm() {
  const { state, onSubmit, pending, key, summary, markDirty } = useCommand(openRecallFromDesk);
  const errors = state.fieldErrors;
  return <form onSubmit={onSubmit(() => window.confirm('Open this recall and hold every matching package?'))} onChange={markDirty} className="space-y-3" aria-label="Open a recall">
    <input type="hidden" name="idempotencyKey" value={key} />
    <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">
      <label className={labelClass}>Recall notice reference<input {...fieldProps('authorityReference', errors)} required className={inputClass} /><FieldError name="authorityReference" errors={errors} /></label>
      <label className={labelClass}>Reason<input {...fieldProps('reason', errors)} required minLength={4} className={inputClass} /><FieldError name="reason" errors={errors} /></label>
      <label className={labelClass}>Package UIDs (one per line)<textarea {...fieldProps('packageUids', errors)} rows={3} placeholder="1A4060300002EE1000012345" className={`${textareaClass} font-mono`} /><FieldError name="packageUids" errors={errors} /></label>
      <label className={labelClass}>Production batches (one per line)<textarea {...fieldProps('batchNumbers', errors)} rows={3} placeholder="BATCH-2026-114" className={`${textareaClass} font-mono`} /><FieldError name="batchNumbers" errors={errors} /></label>
    </fieldset>
    <ActionTrack><PillButton type="submit" tone="danger" disabled={pending}>{pending ? 'Opening…' : 'Open recall and hold packages'}</PillButton></ActionTrack>
    <CommandStatus state={state} summary={summary} />
  </form>;
}
