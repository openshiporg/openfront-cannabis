'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useBag } from '../lib/bag';

/** Add to bag on a product page; once added the shopper can go straight to checkout. */
export function AddToBag({ product }: { product: { id: string; name: string; priceCents: number } }) {
  const bag = useBag();
  const [units, setUnits] = useState(1);
  const [added, setAdded] = useState(false);
  return <div className="mt-8 space-y-3">
    <div className="flex flex-wrap items-center gap-3">
      <div role="group" aria-label="Quantity" className="inline-flex h-12 items-center rounded-[4px] border border-cn-line">
        <button type="button" aria-label="Fewer" onClick={() => setUnits(value => Math.max(1, value - 1))} className="size-12 text-[20px]">−</button>
        <span className="cn-num w-8 text-center text-[17px]" aria-live="polite">{units}</span>
        <button type="button" aria-label="More" onClick={() => setUnits(value => Math.min(20, value + 1))} className="size-12 text-[20px]">+</button>
      </div>
      <button type="button" data-tone="ink" className="cn-btn min-h-12" onClick={() => { bag.add(product, units); setAdded(true); }}>{added ? 'Added to bag' : 'Add to bag'}</button>
      {bag.count > 0 && <Link href="/bag" className="cn-btn min-h-12">Order for pickup · {bag.count}</Link>}
    </div>
    <p className="text-[14px] text-cn-ink-3">Reserve now, pay by card or at the counter. Bring a valid ID to pick up.</p>
  </div>;
}
