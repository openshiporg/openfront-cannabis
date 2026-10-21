import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { getCannabisWorkspace } from '@/features/platform/workspaces/actions/workspaces';
import { WorkspaceStateNotice } from '@/features/platform/operations/components/WorkspaceKit';
import { InventoryWorkbenchClient } from '../components/InventoryWorkbenchClient';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function InventoryWorkbenchPage({ searchParams }: { searchParams?: SearchParams }) {
  const raw = (await searchParams) || {};
  const params = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])) as Record<string, string | undefined>;
  const result = await getCannabisWorkspace('inventory', { cursor: params.cursor, search: params.search, filter: params.filter });
  const breadcrumbs = [{ type: 'link' as const, label: 'Platform', href: '/dashboard/platform' }, { type: 'page' as const, label: 'Inventory' }];
  return <PageContainer header={<h1 className="text-xl font-semibold">Inventory</h1>} breadcrumbs={breadcrumbs}>
    {result.state === 'ok' ? <InventoryWorkbenchClient data={result.data} params={params} /> : <WorkspaceStateNotice result={result} retryHref="/dashboard/platform/inventory" />}
  </PageContainer>;
}
