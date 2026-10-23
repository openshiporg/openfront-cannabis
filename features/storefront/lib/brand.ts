import { LOGO_ICONS } from '@/features/platform/store-settings/lib/untitled-logo-registry';
import { DEFAULT_STORE_LOGO_ICON, normalizeStoreLogoColor } from '@/features/lib/store-logo';

// Untitled UI marks are drawn in #155eef (hue 221) and tinted with hue-rotate.
const REGISTRY_BASE_HUE = 221;

// Cannabis default mark: Flora&Fauna from the Store Settings registry, rotated to resin green.
export const CANNABIS_LOGO_ICON_ID = 'flora-fauna';
export const CANNABIS_LOGO_COLOR = '291';
export const CANNABIS_ACCENT_HUE = 152;
export const CANNABIS_LOGO_ICON = LOGO_ICONS.find(icon => icon.id === CANNABIS_LOGO_ICON_ID)?.lightSvg ?? LOGO_ICONS[0].lightSvg;

type BrandSource = { logoIcon?: string | null; logoColor?: string | null; brandHue?: number | null; isConfigured?: boolean } | null | undefined;

/** The family's stored default (the Restaurant mark) and an empty value both mean "no mark chosen yet". */
export function isDefaultMark(svg?: string | null) {
  return !svg || svg === DEFAULT_STORE_LOGO_ICON;
}

export function storeBrand(store: BrandSource) {
  const chosen = !isDefaultMark(store?.logoIcon);
  const logoSvg = chosen ? store!.logoIcon! : CANNABIS_LOGO_ICON;
  const logoColor = chosen ? normalizeStoreLogoColor(store?.logoColor) : CANNABIS_LOGO_COLOR;
  const hue = store?.isConfigured && Number.isInteger(store.brandHue) ? store.brandHue! : CANNABIS_ACCENT_HUE;
  return { logoSvg, logoColor, hue, logoHue: (REGISTRY_BASE_HUE + Number(logoColor)) % 360 };
}
