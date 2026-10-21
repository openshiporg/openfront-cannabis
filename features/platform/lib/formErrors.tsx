'use client';

import { useEffect, useRef } from 'react';

export type FieldErrors = Record<string, string>;
export type FormState = { error?: string; success?: string; fieldErrors?: FieldErrors; outcome?: 'unknown' };

/** Props that connect an input to its server/client validation message. */
export function fieldProps(name: string, errors?: FieldErrors) {
  const message = errors?.[name];
  return { name, id: `field-${name}`, 'aria-invalid': message ? true : undefined, 'aria-describedby': message ? `field-${name}-error` : undefined } as const;
}

export function FieldError({ name, errors }: { name: string; errors?: FieldErrors }) {
  const message = errors?.[name];
  return message ? <p id={`field-${name}-error`} className="mt-1 text-xs text-destructive">{message}</p> : null;
}

/** Move focus to the first invalid field (or the form summary) after a failed submit. */
export function useFocusFirstError(state: FormState) {
  const summary = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const first = state.fieldErrors && Object.keys(state.fieldErrors)[0];
    const target = first ? document.getElementById(`field-${first}`) : state.error ? summary.current : null;
    target?.focus();
  }, [state]);
  return summary;
}
