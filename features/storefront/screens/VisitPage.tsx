import Link from 'next/link';
import type React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { getPublicCannabisStorefrontSettings } from '../lib/data/menu';
import { addressLines, ageRule, directionsHref, openState, tenderLabels } from '../lib/visit';
import { StorefrontShell, storeName } from '../components/StorefrontShell';

/** Everything a customer needs before walking in: where, when, what to bring, how to pay. */
export async function VisitPage() {
  const settings = await getPublicCannabisStorefrontSettings();
  const visit = settings.visit;
  const open = openState(visit);
  const address = addressLines(visit);
  const directions = directionsHref(visit);
  const tenders = tenderLabels(visit);
  const ages = ageRule(visit);
  const rows: Array<[string, React.ReactNode]> = [
    ['Address', address.length ? <>{address.map(line => <span key={line} className="block">{line}</span>)}</> : 'Not published'],
    ['Hours', open ? <><span className="block">Daily {open.hours}</span><span className="mt-1 inline-flex items-baseline gap-2 text-cn-ink-2"><span aria-hidden="true" className={`cn-dot ${open.open ? 'bg-cn-ok' : 'bg-cn-ink-3'}`} />{open.label}</span></> : 'Not published'],
    ['Phone', visit?.phone ? <a href={`tel:${visit.phone.replace(/[^\d+]/g, '')}`} className="text-cn-accent">{visit.phone}</a> : 'Not published'],
    ['Age', ages.medical != null ? `${ages.adult}+ adult-use · ${ages.medical}+ with a medical card` : `${ages.adult}+`],
    ['Payment', tenders.length ? tenders.join(' · ') : 'Not published'],
    ['Ordering', 'In store only'],
  ];
  return <StorefrontShell settings={settings}>
    <section className="mx-auto max-w-7xl px-4 pb-20 pt-12 sm:px-6 sm:pt-20">
      <p className="cn-num text-[12px] uppercase tracking-[0.14em] text-cn-accent">Visit</p>
      <h1 className="cn-display mt-3 break-words text-[44px] leading-[46px] text-cn-ink sm:text-[64px] sm:leading-[64px]">{settings.isConfigured ? storeName(settings) : 'Visit'}</h1>
      <dl className="cn-band mt-10 max-w-3xl divide-y divide-cn-line text-[15px]">
        {rows.map(([term, value]) => <div key={term} className="grid gap-1 px-5 py-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-6"><dt className="text-cn-ink-2">{term}</dt><dd className="min-w-0 break-words text-cn-ink">{value}</dd></div>)}
      </dl>
      <div className="mt-8 flex flex-wrap gap-2">
        {directions && <span className="cn-track"><a href={directions} target="_blank" rel="noreferrer" className="cn-pill" data-tone="ink">Directions<ArrowUpRight className="size-4" aria-hidden="true" /></a></span>}
        <span className="cn-track"><Link href="/#menu" className="cn-pill" data-active="true">See the menu</Link></span>
      </div>
    </section>
  </StorefrontShell>;
}
