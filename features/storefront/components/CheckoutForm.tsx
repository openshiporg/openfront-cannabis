'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatPrice } from '../lib/format';
import { getPickupOptions, publicGraphql, type PickupOptions } from '../lib/api';
import { useBag } from '../lib/bag';
import { BIRTH_DATE_PATTERN, formatBirthDateInput, isoBirthDate } from '../lib/birth-date';
import { CardFields, useAcceptJs } from './AuthorizeNetCardFields';

const PLACE = `mutation($input: JSON!) { placeCannabisPickupOrder(input: $input) }`;

/** The bag and the checkout: contact, date of birth, pickup window, payment. The server re-prices everything. */
type Quote = { subtotalCents: number; taxCents: number; totalCents: number };
const usDate = (iso: string) => { const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[2]}/${m[3]}/${m[1]}` : ''; };

export function CheckoutForm({ account = null }: { account?: { name: string; email: string; phone: string; dateOfBirth: string } | null }) {
  const router = useRouter();
  const bag = useBag();
  const [options, setOptions] = useState<PickupOptions | null>(null);
  const [loadError, setLoadError] = useState('');
  const [method, setMethod] = useState<'card' | 'pickup'>('pickup');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; href: string; reference: string } | null>(null);
  const key = useRef('');
  if (!key.current && typeof crypto !== 'undefined') key.current = crypto.randomUUID();
  const card = options?.card ?? null;
  const anet = useAcceptJs(card?.env ?? null);

  const [quote, setQuote] = useState<Quote | null>(null);
  const bagKey = bag.items.map(item => `${item.id}:${item.units}`).join(',');
  // The server prices the bag with tax, so the shopper sees the full total before placing the order.
  useEffect(() => {
    if (!bagKey) { setQuote(null); return; }
    let current = true;
    publicGraphql<{ cannabisPickupQuote: Quote }>('query($items: JSON!) { cannabisPickupQuote(items: $items) }', { items: bagKey.split(',').map(entry => { const [productId, units] = entry.split(':'); return { productId, units: Number(units) }; }) })
      .then(data => { if (current) setQuote(data.cannabisPickupQuote); }).catch(() => { if (current) setQuote(null); });
    return () => { current = false; };
  }, [bagKey]);

  useEffect(() => { getPickupOptions().then(next => { setOptions(next); setMethod(next.card ? 'card' : 'pickup'); }).catch(failure => setLoadError(failure.message)); }, []);

  const slotGroups = useMemo(() => {
    if (!options) return [];
    const format = (iso: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', { timeZone: options.timezone, ...opts }).format(new Date(iso));
    const groups = new Map<string, Array<{ start: string; label: string }>>();
    for (const slot of options.slots) {
      const day = format(slot.start, { weekday: 'long', month: 'short', day: 'numeric' });
      groups.set(day, [...(groups.get(day) ?? []), { start: slot.start, label: `${format(slot.start, { hour: 'numeric', minute: '2-digit' })} – ${format(slot.end, { hour: 'numeric', minute: '2-digit' })}` }]);
    }
    return [...groups.entries()];
  }, [options]);

  if (notice) return <div className="space-y-4" role="status"><p className="cn-name text-[26px] text-cn-ink">{notice.text}</p><p className="text-[17px] text-cn-ink-2">Order reference <span className="cn-num font-semibold text-cn-ink" data-testid="order-reference">{notice.reference}</span></p><Link href={notice.href} className="cn-btn">View your order</Link></div>;
  if (bag.ready && bag.items.length === 0) return <div className="space-y-4"><p className="cn-name text-[26px] text-cn-ink">Your bag is empty</p><Link href="/#menu" data-tone="ink" className="cn-btn">See the menu</Link></div>;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !options) return;
    setError(''); setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const opaqueData = method === 'card' && card ? await anet.tokenize(card, form) : undefined;
      const result = await publicGraphql<{ placeCannabisPickupOrder: { reference: string; proof: string; message?: string } }>(PLACE, { input: {
        idempotencyKey: key.current, name: form.get('name'), email: form.get('email'), phone: form.get('phone'), dateOfBirth: isoBirthDate(form.get('dateOfBirth')),
        pickupStart: form.get('pickupStart'), idNotice: form.get('idNotice') === 'on', paymentMethod: method, opaqueData,
        items: bag.items.map(item => ({ productId: item.id, units: item.units })) } });
      const order = result.placeCannabisPickupOrder;
      window.sessionStorage.setItem(`cn-order-${order.reference}`, order.proof);
      bag.clear();
      const orderPath = `/order/${encodeURIComponent(order.reference)}#${encodeURIComponent(order.proof)}`;
      // Payment not confirmed: stay on this page so the shopper reads the message (and cannot submit again), then follow the link.
      if (order.message) { setNotice({ text: order.message, href: orderPath, reference: order.reference }); return; }
      router.push(orderPath);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Something went wrong. Please try again.');
      // A declined or rejected attempt may be retried with new details under a new key.
      key.current = crypto.randomUUID(); setBusy(false);
    }
  };

  const money = (cents: number) => formatPrice(cents, options?.currencyCode);
  if (loadError) return <p role="alert" className="text-[17px] text-cn-ink">{loadError}</p>;
  if (options && !options.pickupEnabled) return <div className="space-y-4"><p className="cn-name text-[26px] text-cn-ink">Pickup orders are paused</p><p className="text-cn-ink-2">Please visit the store, or check back soon.</p><Link href="/visit" className="cn-btn">Visit</Link></div>;

  return <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
    <section aria-labelledby="bag-title">
      <h2 id="bag-title" className="cn-display text-[44px] text-cn-ink">Your bag</h2>
      <ul className="mt-4 border-t border-cn-line">
        {bag.items.map(item => <li key={item.id} className="flex items-center justify-between gap-4 border-b border-cn-line py-3">
          <span className="min-w-0"><Link href={`/menu/${encodeURIComponent(item.id)}`} className="block break-words text-[17px] text-cn-ink">{item.name}</Link><span className="cn-num text-[14px] text-cn-ink-3">{money(item.priceCents)} each</span></span>
          <span role="group" aria-label={`Quantity of ${item.name}`} className="inline-flex h-11 shrink-0 items-center rounded-[4px] border border-cn-line">
            <button type="button" aria-label={`Fewer ${item.name}`} onClick={() => bag.setUnits(item.id, item.units - 1)} className="size-11 text-[20px]">−</button>
            <span className="cn-num w-7 text-center" aria-live="polite">{item.units}</span>
            <button type="button" aria-label={`More ${item.name}`} onClick={() => bag.setUnits(item.id, item.units + 1)} className="size-11 text-[20px]">+</button>
          </span>
        </li>)}
      </ul>
      <dl className="mt-4 space-y-1 text-[17px]">
        <div className="flex items-baseline justify-between"><dt className="text-cn-ink-2">Subtotal</dt><dd className="cn-num text-cn-ink">{money(quote?.subtotalCents ?? bag.subtotalCents)}</dd></div>
        <div className="flex items-baseline justify-between"><dt className="text-cn-ink-2">Tax</dt><dd className="cn-num text-cn-ink">{quote ? money(quote.taxCents) : '…'}</dd></div>
        <div className="flex items-baseline justify-between border-t border-cn-line pt-2 text-[20px] font-semibold text-cn-ink"><dt>Total</dt><dd className="cn-num" data-testid="bag-total">{quote ? money(quote.totalCents) : '…'}</dd></div>
      </dl>
      <p className="mt-2 text-[14px] text-cn-ink-3">Purchase limits apply.</p>
    </section>
    <form onSubmit={submit} aria-label="Pickup order" className="space-y-6">
      <h2 className="cn-display text-[44px] text-cn-ink">Pickup details</h2>
      {account
        ? <p className="text-[15px] text-cn-ink-2">Signed in as <span className="text-cn-ink">{account.email}</span>. This order is saved to <Link href="/account" className="cn-link">your account</Link>.</p>
        : <p className="text-[15px] text-cn-ink-2"><Link href="/account/signin?next=/bag" className="cn-link">Sign in</Link> to fill this in and keep your orders, or continue as a guest.</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="mb-1 block text-[14px] text-cn-ink-2">Full name</span><input name="name" autoComplete="name" required minLength={2} maxLength={120} defaultValue={account?.name} className="cn-field" /></label>
        <label className="block"><span className="mb-1 block text-[14px] text-cn-ink-2">Phone</span><input name="phone" type="tel" autoComplete="tel" required maxLength={30} defaultValue={account?.phone} className="cn-field" /></label>
        <label className="block"><span className="mb-1 block text-[14px] text-cn-ink-2">Email</span><input name="email" type="email" autoComplete="email" required maxLength={254} defaultValue={account?.email} readOnly={Boolean(account)} className="cn-field" /></label>
        <label className="block"><span className="mb-1 block text-[14px] text-cn-ink-2">Date of birth ({options?.minimumAge ?? 21}+ only)</span><input name="dateOfBirth" type="text" inputMode="numeric" placeholder="MM/DD/YYYY" maxLength={10} pattern={BIRTH_DATE_PATTERN} title="Month/day/year, for example 04/09/1986" autoComplete="bday" required defaultValue={account ? usDate(account.dateOfBirth) : undefined} onChange={event => formatBirthDateInput(event.currentTarget)} className="cn-field" /></label>
      </div>
      <label className="block"><span className="mb-1 block text-[14px] text-cn-ink-2">Pickup window</span>
        <select name="pickupStart" required defaultValue="" className="cn-field">
          <option value="" disabled>{options ? (slotGroups.length ? 'Choose a time' : 'No times available right now') : 'Loading times…'}</option>
          {slotGroups.map(([day, slots]) => <optgroup key={day} label={day}>{slots.map(slot => <option key={slot.start} value={slot.start}>{slot.label}</option>)}</optgroup>)}
        </select>
      </label>
      <fieldset className="space-y-2">
        <legend className="cn-name mb-2 text-[18px] text-cn-ink">Payment</legend>
        {card && <label className="flex min-h-12 items-center gap-3"><input type="radio" name="method" className="cn-check" checked={method === 'card'} onChange={() => setMethod('card')} />Card · authorized now, charged when you pick up</label>}
        {options?.payAtPickup !== false && <label className="flex min-h-12 items-center gap-3"><input type="radio" name="method" className="cn-check" checked={method === 'pickup'} onChange={() => setMethod('pickup')} />Pay at pickup</label>}
      </fieldset>
      {method === 'card' && card && <><CardFields />{anet.error && <p role="alert">{anet.error}</p>}</>}
      <label className="flex min-h-11 items-start gap-3 text-[16px]"><input type="checkbox" name="idNotice" required className="cn-check mt-0.5" /><span>I’ll bring a valid government-issued photo ID to pickup. No ID, no order.</span></label>
      {error && <p role="alert" className="text-[16px] font-semibold text-cn-warn">{error}</p>}
      <button type="submit" data-tone="ink" className="cn-btn min-h-12 w-full sm:w-auto" disabled={busy || !options || (method === 'card' && !anet.loaded)}>{busy ? 'Placing your order…' : quote ? `Place pickup order · ${money(quote.totalCents)}` : 'Place pickup order'}</button>
    </form>
  </div>;
}
