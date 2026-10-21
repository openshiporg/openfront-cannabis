import type { CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { normalizeStoreLogoColor } from '@/features/lib/store-logo';
import { getPublicCannabisMenu, getPublicCannabisStorefrontSettings } from '../lib/data/menu';
import { StoreLogo } from '../components/StoreLogo';

function formatPrice(priceCents: number, currencyCode?: string | null) {
  const amount = priceCents / 100;
  if (currencyCode) {
    try {
      return new Intl.NumberFormat('en', { style: 'currency', currency: currencyCode }).format(amount);
    } catch {
      // Unknown currency code: show the plain amount rather than guessing a symbol.
    }
  }
  return amount.toFixed(2);
}

export default async function MenuPage() {
  const [menu, settings] = await Promise.all([getPublicCannabisMenu(), getPublicCannabisStorefrontSettings()]);
  // Restaurant MainLayout convention: the saved logo colour drives the storefront accent.
  const hue = settings.isConfigured && settings.logoColor != null
    ? (260 + Number.parseInt(normalizeStoreLogoColor(settings.logoColor), 10)) % 360
    : settings.brandHue;
  const theme = { '--storefront-hue': hue } as CSSProperties;
  const name = settings.businessName || 'Cannabis';
  const logo = <StoreLogo svg={settings.logoIcon} hue={settings.logoColor} name={name} />;
  return <div className="storefront-theme min-h-screen overflow-x-clip bg-stone-50 text-stone-950" style={theme}>
    <header className="storefront-accent-border border-t-4 border-b bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
        <Link href="/" aria-label={`${name} home`} className="inline-flex min-h-11 min-w-0 items-center">{logo}</Link>
        <Link href="/dashboard/signin" className="storefront-accent-text hidden min-h-11 shrink-0 items-center gap-2 px-3 text-sm sm:inline-flex">Operator sign in<ArrowUpRight className="size-4" /></Link>
        <details className="relative shrink-0 sm:hidden">
          <summary className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-md border px-3">Menu</summary>
          <nav aria-label="Mobile menu" className="absolute right-0 z-10 mt-2 w-64 max-w-[calc(100vw-2.5rem)] rounded-xl border bg-white p-4 shadow-lg">
            <StoreLogo svg={settings.logoIcon} hue={settings.logoColor} name={name} wrap />
            <Link href="/dashboard/signin" className="storefront-accent-text mt-3 flex min-h-11 items-center justify-between">Operator sign in<ArrowUpRight className="size-4" /></Link>
          </nav>
        </details>
      </div>
    </header>
    <main className="mx-auto max-w-6xl space-y-8 px-5 py-12">
      {(settings.tagline || settings.description) && <section className="max-w-3xl space-y-2">
        {settings.tagline && <p className="text-lg font-medium break-words">{settings.tagline}</p>}
        {settings.description && <p className="text-stone-600 break-words">{settings.description}</p>}
      </section>}
      <div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-semibold tracking-tight">Menu</h1><span className="inline-flex items-center gap-2 text-sm text-stone-600"><span className="storefront-accent-bg size-2 rounded-full" aria-hidden="true" />Ordering closed</span></div>
      {settings.unavailable
        ? <p role="status">Store information is temporarily unavailable.</p>
        : !settings.isConfigured && <p role="status" data-testid="unconfigured-storefront-identity">Store identity not configured.</p>}
      <section className="rounded-xl border bg-white p-5" data-testid="customer-workflows-disabled">
        <h2 className="font-semibold">Online ordering unavailable</h2>
        <p className="mt-2 text-sm text-stone-600">Reservations, payments and pickup orders are not available online.</p>
      </section>
      {menu.unavailable && <p role="status">Menu unavailable.</p>}
      {settings.mode === 'demo' && menu.demoProducts.length > 0 && <section data-testid="demo-catalog-lane" className="space-y-4">
        <h2 className="text-xl font-semibold">Fictional catalog · Not for sale</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{menu.demoProducts.map(product => <article key={product.id} className="space-y-3 rounded-xl border bg-white p-5">
          <p className="text-sm text-stone-500">{product.form}</p><h3 className="text-lg font-semibold break-words">{product.name}</h3><p className="text-sm text-stone-600">Not available for order</p>
        </article>)}</div>
      </section>}
      {menu.products.length > 0 && <section data-testid="package-backed-live-catalog" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{menu.products.map(product => <article key={product.id} className="space-y-3 rounded-xl border bg-white p-5">
        <p className="text-sm text-stone-500">{product.form}</p><h2 className="text-lg font-semibold break-words">{product.name}</h2><p>{formatPrice(product.priceCents, menu.currencyCode)}</p><p className="text-sm text-stone-600">Ordering unavailable</p>
      </article>)}</section>}
    </main>
    <footer className="mx-auto max-w-6xl border-t px-5 py-6"><StoreLogo svg={settings.logoIcon} hue={settings.logoColor} name={name} wrap /></footer>
  </div>;
}
