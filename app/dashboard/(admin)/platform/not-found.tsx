import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { Notice, PageTitle, PillLink, Track } from '@/features/platform/components/cannabis-ui';

export default function PlatformNotFound() {
  return <PageContainer header={<PageTitle title="Not found" />} breadcrumbs={[{ type: 'link', label: 'Platform', href: '/dashboard/platform' }, { type: 'page', label: 'Not found' }]}>
    <div className="px-4 md:px-6"><Notice tone="warn" action={<Track><PillLink href="/dashboard/platform" active>Control room</PillLink></Track>}>No record with this ID at this premises</Notice></div>
  </PageContainer>;
}
