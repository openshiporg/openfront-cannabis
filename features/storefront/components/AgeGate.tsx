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

  return <div role="dialog" aria-modal="true" aria-labelledby="cn-age-title" className="fixed inset-0 z-[200] flex items-end justify-center bg-cn-well/85 p-3 sm:items-center sm:p-6">
    <div className="w-full max-w-[440px] rounded-[2px] bg-cn-cover p-6 shadow-[0_32px_80px_-20px_rgb(0_0_0/0.8)] sm:p-9">
      <p className="cn-display truncate text-[20px] text-cn-ink">{storeName}</p>
      <div className="mt-8 flex items-baseline gap-3">
        <span className="cn-display text-[96px] leading-none text-cn-ink">{adultAge}+</span>
        <span className="text-[15px] font-semibold text-cn-ink-2">{medicalAge != null ? `Age required · patients ${medicalAge}+` : 'Age required'}</span>
      </div>
      <h2 id="cn-age-title" className="cn-display mt-6 text-[28px] leading-[34px] text-cn-ink">{state === 'denied' ? `You must be ${medicalAge != null ? `${medicalAge} or older with a medical card` : `${adultAge} or older`} to enter.` : `Are you ${adultAge} or older?`}</h2>
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
