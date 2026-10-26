import Link from 'next/link';
import type React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { getPublicCannabisMenu, getPublicCannabisStorefrontSettings } from '../lib/data/menu';
import { menuForms, menuItems } from './MenuPage';
import { addressLines, ageRule, directionsHref, openState, tenderLabels } from '../lib/visit';
import { COVER_PHOTO, StorefrontShell, storeName } from '../components/StorefrontShell';

/** Everything a customer needs before walking in: where, when, what to bring, how to pay. */
export async function VisitPage() {
  const [settings, menu] = await Promise.all([getPublicCannabisStorefrontSettings(), getPublicCannabisMenu()]);
  const { live, demo } = menuItems(menu);
  const forms = menuForms(live.length ? live : settings.mode === 'demo' ? demo : []);
  const visit = settings.visit;
  const open = openState(visit);
  const address = addressLines(visit);
  const directions = directionsHref(visit);
  const tenders = tenderLabels(visit);
  const ages = ageRule(visit);
  const rows: Array<[string, React.ReactNode]> = [
    ['Address', address.length ? <>{address.map(line => <span key={line} className="block">{line}</span>)}</> : 'Not published'],
    ['Hours', open ? <><span className="block">Daily {open.hours}</span><span className="mt-1 inline-flex items-baseline gap-2 text-cn-ink-2"><span aria-hidden="true" className={`cn-dot ${open.open ? 'bg-cn-ok' : 'bg-cn-ink-3'}`} />{open.label}</span></> : 'Not published'],
    ['Phone', visit?.phone ? <a href={`tel:${visit.phone.replace(/[^\d+]/g, '')}`} className="font-semibold text-cn-ink underline decoration-cn-line decoration-2 underline-offset-4 hover:decoration-cn-ink">{visit.phone}</a> : 'Not published'],
    ['Age', ages.medical != null ? `${ages.adult}+ adult-use · ${ages.medical}+ with a medical card · valid ID` : `${ages.adult}+ · valid ID`],
    ['Payment', tenders.length ? tenders.join(' · ') : 'Not published'],
    ['Ordering', 'In store only'],
  ];
  return <StorefrontShell settings={settings} forms={forms} current="visit">
    <div className="mx-auto grid max-w-[1440px] lg:min-h-[calc(100svh-var(--cn-header)-30px)] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <figure className="relative min-h-[240px] overflow-hidden bg-cn-raise sm:min-h-[360px] lg:min-h-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={COVER_PHOTO.src} alt="" className="absolute inset-0 size-full object-cover [object-position:36%_42%]" />
      </figure>
      <section aria-labelledby="cn-visit-title" className="min-w-0 bg-cn-page px-4 py-8 sm:px-8 sm:py-10 lg:px-12">
        <h1 id="cn-visit-title" className="cn-display break-words text-[56px] text-cn-ink [text-wrap:balance] sm:text-[88px]">{settings.isConfigured ? `Visit ${storeName(settings)}` : 'Visit'}</h1>
        <div className="mt-6 flex flex-wrap gap-2">
          {directions && <a href={directions} target="_blank" rel="noreferrer" className="cn-btn" data-tone="ink">Directions<ArrowUpRight className="size-4" aria-hidden="true" /></a>}
          <Link href="/#menu" className="cn-btn">See the menu</Link>
        </div>
        <dl className="mt-8 border-t border-cn-line text-[17px]">
          {rows.map(([term, value]) => <div key={term} className="grid gap-1 border-b border-cn-line py-4 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-6"><dt className="text-cn-ink-3">{term}</dt><dd className="min-w-0 break-words text-cn-ink">{value}</dd></div>)}
        </dl>
      </section>
    </div>
  </StorefrontShell>;
}
