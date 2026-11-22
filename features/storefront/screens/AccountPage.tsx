import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCustomerAccount, signOutCustomer } from '../lib/data/account';
import { getPublicCannabisMenu, getPublicCannabisStorefrontSettings } from '../lib/data/menu';
import { formatPrice } from '../lib/format';
import { ageRule } from '../lib/visit';
import { menuForms, menuItems } from './MenuPage';
import { OrderAgain, PasswordForm, ProfileForm, SignInForm, SignUpForm } from '../components/AccountForms';
import { StorefrontShell } from '../components/StorefrontShell';

const STATUS: Record<string, string> = { reserved: 'Reserved', preliminarily_eligible: 'Reserved', picking: 'Being picked', staged: 'Ready for pickup', final_verification: 'Ready for pickup', completed: 'Picked up', cancelled: 'Cancelled', expired: 'Expired', rejected: 'Not accepted' };
const title = 'cn-display text-[48px] text-cn-ink sm:text-[72px]';
const nextParam = (value: string | string[] | undefined) => typeof value === 'string' && /^\/(account|bag|order\/PU-[0-9A-F]{12})$/.test(value) ? value : undefined;

async function frame() {
  const [settings, menu, account] = await Promise.all([getPublicCannabisStorefrontSettings(), getPublicCannabisMenu(), getCustomerAccount()]);
  return { settings, menu, account, forms: menuForms(menuItems(menu)) };
}

export async function AccountSignInPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const [{ settings, account, forms }, query] = await Promise.all([frame(), searchParams]);
  const next = nextParam(query.next);
  if (account) redirect(next ?? '/account');
  return <StorefrontShell settings={settings} forms={forms} current="account">
    <section className="mx-auto max-w-[480px] px-4 py-10 sm:py-14">
      <h1 className={title}>Sign in</h1>
      <p className="mb-6 mt-3 text-[17px] text-cn-ink-2">See your orders and check out faster.</p>
      <SignInForm next={next} />
    </section>
  </StorefrontShell>;
}

export async function AccountSignUpPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const [{ settings, account, forms }, query] = await Promise.all([frame(), searchParams]);
  const next = nextParam(query.next);
  if (account) redirect(next ?? '/account');
  return <StorefrontShell settings={settings} forms={forms} current="account">
    <section className="mx-auto max-w-[480px] px-4 py-10 sm:py-14">
      <h1 className={title}>Create account</h1>
      <p className="mb-6 mt-3 text-[17px] text-cn-ink-2">Keep your orders in one place and skip typing your details each time. We still check your ID at pickup.</p>
      <SignUpForm next={next} minimumAge={ageRule(settings.visit).adult} />
    </section>
  </StorefrontShell>;
}

export async function AccountPage() {
  const { settings, menu, account, forms } = await frame();
  if (!account) redirect('/account/signin');
  const onMenu = new Map(menu.products.map(product => [product.id, product]));
  const money = (cents: number) => formatPrice(cents, account.currencyCode);
  const when = (iso: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', { timeZone: account.timezone || undefined, ...options }).format(new Date(iso));
  return <StorefrontShell settings={settings} forms={forms} current="account">
    <section className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 sm:py-14">
      <h1 className={title}>Your account</h1>
      <p className="mt-3 text-[17px] text-cn-ink-2">Signed in as <span className="text-cn-ink">{account.email}</span></p>
      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
        <section aria-labelledby="orders-title">
          <h2 id="orders-title" className="cn-display text-[36px] text-cn-ink sm:text-[44px]">Orders</h2>
          {account.orders.length === 0
            ? <div className="mt-4 space-y-4 border-t border-cn-line pt-5"><p className="text-[17px] text-cn-ink-2">No orders yet. Orders you place while signed in show up here.</p><Link href="/#menu" data-tone="ink" className="cn-btn min-h-12">See the menu</Link></div>
            : <ul className="mt-4 border-t border-cn-line">{account.orders.map(order => {
              const again = order.lines.flatMap(line => { const product = line.productId ? onMenu.get(line.productId) : undefined; return product ? [{ id: product.id, name: product.name, priceCents: product.priceCents, units: line.units }] : []; });
              return <li key={order.reference} className="border-b border-cn-line py-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <Link href={`/order/${order.reference}`} className="cn-num text-[19px] font-semibold text-cn-ink underline decoration-cn-line decoration-2 underline-offset-4">{order.reference}</Link>
                  <span className="cn-num text-[19px] text-cn-ink">{money(order.totalCents)}</span>
                </div>
                <p className="mt-1 text-[15px] text-cn-ink-2">{STATUS[order.status] ?? 'In progress'} · placed {when(order.placedAt, { month: 'short', day: 'numeric', year: 'numeric' })}{order.pickupStart && !['cancelled', 'expired', 'completed'].includes(order.status) ? ` · pickup ${when(order.pickupStart, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}` : ''}</p>
                <p className="mt-2 break-words text-[16px] text-cn-ink">{order.lines.map(line => `${line.units} × ${line.title}`).join(', ')}</p>
                <div className="mt-3 flex flex-wrap gap-2"><Link href={`/order/${order.reference}`} className="cn-btn">View order</Link><OrderAgain lines={again} /></div>
              </li>;
            })}</ul>}
        </section>
        <div className="space-y-12">
          <section aria-labelledby="details-title"><h2 id="details-title" className="cn-name mb-4 text-[22px] text-cn-ink">Your details</h2><ProfileForm name={account.name} phone={account.phone} email={account.email} /></section>
          <section aria-labelledby="password-title"><h2 id="password-title" className="cn-name mb-4 text-[22px] text-cn-ink">Password</h2><PasswordForm /></section>
          <form action={signOutCustomer}><button type="submit" className="cn-btn min-h-12">Sign out</button></form>
        </div>
      </div>
    </section>
  </StorefrontShell>;
}
