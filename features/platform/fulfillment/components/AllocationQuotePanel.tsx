'use client';
import { useState, useTransition } from 'react';
import { ActionTrack, inputClass, labelClass, PillButton } from '@/features/platform/components/cannabis-ui';
import { formatMinorUnits } from '@/features/lib/money';
import { formatMicrounits, parseQuantityToMicrounits } from '@/features/lib/quantity';
import { formatInstant } from '@/features/platform/lib/time';
import { getAllocationQuote, type AllocationQuoteReadback } from '../actions/allocationQuote';

export type QuoteProduct = { id: string; name: string; sku: string; form: string; unitOfMeasure: string; unitQuantityMicrounits: number };

export function AllocationQuotePanel({ cartId, products, productsHasMore, timezone }: { cartId: string; products: QuoteProduct[]; productsHasMore: boolean; timezone: string | null }) {
  const [quote, setQuote] = useState<AllocationQuoteReadback | null>(null);
  const [message, setMessage] = useState('');
  const [productId, setProductId] = useState(products[0]?.id || '');
  const [pending, startTransition] = useTransition();
  const product = products.find(entry => entry.id === productId);
  function load(form: FormData) {
    setQuote(null); setMessage('');
    if (!product) { setMessage('Select a product.'); return; }
    const micro = parseQuantityToMicrounits(String(form.get('quantity') || ''));
    if (!micro) { setMessage(`Enter a positive quantity in ${product.unitOfMeasure} (up to 6 decimal places).`); return; }
    if (!Number.isSafeInteger(product.unitQuantityMicrounits) || product.unitQuantityMicrounits < 1 || micro % product.unitQuantityMicrounits !== 0) {
      setMessage(`Quantity must be a whole number of ${formatMicrounits(product.unitQuantityMicrounits, product.unitOfMeasure)} units.`); return;
    }
    form.set('quantityMicrounits', String(micro));
    startTransition(async () => {
      try {
        const result = await getAllocationQuote(form);
        if ('data' in result) setQuote(result.data);
        else setMessage(result.error);
      } catch { setMessage('Quote is unavailable. Nothing was reserved.'); }
    });
  }
  const money = (cents: number) => formatMinorUnits(cents, quote?.currencyCode);
  return <section className="space-y-3 rounded-lg bg-muted/40 p-3 ring-1 ring-inset ring-border/60" aria-label="Price quote">
    <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Price quote</h4>
    {productsHasMore && <p className="text-xs text-muted-foreground">First 100 active products shown</p>}
    {!products.length ? <p className="text-sm text-muted-foreground">No active products.</p> : <form action={load} className="grid gap-3 sm:grid-cols-2" onChange={() => setQuote(null)}>
      <input type="hidden" name="cartId" value={cartId} />
      <label className={`${labelClass} sm:col-span-2`}>Product<select name="productId" required disabled={pending} value={productId} onChange={event => setProductId(event.target.value)} className={inputClass}>{products.map(entry => <option key={entry.id} value={entry.id}>{entry.name} · {entry.sku} · {entry.form} ({entry.unitOfMeasure})</option>)}</select></label>
      <label className={labelClass}>Quantity{product ? ` (${product.unitOfMeasure})` : ''}<input name="quantity" inputMode="decimal" required disabled={pending} placeholder={product ? formatMicrounits(product.unitQuantityMicrounits) : ''} className={`${inputClass} font-mono`} /></label>
      <label className={labelClass}>Promotion code (optional)<input name="promotionCode" maxLength={100} disabled={pending} className={inputClass} /></label>
      <div className="sm:col-span-2"><ActionTrack><PillButton type="submit" disabled={pending} tone="ink">{pending ? 'Getting quote…' : 'Get quote'}</PillButton></ActionTrack></div>
    </form>}
    {product && <p className="text-xs text-muted-foreground">Increment <span className="font-mono">{formatMicrounits(product.unitQuantityMicrounits, product.unitOfMeasure)}</span></p>}
    {message && <p role="status" className="text-sm">{message}</p>}
    {quote && <div className="space-y-2 text-sm">
      <p className="text-xs text-muted-foreground"><span className="font-mono text-foreground">{formatMicrounits(quote.quantityMicrounits, quote.unitOfMeasure)}</span> · package <span className="font-mono">{quote.packageId}</span> · policy <span className="font-mono">{quote.rulePackVersion}</span></p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 rounded-lg bg-background p-3 font-mono text-sm shadow-xs sm:max-w-sm [&_dt]:font-sans [&_dd]:text-right">
        <dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{money(quote.subtotalCents)}</dd>
        <dt className="text-muted-foreground">Discount</dt><dd className="tabular-nums">{money(quote.discountCents)}</dd>
        <dt className="text-muted-foreground">Tax</dt><dd className="tabular-nums">{money(quote.taxCents)}</dd>
        <dt className="font-medium">Total</dt><dd className="font-medium tabular-nums">{money(quote.totalCents)}</dd>
      </dl>
      <p className="text-xs text-muted-foreground">Quoted {formatInstant(quote.observedAt, timezone)} · cart expires {formatInstant(quote.cartExpiresAt, timezone)} · cart version {quote.cartVersion}</p>
      <p className="text-muted-foreground">{quote.reservationReadiness}</p>
      {quote.packagesHasMore && <p className="text-xs text-muted-foreground">More packages exist than were checked for this quote.</p>}
      <details className="text-xs text-muted-foreground"><summary>Stored quantity</summary>{quote.quantityMicrounits.toLocaleString()} microunits of {quote.unitOfMeasure}</details>
    </div>}
  </section>;
}
