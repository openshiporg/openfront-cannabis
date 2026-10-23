'use client';

import { useActionState, useState } from 'react';
import type { CommandState } from '@/features/platform/workspaces/actions/workflows';
import { useFocusFirstError } from '@/features/platform/lib/formErrors';
import { useUnsavedChangesGuard } from '@/features/platform/lib/useUnsavedChangesGuard';
import { Dot } from '@/features/platform/components/cannabis-ui';

type Action = (state: CommandState, formData: FormData) => Promise<CommandState>;

/**
 * One idempotency key per reviewed command: it is kept across retries until the
 * command is confirmed, so a retry after a lost response cannot apply it twice.
 */
export function useCommand(action: Action) {
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [dirty, setDirty] = useState(false);
  const [state, formAction, pending] = useActionState(async (previous: CommandState, formData: FormData) => {
    const next = await action(previous, formData);
    // Only a confirmed command retires its key; anything else retries under the same identity.
    if (next.success) { setKey(crypto.randomUUID()); setDirty(false); }
    return next;
  }, {} as CommandState);
  const summary = useFocusFirstError(state);
  useUnsavedChangesGuard(dirty && !pending);
  return { state, formAction, pending, key, summary, markDirty: () => setDirty(true) };
}

export function CommandStatus({ state, summary }: { state: CommandState; summary: React.RefObject<HTMLParagraphElement | null> }) {
  if (state.error) return <p ref={summary} tabIndex={-1} role="alert" className="flex items-baseline gap-2 text-sm text-destructive"><Dot tone="danger" />{state.error}</p>;
  if (state.success) return <p role="status" className="flex items-baseline gap-2 text-sm text-foreground"><Dot tone="ok" />{state.success}</p>;
  return null;
}
