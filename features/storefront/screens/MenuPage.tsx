import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { addressLines, ageRule, directionsHref, openState } from '../lib/visit';
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

type Channel = 'adult' | 'medical' | null;
type MenuState = { form: string | null; sort: SortId; q: string; channel: Channel };

function menuHref(state: MenuState, patch: Partial<MenuState> = {}) {
  const next = { ...state, ...patch };
  const query = new URLSearchParams();
  if (next.q) query.set('q', next.q);
  if (next.form) query.set('form', next.form);
  if (next.channel) query.set('channel', next.channel);
  if (next.sort !== 'featured') query.set('sort', next.sort);
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
  const q = (first(params.q) || '').trim().slice(0, 80);
  const requestedChannel = first(params.channel);
  const hasMedical = catalog.some(item => item.medicalEligible); const hasAdult = catalog.some(item => item.adultUseEligible);
  const channel: Channel = requestedChannel === 'medical' || requestedChannel === 'adult' ? requestedChannel : null;
  const state: MenuState = { form: activeForm, sort, q, channel };
  const needle = q.toLowerCase();
  const shown = sortItems(catalog.filter(item => (!activeForm || formKey(item.form) === activeForm)
    && (!channel || (channel === 'medical' ? item.medicalEligible : item.adultUseEligible))
    && (!needle || item.name.toLowerCase().includes(needle) || item.form.toLowerCase().includes(needle))), sort);
  const filtered = Boolean(activeForm || channel || q);
  const name = storeName(settings);
  const open = openState(settings.visit);
  const address = addressLines(settings.visit);
  const directions = directionsHref(settings.visit);

  const ages = ageRule(settings.visit);

  return <StorefrontShell settings={settings} forms={forms} current="menu">
    <div className="mx-auto grid max-w-[1440px] gap-6 px-4 pb-20 pt-4 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
      <section aria-labelledby="cn-cover-title" className="lg:sticky lg:top-[80px] lg:self-start">
        <div className="relative flex min-h-[440px] flex-col overflow-hidden rounded-[2px] bg-cn-cover px-6 pb-7 pt-12 sm:px-9 lg:min-h-[calc(100svh-112px)]">
          <span aria-hidden="true" className="absolute inset-y-0 left-0 w-3 bg-cn-well/60" />
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <span className="cn-display text-[64px] leading-none text-cn-ink sm:text-[88px]">{ages.adult}+</span>
            {ages.medical != null && <span className="text-[15px] font-semibold text-cn-ink-2">Patients {ages.medical}+</span>}
          </div>
          <h1 id="cn-cover-title" className="cn-display mt-auto min-w-0 break-words pt-16 text-[48px] leading-[0.95] text-cn-ink [text-wrap:balance] sm:text-[72px] xl:text-[88px]">{settings.isConfigured ? name : 'Dispensary menu'}</h1>
          <span data-testid="customer-workflows-disabled" className="mt-5 inline-flex items-baseline gap-2 text-[16px] font-semibold text-cn-ink"><span className={`cn-dot ${open ? (open.open ? 'bg-cn-ok' : 'bg-cn-ink-3') : 'bg-cn-accent'}`} aria-hidden="true" />{open ? `${open.open ? 'Open now' : 'Closed'} · in-store only` : 'In-store only'}</span>
          {settings.tagline && <p className="cn-display mt-5 max-w-[30ch] break-words text-[22px] leading-[28px] text-cn-ink sm:text-[24px] sm:leading-[31px]">{settings.tagline}</p>}
          {settings.description && <p className="mt-3 max-w-[46ch] break-words text-[16px] leading-[26px] text-cn-ink-2">{settings.description}</p>}
          {(address.length > 0 || open) && <p className="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[15px] text-cn-ink-2">
            {address.length > 0 && <span className="min-w-0 break-words">{address.join(', ')}</span>}
            {open && <span className="cn-num">Daily {open.hours}</span>}
            {directions && <a href={directions} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1 font-semibold text-cn-ink underline decoration-cn-ink/30 decoration-2 underline-offset-4 hover:decoration-cn-ink">Directions<ArrowUpRight className="size-4" aria-hidden="true" /></a>}
          </p>}
          {settings.unavailable
            ? <p role="status" className="mt-6 inline-flex items-baseline gap-2 text-[15px] text-cn-ink-2"><span className="cn-dot bg-cn-warn" aria-hidden="true" />Store information unavailable</p>
            : !settings.isConfigured && <p role="status" data-testid="unconfigured-storefront-identity" className="mt-6 inline-flex items-baseline gap-2 text-[15px] text-cn-ink-2"><span className="cn-dot bg-cn-ink-3" aria-hidden="true" />Store not set up</p>}
        </div>
      </section>

      <section id="menu" aria-labelledby="menu-title" className="min-w-0 scroll-mt-24 lg:pt-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-baseline gap-3">
            <h2 id="menu-title" className="cn-display text-[40px] leading-none text-cn-ink sm:text-[52px]">{showDemo && !live.length ? 'Sample menu' : 'Menu'}</h2>
            <span className="cn-num text-[15px] text-cn-ink-3">{shown.length}</span>
            {showDemo && !live.length && <span className="inline-flex items-baseline gap-1.5 text-[14px] text-cn-ink-2"><span className="cn-dot bg-cn-warn" aria-hidden="true" />Not for sale</span>}
          </div>
          {catalog.length > 0 && <div className="flex min-w-0 flex-col gap-2">
            <form action="/#menu" role="search" className="flex min-w-0 items-center gap-2">
              {activeForm && <input type="hidden" name="form" value={activeForm} />}{channel && <input type="hidden" name="channel" value={channel} />}{sort !== 'featured' && <input type="hidden" name="sort" value={sort} />}
              <label className="min-w-0 flex-1"><span className="sr-only">Search the menu</span><input name="q" defaultValue={q} maxLength={80} placeholder="Search the menu" className="h-12 w-full min-w-0 rounded-[2px] bg-cn-surface px-4 text-[16px] text-cn-ink outline-none placeholder:text-cn-ink-3 focus-visible:ring-2 focus-visible:ring-cn-ink" /></label>
              <span className="cn-track"><button type="submit" className="cn-pill h-12" data-active="true">Search</button></span>
            </form>
            <nav aria-label="Filter by form" className="cn-track">
              <Link href={menuHref(state, { form: null })} aria-current={!activeForm ? 'page' : undefined} className="cn-pill">All <span className="cn-num text-[13px] text-cn-ink-3">{catalog.length}</span></Link>
              {forms.map(form => <Link key={form.key} href={menuHref(state, { form: form.key })} aria-current={activeForm === form.key ? 'page' : undefined} className="cn-pill">{form.label} <span className="cn-num text-[13px] text-cn-ink-3">{form.count}</span></Link>)}
            </nav>
            <div className="flex flex-wrap gap-2">
              {hasMedical && hasAdult && <nav aria-label="Filter by channel" className="cn-track">
                <Link href={menuHref(state, { channel: null })} aria-current={!channel ? 'page' : undefined} className="cn-pill">Everyone</Link>
                <Link href={menuHref(state, { channel: 'adult' })} aria-current={channel === 'adult' ? 'page' : undefined} className="cn-pill">Adult-use</Link>
                <Link href={menuHref(state, { channel: 'medical' })} aria-current={channel === 'medical' ? 'page' : undefined} className="cn-pill">Medical</Link>
              </nav>}
              {!(showDemo && !live.length) && <nav aria-label="Sort" className="cn-track">
                {SORTS.map(option => <Link key={option.id} href={menuHref(state, { sort: option.id })} aria-current={sort === option.id ? 'page' : undefined} className="cn-pill">{option.label}</Link>)}
              </nav>}
            </div>
          </div>}
        </div>

        {menu.unavailable && menu.reason !== 'not_set_up' && <div role="status" className="cn-band mt-6 flex flex-wrap items-baseline justify-between gap-3 px-5 py-4 text-[15px] text-cn-ink"><span className="inline-flex items-baseline gap-2"><span className="cn-dot bg-cn-warn" aria-hidden="true" />{menu.reason === 'sales_rules' ? 'Menu temporarily unavailable' : 'Menu unavailable'}</span>{!menu.reason && <span className="cn-track"><Link href="/" className="cn-pill" data-active="true">Try again</Link></span>}</div>}

        {live.length > 0 && <div data-testid="package-backed-live-catalog" className="cn-deal mt-8 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-4 xl:grid-cols-3">
          {shown.map(product => <ProductTile key={product.id} product={product} currencyCode={menu.currencyCode} showChannel={hasMedical && hasAdult} />)}
        </div>}

        {!live.length && showDemo && <div data-testid="demo-catalog-lane" className="cn-deal mt-8 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-4 xl:grid-cols-3">
          {shown.map(product => <ProductTile key={product.id} product={product} />)}
        </div>}

        {catalog.length > 0 && !shown.length && filtered && <div className="cn-band mt-8 flex flex-col items-center gap-4 px-5 py-10 text-center">
          <p className="cn-display text-[24px] text-cn-ink">Nothing matches{q ? ` “${q}”` : ''}</p>
          <span className="cn-track"><Link href="/#menu" className="cn-pill" data-active="true">Clear filters</Link></span>
        </div>}

        {!menu.unavailable && !catalog.length && <div className="cn-band mt-8 px-5 py-10 text-center">
          <p className="cn-display text-[24px] text-cn-ink">Nothing on the menu right now</p>
        </div>}
      </section>
    </div>
  </StorefrontShell>;
}
