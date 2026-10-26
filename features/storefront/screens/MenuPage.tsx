import Link from 'next/link';
import type { CSSProperties } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { addressLines, ageRule, directionsHref, openState, tenderLabels } from '../lib/visit';
import { getPublicCannabisMenu, getPublicCannabisStorefrontSettings, type PublicCannabisMenu } from '../lib/data/menu';
import { formKey } from '../lib/format';
import { chapterId, chapterInk } from '../lib/chapters';
import { CatalogEntry, type TileProduct } from '../components/ProductTile';
import { ChapterRail } from '../components/ChapterRail';
import { COVER_PHOTO, StorefrontShell, storeName, type ShellForm } from '../components/StorefrontShell';

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
    live: menu.products.map(product => ({ id: product.id, name: product.name, form: product.form, priceCents: product.priceCents, imageUrl: product.imageUrl, description: product.description, adultUseEligible: product.adultUseEligible, medicalEligible: product.medicalEligible })),
    demo: menu.demoProducts.map(product => ({ id: product.id, name: product.name, form: product.form, description: product.description, demo: true })),
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
  const sample = showDemo && !live.length;
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
  const chapters = forms.map(form => ({ ...form, ink: chapterInk(form.label), id: chapterId(form.label), items: shown.filter(item => formKey(item.form) === form.key) })).filter(chapter => chapter.items.length);
  const name = storeName(settings);
  const open = openState(settings.visit);
  const address = addressLines(settings.visit);
  const directions = directionsHref(settings.visit);
  const tenders = tenderLabels(settings.visit);
  const ages = ageRule(settings.visit);
  const showChannel = hasMedical && hasAdult;
  const facts: Array<[string, string]> = [
    ...(address.length ? [['Address', address.join(', ')] as [string, string]] : []),
    ...(open ? [['Hours', `Daily ${open.hours}`] as [string, string]] : []),
    ['Age', ages.medical != null ? `${ages.adult}+ · patients ${ages.medical}+ · valid ID` : `${ages.adult}+ · valid ID`],
    ...(tenders.length ? [['Payment', `${tenders.join(' · ')} · in store only`] as [string, string]] : []),
  ];

  return <StorefrontShell settings={settings} forms={forms} current="menu">
    <section aria-labelledby="cn-cover-title" className="mx-auto grid max-w-[1440px] lg:min-h-[calc(100svh-var(--cn-header)-30px)] lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <figure className="relative flex min-w-0 flex-col bg-cn-bg lg:min-h-0">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-cn-raise lg:absolute lg:inset-0 lg:aspect-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={COVER_PHOTO.src} alt="" fetchPriority="high" className="absolute inset-0 size-full object-cover [object-position:36%_42%]" />
        </div>
        <figcaption className="relative px-4 pb-6 pt-5 sm:px-7 lg:absolute lg:inset-x-0 lg:bottom-0 lg:bg-cn-bg/80 lg:pb-7 lg:pt-6">
          <h1 id="cn-cover-title" className="cn-display break-words text-[56px] text-cn-ink [text-wrap:balance] sm:text-[88px] xl:text-[112px]">{settings.isConfigured ? name : 'Dispensary menu'}</h1>
          {settings.tagline && <p className="cn-name mt-3 max-w-[40ch] break-words text-[18px] leading-[24px] text-cn-ink-2 sm:text-[21px] sm:leading-[27px]">{settings.tagline}</p>}
        </figcaption>
      </figure>
      <div className="flex min-w-0 flex-col gap-7 bg-cn-page px-4 py-7 sm:px-8 sm:py-9 lg:px-10">
        <div>
          <p data-testid="customer-workflows-disabled" className="cn-display flex items-baseline gap-3 text-[44px] text-cn-ink sm:text-[52px]">
            <span aria-hidden="true" className={`cn-dot size-3 ${open ? (open.open ? 'bg-cn-ok' : 'bg-cn-ink-3') : 'bg-cn-accent'}`} />{open ? (open.open ? 'Open now' : 'Closed') : 'In-store only'}
          </p>
          <p className="mt-2 text-[16px] text-cn-ink-2">{open ? `${open.label.split(' · ')[1] ?? open.hours} · in-store purchase only` : 'Buy in store after an ID check'}</p>
          {settings.unavailable
            ? <p role="status" className="mt-3 inline-flex items-baseline gap-2 text-[15px] text-cn-ink-2"><span className="cn-dot bg-cn-warn" aria-hidden="true" />Store information unavailable</p>
            : !settings.isConfigured && <p role="status" data-testid="unconfigured-storefront-identity" className="mt-3 inline-flex items-baseline gap-2 text-[15px] text-cn-ink-2"><span className="cn-dot bg-cn-ink-3" aria-hidden="true" />Store not set up</p>}
        </div>
        {settings.description && <p className="max-w-[52ch] break-words text-[16px] leading-[25px] text-cn-ink-2">{settings.description}</p>}
        <dl className="grid gap-x-6 gap-y-3 border-y border-cn-line py-4 text-[15px] sm:grid-cols-[6rem_minmax(0,1fr)]">
          {facts.map(([term, value]) => <div key={term} className="contents"><dt className="text-cn-ink-3">{term}</dt><dd className="min-w-0 break-words text-cn-ink">{value}</dd></div>)}
        </dl>
        <div className="flex flex-wrap gap-2">
          {directions && <a href={directions} target="_blank" rel="noreferrer" data-tone="ink" className="cn-btn">Directions<ArrowUpRight className="size-4" aria-hidden="true" /></a>}
          <Link href="/visit" className="cn-btn">Visit details</Link>
        </div>
        {forms.length > 0 && <nav aria-labelledby="cn-index-title" className="mt-auto">
          <div className="flex items-baseline justify-between gap-3"><h2 id="cn-index-title" className="cn-name text-[20px] text-cn-ink">{sample ? 'Sample menu' : 'Menu'}</h2><span className="cn-num text-[15px] text-cn-ink-3">{catalog.length}</span></div>
          <ul className="mt-2 border-b border-cn-line">
            {forms.map(form => <li key={form.key} className="border-t border-cn-line">
              <Link href={menuHref(state, { form: activeForm === form.key ? null : form.key })} aria-current={activeForm === form.key ? 'page' : undefined} className="group flex min-h-12 items-center gap-3 py-1.5 aria-[current=page]:bg-cn-raise">
                <span aria-hidden="true" className="h-7 w-2 shrink-0 rounded-[1px]" style={{ background: chapterInk(form.label) }} />
                <span className="cn-display min-w-0 flex-1 truncate text-[30px] text-cn-ink decoration-2 underline-offset-4 group-hover:underline">{form.label}</span>
                <span className="cn-num pr-2 text-[15px] text-cn-ink-3">{form.count}</span>
              </Link>
            </li>)}
          </ul>
        </nav>}
      </div>
    </section>

    <section id="menu" aria-labelledby="menu-title" className="scroll-mt-[var(--cn-header)] pt-10 sm:pt-14" style={chapters.length < 2 ? { '--cn-rail': '0px' } as CSSProperties : undefined}>
      <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 sm:px-6">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h2 id="menu-title" className="cn-display text-[48px] text-cn-ink sm:text-[64px]">{sample ? 'Sample menu' : activeForm ? forms.find(form => form.key === activeForm)?.label : 'The menu'}</h2>
          <span className="cn-num text-[16px] text-cn-ink-3">{shown.length} {shown.length === 1 ? 'item' : 'items'}</span>
          {sample && <span className="inline-flex items-baseline gap-1.5 text-[15px] text-cn-ink-2"><span className="cn-dot bg-cn-warn" aria-hidden="true" />Not for sale</span>}
        </div>
        {catalog.length > 0 && <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <form action="/#menu" role="search" className="flex w-full min-w-0 items-center gap-2 lg:max-w-[520px]">
            {activeForm && <input type="hidden" name="form" value={activeForm} />}{channel && <input type="hidden" name="channel" value={channel} />}{sort !== 'featured' && <input type="hidden" name="sort" value={sort} />}
            <label className="min-w-0 flex-1"><span className="sr-only">Search the menu</span><input name="q" type="search" defaultValue={q} maxLength={80} placeholder="Search by name or form" className="cn-field" /></label>
            <button type="submit" className="cn-btn min-h-12">Search</button>
          </form>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-1">
            {showChannel && <nav aria-label="Filter by channel" className="cn-scroll flex gap-5 overflow-x-auto">
              <Link href={menuHref(state, { channel: null })} aria-current={!channel ? 'page' : undefined} className="cn-tab">Everyone</Link>
              <Link href={menuHref(state, { channel: 'adult' })} aria-current={channel === 'adult' ? 'page' : undefined} className="cn-tab">Adult-use</Link>
              <Link href={menuHref(state, { channel: 'medical' })} aria-current={channel === 'medical' ? 'page' : undefined} className="cn-tab">Medical</Link>
            </nav>}
            {!sample && <nav aria-label="Sort" className="cn-scroll flex gap-5 overflow-x-auto">
              {SORTS.map(option => <Link key={option.id} href={menuHref(state, { sort: option.id })} aria-current={sort === option.id ? 'page' : undefined} className="cn-tab">{option.label}</Link>)}
            </nav>}
          </div>
        </div>}
        {filtered && shown.length > 0 && <p className="text-[15px] text-cn-ink-2">{[activeForm && forms.find(form => form.key === activeForm)?.label, channel === 'adult' && 'Adult-use', channel === 'medical' && 'Medical', q && `“${q}”`].filter(Boolean).join(' · ')} · <Link href="/#menu" className="font-semibold text-cn-ink underline decoration-cn-line decoration-2 underline-offset-4 hover:decoration-cn-ink">Show everything</Link></p>}
      </div>

      {menu.unavailable && menu.reason !== 'not_set_up' && <div role="status" className="mx-auto mt-8 flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 sm:px-6">
        <span className="inline-flex items-baseline gap-2 text-[17px] text-cn-ink"><span className="cn-dot bg-cn-warn" aria-hidden="true" />{menu.reason === 'sales_rules' ? 'Menu temporarily unavailable' : 'Menu unavailable'}</span>
        {!menu.reason && <Link href="/" className="cn-btn">Try again</Link>}
      </div>}

      {chapters.length > 0 && <div data-testid={live.length ? 'package-backed-live-catalog' : 'demo-catalog-lane'} className="mt-8">
        <ChapterRail chapters={chapters.map(chapter => ({ id: chapter.id, label: chapter.label, count: chapter.items.length, ink: chapter.ink }))} />
        <div className="cn-print">
          {chapters.map(chapter => <section key={chapter.key} id={chapter.id} aria-labelledby={`${chapter.id}-title`} style={{ '--chapter': chapter.ink } as CSSProperties} className="scroll-mt-[calc(var(--cn-header)+var(--cn-rail))] pb-10">
            <div className="cn-band">
              <div className="mx-auto flex max-w-[1440px] items-baseline justify-between gap-4 px-4 py-2 sm:px-6 sm:py-2.5">
                <h3 id={`${chapter.id}-title`} className="cn-display min-w-0 truncate text-[36px] sm:text-[48px]">{chapter.label}</h3>
                <span className="cn-num shrink-0 text-[15px] font-semibold">{chapter.items.length} {chapter.items.length === 1 ? 'item' : 'items'}</span>
              </div>
            </div>
            <div className="mx-auto grid max-w-[1440px] gap-x-14 px-4 sm:px-6 lg:grid-cols-2">
              {chapter.items.map(product => <CatalogEntry key={product.id} product={product} currencyCode={menu.currencyCode} showChannel={showChannel} />)}
            </div>
          </section>)}
        </div>
      </div>}

      {catalog.length > 0 && !shown.length && filtered && <div className="mx-auto mt-8 flex max-w-[1440px] flex-col items-start gap-4 border-t border-cn-line px-4 pt-8 sm:px-6">
        <p className="cn-name text-[26px] text-cn-ink">Nothing matches{q ? ` “${q}”` : ''}</p>
        <Link href="/#menu" data-tone="ink" className="cn-btn">Clear filters</Link>
      </div>}

      {!menu.unavailable && !catalog.length && <div className="mx-auto mt-8 max-w-[1440px] border-t border-cn-line px-4 pt-8 sm:px-6">
        <p className="cn-name text-[26px] text-cn-ink">Nothing on the menu right now</p>
      </div>}
    </section>
  </StorefrontShell>;
}
