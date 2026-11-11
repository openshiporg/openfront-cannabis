'use client';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

/** Re-reads the page. Staff reads release lapsed carts, so this is the "run it now" control. No timer does it. */
export function RefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return <button type="button" onClick={() => start(() => router.refresh())} disabled={pending} data-testid="workspace-refresh" className="ml-2 rounded-[4px] border border-border px-1.5 py-0.5 text-[11px] font-medium text-foreground hover:bg-muted disabled:opacity-60">{pending ? 'Refreshing…' : 'Refresh'}</button>;
}
