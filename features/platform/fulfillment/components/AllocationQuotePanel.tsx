'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatMinorUnits } from '@/features/lib/money';
import { formatMicrounits, parseQuantityToMicrounits } from '@/features/lib/quantity';
import { getAllocationQuote, type AllocationQuoteReadback } from '../actions/allocationQuote';

export type QuoteProduct = { id: string; name: string; sku: string; form: string; unitOfMeasure: string; unitQuantityMicrounits: number };

export function AllocationQuotePanel({ cartId, products, productsHasMore }: { cartId: string; products: QuoteProduct[]; productsHasMore: boolean }) {
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
  return <section className="space-y-3 rounded-md border p-3" aria-label="Price quote">
    <h4 className="font-medium">Price quote</h4>
    {productsHasMore && <p className="text-sm text-muted-foreground">Showing the first 100 active products.</p>}
    {!products.length ? <p className="text-sm text-muted-foreground">No active products.</p> : <form action={load} className="flex flex-wrap items-end gap-2" onChange={() => setQuote(null)}>
      <input type="hidden" name="cartId" value={cartId} />
      <label className="space-y-1 text-sm">Product<select name="productId" required disabled={pending} value={productId} onChange={event => setProductId(event.target.value)} className="block h-10 max-w-full rounded-md border bg-background px-3">{products.map(entry => <option key={entry.id} value={entry.id}>{entry.name} · {entry.sku} · {entry.form} ({entry.unitOfMeasure})</option>)}</select></label>
      <label className="space-y-1 text-sm">Quantity{product ? ` (${product.unitOfMeasure})` : ''}<Input name="quantity" inputMode="decimal" required disabled={pending} placeholder={product ? formatMicrounits(product.unitQuantityMicrounits) : ''} /></label>
      <label className="space-y-1 text-sm">Promotion code (optional)<Input name="promotionCode" maxLength={100} disabled={pending} /></label>
      <Button type="submit" disabled={pending}>{pending ? 'Getting quote…' : 'Get quote'}</Button>
    </form>}
    {product && <p className="text-xs text-muted-foreground">Sold in units of {formatMicrounits(product.unitQuantityMicrounits, product.unitOfMeasure)}.</p>}
    {message && <p role="status" className="text-sm">{message}</p>}
    {quote && <div className="space-y-2 text-sm">
      <p>{formatMicrounits(quote.quantityMicrounits, quote.unitOfMeasure)} · package {quote.packageId} · policy {quote.rulePackVersion}</p>
      <dl className="grid grid-cols-2 gap-1 sm:max-w-sm">
        <dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{money(quote.subtotalCents)}</dd>
        <dt className="text-muted-foreground">Discount</dt><dd className="tabular-nums">{money(quote.discountCents)}</dd>
        <dt className="text-muted-foreground">Tax</dt><dd className="tabular-nums">{money(quote.taxCents)}</dd>
        <dt className="font-medium">Total</dt><dd className="font-medium tabular-nums">{money(quote.totalCents)}</dd>
      </dl>
      <p className="text-xs text-muted-foreground">Quoted {new Date(quote.observedAt).toLocaleString()} · cart expires {new Date(quote.cartExpiresAt).toLocaleString()} · cart version {quote.cartVersion}</p>
      <p className="text-muted-foreground">{quote.reservationReadiness}</p>
      {quote.packagesHasMore && <p className="text-xs text-muted-foreground">More packages exist than were checked for this quote.</p>}
      <details className="text-xs text-muted-foreground"><summary>Stored quantity</summary>{quote.quantityMicrounits.toLocaleString()} microunits of {quote.unitOfMeasure}</details>
    </div>}
  </section>;
}
