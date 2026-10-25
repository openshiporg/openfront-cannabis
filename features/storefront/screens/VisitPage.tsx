import Link from 'next/link';
import type React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { getPublicCannabisMenu, getPublicCannabisStorefrontSettings } from '../lib/data/menu';
import { menuForms, menuItems } from './MenuPage';
import { addressLines, ageRule, directionsHref, openState, tenderLabels } from '../lib/visit';
import { StorefrontShell, storeName } from '../components/StorefrontShell';

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
    ['Phone', visit?.phone ? <a href={`tel:${visit.phone.replace(/[^\d+]/g, '')}`} className="font-semibold text-cn-ink underline decoration-cn-ink/30 underline-offset-4">{visit.phone}</a> : 'Not published'],
    ['Age', ages.medical != null ? `${ages.adult}+ adult-use · ${ages.medical}+ with a medical card` : `${ages.adult}+`],
    ['Payment', tenders.length ? tenders.join(' · ') : 'Not published'],
    ['Ordering', 'In store only'],
  ];
  return <StorefrontShell settings={settings} forms={forms} current="visit">
    <div className="mx-auto grid max-w-[1440px] gap-6 px-4 pb-20 pt-4 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
      <section aria-labelledby="cn-visit-title" className="relative flex min-h-[360px] flex-col overflow-hidden rounded-[2px] bg-cn-cover px-6 pb-7 pt-12 sm:px-9 lg:min-h-[calc(100svh-112px)]">
        <span className="cn-display text-[64px] leading-none text-cn-ink sm:text-[88px]">{ages.adult}+</span>
        <h1 id="cn-visit-title" className="cn-display mt-auto break-words pt-16 text-[48px] leading-[0.95] text-cn-ink [text-wrap:balance] sm:text-[72px] xl:text-[88px]">{settings.isConfigured ? storeName(settings) : 'Visit'}</h1>
        <div className="mt-8 flex flex-wrap gap-2">
          {directions && <span className="cn-track"><a href={directions} target="_blank" rel="noreferrer" className="cn-pill" data-tone="ink">Directions<ArrowUpRight className="size-4" aria-hidden="true" /></a></span>}
          <span className="cn-track"><Link href="/#menu" className="cn-pill">See the menu</Link></span>
        </div>
      </section>
      <dl className="grid content-start gap-y-7 self-start text-[17px] lg:pt-6">
        {rows.map(([term, value]) => <div key={term} className="grid gap-1 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-6"><dt className="cn-display text-[20px] text-cn-ink-2">{term}</dt><dd className="min-w-0 break-words text-cn-ink">{value}</dd></div>)}
      </dl>
    </div>
  </StorefrontShell>;
}
