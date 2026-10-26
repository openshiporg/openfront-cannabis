import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { ButtonLink, Notice, PageTitle } from '@/features/platform/components/cannabis-ui';

export default function PlatformNotFound() {
  return <PageContainer header={<PageTitle title="Not found" />} breadcrumbs={[{ type: 'link', label: 'Platform', href: '/dashboard/platform' }, { type: 'page', label: 'Not found' }]}>
    <div className="px-4 md:px-6"><Notice tone="warn" action={<ButtonLink href="/dashboard/platform" tone="primary">Control room</ButtonLink>}>No record with this ID at this premises</Notice></div>
  </PageContainer>;
}
