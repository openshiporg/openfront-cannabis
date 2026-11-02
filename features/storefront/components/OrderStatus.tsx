'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatPrice } from '../lib/format';
import { publicGraphql } from '../lib/api';

type Order = { reference: string; status: string; name: string; paymentMethod: string; paymentStatus: string; currencyCode: string; timezone: string; pickupStart: string; pickupEnd: string;
  subtotalCents: number; taxCents: number; discountCents: number; totalCents: number; lines: Array<{ title: string; units: number; totalCents: number }> };

const STATE: Record<string, string> = { reserved: 'Reserved. We’re getting it ready.', picking: 'We’re picking your order.', staged: 'Ready for pickup.', final_verification: 'Ready for pickup.', completed: 'Picked up. Thank you!', cancelled: 'Cancelled.', expired: 'This order expired.' };

/** The confirmation page. The order is private to whoever placed it: the key travels in the URL fragment. */
export function OrderStatus({ reference }: { reference: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [proof, setProof] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const fromUrl = decodeURIComponent(window.location.hash.slice(1));
    const key = fromUrl || window.sessionStorage.getItem(`cn-order-${reference}`) || '';
    if (!key) { setError('Open this page from your confirmation link to see your order.'); return; }
    window.sessionStorage.setItem(`cn-order-${reference}`, key); setProof(key);
    publicGraphql<{ cannabisPickupOrder: Order }>('query($r:String!,$p:String!){ cannabisPickupOrder(reference:$r, proof:$p) }', { r: reference, p: key }).then(data => setOrder(data.cannabisPickupOrder)).catch(failure => setError(failure.message));
  }, [reference]);

  const cancel = async () => {
    if (!window.confirm('Cancel this order?')) return;
    setBusy(true); setError('');
    try { await publicGraphql('mutation($r:String!,$p:String!){ cancelCannabisPickupOrder(reference:$r, proof:$p) }', { r: reference, p: proof }); setOrder(current => current && { ...current, status: 'cancelled' }); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not cancel.'); }
    setBusy(false);
  };

  if (error && !order) return <p role="alert" className="text-[17px] text-cn-ink">{error}</p>;
  if (!order) return <p className="text-cn-ink-2">Loading your order…</p>;
  const money = (cents: number) => formatPrice(cents, order.currencyCode);
  const when = (iso: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', { timeZone: order.timezone, ...opts }).format(new Date(iso));
  const active = ['reserved', 'preliminarily_eligible'].includes(order.status);
  return <div className="max-w-2xl space-y-6">
    <p className="text-[17px] text-cn-ink-2">{STATE[order.status] ?? 'Your order is being handled.'}</p>
    <p className="cn-display cn-num text-[44px] text-cn-ink" data-testid="order-reference">{order.reference}</p>
    {order.pickupStart && <p className="text-[18px] text-cn-ink">Pickup {when(order.pickupStart, { weekday: 'long', month: 'short', day: 'numeric' })}, {when(order.pickupStart, { hour: 'numeric', minute: '2-digit' })} – {when(order.pickupEnd, { hour: 'numeric', minute: '2-digit' })}</p>}
    <p className="border-l-2 border-cn-ink pl-4 text-[17px] text-cn-ink">Bring a valid government-issued photo ID. We check it before handing over your order.</p>
    <ul className="border-t border-cn-line">{order.lines.map(line => <li key={line.title} className="flex justify-between gap-4 border-b border-cn-line py-3"><span>{line.units} × {line.title}</span><span className="cn-num">{money(line.totalCents)}</span></li>)}</ul>
    <dl className="space-y-1 text-[16px]">
      <div className="flex justify-between"><dt className="text-cn-ink-2">Subtotal</dt><dd className="cn-num">{money(order.subtotalCents)}</dd></div>
      {order.discountCents > 0 && <div className="flex justify-between"><dt className="text-cn-ink-2">Discount</dt><dd className="cn-num">−{money(order.discountCents)}</dd></div>}
      <div className="flex justify-between"><dt className="text-cn-ink-2">Tax</dt><dd className="cn-num">{money(order.taxCents)}</dd></div>
      <div className="flex justify-between text-[20px] font-semibold"><dt>Total</dt><dd className="cn-num">{money(order.totalCents)}</dd></div>
    </dl>
    <p className="text-cn-ink-2">{['cancelled', 'expired'].includes(order.status) ? (order.paymentMethod === 'card' ? 'Your card hold was released. You were not charged.' : 'No payment was taken.') : order.paymentMethod === 'card' ? (order.paymentStatus === 'authorized' ? 'Your card is authorized and is charged when you pick up.' : order.paymentStatus === 'voided' ? 'The card hold was released.' : order.paymentStatus === 'captured' ? 'Paid by card.' : '') : order.paymentStatus === 'paid_at_pickup' ? 'Paid at pickup.' : 'You’ll pay at pickup.'}</p>
    {error && <p role="alert" className="font-semibold text-cn-warn">{error}</p>}
    <div className="flex flex-wrap gap-2"><Link href="/#menu" className="cn-btn">Back to the menu</Link>{active && <button type="button" className="cn-btn" disabled={busy} onClick={cancel}>{busy ? 'Cancelling…' : 'Cancel order'}</button>}</div>
  </div>;
}
