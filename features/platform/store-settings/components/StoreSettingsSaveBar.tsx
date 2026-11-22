'use client'

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Store Settings save control. Below md it is pinned to the bottom of the
 * viewport (clear of the floating assistant button and the home indicator);
 * from md up it renders inline where the page places it.
 * Pass `button` to use the repo's own raised-pill save button (e.g. a form submit Pill).
 */
export function StoreSettingsSaveBar({
  onSave,
  isSaving,
  status,
  label = 'Save Settings',
  button,
  className,
}: {
  onSave?: () => void
  isSaving: boolean
  status?: string | null
  label?: string
  button?: ReactNode
  className?: string
}) {
  const control = button ?? (
    <Button onClick={onSave} disabled={isSaving} className="h-10 rounded-full px-5 text-sm" type="button">
      {isSaving ? 'Saving...' : label}
    </Button>
  )

  return (
    <>
      <div className={cn('hidden md:flex md:items-center md:gap-3', className)}>
        {status ? <span className="text-xs text-muted-foreground">{status}</span> : null}
        {control}
      </div>
      <div className="flex flex-col gap-2 border-t border-border pt-4 md:hidden [&_button]:min-h-11 [&_button]:w-full">
        {status ? <span className="text-xs text-muted-foreground">{status}</span> : null}
        {control}
      </div>
    </>
  )
}
