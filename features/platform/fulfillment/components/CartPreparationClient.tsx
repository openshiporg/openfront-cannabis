'use client';

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from 'react';
import { Actions, Dot, DotLabel, inputClass, labelClass, Panel, Button, statusTone, codeLabel, sentenceCase } from '@/features/platform/components/cannabis-ui';
import { formatMinorUnits } from '@/features/lib/money';
import { formatMicrounits } from '@/features/lib/quantity';
import { getCartPreparation, getPreparationOutcome, prepareCart } from '../actions/preparation';
import type { PreparationDetail } from '../types';
import { formatInstant } from '@/features/platform/lib/time';
import { AllocationQuotePanel, type QuoteProduct } from './AllocationQuotePanel';
import { intentSlot, parsePreparationIntents, preparationIntentForm, preparationKey, PREPARATION_INTENTS_KEY, REASON_CODE_HTML_PATTERN, removePreparationIntent, storePreparationIntent, type PreparationIntent } from '../preparationIntent';

const actions: Record<string, Array<{ status: string; label: string }>> = {
  reserved: [{ status: 'picking', label: 'Start picking' }],
  picking: [{ status: 'staged', label: 'Mark staged' }, { status: 'reserved', label: 'Return to reserved' }],
  staged: [{ status: 'picking', label: 'Reopen picking' }],
};

const INTENT_CHANGE = 'cannabis-preparation-intent-change';
function subscribeIntent(listener: () => void) {
  window.addEventListener('storage', listener); window.addEventListener(INTENT_CHANGE, listener);
  return () => { window.removeEventListener('storage', listener); window.removeEventListener(INTENT_CHANGE, listener); };
}
function readJournal() {
  try { return sessionStorage.getItem(PREPARATION_INTENTS_KEY) ?? ''; }
  catch { return '@unavailable'; }
}
function notify() { window.dispatchEvent(new Event(INTENT_CHANGE)); }

const readable = (value: string | null | undefined) => (value || '').replaceAll('_', ' ');

export function CartPreparationClient({ carts, authorityFingerprint, products, productsHasMore, currencyCode, timezone }: {
  carts: Array<{ id: string; reference: string }>; authorityFingerprint: string; products: QuoteProduct[]; productsHasMore: boolean; currencyCode: string | null; timezone: string | null;
}) {
  const [detail, setDetail] = useState<PreparationDetail | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const [observedAt, setObservedAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const selection = useRef(0);
  const journalText = useSyncExternalStore(subscribeIntent, readJournal, () => '@server');
  const storageReady = journalText !== '@server' && journalText !== '@unavailable';
  const journal = storageReady ? parsePreparationIntents(journalText || null) : undefined;
  const currentAuthority = useRef(authorityFingerprint);
  useEffect(() => { currentAuthority.current = authorityFingerprint; selection.current++; }, [authorityFingerprint]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 15_000); return () => window.clearInterval(timer); }, []);

  // Only this principal's intents are shown; other accounts' entries stay untouched in storage.
  const ownIntents = journal ? Object.values(journal).filter(intent => intent.authorityFingerprint === authorityFingerprint) : [];
  const saved = detail ? journal?.[intentSlot(authorityFingerprint, detail.id)] : undefined;
  const money = (cents: number) => formatMinorUnits(cents, currencyCode);

  function load(cartId: string) {
    const request = ++selection.current;
    setSelectedId(cartId); setDetail(null); setMessage(''); setLoadFailed(false);
    if (!cartId) return;
    startTransition(async () => {
      try {
        const result = await getCartPreparation(cartId);
        if (request !== selection.current) return;
        if ('error' in result) { setMessage(result.error); setLoadFailed(true); }
        else { setDetail(result.data); setObservedAt(Date.now()); setNow(Date.now()); }
      } catch {
        if (request !== selection.current) return;
        setMessage('Cart details are unavailable.'); setLoadFailed(true);
      }
    });
  }
  function persist(intent: PreparationIntent) { storePreparationIntent(sessionStorage, intent); notify(); }
  function dispatch(intent: PreparationIntent) {
    if (intent.authorityFingerprint !== authorityFingerprint) return;
    const request = selection.current;
    startTransition(async () => {
      try {
        const result = await prepareCart(preparationIntentForm(intent));
        if (request !== selection.current || intent.authorityFingerprint !== currentAuthority.current) return;
        setMessage('error' in result ? result.error : result.success);
        if (!('error' in result)) {
          persist({ ...intent, state: 'acknowledged' });
          const refreshed = await getCartPreparation(intent.input.cartId);
          if (request !== selection.current) return;
          if ('data' in refreshed) { setDetail(refreshed.data); setObservedAt(Date.now()); setNow(Date.now()); }
          else { setDetail(null); setLoadFailed(true); setMessage('Step recorded, but the cart could not be reloaded.'); }
        }
      } catch { setMessage('The step could not be confirmed. Check the recorded outcome before retrying.'); }
    });
  }
  function checkOutcome(intent: PreparationIntent) {
    startTransition(async () => {
      try {
        const outcome = await getPreparationOutcome(intent.input.idempotencyKey);
        if (outcome.state === 'succeeded') { persist({ ...intent, state: 'acknowledged' }); setMessage('This step was recorded.'); if (detail?.id === intent.input.cartId) load(intent.input.cartId); }
        else if (outcome.state === 'not_found') setMessage('No record of this step was found. You can retry it.');
        else if (outcome.state === 'processing') setMessage('This step is still being recorded. Check again shortly.');
        else if (outcome.state === 'failed') setMessage('This step failed and needs review.');
        else setMessage('The recorded outcome is unavailable right now.');
      } catch { setMessage('The recorded outcome is unavailable right now.'); }
    });
  }
  function submit(formData: FormData) {
    if (!detail || !storageReady || !journal || (saved && saved.state === 'pending') || detail.authorityFingerprint !== authorityFingerprint) return;
    const cartId = String(formData.get('cartId')); const expectedVersion = Number(formData.get('expectedVersion')); const nextStatus = String(formData.get('nextStatus'));
    const intent: PreparationIntent = { authorityFingerprint, state: 'pending', input: {
      cartId, expectedVersion, nextStatus, reasonCode: String(formData.get('reasonCode') || '').trim(), idempotencyKey: preparationKey(cartId, expectedVersion, nextStatus) } };
    try { persist(intent); dispatch(intent); }
    catch { setMessage('This step could not be saved on this device, so it was not sent.'); }
  }
  function dismiss(intent: PreparationIntent) {
    if (intent.authorityFingerprint !== authorityFingerprint || intent.state !== 'acknowledged') return;
    try { removePreparationIntent(sessionStorage, intent); notify(); }
    catch { setMessage('Could not dismiss this command.'); }
  }

  // The backend rechecks expiry on every step; this only keeps controls honest while the page is open.
  const expired = detail ? !(new Date(detail.expiresAt).getTime() > now) : true;
  const cartLabel = (cartId: string) => carts.find(cart => cart.id === cartId)?.reference || detail?.reference || 'Cart';
  return <Panel data-testid="cart-preparation-workbench" title="Cart preparation" meta="Reservation kept · not a sale">
    <div className="space-y-5">
      <label className={labelClass}>Cart
        <select className={inputClass} value={selectedId} disabled={pending || !carts.length} onChange={event => load(event.target.value)}>
          <option value="" disabled>Select a cart</option>
          {carts.map(cart => <option key={cart.id} value={cart.id}>{cart.reference}</option>)}
        </select>
      </label>
      {pending && <p role="status" className="flex items-baseline gap-2 text-sm text-muted-foreground"><Dot tone="info" />Loading…</p>}
      {journalText === '@unavailable' && <p role="status" className="flex items-baseline gap-2 text-sm"><Dot tone="warn" />This browser can’t save commands; preparation steps unavailable.</p>}
      {storageReady && !journal && <p role="status" className="flex items-baseline gap-2 text-sm"><Dot tone="warn" />Saved commands on this device couldn’t be read; preparation steps unavailable.</p>}
      {message && <p role="status" className="rounded-[5px] border border-border bg-muted/20 px-3 py-2.5 text-sm">{message}</p>}
      {loadFailed && selectedId && <Actions><Button type="button" disabled={pending} onClick={() => load(selectedId)}>Retry</Button></Actions>}
      {ownIntents.length > 0 && <section className="space-y-2 rounded-[5px] border border-border bg-muted/20 p-3" aria-label="Saved commands">
        <h3 className="text-xs font-semibold text-foreground">Saved commands</h3>
        <ul className="space-y-2">{ownIntents.map(intent => <li key={intentSlot(intent.authorityFingerprint, intent.input.cartId)} className="flex flex-wrap items-center gap-2 text-sm">
          <DotLabel tone={intent.state === 'pending' ? 'warn' : 'ok'} className="min-w-0 flex-1"><span className="font-mono">{cartLabel(intent.input.cartId)}</span> · {readable(intent.input.nextStatus)} · v{intent.input.expectedVersion} · {intent.state === 'pending' ? 'outcome not confirmed' : 'recorded'}</DotLabel>
          {intent.state === 'pending' ? <>
            <Actions><Button type="button" disabled={pending} onClick={() => checkOutcome(intent)}>Check recorded outcome</Button><Button type="button" tone="primary" disabled={pending} onClick={() => dispatch(intent)}>Retry this step</Button></Actions>
          </> : <Actions><Button type="button" disabled={pending} onClick={() => dismiss(intent)}>Dismiss</Button></Actions>}
        </li>)}</ul>
      </section>}
      {detail && detail.authorityFingerprint === authorityFingerprint && <div className="space-y-4">
        <AllocationQuotePanel timezone={timezone} key={`${authorityFingerprint}:${detail.id}`} cartId={detail.id} products={products} productsHasMore={productsHasMore} />
        <div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><span className="font-mono text-base font-semibold">{detail.reference}</span><DotLabel tone={statusTone(detail.status)} className="text-xs text-muted-foreground">{sentenceCase(detail.status)}</DotLabel><span className="ml-auto font-mono text-sm">{money(detail.totalCents)}</span></div>
          <p className="mt-0.5 text-xs text-muted-foreground">v{detail.version} · loaded {formatInstant(new Date(observedAt).toISOString(), timezone)} · reservation expires {formatInstant(detail.expiresAt, timezone)}</p>
        </div>
        <ul className="divide-y divide-border overflow-hidden rounded-[5px] border border-border bg-muted/20">{detail.lines.map(line => <li key={line.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3 py-2.5 text-sm"><div className="min-w-0"><p className="font-medium">{line.titleSnapshot}</p><p className="break-all font-mono text-xs text-muted-foreground">{line.packageUidSnapshot}</p></div><p className="tabular-nums text-xs">{formatMicrounits(line.quantityMicrounits)} · {money(line.totalCents)}</p></li>)}</ul>
        {detail.linesHasMore && <p role="status" className="flex items-baseline gap-2 text-sm"><Dot tone="warn" />Too many lines to show; preparation steps unavailable.</p>}
        {expired && <p role="status" className="flex items-baseline gap-2 text-sm"><Dot tone="danger" />Reservation expired</p>}
        {saved?.state === 'pending' && <p role="status" className="flex items-baseline gap-2 text-sm"><Dot tone="warn" />A step for this cart is not confirmed. Resolve it under Saved commands.</p>}
        {!detail.linesHasMore && !expired && journal && saved?.state !== 'pending' && actions[detail.status]?.map(action => <form key={`${detail.id}:${detail.version}:${action.status}`} onSubmit={event => { event.preventDefault(); submit(new FormData(event.currentTarget)); }} className="flex flex-col gap-3 rounded-[5px] border border-border bg-muted/20 p-3 sm:flex-row sm:items-end">
          <input type="hidden" name="cartId" value={detail.id} /><input type="hidden" name="expectedVersion" value={detail.version} /><input type="hidden" name="nextStatus" value={action.status} />
          <label className={`${labelClass} flex-1`}>Reason code
            <input name="reasonCode" required pattern={REASON_CODE_HTML_PATTERN} maxLength={100} disabled={pending} placeholder="picking_started" aria-describedby={`reason-help-${action.status}`} className={`${inputClass} font-mono`} />
            <span id={`reason-help-${action.status}`} className="mt-1 block font-normal text-muted-foreground">a–z, 0–9 and _ only</span>
          </label>
          <Actions><Button disabled={pending} type="submit" tone="primary">{action.label}</Button></Actions>
        </form>)}
        {!actions[detail.status] && <p className="text-sm text-muted-foreground">No preparation step is available for this cart status.</p>}
        <section aria-label="Allocation history"><h3 className="text-xs font-semibold text-foreground">Allocation history</h3>
          {detail.allocationHistory.length ? <ul className="mt-2 space-y-2 border-l border-border pl-3">{detail.allocationHistory.map(event => <li key={event.id} className="text-sm"><p>{event.evidenceState === 'recorded_fields' && event.quantityMicrounits != null && event.totalCents != null ? `${formatMicrounits(event.quantityMicrounits)} · ${money(event.totalCents)}` : 'Older allocation record; details not available'}</p><p className="text-xs text-muted-foreground">{event.actorName} · {formatInstant(event.occurredAt, timezone)}</p></li>)}</ul> : <p className="text-sm text-muted-foreground">No allocation records for these lines.</p>}
          {detail.allocationHistoryHasMore && <p className="text-xs text-muted-foreground">Showing the latest 20 allocation records.</p>}
        </section>
        <section aria-label="Preparation history"><h3 className="text-xs font-semibold text-foreground">Preparation history</h3>
          {detail.history.length ? <ul className="mt-2 space-y-2 border-l border-border pl-3">{detail.history.map(event => <li key={event.id} className="text-sm"><p >{sentenceCase(event.beforeStatus)} to {sentenceCase(event.status)} · {codeLabel(event.reasonCode)}</p><p className="text-xs text-muted-foreground">{event.actorName || 'Staff member'} · {formatInstant(event.occurredAt, timezone)}</p></li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">No preparation steps recorded.</p>}
          {detail.historyHasMore && <p className="mt-2 text-xs text-muted-foreground">Showing the latest 20 steps.</p>}
        </section>
      </div>}
      {!carts.length && <p className="text-sm text-muted-foreground">No carts are waiting for preparation.</p>}
    </div>
  </Panel>;
}
