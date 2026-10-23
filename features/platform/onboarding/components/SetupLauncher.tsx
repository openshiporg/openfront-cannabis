'use client';

import { useState } from 'react';
import { ActionTrack, PillButton } from '@/features/platform/components/cannabis-ui';
import { OnboardingDialog } from './OnboardingDialog';

/** In-page entry to setup, for touch and keyboard users who never see the sidebar card's hover buttons. */
export function SetupLauncher() {
  const [open, setOpen] = useState(false);
  return <>
    <ActionTrack><PillButton tone="ink" onClick={() => setOpen(true)}>Start setup</PillButton></ActionTrack>
    <OnboardingDialog open={open} onOpenChange={setOpen} />
  </>;
}
