import Link from 'next/link';
import type { CSSProperties } from 'react';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { getPublicCannabisMenu, getPublicCannabisStorefrontSettings } from '../lib/data/menu';
import { formatPrice, formKey } from '../lib/format';
import { chapterInk } from '../lib/chapters';
import { directionsHref, openState } from '../lib/visit';
import { CatalogEntry, ProductPlate, channelLabel } from '../components/ProductTile';
import { StorefrontShell } from '../components/StorefrontShell';
import { menuForms, menuItems } from './MenuPage';

export async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [menu, settings] = await Promise.all([getPublicCannabisMenu(), getPublicCannabisStorefrontSettings()]);
  const { live, demo } = menuItems(menu);
  const catalog = live.length ? live : settings.mode === 'demo' ? demo : [];
  const product = catalog.find(item => item.id === decodeURIComponent(id));
  if (!product) notFound();
  const source = menu.products.find(item => item.id === product.id);
  const related = catalog.filter(item => item.id !== product.id && formKey(item.form) === formKey(product.form)).slice(0, 6);
  const channels = channelLabel(product);
  const open = openState(settings.visit);
  const directions = directionsHref(settings.visit);
  const formHref = `/?form=${encodeURIComponent(formKey(product.form))}#menu`;
  const specs: Array<[string, string]> = [
    ['Form', product.form],
    ...(channels ? [['Sold for', channels] as [string, string]] : []),
    ...(source?.sku ? [['SKU', source.sku] as [string, string]] : []),
    ['Purchase', product.demo ? 'Sample · not for sale' : 'In store only, after an ID check'],
    ...(open ? [['Store', open.label] as [string, string]] : []),
  ];

  return <StorefrontShell settings={settings} forms={menuForms(catalog)} current="menu">
    <div className="mx-auto max-w-[1440px] px-4 pt-6 sm:px-6 sm:pt-8" style={{ '--chapter': chapterInk(product.form) } as CSSProperties}>
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-[15px] text-cn-ink-2">
        <Link href="/#menu" className="inline-flex min-h-11 items-center gap-1.5 hover:text-cn-ink"><ArrowLeft className="size-4" aria-hidden="true" />Menu</Link>
        <span aria-hidden="true" className="text-cn-ink-3">/</span>
        <Link href={formHref} className="inline-flex min-h-11 min-w-0 items-center truncate hover:text-cn-ink">{product.form}</Link>
      </nav>
      <article className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-14">
        <div className="lg:sticky lg:top-[calc(var(--cn-header)+24px)] lg:self-start"><ProductPlate product={product} /></div>
        <div className="min-w-0 lg:pt-2">
          <h1 className="cn-display break-words text-[52px] text-cn-ink [text-wrap:balance] sm:text-[80px]">{product.name}</h1>
          <div className="mt-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-y border-cn-line py-4">
            {product.priceCents != null ? <p className="cn-display cn-num text-[56px] text-cn-ink">{formatPrice(product.priceCents, menu.currencyCode)}</p> : <p className="cn-name text-[24px] text-cn-warn">Sample · not for sale</p>}
            {!product.demo && <p className="inline-flex items-baseline gap-2 text-[16px] text-cn-ink-2"><span className="cn-dot bg-cn-ok" aria-hidden="true" />In stock · buy in store</p>}
          </div>
          <dl className="mt-2 text-[16px]">
            {specs.map(([term, value]) => <div key={term} className="grid gap-1 border-b border-cn-line py-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-6"><dt className="text-cn-ink-3">{term}</dt><dd className="min-w-0 break-words text-cn-ink">{value}</dd></div>)}
          </dl>
          {product.description && <p className="mt-6 max-w-prose whitespace-pre-line break-words text-[17px] leading-[28px] text-cn-ink-2">{product.description}</p>}
          <div className="mt-8 flex flex-wrap gap-2">
            {directions && <a href={directions} target="_blank" rel="noreferrer" data-tone="ink" className="cn-btn">Directions<ArrowUpRight className="size-4" aria-hidden="true" /></a>}
            <Link href={formHref} className="cn-btn">More {product.form.toLowerCase()}</Link>
          </div>
        </div>
      </article>
    </div>
    {related.length > 0 && <section aria-labelledby="related-title" className="mt-16" style={{ '--chapter': chapterInk(product.form) } as CSSProperties}>
      <div className="bg-[var(--chapter)] text-cn-on-ink">
        <div className="mx-auto flex max-w-[1440px] items-baseline justify-between gap-4 px-4 py-2.5 sm:px-6">
          <h2 id="related-title" className="cn-display text-[36px] sm:text-[44px]">More {product.form.toLowerCase()}</h2>
          <span className="cn-num text-[15px] font-semibold">{related.length}</span>
        </div>
      </div>
      <div className="mx-auto grid max-w-[1440px] gap-x-14 px-4 sm:px-6 lg:grid-cols-2">{related.map(item => <CatalogEntry key={item.id} product={item} currencyCode={menu.currencyCode} showChannel={catalog.some(entry => entry.medicalEligible) && catalog.some(entry => entry.adultUseEligible)} />)}</div>
    </section>}
  </StorefrontShell>;
}
