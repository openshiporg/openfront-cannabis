'use client';

import { useEffect } from 'react';

const MESSAGE = 'You have unsaved changes. Leave without saving?';

/** Warn before a reload, tab close or in-app link navigation discards a dirty form. */
export function useUnsavedChangesGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const linkClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!anchor || anchor.getAttribute('target') === '_blank' || event.defaultPrevented) return;
      if (!window.confirm(MESSAGE)) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', linkClick, true);
    return () => { window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('click', linkClick, true); };
  }, [dirty]);
}

export function confirmDiscard(dirty: boolean) {
  return !dirty || window.confirm(MESSAGE);
}
