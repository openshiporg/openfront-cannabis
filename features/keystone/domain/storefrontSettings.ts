import { sanitizeStoreLogoSvg } from '../../lib/sanitize-store-logo.ts';
import { DEFAULT_STORE_LOGO_ICON, normalizeStoreLogoColor } from '../../lib/store-logo.ts';

export const NEUTRAL_STOREFRONT_HUE = 215;
export const DEMO_STOREFRONT_HUE = 148;
export const DEMO_STOREFRONT_TAGLINE = "Sample storefront — nothing here is for sale";
export const DEMO_STOREFRONT_DESCRIPTION = "Example menu items only. They can’t be reserved or ordered.";

const DEMO_CATALOG_BLUEPRINT = [
  { id: "demo-moonleaf-flower", name: "Fictional Moonleaf Flower", form: "Flower", categoryCode: "demo_flower", description: "Fictional demonstration item. No inventory, potency, eligibility, or availability is represented." },
  { id: "demo-citrus-drift-gummies", name: "Fictional Citrus Drift Gummies", form: "Edible", categoryCode: "demo_edible", description: "Fictional demonstration item. It cannot be reserved, ordered, purchased, or fulfilled." },
  { id: "demo-quiet-current-balm", name: "Fictional Quiet Current Balm", form: "Topical", categoryCode: "demo_topical", description: "Fictional demonstration item. No medical, therapeutic, package, or provider claim is made." },
] as const;

export type PublicDemoCatalogItem = {
  id: string;
  name: string;
  form: string;
  categoryCode: string;
  description: string;
  demoOnly: true;
  saleable: false;
  orderable: false;
};

export type PublicStorefrontSettings = {
  businessName: string | null;
  tagline: string | null;
  description: string | null;
  brandHue: number;
  logoIcon?: string;
  logoColor?: string;
  mode: "neutral" | "demo" | "configured";
  isConfigured: boolean;
};

export const NEUTRAL_STOREFRONT_SETTINGS: PublicStorefrontSettings = Object.freeze({
  businessName: null,
  tagline: null,
  description: null,
  brandHue: NEUTRAL_STOREFRONT_HUE,
  logoIcon: DEFAULT_STORE_LOGO_ICON,
  logoColor: '0',
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

export function demoCatalogSeed() {
  return DEMO_CATALOG_BLUEPRINT.map(item => ({ ...item, demoOnly: true, saleable: false, orderable: false }));
}

/** Allowlist and re-derive all control flags before mock catalog data reaches the public UI. */
export function projectPublicDemoCatalog(value: unknown): PublicDemoCatalogItem[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 6) return [];
  try {
    return value.map(entry => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("Invalid demo catalog entry");
      const item = entry as Record<string, unknown>;
      const id = requiredPublicText(item.id, "Demo item ID", 80);
      const name = requiredPublicText(item.name, "Demo item name", 120);
      const form = requiredPublicText(item.form, "Demo item form", 60);
      const categoryCode = requiredPublicText(item.categoryCode, "Demo category", 60);
      const description = requiredPublicText(item.description, "Demo item description", 200);
      if (!/^demo-[a-z0-9-]+$/.test(id) || !name.startsWith("Fictional ") || !categoryCode.startsWith("demo_") || !description.startsWith("Fictional demonstration item.")) {
        throw new Error("Demo catalog labels must remain explicitly fictional");
      }
      return { id, name, form, categoryCode, description, demoOnly: true, saleable: false, orderable: false };
    });
  } catch {
    return [];
  }
}

export function demoStorefrontSettingsForPremises(premisesName: unknown) {
  const premises = requiredPublicText(premisesName, "Premises name", 500).replace(/\s+/g, " ");
  const suffix = " — Demo Storefront";
  const boundedPremises = premises.slice(0, 120 - suffix.length).trimEnd();
  return {
    businessName: `${boundedPremises}${suffix}`,
    tagline: DEMO_STOREFRONT_TAGLINE,
    description: DEMO_STOREFRONT_DESCRIPTION,
    brandHue: DEMO_STOREFRONT_HUE,
    publicationStatus: "published" as const,
    storefrontMode: "demo" as const,
    demoCatalog: demoCatalogSeed(),
  };
}

/** Re-project only published persisted values so malformed, draft, or legacy rows stay neutral. */
export function projectPublicStorefrontSettings(value: unknown): PublicStorefrontSettings {
  try {
    if (!value || typeof value !== "object" || (value as Record<string, unknown>).publicationStatus !== "published") {
      return { ...NEUTRAL_STOREFRONT_SETTINGS };
    }
    const mode = (value as Record<string, unknown>).storefrontMode;
    if (mode !== "demo" && mode !== "configured") return { ...NEUTRAL_STOREFRONT_SETTINGS };
    const settings = normalizeStorefrontSettingsInput(value);
    const row = value as Record<string, unknown>;
    return { ...settings, logoIcon: sanitizeStoreLogoSvg(String(row.logoIcon || '')) || DEFAULT_STORE_LOGO_ICON,
      logoColor: normalizeStoreLogoColor(row.logoColor), mode, isConfigured: true };
  } catch {
    return { ...NEUTRAL_STOREFRONT_SETTINGS };
  }
}
