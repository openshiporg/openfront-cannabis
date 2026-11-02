'use client';

import Link from 'next/link';
import { useBag } from '../lib/bag';

export function BagLink({ className }: { className?: string }) {
  const { count } = useBag();
  return <Link href="/bag" className={className ?? 'cn-tab'}>Bag{count > 0 && <span className="cn-num ml-1.5 rounded-full bg-cn-ink px-1.5 text-[12px] text-cn-on-ink">{count}</span>}</Link>;
}
