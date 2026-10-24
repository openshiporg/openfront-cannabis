'use server';

import { ClientError, GraphQLClient } from 'graphql-request';
import { getAuthHeaders } from '@/features/dashboard/lib/cookies';
import { getGraphQLEndpoint } from '@/features/dashboard/lib/getBaseUrl';

export type CommandResponse<T> = { success: true; data: T } | { success: false; message: string | null };

// A rule message we wrote ("Purchase-limit rules require …") is safe to show the operator;
// anything that looks like an internal or database error is not.
const INTERNAL = /prisma|invalid `|\bsql\b|stack|econn|fetch failed|unexpected error|node_modules|\n/i;

function operatorMessage(error: unknown): string | null {
  // Duck-typed: across server bundles a ClientError may not be this module's class, so instanceof misses it.
  const message = (error as ClientError | null)?.response?.errors?.[0]?.message;
  if (typeof message !== 'string') return null;
  const text = message.trim();
  return text && text.length <= 300 && !INTERNAL.test(text) ? text : null;
}

/** keystoneClient for vertical commands: same endpoint and session, but keeps a safe rule message on failure. */
export async function runCommandRequest<T>(query: string, variables: Record<string, unknown>): Promise<CommandResponse<T>> {
  try {
    const client = new GraphQLClient(await getGraphQLEndpoint(), { credentials: 'include', redirect: 'error', headers: (await getAuthHeaders()) || {} });
    return { success: true, data: await client.request<T>(query, variables) };
  } catch (error) {
    return { success: false, message: operatorMessage(error) };
  }
}
