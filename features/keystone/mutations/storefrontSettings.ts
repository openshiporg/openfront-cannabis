import type { Context } from ".keystone/types";
import { NEUTRAL_STOREFRONT_SETTINGS, normalizeLogoSettings, normalizeStorefrontSettingsInput, projectPublicStorefrontSettings } from "../domain/storefrontSettings";
import { requireOperationalAuthority, requireReadAuthority, runControlledOperation } from "./workflow";

const SETTINGS_SELECTION = "id businessName tagline description brandHue logoIcon logoColor publicationStatus storefrontMode updatedAt";

async function scopedSettings(context: Context, organizationId: string, premisesId: string) {
  return context.sudo().query.StorefrontSettings.findMany({
    where: {
      organization: { id: { equals: organizationId } },
      premises: { id: { equals: premisesId } },
    },
    orderBy: [{ createdAt: "asc" }],
    take: 2,
    query: SETTINGS_SELECTION,
  });
}

/** Private editing view: the persisted values (including drafts) and their revision. */
export async function cannabisStorefrontSettingsWorkspace(_root: unknown, _args: unknown, context: Context) {
  let authority: Awaited<ReturnType<typeof requireReadAuthority>>;
  try { authority = await requireReadAuthority(context, "canManageAuthority"); }
  catch { return { state: "forbidden" }; }
  let canSave = true;
  try { await requireOperationalAuthority(context, "canManageAuthority", "authority"); } catch { canSave = false; }
  const settings = await scopedSettings(context, authority.organizationId, authority.premisesId);
  if (settings.length > 1) throw new Error("Storefront settings scope is inconsistent and requires review");
  const row = settings[0];
  return {
    state: "ok",
    canSave,
    revision: row ? new Date(row.updatedAt).toISOString() : null,
    settings: row ? {
      businessName: row.businessName, tagline: row.tagline || "", description: row.description || "", brandHue: row.brandHue,
      ...normalizeLogoSettings({ logoIcon: row.logoIcon || undefined, logoColor: row.logoColor }),
      publicationStatus: row.publicationStatus, storefrontMode: row.storefrontMode,
    } : null,
    publicPreview: projectPublicStorefrontSettings(row),
    organizationId: authority.organizationId,
    premisesId: authority.premisesId,
  };
}

export async function configureCannabisStorefrontSettings(_root: unknown, args: { input: any }, context: Context) {
  const input = args.input;
  return runControlledOperation(context, input, {
    permission: "canManageAuthority",
    activity: "authority",
    scope: "configureCannabisStorefrontSettings",
    lockKeys: ["storefront-settings"],
    resourceType: "StorefrontSettings",
    action: "storefront.settings.configured",
    emitStateEvent: false,
  }, async (tx, authority) => {
    const settings = normalizeStorefrontSettingsInput(input);
    const logo = normalizeLogoSettings(input);
    const existing = await scopedSettings(tx, authority.organizationId, authority.premisesId);
    if (existing.length > 1) throw new Error("Storefront settings scope is inconsistent and requires review");
    // Reject a save made from a stale form instead of overwriting a newer change.
    const currentRevision = existing[0] ? new Date(existing[0].updatedAt).toISOString() : null;
    if ((input.expectedRevision ?? null) !== currentRevision) throw new Error("Store settings changed since this form was opened");
    const data = {
      businessName: settings.businessName,
      tagline: settings.tagline,
      description: settings.description,
      brandHue: settings.brandHue,
      ...logo,
      publicationStatus: "published" as const,
      storefrontMode: "configured" as const,
    };
    const saved = existing[0]
      ? await tx.sudo().query.StorefrontSettings.updateOne({ where: { id: existing[0].id }, data, query: SETTINGS_SELECTION })
      : await tx.sudo().query.StorefrontSettings.createOne({ data: {
          ...data,
          organization: { connect: { id: authority.organizationId } },
          premises: { connect: { id: authority.premisesId } },
        }, query: SETTINGS_SELECTION });
    return { id: saved.id, status: "configured", revision: new Date(saved.updatedAt).toISOString(), ...projectPublicStorefrontSettings(saved) };
  });
}

export function unconfiguredStorefrontSettings() {
  return { ...NEUTRAL_STOREFRONT_SETTINGS };
}
