'use client';

import { useEffect, useState } from 'react';
import { AGE_COOKIE } from '../lib/age';

/** Ages come from the store's sales rules; a lower medical age adds a patient path. */
export function AgeGate({ storeName, confirmed, adultAge, medicalAge }: { storeName: string; confirmed: boolean; adultAge: number; medicalAge: number | null }) {
  const [state, setState] = useState<'ask' | 'denied' | 'ok'>(confirmed ? 'ok' : 'ask');

  useEffect(() => {
    if (state === 'ok') return;
    document.documentElement.style.overflow = 'hidden';
    return () => { document.documentElement.style.overflow = ''; };
  }, [state]);

  if (state === 'ok') return null;

  const confirm = () => {
    document.cookie = `${AGE_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
    setState('ok');
  };

  return <div role="dialog" aria-modal="true" aria-labelledby="cn-age-title" className="fixed inset-0 z-[200] flex items-end justify-center bg-cn-ink/45 p-3 backdrop-blur-md sm:items-center sm:p-6">
    <div className="w-full max-w-[420px] rounded-[28px] bg-cn-bg p-6 shadow-[0_24px_80px_rgb(24_32_27/0.38)] sm:p-8">
      <p className="cn-num truncate text-[12px] uppercase tracking-[0.14em] text-cn-ink-2">{storeName}</p>
      <div className="mt-8 flex items-baseline gap-3">
        <span className="cn-display text-[64px] font-medium leading-none text-cn-accent">{adultAge}+</span>
        <span className="text-[13px] font-medium text-cn-ink-2">{medicalAge != null ? `Age required · patients ${medicalAge}+` : 'Age required'}</span>
      </div>
      <h2 id="cn-age-title" className="cn-display mt-6 text-[24px] leading-[30px] text-cn-ink">{state === 'denied' ? `You must be ${medicalAge != null ? `${medicalAge} or older with a medical card` : `${adultAge} or older`} to enter.` : `Are you ${adultAge} or older?`}</h2>
      {state === 'denied'
        ? <div className="cn-track mt-8 flex w-full"><button type="button" onClick={() => setState('ask')} data-active="true" className="cn-pill h-11 flex-1 text-[15px]">Back</button></div>
        : <div className="mt-8 space-y-2">
          <div className="cn-track grid w-full grid-cols-2">
            <button type="button" onClick={() => setState('denied')} className="cn-pill h-11 text-[15px]">No</button>
            <button type="button" autoFocus onClick={confirm} data-tone="ink" className="cn-pill h-11 text-[15px]">Yes, I am {adultAge}+</button>
          </div>
          {medicalAge != null && <div className="cn-track flex w-full"><button type="button" onClick={confirm} className="cn-pill h-11 flex-1 text-[14px]">I’m a registered patient, {medicalAge}+</button></div>}
        </div>}
    </div>
  </div>;
}
