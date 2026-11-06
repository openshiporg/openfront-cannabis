import { DEFAULT_STORE_LOGO_COLOR, DEFAULT_STORE_LOGO_ICON, normalizeStoreLogoColor } from '@/features/lib/store-logo';

// Untitled UI marks are drawn in #155eef (hue 221) and tinted with hue-rotate.
const REGISTRY_BASE_HUE = 221;

// Cannabis default mark: "Pollinate" from the Untitled UI logo picker, in green (hue 270), as set in
// platform/store-settings/lib/store-logo.ts. Every mark comes from that registry.
export const CANNABIS_LOGO_ICON = DEFAULT_STORE_LOGO_ICON;
export const CANNABIS_LOGO_COLOR = DEFAULT_STORE_LOGO_COLOR;
export const CANNABIS_ACCENT_HUE = 152;

/** Marks retired on 2026-11-05: the family's Restaurant mark (the old column default) and the custom circle seed. */
export const RETIRED_STORE_LOGO_ICONS = ['<svg xmlns="http://www.w3.org/2000/svg" fill="none" height="100%" width="100%" viewBox="0 0 200 200"><g clip-path="url(#restaurant-logo-clip)"><path fill-rule="evenodd" clip-rule="evenodd" d="M107.143 0H92.8571V63.2531L69.1621 4.60582L55.9166 9.95735L80.2255 70.1239L34.3401 24.2385L24.2386 34.3401L68.2177 78.3191L11.2241 53.4181L5.50459 66.5089L65.8105 92.8571H0V107.143H65.8104L5.50461 133.491L11.2241 146.582L68.2176 121.681L24.2386 165.66L34.3401 175.761L80.2255 129.876L55.9166 190.043L69.1621 195.394L92.8571 136.747V200H107.143V136.747L130.838 195.394L144.083 190.043L119.775 129.876L165.66 175.761L175.761 165.66L131.782 121.681L188.776 146.582L194.495 133.491L134.19 107.143H200V92.8571H134.189L194.495 66.5089L188.776 53.4181L131.782 78.3191L175.761 34.34L165.66 24.2385L119.775 70.1238L144.083 9.95735L130.838 4.60582L107.143 63.2531V0Z" fill="url(#restaurant-logo-gradient)"/></g><defs><linearGradient id="restaurant-logo-gradient" x1="14" y1="26" x2="179" y2="179.5" gradientUnits="userSpaceOnUse"><stop stop-color="#5c6bc0"/><stop offset="1" stop-color="#4f39f6"/></linearGradient><clipPath id="restaurant-logo-clip"><rect width="200" height="200" fill="white"/></clipPath></defs></svg>', '<svg xmlns="http://www.w3.org/2000/svg" fill="none" height="100%" width="100%" viewBox="0 0 200 200"><circle cx="100" cy="100" r="96" fill="#1f5130"/><path d="M100 34c-9 22-30 40-30 70 0 18 13 32 30 36 17-4 30-18 30-36 0-30-21-48-30-70Z" fill="#8fd19e"/><path d="M97 92h6v74h-6z" fill="#1f5130"/><path d="M100 120c-14-6-30-6-46 4 12 10 30 12 46 4m0-8c14-6 30-6 46 4-12 10-30 12-46 4" fill="#5fb878"/></svg>'];

type BrandSource = { logoIcon?: string | null; logoColor?: string | null; brandHue?: number | null; isConfigured?: boolean } | null | undefined;

/** An empty value or a retired mark means "no mark chosen yet": the registry default shows. */
export function isDefaultMark(svg?: string | null) {
  return !svg || RETIRED_STORE_LOGO_ICONS.includes(svg);
}

export function storeBrand(store: BrandSource) {
  // The saved icon is always shown, with the saved hue. An empty (or never-chosen platform placeholder) value renders the Cannabis default icon.
  const retired = isDefaultMark(store?.logoIcon);
  const logoSvg = retired ? CANNABIS_LOGO_ICON : store!.logoIcon!;
  const logoColor = retired ? CANNABIS_LOGO_COLOR : normalizeStoreLogoColor(store?.logoColor);
  const hue = store?.isConfigured && Number.isInteger(store.brandHue) ? store.brandHue! : CANNABIS_ACCENT_HUE;
  return { logoSvg, logoColor, hue, logoHue: (REGISTRY_BASE_HUE + Number(logoColor)) % 360 };
}
