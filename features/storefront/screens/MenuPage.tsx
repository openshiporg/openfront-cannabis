import Link from 'next/link';
import { getPublicCannabisMenu, getPublicCannabisStorefrontSettings, type PublicCannabisMenu } from '../lib/data/menu';
import { formKey } from '../lib/format';
import { ProductTile, type TileProduct } from '../components/ProductTile';
import { StorefrontShell, storeName, type ShellForm } from '../components/StorefrontShell';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const SORTS = [
  { id: 'featured', label: 'Featured' },
  { id: 'price-asc', label: 'Price low' },
  { id: 'price-desc', label: 'Price high' },
  { id: 'name', label: 'A–Z' },
] as const;
type SortId = (typeof SORTS)[number]['id'];

const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export function menuItems(menu: PublicCannabisMenu): { live: TileProduct[]; demo: TileProduct[] } {
  return {
    live: menu.products.map(product => ({ id: product.id, name: product.name, form: product.form, priceCents: product.priceCents, imageUrl: product.imageUrl, adultUseEligible: product.adultUseEligible, medicalEligible: product.medicalEligible })),
    demo: menu.demoProducts.map(product => ({ id: product.id, name: product.name, form: product.form, demo: true })),
  };
}

export function menuForms(items: TileProduct[]): ShellForm[] {
  const forms = new Map<string, ShellForm>();
  for (const item of items) {
    const key = formKey(item.form);
    const entry = forms.get(key) ?? { key, label: item.form.trim(), count: 0 };
    entry.count += 1;
    forms.set(key, entry);
  }
  return [...forms.values()].sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function sortItems(items: TileProduct[], sort: SortId) {
  const list = [...items];
  if (sort === 'price-asc') list.sort((left, right) => (left.priceCents ?? 0) - (right.priceCents ?? 0));
  if (sort === 'price-desc') list.sort((left, right) => (right.priceCents ?? 0) - (left.priceCents ?? 0));
  if (sort === 'name') list.sort((left, right) => left.name.localeCompare(right.name));
  return list;
}

function menuHref(form: string | null, sort: SortId) {
  const query = new URLSearchParams();
  if (form) query.set('form', form);
  if (sort !== 'featured') query.set('sort', sort);
  const text = query.toString();
  return `/${text ? `?${text}` : ''}#menu`;
}

export default async function MenuPage({ searchParams }: { searchParams?: SearchParams }) {
  const params = (await searchParams) || {};
  const [menu, settings] = await Promise.all([getPublicCannabisMenu(), getPublicCannabisStorefrontSettings()]);
  const { live, demo } = menuItems(menu);
  const showDemo = settings.mode === 'demo' && demo.length > 0;
  const catalog = live.length ? live : showDemo ? demo : [];
  const forms = menuForms(catalog);
  const requestedForm = first(params.form);
  const activeForm = forms.some(form => form.key === requestedForm) ? requestedForm! : null;
  const requestedSort = first(params.sort);
  const sort: SortId = SORTS.some(option => option.id === requestedSort) ? requestedSort as SortId : 'featured';
  const shown = sortItems(activeForm ? catalog.filter(item => formKey(item.form) === activeForm) : catalog, sort);
  const name = storeName(settings);

  return <StorefrontShell settings={settings} forms={forms}>
    <section className="mx-auto max-w-7xl px-4 pb-10 pt-12 sm:px-6 sm:pt-20">
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-3">
        <h1 className="cn-display min-w-0 break-words text-[44px] leading-[46px] text-cn-ink sm:text-[72px] sm:leading-[72px]">{settings.isConfigured ? name : 'Dispensary menu'}</h1>
        <span data-testid="customer-workflows-disabled" className="inline-flex items-baseline gap-2 text-[14px] text-cn-ink-2"><span className="cn-dot bg-cn-accent" aria-hidden="true" />In-store only</span>
      </div>
      {settings.tagline && <p className="cn-display mt-5 max-w-2xl break-words text-[22px] leading-[30px] text-cn-ink sm:text-[26px] sm:leading-[34px]">{settings.tagline}</p>}
      {settings.description && <p className="mt-3 max-w-xl break-words text-[15px] leading-6 text-cn-ink-2">{settings.description}</p>}
      {settings.unavailable
        ? <p role="status" className="mt-6 inline-flex items-baseline gap-2 text-[14px] text-cn-ink-2"><span className="cn-dot bg-cn-warn" aria-hidden="true" />Store information unavailable</p>
        : !settings.isConfigured && <p role="status" data-testid="unconfigured-storefront-identity" className="mt-6 inline-flex items-baseline gap-2 text-[14px] text-cn-ink-2"><span className="cn-dot bg-cn-ink-3" aria-hidden="true" />Store not set up</p>}
    </section>

    <section id="menu" aria-labelledby="menu-title" className="mx-auto max-w-7xl scroll-mt-24 px-4 pb-20 sm:px-6">
      <div className="flex flex-col gap-4 border-t border-cn-line pt-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-baseline gap-3">
          <h2 id="menu-title" className="cn-display text-[28px] leading-8 text-cn-ink">{showDemo && !live.length ? 'Sample menu' : 'Menu'}</h2>
          <span className="cn-num text-[13px] text-cn-ink-3">{shown.length}</span>
          {showDemo && !live.length && <span className="inline-flex items-baseline gap-1.5 text-[13px] text-cn-ink-2"><span className="cn-dot bg-cn-warn" aria-hidden="true" />Not for sale</span>}
        </div>
        {catalog.length > 0 && <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          <nav aria-label="Filter by form" className="cn-track">
            <Link href={menuHref(null, sort)} aria-current={!activeForm ? 'page' : undefined} className="cn-pill">All <span className="cn-num text-[11px] text-cn-ink-3">{catalog.length}</span></Link>
            {forms.map(form => <Link key={form.key} href={menuHref(form.key, sort)} aria-current={activeForm === form.key ? 'page' : undefined} className="cn-pill">{form.label} <span className="cn-num text-[11px] text-cn-ink-3">{form.count}</span></Link>)}
          </nav>
          {!(showDemo && !live.length) && <nav aria-label="Sort" className="cn-track">
            {SORTS.map(option => <Link key={option.id} href={menuHref(activeForm, option.id)} aria-current={sort === option.id ? 'page' : undefined} className="cn-pill">{option.label}</Link>)}
          </nav>}
        </div>}
      </div>

      {menu.unavailable && <div role="status" className="cn-band mt-6 flex flex-wrap items-baseline justify-between gap-3 px-5 py-4 text-[14px] text-cn-ink"><span className="inline-flex items-baseline gap-2"><span className="cn-dot bg-cn-warn" aria-hidden="true" />Menu unavailable</span><span className="cn-track"><Link href="/" className="cn-pill" data-active="true">Try again</Link></span></div>}

      {live.length > 0 && <div data-testid="package-backed-live-catalog" className="mt-8 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 lg:grid-cols-4">
        {shown.map(product => <ProductTile key={product.id} product={product} currencyCode={menu.currencyCode} />)}
      </div>}

      {!live.length && showDemo && <div data-testid="demo-catalog-lane" className="mt-8 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 lg:grid-cols-4">
        {shown.map(product => <ProductTile key={product.id} product={product} />)}
      </div>}

      {!menu.unavailable && !catalog.length && <div className="cn-band mt-8 px-5 py-10 text-center">
        <p className="cn-display text-[22px] text-cn-ink">Nothing on the menu right now</p>
      </div>}
    </section>
  </StorefrontShell>;
}
