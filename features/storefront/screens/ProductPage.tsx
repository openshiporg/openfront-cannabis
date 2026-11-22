import Link from 'next/link';
import type { CSSProperties } from 'react';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getPublicCannabisMenu, getPublicCannabisStorefrontSettings } from '../lib/data/menu';
import { formatPrice, formKey } from '../lib/format';
import { chapterInk } from '../lib/chapters';
import { CatalogEntry, ProductPlate, channelLabel, potencyFacts } from '../components/ProductTile';
import { StorefrontShell } from '../components/StorefrontShell';
import { AddToBag } from '../components/AddToBag';
import { menuForms, menuItems } from './MenuPage';

export async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [menu, settings] = await Promise.all([getPublicCannabisMenu(), getPublicCannabisStorefrontSettings()]);
  const catalog = menuItems(menu);
  const product = catalog.find(item => item.id === decodeURIComponent(id));
  if (!product) notFound();
  const related = catalog.filter(item => item.id !== product.id && formKey(item.form) === formKey(product.form)).slice(0, 6);
  const channels = channelLabel(product);
  const formHref = `/?form=${encodeURIComponent(formKey(product.form))}#menu`;

  return <StorefrontShell settings={settings} forms={menuForms(catalog)} current="menu">
    <div className="mx-auto max-w-[1440px] px-4 pt-6 sm:px-6 sm:pt-8" style={{ '--chapter': chapterInk(product.form) } as CSSProperties}>
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-[15px] text-cn-ink-2">
        <Link href="/#menu" className="inline-flex min-h-11 items-center gap-1.5 hover:text-cn-ink"><ArrowLeft className="size-4" aria-hidden="true" />Menu</Link>
        <span aria-hidden="true" className="text-cn-ink-3">/</span>
        <Link href={formHref} className="inline-flex min-h-11 min-w-0 items-center truncate hover:text-cn-ink">{product.form}</Link>
      </nav>
      <article className="mt-2 grid gap-6 sm:mt-4 sm:gap-8 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-14">
        <div className="lg:sticky lg:top-[calc(var(--cn-header)+24px)] lg:self-start"><ProductPlate product={product} specs={[['Form', product.form], ...(product.priceCents != null ? [['Price', formatPrice(product.priceCents, menu.currencyCode)] as [string, string]] : []), ['Sold for', channels || '—'], ['Buy', 'Pickup']]} className="aspect-[4/3] lg:aspect-[4/5]" /></div>
        <div className="min-w-0 lg:pt-2">
          <h1 className="cn-display break-words text-[44px] text-cn-ink [text-wrap:balance] sm:text-[64px] xl:text-[80px]">{product.name}</h1>
          <div className="mt-5 flex flex-col gap-2 border-y border-cn-line py-4 sm:mt-6 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-x-6">
            {product.priceCents != null && <p className="cn-display cn-num text-[44px] text-cn-ink sm:text-[56px]">{formatPrice(product.priceCents, menu.currencyCode)}</p>}
            <p className="inline-flex items-baseline gap-2 text-[16px] text-cn-ink-2"><span className="cn-dot bg-cn-ok" aria-hidden="true" />In stock · order for pickup</p>
          </div>
          {potencyFacts(product).length > 0 && <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
            {potencyFacts(product).map(fact => { const [term, ...rest] = fact.split(' '); return rest.length
              ? <div key={fact}><dt className="text-[14px] text-cn-ink-3">{term}</dt><dd className="cn-display cn-num text-[28px] text-cn-ink">{rest.join(' ')}</dd></div>
              : <div key={fact}><dt className="text-[14px] text-cn-ink-3">Type</dt><dd className="cn-display text-[28px] text-cn-ink">{term}</dd></div>; })}
          </dl>}
          {product.priceCents != null && <AddToBag product={{ id: product.id, name: product.name, priceCents: product.priceCents }} cardOnline={settings.visit?.cardOnline === true} />}
          {product.description && <p className="mt-6 max-w-prose whitespace-pre-line break-words text-[17px] [text-wrap:pretty] leading-[28px] text-cn-ink-2">{product.description}</p>}
        </div>
      </article>
    </div>
    {related.length > 0 && <section aria-labelledby="related-title" className="mt-16" style={{ '--chapter': chapterInk(product.form) } as CSSProperties}>
      <div className="bg-[var(--chapter)] text-cn-on-ink">
        <div className="mx-auto flex max-w-[1440px] items-baseline justify-between gap-4 px-4 py-2.5 sm:px-6">
          <h2 id="related-title" className="cn-display text-[36px] sm:text-[44px]">More {product.form.toLowerCase()}</h2>
          <span className="cn-num text-[15px] font-semibold">{related.length} {related.length === 1 ? 'item' : 'items'}</span>
        </div>
      </div>
      <div className="mx-auto grid max-w-[1440px] gap-x-14 px-4 sm:px-6 lg:grid-cols-2">{related.map(item => <CatalogEntry key={item.id} product={item} currencyCode={menu.currencyCode} showChannel={catalog.some(entry => entry.medicalEligible) && catalog.some(entry => entry.adultUseEligible)} />)}</div>
    </section>}
  </StorefrontShell>;
}
