import { getPublicCannabisMenu, getPublicCannabisStorefrontSettings } from '../lib/data/menu';
import { menuForms, menuItems } from './MenuPage';
import { OrderStatus } from '../components/OrderStatus';
import { StorefrontShell } from '../components/StorefrontShell';

export async function OrderPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const [settings, menu] = await Promise.all([getPublicCannabisStorefrontSettings(), getPublicCannabisMenu()]);
  return <StorefrontShell settings={settings} forms={menuForms(menuItems(menu))}>
    <section className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 sm:py-14"><h1 className="cn-display mb-6 text-[56px] text-cn-ink sm:text-[88px]">Order placed</h1><OrderStatus reference={decodeURIComponent(reference)} /></section>
  </StorefrontShell>;
}
