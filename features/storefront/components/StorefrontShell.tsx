import type { CSSProperties, ReactNode } from 'react';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { PublicStorefrontSettingsResult } from '../lib/data/menu';
import { AGE_COOKIE } from '../lib/age';
import { storeBrand } from '../lib/brand';
import { addressLines, ageRule, ageStripLabel, directionsHref, openState, tenderLabels } from '../lib/visit';
import { AgeGate } from './AgeGate';
import { PhoneMenu } from './PhoneMenu';
import { StoreLogo } from './StoreLogo';

export type ShellForm = { key: string; label: string; count: number };

export function storeName(settings: PublicStorefrontSettingsResult) {
  return settings.businessName || 'Dispensary';
}

/** Public frame: age gate, age and open-state strip, header, phone menu, and a footer with address, hours and payment. */
export async function StorefrontShell({ settings, forms = [], current, children }: { settings: PublicStorefrontSettingsResult; forms?: ShellForm[]; current?: 'menu' | 'visit'; children: ReactNode }) {
  const confirmed = (await cookies()).get(AGE_COOKIE)?.value === '1';
  const brand = storeBrand(settings);
  const name = storeName(settings);
  const logo = (wrap = false) => <StoreLogo svg={brand.logoSvg} hue={brand.logoColor} name={name} wrap={wrap} />;
  const theme = { '--cn-h': brand.hue } as CSSProperties;
  const shortcuts = forms;
  const navClass = (on: boolean) => `shrink-0 rounded-[2px] px-3 py-2 text-[15px] hover:bg-cn-surface hover:text-cn-ink ${on ? 'font-semibold text-cn-ink' : 'text-cn-ink-2'}`;
  const visit = settings.visit;
  const ages = ageRule(visit);
  const open = openState(visit);
  const address = addressLines(visit);
  const directions = directionsHref(visit);
  const tenders = tenderLabels(visit);
  const ageLabel = ageStripLabel(visit);
  return <div className="storefront-theme flex min-h-dvh flex-col overflow-x-clip" style={theme}>
    <AgeGate storeName={name} confirmed={confirmed} adultAge={ages.adult} medicalAge={ages.medical} />
    <div className="bg-cn-ink text-cn-bg">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-2 text-[13px] font-semibold sm:px-6">
        <span className="cn-num shrink-0">{ageLabel}</span>
        <span className="inline-flex min-w-0 items-baseline gap-2 truncate">{open && <span aria-hidden="true" className={`cn-dot ${open.open ? 'bg-[#1f7a44]' : 'bg-cn-bg/40'}`} />}<span className="truncate">{open ? open.label : 'In-store purchase only'}</span></span>
      </div>
    </div>
    <header className="sticky top-0 z-40 bg-cn-bg">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label={`${name} menu`} className="inline-flex min-w-0 items-center text-cn-ink">{logo()}</Link>
        <nav aria-label="Menu forms" className="no-scrollbar hidden min-w-0 items-center gap-1 overflow-x-auto lg:flex">
          <Link href="/#menu" aria-current={current === 'menu' ? 'page' : undefined} className={navClass(current === 'menu')}>Menu</Link>
          <Link href="/visit" aria-current={current === 'visit' ? 'page' : undefined} className={navClass(current === 'visit')}>Visit</Link>
          {shortcuts.map(form => <Link key={form.key} href={`/?form=${encodeURIComponent(form.key)}#menu`} className={navClass(false)}>{form.label}</Link>)}
        </nav>
        <Link href="/dashboard/signin" className="hidden shrink-0 items-center gap-1.5 rounded-[2px] px-3 py-2 text-[15px] text-cn-ink-2 hover:bg-cn-surface hover:text-cn-ink sm:inline-flex">Staff sign in<ArrowUpRight className="size-4" aria-hidden="true" /></Link>
        <PhoneMenu>
          <nav aria-label="Phone menu" className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[calc(100vw-2rem)] max-w-sm rounded-[2px] bg-cn-surface p-3 shadow-[0_24px_48px_-12px_rgb(0_0_0/0.7)]">
            <div className="px-2 pb-2 text-cn-ink">{logo(true)}</div>
            <ul className="grid gap-1">
              <li><Link href="/#menu" className="flex min-h-12 items-center justify-between rounded-[2px] bg-cn-leaf px-3 text-[16px] font-semibold text-cn-ink">Menu<span className="cn-num text-[13px] text-cn-ink-3">{forms.reduce((sum, form) => sum + form.count, 0)}</span></Link></li>
              {forms.map(form => <li key={form.key}><Link href={`/?form=${encodeURIComponent(form.key)}#menu`} className="flex min-h-12 items-center justify-between rounded-[2px] bg-cn-leaf px-3 text-[16px] text-cn-ink-2">{form.label}<span className="cn-num text-[13px] text-cn-ink-3">{form.count}</span></Link></li>)}
            </ul>
            <Link href="/visit" className="mt-1 flex min-h-12 items-center justify-between px-2 text-[15px] font-medium text-cn-ink">Visit · hours and address</Link>
            <Link href="/dashboard/signin" className="mt-1 flex min-h-12 items-center justify-between px-2 text-[15px] text-cn-ink-2">Staff sign in<ArrowUpRight className="size-4" aria-hidden="true" /></Link>
          </nav>
        </PhoneMenu>
      </div>
    </header>
    <main className="flex-1">{children}</main>
    <footer className="bg-cn-cover">
      <div className="mx-auto grid max-w-[1440px] gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,1fr))]">
        <div className="min-w-0 space-y-2 text-cn-ink">
          {logo(true)}
          {settings.tagline && <p className="max-w-md break-words text-[14px] text-cn-ink-2">{settings.tagline}</p>}
        </div>
        {address.length > 0 && <section aria-labelledby="visit-title" className="min-w-0 text-[14px]">
          <h2 id="visit-title" className="cn-display text-[17px] text-cn-ink">Visit</h2>
          <address className="mt-2 not-italic text-cn-ink">{address.map(line => <span key={line} className="block break-words">{line}</span>)}</address>
          {visit?.phone && <a href={`tel:${visit.phone.replace(/[^\d+]/g, '')}`} className="mt-1 inline-flex min-h-11 items-center text-cn-ink-2 hover:text-cn-ink">{visit.phone}</a>}
          {directions && <a href={directions} target="_blank" rel="noreferrer" className="mt-1 flex min-h-11 items-center gap-1 text-cn-accent">Directions<ArrowUpRight className="size-3.5" aria-hidden="true" /></a>}
        </section>}
        {open && <section aria-labelledby="hours-title" className="min-w-0 text-[14px]">
          <h2 id="hours-title" className="cn-display text-[17px] text-cn-ink">Hours</h2>
          <p className="mt-2 inline-flex items-baseline gap-2 text-cn-ink"><span aria-hidden="true" className={`cn-dot ${open.open ? 'bg-cn-ok' : 'bg-cn-ink-3'}`} />{open.open ? 'Open now' : 'Closed now'}</p>
          <p className="cn-num mt-1 text-[13px] text-cn-ink-2">Daily {open.hours}</p>
        </section>}
        {tenders.length > 0 && <section aria-labelledby="pay-title" className="min-w-0 text-[14px]">
          <h2 id="pay-title" className="cn-display text-[17px] text-cn-ink">Payment</h2>
          <p className="mt-2 text-cn-ink">{tenders.join(' · ')}</p>
        </section>}
      </div>
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-5 gap-y-1 px-4 pb-6 text-[14px] text-cn-ink-2 sm:px-6">
        <span className="cn-display inline-flex min-h-11 items-center text-[17px] text-cn-ink">{ages.medical != null ? `${ages.adult}+ · PATIENTS ${ages.medical}+` : `${ages.adult}+`}</span>
        <Link href="/#menu" className="inline-flex min-h-11 items-center hover:text-cn-ink">Menu</Link>
        <Link href="/visit" className="inline-flex min-h-11 items-center hover:text-cn-ink">Visit</Link>
        <Link href="/dashboard/signin" className="inline-flex min-h-11 items-center gap-1 hover:text-cn-ink">Staff sign in<ArrowUpRight className="size-3.5" aria-hidden="true" /></Link>
        <span className="cn-num inline-flex min-h-11 items-center">© {new Date().getFullYear()}</span>
      </div>
    </footer>
  </div>;
}
