import { sanitizeStoreLogoSvg } from '@/features/lib/sanitize-store-logo';
import { DEFAULT_STORE_LOGO_ICON, normalizeStoreLogoColor } from '@/features/lib/store-logo';

/** One allowlisted renderer for public header, mobile menu and footer. */
export function StoreLogo({ svg, hue, name, wrap = false }: { svg?: string; hue?: string; name: string; wrap?: boolean }) {
  const safe = sanitizeStoreLogoSvg(svg || '') || DEFAULT_STORE_LOGO_ICON;
  return <span className="inline-flex min-h-11 min-w-0 max-w-full items-center gap-3 font-semibold">
    <span aria-hidden="true" className="inline-flex size-9 shrink-0 items-center justify-center [&>svg]:block [&>svg]:size-full" style={{ filter: `hue-rotate(${normalizeStoreLogoColor(hue)}deg)` }} dangerouslySetInnerHTML={{ __html: safe }} />
    <span title={name} className={wrap ? 'min-w-0 break-words [overflow-wrap:anywhere]' : 'min-w-0 truncate'}>{name}</span>
  </span>;
}
