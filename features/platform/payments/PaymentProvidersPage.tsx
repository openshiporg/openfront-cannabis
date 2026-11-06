import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { PageTitle } from '@/features/platform/components/cannabis-ui';
import { Workboard, Empty } from '@/features/platform/operations/components/WorkspaceKit';
import { ProviderToggle, TenderProviderLink } from './ProviderControls';

export async function PaymentProvidersPage() {
  const result = await keystoneClient(`query PaymentProviders { items: paymentProviders(orderBy: [{ name: asc }], take: 50) { id name code isInstalled tenderConfigurations(take: 20) { id displayName type enabled } } tenderConfigurations(take:50){id displayName type} }`);
  const items = result.success ? result.data.items : []; const tenders = result.success ? result.data.tenderConfigurations : [];
  const breadcrumbs = [{ type: 'link' as const, label: 'Platform', href: '/dashboard/platform' }, { type: 'page' as const, label: 'Payment providers' }];
  return <PageContainer header={<PageTitle title="Payment providers" meta="Cash, debit and cannabis-specific bank payment adapters. Visa, Mastercard, Stripe and PayPal are not available for cannabis sales." />} breadcrumbs={breadcrumbs}><Workboard>
    <section className="rounded-md border border-border bg-card"><div className="border-b border-border px-4 py-3 font-medium">Providers · {items.length}</div>{items.length ? <div className="divide-y divide-border">{items.map((item: any) => <div key={item.id} className="grid gap-2 px-4 py-3 sm:grid-cols-3"><div><strong>{item.name}</strong><span className="block font-mono text-xs text-muted-foreground">{item.code}</span></div><div><div>{item.isInstalled ? 'Installed' : 'Not configured'}</div><ProviderToggle id={item.id} installed={item.isInstalled}/></div><div>{item.tenderConfigurations?.length ? item.tenderConfigurations.map((t: any) => `${t.displayName} (${t.type})`).join(', ') : 'Not linked'}</div></div>)}</div> : <Empty>No payment providers are configured.</Empty>}<TenderProviderLink providers={items} tenders={tenders}/></section>
    <p className="text-sm text-muted-foreground">Cash is paid at the counter. Debit is processed on a cannabis-friendly PIN terminal. Aeropay requires merchant credentials and remains unavailable until configured. Link providers through Tender Configuration.</p></Workboard></PageContainer>;
}
