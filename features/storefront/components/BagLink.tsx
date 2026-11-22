'use client';

import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { useBag } from '../lib/bag';

/** The bag, as a text tab (desktop), a row (phone menu) or an icon with its count (phone header). */
export function BagLink({ className, icon = false }: { className?: string; icon?: boolean }) {
  const { count } = useBag();
  if (icon) return <Link href="/bag" aria-label={count > 0 ? `Bag, ${count} ${count === 1 ? 'item' : 'items'}` : 'Bag'} className={className ?? 'cn-icon-btn relative'}>
    <ShoppingBag className="size-[22px]" aria-hidden="true" />
    {count > 0 && <span aria-hidden="true" className="cn-num absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-cn-ink px-1 text-[11px] font-bold leading-none text-cn-on-ink">{count}</span>}
  </Link>;
  return <Link href="/bag" className={className ?? 'cn-tab'}>Bag{count > 0 && <span className="cn-num ml-1.5 rounded-full bg-cn-ink px-1.5 text-[12px] text-cn-on-ink">{count}</span>}</Link>;
}
