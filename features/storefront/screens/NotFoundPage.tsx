import Link from 'next/link';
import { getPublicCannabisMenu, getPublicCannabisStorefrontSettings } from '../lib/data/menu';
import { menuForms, menuItems } from './MenuPage';
import { StorefrontShell } from '../components/StorefrontShell';

/** In-shell 404: "Page not found" for unknown URLs, "Not on the menu" for an unknown product. */
export async function NotFoundPage({ title }: { title: string }) {
  const [settings, menu] = await Promise.all([getPublicCannabisStorefrontSettings(), getPublicCannabisMenu()]);
  const { live, demo } = menuItems(menu);
  return <StorefrontShell settings={settings} forms={menuForms(live.length ? live : settings.mode === 'demo' ? demo : [])}>
    <section className="mx-auto max-w-[1440px] px-4 py-24 sm:px-6 sm:py-32">
      <p className="cn-display text-[88px] leading-none text-cn-ink-3">404</p>
      <h1 className="cn-display mt-4 text-[44px] leading-[46px] text-cn-ink sm:text-[64px] sm:leading-[64px]">{title}</h1>
      <div className="cn-track mt-8"><Link href="/#menu" data-active="true" className="cn-pill">Back to menu</Link></div>
    </section>
  </StorefrontShell>;
}
