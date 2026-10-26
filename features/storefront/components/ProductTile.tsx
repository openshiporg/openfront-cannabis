import Link from 'next/link';
import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { formatPrice } from '../lib/format';
import { chapterInk } from '../lib/chapters';

export type TileProduct = {
  id: string; name: string; form: string; priceCents?: number; imageUrl?: string | null; description?: string | null;
  adultUseEligible?: boolean; medicalEligible?: boolean; demo?: boolean;
};

export const channelLabel = (product: TileProduct) => [product.adultUseEligible && 'Adult-use', product.medicalEligible && 'Medical'].filter(Boolean).join(' · ');

/** One catalog entry: name and price on one baseline, a spec line, the description's first lines. */
export function CatalogEntry({ product, currencyCode, showChannel = true }: { product: TileProduct; currencyCode?: string | null; showChannel?: boolean }) {
  const channel = showChannel ? channelLabel(product) : '';
  return <Link href={`/menu/${encodeURIComponent(product.id)}`} style={{ '--chapter': chapterInk(product.form) } as CSSProperties}
    className="cn-entry group flex min-w-0 gap-4 py-4 transition-transform duration-150 active:scale-[0.995] sm:py-5">
    {product.imageUrl && <span className="block size-[72px] shrink-0 overflow-hidden rounded-[3px] bg-cn-raise sm:size-[88px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={product.imageUrl} alt="" loading="lazy" className="size-full object-cover" />
    </span>}
    <span className="block min-w-0 flex-1">
      <span className="flex items-baseline justify-between gap-4">
        <span className="cn-name cn-entry-name min-w-0 break-words text-[22px] leading-[26px] text-cn-ink sm:text-[24px] sm:leading-[28px]">{product.name}</span>
        {product.priceCents != null
          ? <span className="cn-display cn-num shrink-0 text-[24px] text-cn-ink sm:text-[26px]">{formatPrice(product.priceCents, currencyCode)}</span>
          : <span className="shrink-0 text-[14px] font-semibold text-cn-warn">Sample</span>}
      </span>
      <span className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[14px] text-cn-ink-2">
        <span>{product.form}</span>
        {channel && <span>{channel}</span>}
        <span className="text-cn-ink-3">{product.demo ? 'Not for sale' : 'In store'}</span>
      </span>
      {product.description && <span className="mt-1.5 line-clamp-2 block max-w-[60ch] text-[15px] leading-[22px] text-cn-ink-3">{product.description}</span>}
    </span>
  </Link>;
}

/** The item's plate: its photo when there is one, otherwise the chapter's ink with the form and name printed on it. */
export function ProductPlate({ product, className }: { product: TileProduct; className?: string }) {
  if (product.imageUrl) {
    return <div className={cn('aspect-[4/5] w-full overflow-hidden rounded-[4px] bg-cn-raise', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={product.imageUrl} alt="" className="size-full object-cover" loading="eager" />
    </div>;
  }
  return <div aria-hidden="true" style={{ background: chapterInk(product.form) }} className={cn('flex aspect-[4/3] w-full flex-col justify-between overflow-hidden rounded-[4px] p-5 text-cn-on-ink sm:p-8 lg:aspect-[4/5]', className)}>
    <span className="flex items-baseline justify-between gap-3 text-[15px] font-semibold"><span>{product.form}</span>{product.demo && <span>Sample</span>}</span>
    <span className="cn-display break-words text-[56px] [text-wrap:balance] sm:text-[88px] lg:text-[104px]">{product.name}</span>
  </div>;
}
