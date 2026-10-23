import Link from 'next/link';
import { cn } from '@/lib/utils';
import { formatPrice } from '../lib/format';

export type TileProduct = {
  id: string; name: string; form: string; priceCents?: number; imageUrl?: string | null;
  adultUseEligible?: boolean; medicalEligible?: boolean; demo?: boolean;
};

/** Product art: the photo when there is one, otherwise a label tile built from real fields only. */
export function ProductArt({ product, currencyCode, large = false }: { product: TileProduct; currencyCode?: string | null; large?: boolean }) {
  if (product.imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={product.imageUrl} alt="" className="aspect-[4/5] w-full rounded-[18px] bg-cn-well object-cover" loading={large ? 'eager' : 'lazy'} />;
  }
  const initial = product.name.replace(/^Fictional\s+/, '').trim().charAt(0).toUpperCase() || '·';
  return <div aria-hidden="true" className={cn('relative flex aspect-[4/5] w-full flex-col justify-between overflow-hidden rounded-[18px] bg-cn-tint p-4 text-cn-accent', large && 'p-6 sm:p-8')}>
    <div className="flex items-start justify-between gap-2">
      <span className={cn('cn-num truncate uppercase tracking-[0.14em]', large ? 'text-[13px]' : 'text-[11px]')}>{product.form}</span>
      {product.demo && <span className="cn-num shrink-0 text-[11px] uppercase tracking-[0.14em]">Sample</span>}
    </div>
    <span className={cn('cn-display self-start leading-none', large ? 'text-[160px] sm:text-[200px]' : 'text-[88px] sm:text-[104px]')}>{initial}</span>
    <div className="flex items-end justify-between gap-2 border-t border-current/20 pt-2">
      <span className={cn('cn-num', large ? 'text-[13px]' : 'text-[11px]')}>{[product.adultUseEligible && 'ADULT-USE', product.medicalEligible && 'MEDICAL'].filter(Boolean).join(' · ') || (product.demo ? 'NOT FOR SALE' : '')}</span>
      {product.priceCents != null && <span className={cn('cn-num', large ? 'text-[15px]' : 'text-[12px]')}>{formatPrice(product.priceCents, currencyCode)}</span>}
    </div>
  </div>;
}

export function ProductTile({ product, currencyCode }: { product: TileProduct; currencyCode?: string | null }) {
  return <Link href={`/menu/${encodeURIComponent(product.id)}`} className="group block min-w-0 rounded-[20px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cn-accent">
    <div className="transition-transform duration-200 ease-out group-hover:-translate-y-0.5"><ProductArt product={product} currencyCode={currencyCode} /></div>
    <div className="mt-3 flex items-baseline justify-between gap-3">
      <h3 className="cn-display min-w-0 break-words text-[17px] leading-[22px] text-cn-ink sm:text-[19px] sm:leading-[24px]">{product.name}</h3>
    </div>
    <div className="mt-1 flex items-baseline justify-between gap-3 text-[13px]">
      <span className="truncate text-cn-ink-2">{product.form}</span>
      {product.priceCents != null ? <span className="cn-num shrink-0 text-cn-ink">{formatPrice(product.priceCents, currencyCode)}</span> : <span className="shrink-0 text-cn-ink-3">Not for sale</span>}
    </div>
  </Link>;
}
