import { ArrowUpRight } from 'lucide-react';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { Notice, PageTitle, PillLink, Track } from '@/features/platform/components/cannabis-ui';
import { WorkspaceStateNotice } from '@/features/platform/operations/components/WorkspaceKit';
import { getCannabisWorkspace } from '@/features/platform/workspaces/actions/workspaces';
import { getPublicCannabisMenu, getPublicCannabisStorefrontSettings } from '@/features/storefront/lib/data/menu';
import { ageStripLabel, openState } from '@/features/storefront/lib/visit';
import { getStoreSettingsSetup } from '../actions/settings';
import { StorefrontSettingsForm } from '../components/StorefrontSettingsForm';

/** What a visitor sees right now, read from the same public queries the storefront uses. */
async function publicState() {
  const [settings, menu] = await Promise.all([getPublicCannabisStorefrontSettings(), getPublicCannabisMenu()]);
  const items = menu.products.slice(0, 2).map(product => ({ form: product.form, name: product.name }));
  const open = openState(settings.visit);
  const strip = { age: ageStripLabel(settings.visit), hours: open?.label ?? 'In-store purchase only' };
  if (settings.unavailable) return { tone: 'danger' as const, label: 'Storefront unavailable', items, strip };
  if (!settings.isConfigured) return { tone: 'warn' as const, label: 'Storefront shows "Store not set up"', items, strip };
  if (menu.unavailable) return { tone: 'danger' as const, label: menu.reason === 'sales_rules' ? 'Live, menu unavailable: sales rules invalid' : 'Live, menu unavailable', items, fix: menu.reason === 'sales_rules', strip };
  return { tone: 'ok' as const, label: menu.products.length ? `Live · ${menu.products.length} in stock` : 'Live · nothing in stock', items, strip };
}

export async function StorefrontSettingsPage() {
  const result = await getStoreSettingsSetup();
  const header = <PageTitle title="Store Settings" meta="Business name, logo and storefront accent" />;
  const breadcrumbs = [{ type: 'link' as const, label: 'Platform', href: '/dashboard/platform' }, { type: 'page' as const, label: 'Store Settings' }];
  const setup = result.state === 'forbidden' ? await getCannabisWorkspace('overview') : null;
  const visible = result.state === 'ok' ? await publicState() : null;
  return <PageContainer header={header} breadcrumbs={breadcrumbs}>
    <div className="space-y-6 px-4 pb-28 md:px-6">
      {visible && <Notice tone={visible.tone} action={<Track>{visible.fix && <PillLink href="/dashboard/platform/authority#sales-rules">Fix sales rules</PillLink>}<PillLink href="/dashboard/platform/authority#premises">Address and phone</PillLink><a href="/" target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center gap-1 rounded-full bg-background px-3 text-[13px] font-medium shadow-[0_1px_2px_rgb(0_0_0/0.12)] dark:bg-zinc-800">View storefront<ArrowUpRight className="size-3.5" aria-hidden="true" /></a></Track>}>Public storefront: {visible.label}</Notice>}
      {result.state === 'ok' && <StorefrontSettingsForm setup={result.data} previewItems={visible?.items ?? []} previewStrip={visible?.strip} />}
      {result.state === 'forbidden' && (setup?.state === 'setup_required' ? <WorkspaceStateNotice result={{ state: 'setup_required' }} retryHref="/dashboard/platform/store-settings" /> : <Notice tone="warn">No access to Store Settings for this premises</Notice>)}
      {result.state === 'unavailable' && <div role="alert"><Notice tone="danger" action={<Track><PillLink href="/dashboard/platform/store-settings" active>Retry</PillLink></Track>}>Store Settings could not be loaded</Notice></div>}
    </div>
  </PageContainer>;
}
