'use client';

import { Actions, Button, inputClass, labelClass } from '@/features/platform/components/cannabis-ui';
import { FieldError, fieldProps } from '@/features/platform/lib/formErrors';
import { CommandStatus, useCommand } from '@/features/platform/operations/components/useCommand';
import { setStorefrontCoverFromSettings } from '@/features/platform/workspaces/actions/workflows';

/** The storefront cover photo: shown behind the store name on the menu and on Visit. */
export function CoverPhotoForm({ coverUrl, canSave }: { coverUrl: string | null; canSave: boolean }) {
  const { state, onSubmit, pending, key, summary, markDirty } = useCommand(setStorefrontCoverFromSettings);
  const errors = state.fieldErrors;
  return <form onSubmit={onSubmit()} onChange={markDirty} className="space-y-3" aria-label="Cover photo">
    <input type="hidden" name="idempotencyKey" value={key} />
    <fieldset disabled={pending || !canSave} className="flex flex-wrap items-start gap-4">
      {coverUrl
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={coverUrl} alt="" className="aspect-[16/9] w-48 shrink-0 rounded-[5px] border object-cover" />
        : <span className="grid aspect-[16/9] w-48 shrink-0 place-items-center rounded-[5px] border border-dashed text-xs text-muted-foreground">Built-in cover</span>}
      <div className="min-w-0 flex-1 space-y-2">
        <label className={labelClass}>{coverUrl ? 'Replace cover photo' : 'Cover photo'}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" {...fieldProps('photo', errors)} className={`${inputClass} py-1.5 file:mr-3 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-sm`} /><span className="mt-1 block font-normal text-muted-foreground">Landscape JPEG, PNG or WebP, up to 10 MB.</span><FieldError name="photo" errors={errors} /></label>
        {coverUrl && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="remove" />Remove and use the built-in cover</label>}
      </div>
    </fieldset>
    <Actions><Button type="submit" disabled={pending || !canSave} tone="primary">{pending ? 'Saving…' : 'Save cover'}</Button></Actions>
    <CommandStatus state={state} summary={summary} />
  </form>;
}
