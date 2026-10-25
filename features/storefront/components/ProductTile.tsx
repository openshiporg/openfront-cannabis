import Link from 'next/link';
import { cn } from '@/lib/utils';
import { formatPrice } from '../lib/format';

export type TileProduct = {
  id: string; name: string; form: string; priceCents?: number; imageUrl?: string | null;
  adultUseEligible?: boolean; medicalEligible?: boolean; demo?: boolean;
};

/** Product art: a paper leaf holding the photo when there is one, otherwise the item's initial printed on it from real fields only. */
export function ProductArt({ product, currencyCode, large = false }: { product: TileProduct; currencyCode?: string | null; large?: boolean }) {
  if (product.imageUrl) {
    return <div className="cn-leaf aspect-[4/5] w-full p-[8%] pt-[12%]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={product.imageUrl} alt="" className="size-full rounded-[2px] object-cover" loading={large ? 'eager' : 'lazy'} />
    </div>;
  }
  const initial = product.name.replace(/^Fictional\s+/, '').trim().charAt(0).toUpperCase() || '·';
  return <div aria-hidden="true" className={cn('cn-leaf flex aspect-[4/5] w-full flex-col justify-between overflow-hidden p-4 pt-6 text-cn-ink', large && 'p-6 pt-9 sm:p-9 sm:pt-12')}>
    <div className="flex items-start justify-between gap-2">
      <span className={cn('truncate font-semibold text-cn-ink-2', large ? 'text-[16px]' : 'text-[13px]')}>{product.form}</span>
      {product.demo && <span className="shrink-0 text-[13px] font-semibold text-cn-warn">Sample</span>}
    </div>
    <span className={cn('cn-display self-start leading-[0.8]', large ? 'text-[180px] sm:text-[240px]' : 'text-[96px] sm:text-[120px]')}>{initial}</span>
    <div className="flex items-end justify-between gap-2">
      <span className={cn('text-cn-ink-2', large ? 'text-[15px]' : 'text-[13px]')}>{[product.adultUseEligible && 'Adult-use', product.medicalEligible && 'Medical'].filter(Boolean).join(' · ') || (product.demo ? 'Not for sale' : '')}</span>
      {product.priceCents != null && <span className={cn('cn-num font-semibold', large ? 'text-[17px]' : 'text-[14px]')}>{formatPrice(product.priceCents, currencyCode)}</span>}
    </div>
  </div>;
}

export function ProductTile({ product, currencyCode }: { product: TileProduct; currencyCode?: string | null }) {
  return <Link href={`/menu/${encodeURIComponent(product.id)}`} className="group block min-w-0 rounded-[2px] transition-transform duration-150 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cn-ink">
    <ProductArt product={product} currencyCode={currencyCode} />
    <div className="mt-3 flex items-baseline justify-between gap-3">
      <h3 className="cn-display min-w-0 break-words text-[18px] leading-[23px] text-cn-ink sm:text-[20px] sm:leading-[25px]">{product.name}</h3>
    </div>
    <div className="mt-1 flex items-baseline justify-between gap-3 text-[14px]">
      <span className="truncate text-cn-ink-2">{product.form}</span>
      {product.priceCents != null ? <span className="cn-num shrink-0 font-semibold text-cn-ink">{formatPrice(product.priceCents, currencyCode)}</span> : <span className="shrink-0 text-cn-ink-3">Not for sale</span>}
    </div>
  </Link>;
}
