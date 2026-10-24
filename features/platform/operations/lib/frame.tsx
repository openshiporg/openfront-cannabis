import type React from 'react';
import { notFound } from 'next/navigation';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { getCannabisWorkspace, type WorkspaceOptions } from '@/features/platform/workspaces/actions/workspaces';
import type { CannabisWorkspaceResult } from '@/features/platform/workspaces/lib/boundary';
import type { WorkspaceData, WorkspaceSection } from '@/features/platform/workspaces/lib/contract';
import { Notice, operatingState, PageTitle, PillLink, Track, type DotTone } from '@/features/platform/components/cannabis-ui';
import { AsOf, WorkspaceStateNotice } from '../components/WorkspaceKit';

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;
export type Params = Record<string, string | undefined>;
export type TitleState = { tone: DotTone; state: string };
export type Crumb = { label: string; href?: string };

export async function readParams(searchParams?: SearchParams): Promise<Params> {
  const raw = (await searchParams) || {};
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
}

/**
 * One workspace page: load the section, show closed states, and put the title with its
 * state dot, the as-of time and the sales-rules warning above the content. A detail page
 * whose record is `missing` answers 404.
 */
export async function frame<S extends WorkspaceSection>(section: S, path: string, title: string, params: Params, render: (data: WorkspaceData<S>) => React.ReactNode,
  titleState?: (data: WorkspaceData<S>) => TitleState, extra: { crumbs?: Crumb[]; heading?: (data: WorkspaceData<S>) => string; missing?: (data: WorkspaceData<S>) => boolean } = {}) {
  const options: WorkspaceOptions = { cursor: params.cursor, search: params.search, filter: params.filter, productSearch: params.productSearch, id: params.id };
  const result: CannabisWorkspaceResult<WorkspaceData<S>> = await getCannabisWorkspace(section, options);
  const crumbs = extra.crumbs ?? [{ label: title }];
  const breadcrumbs = [{ type: 'link' as const, label: 'Platform', href: '/dashboard/platform' }, ...crumbs.map(crumb => crumb.href ? { type: 'link' as const, label: crumb.label, href: crumb.href } : { type: 'page' as const, label: crumb.label })];
  if (result.state !== 'ok') {
    return <PageContainer header={<PageTitle title={title} />} breadcrumbs={breadcrumbs}><WorkspaceStateNotice result={result} retryHref={path} /></PageContainer>;
  }
  const data = result.data;
  if (extra.missing?.(data)) notFound();
  const { tone, state } = titleState ? titleState(data) : operatingState(data.operating);
  const meta = <span className="flex flex-wrap gap-x-3"><AsOf generatedAt={data.generatedAt} timezone={data.timezone} />{data.jurisdictionCode && <span className="font-mono">{data.jurisdictionCode}</span>}</span>;
  const rulesNotice = data.salesRules.problem && section !== 'authority'
    ? <div className="mb-6 px-4 md:px-6"><Notice tone="danger" action={<Track><PillLink href="/dashboard/platform/authority#sales-rules" active>Fix sales rules</PillLink></Track>}>Sales rules invalid: {data.salesRules.problem}. Menu and sales unavailable.</Notice></div>
    : null;
  return <PageContainer header={<PageTitle title={extra.heading?.(data) ?? title} tone={tone} state={state} meta={meta} />} breadcrumbs={breadcrumbs}>{rulesNotice}{render(data)}</PageContainer>;
}
