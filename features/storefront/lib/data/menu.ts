'use server';

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { NEUTRAL_STOREFRONT_SETTINGS, type PublicDemoCatalogItem, type PublicStorefrontSettings } from '@/features/keystone/domain/storefrontSettings';

export type PublicLiveMenuItem = {
  id: string; name: string; sku?: string; form: string; categoryCode: string; priceCents: number; description?: string | null;
  imageUrl?: string | null; adultUseEligible?: boolean; medicalEligible?: boolean;
};

export type PublicCannabisMenu = {
  unavailable?: boolean;
  reason?: 'not_set_up' | 'sales_rules';
  jurisdictionCode?: string;
  rulePackVersion?: string;
  currencyCode?: string | null;
  products: PublicLiveMenuItem[];
  demoProducts: PublicDemoCatalogItem[];
};

export async function getPublicCannabisMenu(): Promise<PublicCannabisMenu> {
  const response = await keystoneClient<{ publicCannabisMenu: PublicCannabisMenu }>('query PublicCannabisMenu { publicCannabisMenu }', {}, undefined,
    // @ts-expect-error The restored E-commerce keystoneClient has no privacy option and logs failures; kept until the family upstreams it.
    { logErrors: false });
  if (!response.success) return { unavailable: true, products: [], demoProducts: [] };
  return response.data.publicCannabisMenu;
}

export type PublicVisit = {
  address: { line1: string | null; city: string | null; region: string | null; postalCode: string | null; country: string | null };
  phone: string | null; timezone: string | null; hours: { opensMinute: number; closesMinute: number } | null; tenders: string[];
  minimumAge: number | null; medicalMinimumAge: number | null;
};

export type PublicStorefrontSettingsResult = PublicStorefrontSettings & { unavailable?: boolean; visit?: PublicVisit };

export async function getPublicCannabisStorefrontSettings(): Promise<PublicStorefrontSettingsResult> {
  const response = await keystoneClient<{ publicCannabisStorefrontSettings: PublicStorefrontSettingsResult }>(
    'query PublicCannabisStorefrontSettings { publicCannabisStorefrontSettings }',
    {},
    undefined,
    // @ts-expect-error The restored E-commerce keystoneClient has no privacy option and logs failures; kept until the family upstreams it.
    { logErrors: false },
  );
  if (!response.success || !response.data?.publicCannabisStorefrontSettings) return { ...NEUTRAL_STOREFRONT_SETTINGS, unavailable: true };
  return response.data.publicCannabisStorefrontSettings;
}

export async function submitCustomerIntake(_state: any, _formData: FormData) {
  return { error: 'Customer intake is not available.' };
}
