import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { getStoreSettingsSetup } from '../actions/settings';
import { StorefrontSettingsForm } from '../components/StorefrontSettingsForm';

export async function StorefrontSettingsPage() {
  const result = await getStoreSettingsSetup();
  const header = <div><h1 className="text-xl font-semibold">Store Settings</h1><p className="text-sm text-muted-foreground">Business name, logo and storefront colours.</p></div>;
  const breadcrumbs = [{ type: 'link' as const, label: 'Platform', href: '/dashboard/platform' }, { type: 'page' as const, label: 'Store Settings' }];
  return <PageContainer header={header} breadcrumbs={breadcrumbs}>
    {result.state === 'ok' && <div className="p-4 md:p-6"><StorefrontSettingsForm setup={result.data} /></div>}
    {result.state === 'forbidden' && <div role="status" className="m-4 flex gap-3 rounded-lg border bg-muted/40 p-4 md:m-6"><AlertTriangle className="size-5 shrink-0 text-muted-foreground" /><div><p className="font-medium">No access</p><p className="text-sm text-muted-foreground">You need permission to manage store settings for this premises.</p></div></div>}
    {result.state === 'unavailable' && <div role="alert" className="m-4 flex gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 md:m-6"><AlertTriangle className="size-5 shrink-0 text-destructive" /><div className="space-y-2"><p className="font-medium">Store Settings are unavailable</p><p className="text-sm text-muted-foreground">They could not be loaded. Try again.</p><Button asChild size="sm" variant="outline"><Link href="/dashboard/platform/store-settings">Retry</Link></Button></div></div>}
  </PageContainer>;
}
