import { sanitizeStoreLogoSvg } from '@/features/lib/sanitize-store-logo';
import { cn } from '@/lib/utils';
import { CANNABIS_LOGO_ICON, storeBrand } from '../lib/brand';

/** One allowlisted renderer for the public header, phone menu, footer and the Store Settings preview. */
export function StoreLogo({ svg, hue, name, wrap = false, size = 'md', className }: { svg?: string; hue?: string; name: string; wrap?: boolean; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const brand = storeBrand({ logoIcon: svg, logoColor: hue });
  const safe = sanitizeStoreLogoSvg(brand.logoSvg) || CANNABIS_LOGO_ICON;
  return <span className={cn('inline-flex min-h-11 min-w-0 max-w-full items-center gap-2.5', className)}>
    <span aria-hidden="true" className={cn('inline-flex shrink-0 items-center justify-center [&>svg]:block [&>svg]:size-full', size === 'sm' ? 'size-6' : size === 'lg' ? 'size-10' : 'size-8')} style={{ filter: `hue-rotate(${brand.logoColor}deg)` }} dangerouslySetInnerHTML={{ __html: safe }} />
    <span title={name} className={cn('min-w-0 font-[family-name:var(--font-cn-display)] font-medium tracking-[-0.015em]', size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-base' : 'text-[19px]', wrap ? 'break-words [overflow-wrap:anywhere]' : 'truncate')}>{name}</span>
  </span>;
}
