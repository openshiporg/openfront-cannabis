import Link from 'next/link';
import { getPublicCannabisMenu, getPublicCannabisStorefrontSettings } from '../lib/data/menu';
import { menuForms, menuItems } from './MenuPage';
import { StorefrontShell } from '../components/StorefrontShell';

/** In-shell 404: "Page not found" for unknown URLs, "Not on the menu" for an unknown product. */
export async function NotFoundPage({ title }: { title: string }) {
  const [settings, menu] = await Promise.all([getPublicCannabisStorefrontSettings(), getPublicCannabisMenu()]);
  const { live, demo } = menuItems(menu);
  return <StorefrontShell settings={settings} forms={menuForms(live.length ? live : settings.mode === 'demo' ? demo : [])}>
    <section className="mx-auto max-w-[1440px] px-4 py-20 sm:px-6 sm:py-28">
      <p className="cn-display cn-num text-[120px] text-cn-ink-3 sm:text-[180px]">404</p>
      <h1 className="cn-name mt-4 text-[36px] leading-[40px] text-cn-ink sm:text-[52px] sm:leading-[56px]">{title}</h1>
      <div className="mt-8 flex flex-wrap gap-2"><Link href="/#menu" data-tone="ink" className="cn-btn">Back to the menu</Link><Link href="/visit" className="cn-btn">Visit</Link></div>
    </section>
  </StorefrontShell>;
}
