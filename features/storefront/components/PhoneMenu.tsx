'use client';

import { useRef, type ReactNode } from 'react';
import { Menu as MenuIcon } from 'lucide-react';

/** Disclosure for the phone menu; any link tapped inside closes it. */
export function PhoneMenu({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  return <details ref={ref} className="group relative shrink-0 sm:hidden" onClick={event => { if ((event.target as HTMLElement).closest('a') && ref.current) ref.current.open = false; }}>
    <summary aria-label="Open menu" className="flex size-11 cursor-pointer list-none items-center justify-center rounded-[2px] bg-cn-surface text-cn-ink [&::-webkit-details-marker]:hidden"><MenuIcon className="size-5" aria-hidden="true" /></summary>
    {children}
  </details>;
}
