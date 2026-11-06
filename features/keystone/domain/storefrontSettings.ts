import { sanitizeStoreLogoSvg } from '../../lib/sanitize-store-logo.ts';
import { DEFAULT_STORE_LOGO_COLOR, DEFAULT_STORE_LOGO_ICON, normalizeStoreLogoColor } from '../../lib/store-logo.ts';

export const NEUTRAL_STOREFRONT_HUE = 215;

export type PublicStorefrontSettings = {
  businessName: string | null;
  tagline: string | null;
  description: string | null;
  brandHue: number;
  logoIcon?: string;
  logoColor?: string;
  mode: "neutral" | "configured";
  isConfigured: boolean;
};

export const NEUTRAL_STOREFRONT_SETTINGS: PublicStorefrontSettings = Object.freeze({
  businessName: null,
  tagline: null,
  description: null,
  brandHue: NEUTRAL_STOREFRONT_HUE,
  logoIcon: DEFAULT_STORE_LOGO_ICON,
  logoColor: DEFAULT_STORE_LOGO_COLOR,
  mode: "neutral",
  isConfigured: false,
});

function requiredPublicText(value: unknown, label: string, max: number) {
  if (typeof value !== "string") throw new Error(`${label} must be text`);
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new Error(`${label} must contain 1-${max} characters`);
  return normalized;
}

function optionalPublicText(value: unknown, label: string, max: number) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new Error(`${label} must be text`);
  const normalized = value.trim();
  if (normalized.length > max) throw new Error(`${label} must contain at most ${max} characters`);
  return normalized || null;
}

export function assertStorefrontHue(value: unknown) {
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 359) {
    throw new Error("Brand hue must be an integer between 0 and 359");
  }
  return value as number;
}

export function normalizeStorefrontSettingsInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Storefront settings input is required");
  const values = input as Record<string, unknown>;
  return {
    businessName: requiredPublicText(values.businessName, "Business name", 120),
    tagline: optionalPublicText(values.tagline, "Tagline", 180),
    description: optionalPublicText(values.description, "Description", 240),
    brandHue: assertStorefrontHue(values.brandHue),
  };
}

export function normalizeLogoSettings(input: { logoIcon?: unknown; logoColor?: unknown }) {
  const value = input.logoIcon;
  const logoIcon = value === undefined ? DEFAULT_STORE_LOGO_ICON : typeof value === 'string' ? sanitizeStoreLogoSvg(value) : '';
  if (value !== undefined && !logoIcon) throw new Error('Logo must be a valid, safe SVG document');
  return { logoIcon, logoColor: normalizeStoreLogoColor(input.logoColor) };
}

/** Allowlist and re-derive all control flags before mock catalog data reaches the public UI. */
/** Re-project only published persisted values so malformed, draft, or legacy rows stay neutral. */
export function projectPublicStorefrontSettings(value: unknown): PublicStorefrontSettings {
  try {
    if (!value || typeof value !== "object" || (value as Record<string, unknown>).publicationStatus !== "published") {
      return { ...NEUTRAL_STOREFRONT_SETTINGS };
    }
    const mode = (value as Record<string, unknown>).storefrontMode;
    if (mode !== "configured") return { ...NEUTRAL_STOREFRONT_SETTINGS };
    const settings = normalizeStorefrontSettingsInput(value);
    const row = value as Record<string, unknown>;
    return { ...settings, logoIcon: sanitizeStoreLogoSvg(String(row.logoIcon || '')) || DEFAULT_STORE_LOGO_ICON,
      logoColor: normalizeStoreLogoColor(row.logoColor), mode: "configured", isConfigured: true };
  } catch {
    return { ...NEUTRAL_STOREFRONT_SETTINGS };
  }
}
