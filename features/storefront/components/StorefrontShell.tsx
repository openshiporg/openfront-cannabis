import type { CSSProperties, ReactNode } from 'react';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { PublicStorefrontSettingsResult } from '../lib/data/menu';
import { AGE_COOKIE } from '../lib/age';
import { storeBrand } from '../lib/brand';
import { chapterInk } from '../lib/chapters';
import { addressLines, ageRule, ageStripLabel, directionsHref, openState, tenderLabels } from '../lib/visit';
import { AgeGate } from './AgeGate';
import { PhoneMenu } from './PhoneMenu';
import { StoreLogo } from './StoreLogo';

export type ShellForm = { key: string; label: string; count: number };

export function storeName(settings: PublicStorefrontSettingsResult) {
  return settings.businessName || 'Dispensary';
}

/** The cover photograph's source, credited in the colophon. */
export const COVER_PHOTO = {
  src: '/storefront/cover-silver-star-haze.jpg',
  credit: 'Cover photo: Cannabis Pictures, CC BY 2.0',
  href: 'https://commons.wikimedia.org/wiki/File:Cannabis_Silver_star_haze_in_bloom_(25519864035).jpg',
};

/** Public frame: age gate, age and open-state strip, header, phone menu, and the catalog colophon. */
export async function StorefrontShell({ settings, forms = [], current, children }: { settings: PublicStorefrontSettingsResult; forms?: ShellForm[]; current?: 'menu' | 'visit'; children: ReactNode }) {
  const confirmed = (await cookies()).get(AGE_COOKIE)?.value === '1';
  const brand = storeBrand(settings);
  const name = storeName(settings);
  const logo = (wrap = false) => <StoreLogo svg={brand.logoSvg} hue={brand.logoColor} name={name} wrap={wrap} />;
  const theme = { '--cn-h': brand.hue } as CSSProperties;
  const visit = settings.visit;
  const ages = ageRule(visit);
  const open = openState(visit);
  const address = addressLines(visit);
  const directions = directionsHref(visit);
  const tenders = tenderLabels(visit);
  return <div className="storefront-theme flex min-h-dvh flex-col overflow-x-clip" style={theme}>
    <AgeGate storeName={name} logo={logo()} confirmed={confirmed} adultAge={ages.adult} medicalAge={ages.medical} />
    <div className="bg-cn-ink text-cn-on-ink">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-1.5 text-[13px] font-semibold sm:px-6">
        <span className="cn-num shrink-0">{ageStripLabel(visit)}</span>
        <span className="inline-flex min-w-0 items-baseline gap-2 truncate">{open && <span aria-hidden="true" className={`cn-dot ${open.open ? 'bg-[#16834a]' : 'bg-cn-on-ink/40'}`} />}<span className="truncate">{open ? open.label : 'In-store purchase only'}</span></span>
      </div>
    </div>
    <header className="sticky top-0 z-40 border-b border-cn-line bg-cn-bg">
      <div className="mx-auto flex h-[var(--cn-header)] max-w-[1440px] items-center justify-between gap-6 px-4 sm:px-6">
        <Link href="/" aria-label={`${name} menu`} className="inline-flex min-w-0 items-center text-cn-ink">{logo()}</Link>
        <nav aria-label="Store" className="hidden items-center gap-7 sm:flex">
          <Link href="/#menu" aria-current={current === 'menu' ? 'page' : undefined} className="cn-tab">Menu</Link>
          <Link href="/visit" aria-current={current === 'visit' ? 'page' : undefined} className="cn-tab">Visit</Link>
          <Link href="/dashboard/signin" className="cn-tab text-cn-ink-3">Staff sign in<ArrowUpRight className="size-3.5" aria-hidden="true" /></Link>
        </nav>
        <PhoneMenu>
          <nav aria-label="Phone menu" className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[calc(100vw-2rem)] max-w-sm rounded-[4px] border border-cn-line bg-cn-page p-2 shadow-[0_24px_48px_-16px_rgb(0_0_0/0.8)]">
            <ul className="divide-y divide-cn-line">
              <li><Link href="/#menu" className="flex min-h-12 items-center justify-between px-3 text-[16px] font-semibold text-cn-ink">Menu<span className="cn-num text-[14px] font-normal text-cn-ink-3">{forms.reduce((sum, form) => sum + form.count, 0)}</span></Link></li>
              {forms.map(form => <li key={form.key}><Link href={`/?form=${encodeURIComponent(form.key)}#menu`} className="flex min-h-12 items-center justify-between gap-3 px-3 text-[16px] text-cn-ink-2">
                <span className="inline-flex items-center gap-2.5"><span aria-hidden="true" className="inline-block size-2.5 rounded-[2px]" style={{ background: chapterInk(form.label) }} />{form.label}</span><span className="cn-num text-[14px] text-cn-ink-3">{form.count}</span>
              </Link></li>)}
              <li><Link href="/visit" className="flex min-h-12 items-center px-3 text-[16px] font-semibold text-cn-ink">Visit · hours and address</Link></li>
              <li><Link href="/dashboard/signin" className="flex min-h-12 items-center justify-between px-3 text-[15px] text-cn-ink-2">Staff sign in<ArrowUpRight className="size-4" aria-hidden="true" /></Link></li>
            </ul>
          </nav>
        </PhoneMenu>
      </div>
    </header>
    <main className="flex-1">{children}</main>
    <footer className="mt-16 border-t border-cn-line bg-cn-page">
      <div className="mx-auto grid max-w-[1440px] gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))]">
        <div className="min-w-0 space-y-3 text-cn-ink">
          {logo(true)}
          {settings.tagline && <p className="max-w-md break-words text-[15px] text-cn-ink-2">{settings.tagline}</p>}
        </div>
        {address.length > 0 && <section aria-labelledby="visit-title" className="min-w-0 text-[15px]">
          <h2 id="visit-title" className="cn-name text-[18px] text-cn-ink">Visit</h2>
          <address className="mt-2 not-italic text-cn-ink-2">{address.map(line => <span key={line} className="block break-words">{line}</span>)}</address>
          {visit?.phone && <a href={`tel:${visit.phone.replace(/[^\d+]/g, '')}`} className="mt-1 inline-flex min-h-11 items-center text-cn-ink-2 hover:text-cn-ink">{visit.phone}</a>}
          {directions && <a href={directions} target="_blank" rel="noreferrer" className="flex min-h-11 items-center gap-1 font-semibold text-cn-ink underline decoration-cn-line decoration-2 underline-offset-4 hover:decoration-cn-ink">Directions<ArrowUpRight className="size-4" aria-hidden="true" /></a>}
        </section>}
        {open && <section aria-labelledby="hours-title" className="min-w-0 text-[15px]">
          <h2 id="hours-title" className="cn-name text-[18px] text-cn-ink">Hours</h2>
          <p className="mt-2 inline-flex items-baseline gap-2 text-cn-ink"><span aria-hidden="true" className={`cn-dot ${open.open ? 'bg-cn-ok' : 'bg-cn-ink-3'}`} />{open.open ? 'Open now' : 'Closed now'}</p>
          <p className="cn-num mt-1 text-cn-ink-2">Daily {open.hours}</p>
        </section>}
        {tenders.length > 0 && <section aria-labelledby="pay-title" className="min-w-0 text-[15px]">
          <h2 id="pay-title" className="cn-name text-[18px] text-cn-ink">Payment</h2>
          <p className="mt-2 text-cn-ink-2">{tenders.join(' · ')}</p>
          <p className="mt-1 text-cn-ink-3">In store only</p>
        </section>}
      </div>
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-6 gap-y-1 border-t border-cn-line px-4 py-4 text-[14px] text-cn-ink-3 sm:px-6">
        <span className="cn-display text-[20px] text-cn-ink">{ages.medical != null ? `${ages.adult}+ · patients ${ages.medical}+` : `${ages.adult}+`}</span>
        <Link href="/#menu" className="inline-flex min-h-11 items-center hover:text-cn-ink">Menu</Link>
        <Link href="/visit" className="inline-flex min-h-11 items-center hover:text-cn-ink">Visit</Link>
        <Link href="/dashboard/signin" className="inline-flex min-h-11 items-center gap-1 hover:text-cn-ink">Staff sign in<ArrowUpRight className="size-3.5" aria-hidden="true" /></Link>
        <a href={COVER_PHOTO.href} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center hover:text-cn-ink">{COVER_PHOTO.credit}</a>
        <span className="cn-num inline-flex min-h-11 items-center">© {new Date().getFullYear()}</span>
      </div>
    </footer>
  </div>;
}
