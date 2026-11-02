'use client';

import { useEffect, useState } from 'react';

type Accept = { dispatchData: (data: unknown, cb: (response: { messages?: { resultCode?: string; message?: Array<{ text?: string }> }; opaqueData?: { dataDescriptor: string; dataValue: string } }) => void) => void };
declare global { interface Window { Accept?: Accept } }

export type CardConfig = { apiLoginId: string; clientKey: string; env: 'sandbox' | 'production' };

/** Loads Accept.js so card numbers go from this page straight to Authorize.net; only a one-time token reaches the store. */
export function useAcceptJs(env: CardConfig['env'] | null) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!env) return;
    if (window.Accept) { setLoaded(true); return; }
    const existing = document.querySelector<HTMLScriptElement>('script[data-anet]');
    if (existing) { existing.addEventListener('load', () => setLoaded(true), { once: true }); return; }
    const script = document.createElement('script');
    script.src = env === 'production' ? 'https://js.authorize.net/v1/Accept.js' : 'https://jstest.authorize.net/v1/Accept.js';
    script.dataset.anet = env; script.charset = 'utf-8';
    script.onload = () => setLoaded(true);
    script.onerror = () => setError('Secure card entry could not load. Choose pay at pickup or try again.');
    document.head.appendChild(script);
  }, [env]);
  const tokenize = (config: CardConfig, form: FormData) => new Promise<{ dataDescriptor: string; dataValue: string }>((resolve, reject) => {
    if (!window.Accept) { reject(new Error('Secure card entry is still loading.')); return; }
    window.Accept.dispatchData({ authData: { apiLoginID: config.apiLoginId, clientKey: config.clientKey }, cardData: {
      cardNumber: String(form.get('cardNumber') || '').replace(/\s/g, ''), month: String(form.get('cardMonth') || ''), year: String(form.get('cardYear') || ''), cardCode: String(form.get('cardCode') || '') } }, response => {
      if (response.messages?.resultCode === 'Error' || !response.opaqueData) reject(new Error(response.messages?.message?.[0]?.text || 'Those card details were not accepted.'));
      else resolve(response.opaqueData);
    });
  });
  return { loaded, error, tokenize };
}

/** Card inputs. The order form is never submitted natively: tokenize() reads these fields in the browser and only the token is sent on. */
export function CardFields() {
  return <fieldset className="grid gap-3 sm:grid-cols-3">
    <legend className="cn-name mb-2 text-[18px] text-cn-ink">Card</legend>
    <label className="block sm:col-span-3"><span className="mb-1 block text-[14px] text-cn-ink-2">Card number</span><input name="cardNumber" autoComplete="cc-number" inputMode="numeric" required maxLength={23} className="cn-field" /></label>
    <label className="block"><span className="mb-1 block text-[14px] text-cn-ink-2">Month (MM)</span><input name="cardMonth" autoComplete="cc-exp-month" inputMode="numeric" required maxLength={2} className="cn-field" /></label>
    <label className="block"><span className="mb-1 block text-[14px] text-cn-ink-2">Year (YYYY)</span><input name="cardYear" autoComplete="cc-exp-year" inputMode="numeric" required maxLength={4} className="cn-field" /></label>
    <label className="block"><span className="mb-1 block text-[14px] text-cn-ink-2">Security code</span><input name="cardCode" autoComplete="cc-csc" inputMode="numeric" required maxLength={4} className="cn-field" /></label>
  </fieldset>;
}
