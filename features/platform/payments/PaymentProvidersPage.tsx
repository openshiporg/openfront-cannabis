import { notFound } from 'next/navigation';
import { getAuthenticatedUser } from '@/features/dashboard/actions/auth';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { Disclosure, PageTitle, StatusText } from '@/features/platform/components/cannabis-ui';
import { isPaymentProviderConfigured } from '@/features/keystone/utils/paymentProviderConfig';

const CARD_CODE = 'pp_authorizenet_authorizenet';
import { Workboard } from '@/features/platform/operations/components/WorkspaceKit';
import { ProviderToggle, TenderProviderLink } from './ProviderControls';

export async function PaymentProvidersPage() {
  // The page lists finance records: a role without the finance grant has no such page.
  const auth = await getAuthenticatedUser();
  const role = auth.success ? (auth.data as any)?.authenticatedItem?.role : null;
  if (role?.canManageFinance !== true) notFound();
  const result = await keystoneClient(`query PaymentProviders { items: paymentProviders(orderBy: [{ name: asc }], take: 50) { id name code isInstalled tenderConfigurations(take: 20) { id displayName type enabled } } tenderConfigurations(take:50){id displayName type} }`);
  const items = result.success ? result.data.items : []; const tenders = result.success ? result.data.tenderConfigurations : [];
  const breadcrumbs = [{ type: 'link' as const, label: 'Platform', href: '/dashboard/platform' }, { type: 'page' as const, label: 'Payment providers' }];
  const connected = (code: string) => isPaymentProviderConfigured(code);
  const label = (item: any) => item.code === 'pp_manual_pickup' ? 'On' : !connected(item.code) ? 'Not connected' : item.isInstalled ? 'On' : 'Off';
  const note = (item: any) => item.code === 'pp_manual_pickup' ? 'Shoppers reserve online and pay with cash or debit when they collect.'
    : connected(item.code) ? (item.isInstalled ? 'Shoppers can pay with this when they order online.' : 'Connected, and switched off. Shoppers are not offered it.')
    : 'Add this provider’s account keys to the server settings, then switch it on here.';
  // A provider the store has keys for but has never used has no record yet; it appears once the keys are in place.
  const counter = items.some((item: any) => item.code === 'pp_manual_pickup') ? [] : [{ id: 'pp_manual_pickup', code: 'pp_manual_pickup', name: 'Pay at pickup: cash or debit', isInstalled: true, tenderConfigurations: [], pending: true }];
  const rows = [...counter, ...items, ...(items.some((item: any) => item.code === CARD_CODE) ? [] : [{ id: CARD_CODE, code: CARD_CODE, name: 'Card (Authorize.net)', isInstalled: connected(CARD_CODE), tenderConfigurations: [], pending: true }])];
  return <PageContainer header={<PageTitle title="Payment providers" meta="How shoppers pay for online orders. Cash and debit at the counter always work." />} breadcrumbs={breadcrumbs}><Workboard>
    <section className="overflow-hidden rounded-[6px] border border-border bg-card">
      <div className="divide-y divide-border">{rows.map((item: any) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <div className="min-w-0"><p className="text-sm font-medium">{item.name}</p><p className="text-[13px] text-muted-foreground">{note(item)}</p></div>
        <div className="flex items-center gap-3"><StatusText tone={label(item) === 'On' ? 'ok' : 'muted'}>{label(item)}</StatusText>{!item.pending && item.code !== 'pp_manual_pickup' && connected(item.code) && <ProviderToggle id={item.id} installed={item.isInstalled} />}</div>
      </div>)}</div>
    </section>
    {tenders.some((tender: any) => tender.type !== 'cash') && items.length > 0 && <Disclosure label="Match a counter payment type to a provider"><TenderProviderLink providers={items} tenders={tenders} /></Disclosure>}
  </Workboard></PageContainer>;
}
