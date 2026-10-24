'use client';

import { startTransition, useActionState, useRef, useState } from 'react';
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
  const form = useRef<HTMLFormElement | null>(null);
  const [state, formAction, pending] = useActionState(async (previous: CommandState, formData: FormData) => {
    const next = await action(previous, formData);
    // Only a confirmed command retires its key and clears the form; anything else keeps
    // what was typed and retries under the same identity.
    if (next.success) { setKey(crypto.randomUUID()); setDirty(false); form.current?.reset(); }
    return next;
  }, {} as CommandState);
  const summary = useFocusFirstError(state);
  useUnsavedChangesGuard(dirty && !pending);
  /**
   * Submit handler for <form onSubmit>. A function `action` makes React reset every
   * uncontrolled field when it settles, even after an error; submitting here keeps them.
   * `prepare` may add derived fields, or return false to stop (client check or cancelled confirm).
   */
  const onSubmit = (prepare?: (formData: FormData) => boolean | void) => (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    form.current = event.currentTarget;
    const formData = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
    if (prepare?.(formData) === false) return;
    startTransition(() => formAction(formData));
  };
  return { state, formAction, onSubmit, pending, key, summary, markDirty: () => setDirty(true) };
}

export function CommandStatus({ state, summary }: { state: CommandState; summary: React.RefObject<HTMLParagraphElement | null> }) {
  if (state.error) return <p ref={summary} tabIndex={-1} role="alert" className="flex items-baseline gap-2 text-sm text-destructive"><Dot tone="danger" />{state.error}</p>;
  if (state.success) return <p role="status" className="flex items-baseline gap-2 text-sm text-foreground"><Dot tone="ok" />{state.success}</p>;
  return null;
}
