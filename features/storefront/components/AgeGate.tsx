'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { AGE_COOKIE } from '../lib/age';

/** Ages come from the store's sales rules; a lower medical age adds a patient path. Opaque: nothing behind it reads until confirmed. */
export function AgeGate({ storeName, logo, confirmed, adultAge, medicalAge }: { storeName: string; logo?: ReactNode; confirmed: boolean; adultAge: number; medicalAge: number | null }) {
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

  return <div role="dialog" aria-modal="true" aria-labelledby="cn-age-title" className="fixed inset-0 z-[200] flex flex-col bg-cn-bg">
    <div className="mx-auto flex w-full max-w-[1440px] items-center px-4 py-4 text-cn-ink sm:px-6">{logo ?? <span className="cn-name text-[21px]">{storeName}</span>}</div>
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col justify-end px-4 pb-8 sm:justify-center sm:px-6 sm:pb-16">
      <p className="cn-display cn-num text-[120px] text-cn-ink sm:text-[200px]">{adultAge}+</p>
      <h2 id="cn-age-title" className="cn-name mt-4 max-w-[22ch] text-[30px] leading-[34px] text-cn-ink sm:text-[40px] sm:leading-[44px]">{state === 'denied' ? `You must be ${medicalAge != null ? `${medicalAge} or older with a medical card` : `${adultAge} or older`} to enter.` : `Are you ${adultAge} or older?`}</h2>
      <p className="mt-3 text-[16px] text-cn-ink-2">{medicalAge != null ? `Adult-use ${adultAge}+ · registered patients ${medicalAge}+ · valid ID at the door` : `Valid ID at the door`}</p>
      {state === 'denied'
        ? <div className="mt-8 flex"><button type="button" onClick={() => setState('ask')} className="cn-btn min-w-40">Back</button></div>
        : <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button type="button" autoFocus onClick={confirm} data-tone="ink" className="cn-btn min-h-12 sm:min-w-56">Yes, I am {adultAge}+</button>
          {medicalAge != null && <button type="button" onClick={confirm} className="cn-btn min-h-12">I’m a registered patient, {medicalAge}+</button>}
          <button type="button" onClick={() => setState('denied')} className="cn-btn min-h-12 sm:min-w-28">No</button>
        </div>}
    </div>
  </div>;
}
