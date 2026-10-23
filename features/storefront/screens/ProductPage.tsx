import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getPublicCannabisMenu, getPublicCannabisStorefrontSettings } from '../lib/data/menu';
import { formatPrice, formKey } from '../lib/format';
import { ProductArt, ProductTile } from '../components/ProductTile';
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
  const demoSource = menu.demoProducts.find(item => item.id === product.id);
  const description = source?.description || demoSource?.description;
  const related = catalog.filter(item => item.id !== product.id && formKey(item.form) === formKey(product.form)).slice(0, 4);
  const channels = [product.adultUseEligible && 'Adult-use', product.medicalEligible && 'Medical'].filter(Boolean) as string[];

  return <StorefrontShell settings={settings} forms={menuForms(catalog)}>
    <div className="mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-6 sm:pt-10">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-[13px] text-cn-ink-2">
        <Link href="/#menu" className="inline-flex items-center gap-1.5 hover:text-cn-ink"><ArrowLeft className="size-4" aria-hidden="true" />Menu</Link>
        <span aria-hidden="true" className="text-cn-ink-3">/</span>
        <Link href={`/?form=${encodeURIComponent(formKey(product.form))}#menu`} className="truncate hover:text-cn-ink">{product.form}</Link>
      </nav>
      <article className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
        <div className="lg:sticky lg:top-24 lg:self-start"><ProductArt product={product} currencyCode={menu.currencyCode} large /></div>
        <div className="min-w-0">
          <p className="cn-num text-[12px] uppercase tracking-[0.14em] text-cn-accent">{product.form}</p>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <h1 className="cn-display min-w-0 break-words text-[36px] leading-[40px] text-cn-ink sm:text-[52px] sm:leading-[54px]">{product.name}</h1>
          </div>
          <p className="mt-3 inline-flex items-baseline gap-2 text-[14px] text-cn-ink-2">
            {product.demo ? <><span className="cn-dot bg-cn-warn" aria-hidden="true" />Sample · not for sale</> : <><span className="cn-dot bg-cn-ok" aria-hidden="true" />In stock · buy in store</>}
          </p>
          {product.priceCents != null && <p className="cn-num mt-8 text-[32px] leading-none text-cn-ink">{formatPrice(product.priceCents, menu.currencyCode)}</p>}
          <dl className="cn-band mt-8 divide-y divide-cn-line text-[14px]">
            <div className="flex items-baseline justify-between gap-4 px-5 py-3.5"><dt className="text-cn-ink-2">Form</dt><dd className="text-right text-cn-ink">{product.form}</dd></div>
            {channels.length > 0 && <div className="flex items-baseline justify-between gap-4 px-5 py-3.5"><dt className="text-cn-ink-2">Sold for</dt><dd className="text-right text-cn-ink">{channels.join(' · ')}</dd></div>}
            {source?.sku && <div className="flex items-baseline justify-between gap-4 px-5 py-3.5"><dt className="text-cn-ink-2">SKU</dt><dd className="cn-num break-all text-right text-cn-ink">{source.sku}</dd></div>}
            <div className="flex items-baseline justify-between gap-4 px-5 py-3.5"><dt className="text-cn-ink-2">Purchase</dt><dd className="text-right text-cn-ink">In store only</dd></div>
          </dl>
          {description && <p className="mt-8 max-w-prose whitespace-pre-line break-words text-[15px] leading-7 text-cn-ink-2">{description}</p>}
          <div className="cn-track mt-8"><Link href="/#menu" data-active="true" className="cn-pill">Back to menu</Link></div>
        </div>
      </article>
      {related.length > 0 && <section aria-labelledby="related-title" className="mt-20 border-t border-cn-line pt-6">
        <div className="flex items-baseline gap-3"><h2 id="related-title" className="cn-display text-[24px] text-cn-ink">More {product.form.toLowerCase()}</h2><span className="cn-num text-[13px] text-cn-ink-3">{related.length}</span></div>
        <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 lg:grid-cols-4">{related.map(item => <ProductTile key={item.id} product={item} currencyCode={menu.currencyCode} />)}</div>
      </section>}
    </div>
  </StorefrontShell>;
}
