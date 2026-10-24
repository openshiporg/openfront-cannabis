import type { Metadata } from 'next';
import { VisitPage } from '@/features/storefront/screens/VisitPage';
import { getPublicCannabisStorefrontSettings } from '@/features/storefront/lib/data/menu';
export default VisitPage;
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicCannabisStorefrontSettings();
  return { title: settings.businessName ? `${settings.businessName} · Visit` : 'Visit' };
}
