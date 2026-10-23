import type { CSSProperties, ReactNode } from 'react';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { PublicStorefrontSettingsResult } from '../lib/data/menu';
import { AGE_COOKIE } from '../lib/age';
import { storeBrand } from '../lib/brand';
import { AgeGate } from './AgeGate';
import { PhoneMenu } from './PhoneMenu';
import { StoreLogo } from './StoreLogo';

export type ShellForm = { key: string; label: string; count: number };

export function storeName(settings: PublicStorefrontSettingsResult) {
  return settings.businessName || 'Dispensary';
}

/** Public frame: age gate, 21+ strip, header, phone menu and footer. */
export async function StorefrontShell({ settings, forms = [], children }: { settings: PublicStorefrontSettingsResult; forms?: ShellForm[]; children: ReactNode }) {
  const confirmed = (await cookies()).get(AGE_COOKIE)?.value === '1';
  const brand = storeBrand(settings);
  const name = storeName(settings);
  const logo = (wrap = false) => <StoreLogo svg={brand.logoSvg} hue={brand.logoColor} name={name} wrap={wrap} />;
  const theme = { '--cn-h': brand.hue } as CSSProperties;
  const shortcuts = forms.slice(0, 5);
  return <div className="storefront-theme flex min-h-screen flex-col overflow-x-clip" style={theme}>
    <AgeGate storeName={name} confirmed={confirmed} />
    <div className="bg-cn-ink text-[#f6f4ee]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2 text-[12px] sm:px-6">
        <span className="cn-num tracking-[0.12em]">21+ ONLY</span>
        <span className="truncate text-[#f6f4ee]/75">In-store purchase only</span>
      </div>
    </div>
    <header className="sticky top-0 z-40 border-b border-cn-line bg-cn-bg/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label={`${name} menu`} className="inline-flex min-w-0 items-center text-cn-ink">{logo()}</Link>
        <nav aria-label="Menu forms" className="hidden min-w-0 items-center gap-1 lg:flex">
          <Link href="/#menu" className="rounded-full px-3 py-2 text-[14px] font-medium text-cn-ink hover:bg-cn-well">Menu</Link>
          {shortcuts.map(form => <Link key={form.key} href={`/?form=${encodeURIComponent(form.key)}#menu`} className="rounded-full px-3 py-2 text-[14px] text-cn-ink-2 hover:bg-cn-well hover:text-cn-ink">{form.label}</Link>)}
        </nav>
        <Link href="/dashboard/signin" className="hidden shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[14px] text-cn-ink-2 hover:bg-cn-well hover:text-cn-ink sm:inline-flex">Staff sign in<ArrowUpRight className="size-4" aria-hidden="true" /></Link>
        <PhoneMenu>
          <nav aria-label="Phone menu" className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[calc(100vw-2rem)] max-w-sm rounded-[24px] border border-cn-line bg-cn-surface p-3 shadow-[0_18px_60px_rgb(24_32_27/0.22)]">
            <div className="px-2 pb-2 text-cn-ink">{logo(true)}</div>
            <ul className="divide-y divide-cn-line border-y border-cn-line">
              <li><Link href="/#menu" className="flex min-h-12 items-center justify-between px-2 text-[15px] font-medium text-cn-ink">Menu<span className="cn-num text-[12px] text-cn-ink-3">{forms.reduce((sum, form) => sum + form.count, 0)}</span></Link></li>
              {forms.map(form => <li key={form.key}><Link href={`/?form=${encodeURIComponent(form.key)}#menu`} className="flex min-h-12 items-center justify-between px-2 text-[15px] text-cn-ink-2">{form.label}<span className="cn-num text-[12px] text-cn-ink-3">{form.count}</span></Link></li>)}
            </ul>
            <Link href="/dashboard/signin" className="mt-1 flex min-h-12 items-center justify-between px-2 text-[15px] text-cn-ink-2">Staff sign in<ArrowUpRight className="size-4" aria-hidden="true" /></Link>
          </nav>
        </PhoneMenu>
      </div>
    </header>
    <main className="flex-1">{children}</main>
    <footer className="border-t border-cn-line">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:px-6">
        <div className="min-w-0 space-y-2 text-cn-ink">
          {logo(true)}
          {settings.tagline && <p className="max-w-md break-words text-[14px] text-cn-ink-2">{settings.tagline}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-cn-ink-2">
          <span className="cn-num tracking-[0.12em] text-cn-ink">21+</span>
          <Link href="/#menu" className="hover:text-cn-ink">Menu</Link>
          <Link href="/dashboard/signin" className="inline-flex items-center gap-1 hover:text-cn-ink">Staff sign in<ArrowUpRight className="size-3.5" aria-hidden="true" /></Link>
          <span className="cn-num">© {new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  </div>;
}
