'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Menu as MenuIcon, X } from 'lucide-react';

/** The phone menu: a full-height drawer. Escape, the close button, the backdrop or any link inside closes it. */
export function PhoneMenu({ title, children }: { title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const query = useSearchParams()?.toString() ?? "";
  const close = () => ref.current?.close();

  // Following a link closes the drawer, including a link to the page already open.
  useEffect(() => { ref.current?.close(); }, [pathname, query]);

  return <div className="shrink-0 sm:hidden">
    <button type="button" aria-label="Open menu" aria-haspopup="dialog" onClick={() => ref.current?.showModal()} className="cn-icon-btn"><MenuIcon className="size-[22px]" aria-hidden="true" /></button>
    <dialog ref={ref} aria-label={title} className="cn-drawer"
      onClick={event => { const target = event.target as HTMLElement; if (target === ref.current || target.closest('a')) close(); }}>
      <div className="flex h-full flex-col">
        <div className="flex h-[var(--cn-header)] shrink-0 items-center justify-between border-b border-cn-line pl-4 pr-2.5">
          <p className="cn-name text-[21px] text-cn-ink">{title}</p>
          <button type="button" aria-label="Close menu" onClick={close} className="cn-icon-btn"><X className="size-[22px]" aria-hidden="true" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">{children}</div>
      </div>
    </dialog>
  </div>;
}
