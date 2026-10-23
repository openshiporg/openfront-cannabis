import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { Notice, PageTitle, PillLink, Track } from '@/features/platform/components/cannabis-ui';
import { getStoreSettingsSetup } from '../actions/settings';
import { StorefrontSettingsForm } from '../components/StorefrontSettingsForm';

export async function StorefrontSettingsPage() {
  const result = await getStoreSettingsSetup();
  const header = <PageTitle title="Store Settings" meta="Business name, logo and storefront accent" />;
  const breadcrumbs = [{ type: 'link' as const, label: 'Platform', href: '/dashboard/platform' }, { type: 'page' as const, label: 'Store Settings' }];
  return <PageContainer header={header} breadcrumbs={breadcrumbs}>
    <div className="px-4 pb-10 md:px-6">
      {result.state === 'ok' && <StorefrontSettingsForm setup={result.data} />}
      {result.state === 'forbidden' && <Notice tone="warn">No access to Store Settings for this premises</Notice>}
      {result.state === 'unavailable' && <div role="alert"><Notice tone="danger" action={<Track><PillLink href="/dashboard/platform/store-settings" active>Retry</PillLink></Track>}>Store Settings could not be loaded</Notice></div>}
    </div>
  </PageContainer>;
}
