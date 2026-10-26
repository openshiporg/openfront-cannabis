import { LOGO_ICONS } from '@/features/platform/store-settings/lib/untitled-logo-registry';
import { DEFAULT_STORE_LOGO_ICON, normalizeStoreLogoColor } from '@/features/lib/store-logo';

// Untitled UI marks are drawn in #155eef (hue 221) and tinted with hue-rotate.
const REGISTRY_BASE_HUE = 221;

// Cannabis default mark: Luminous from the Untitled UI registry (three leaf-like blades, no circle),
// filled with one white-to-grey gradient and drawn without a tile behind it. Neutral, so the
// logo-colour rotation leaves it unchanged.
export const CANNABIS_LOGO_ICON_ID = 'luminous';
export const CANNABIS_LOGO_COLOR = '0';
export const CANNABIS_ACCENT_HUE = 152;
const LUMINOUS = LOGO_ICONS.find(icon => icon.id === CANNABIS_LOGO_ICON_ID)?.darkSvg ?? LOGO_ICONS[0].darkSvg;
export const CANNABIS_LOGO_ICON = LUMINOUS
  .replace('<g fill="#fff">', '<defs><linearGradient id="cn-mark-gradient" x1="4" y1="2" x2="38" y2="46" gradientUnits="userSpaceOnUse"><stop stop-color="#ffffff"/><stop offset="1" stop-color="#8f8f8f"/></linearGradient></defs><g fill="url(#cn-mark-gradient)">')
  .replace(' opacity=".5"', ' opacity=".62"')
  .replace(' opacity=".7"', ' opacity=".82"');

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
