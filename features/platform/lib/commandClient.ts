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

/** The same command with one image file, sent as a GraphQL multipart request (the `photo: Upload` argument). */
export async function runCommandUpload<T>(query: string, variables: Record<string, unknown>, photo: File): Promise<CommandResponse<T>> {
  try {
    const body = new FormData();
    body.append('operations', JSON.stringify({ query, variables: { ...variables, photo: null } }));
    body.append('map', JSON.stringify({ 1: ['variables.photo'] }));
    body.append('1', photo, photo.name || 'photo');
    // Keystone's GraphQL endpoint rejects multipart posts without a preflight header (CSRF guard).
    const response = await fetch(await getGraphQLEndpoint(), { method: 'POST', redirect: 'error', headers: { ...((await getAuthHeaders()) || {}), 'apollo-require-preflight': 'true' }, body });
    const json = await response.json().catch(() => null) as { data?: T; errors?: Array<{ message?: string }> } | null;
    if (json?.errors?.length || !json?.data) return { success: false, message: operatorMessage({ response: { errors: json?.errors ?? [] } }) };
    return { success: true, data: json.data };
  } catch {
    return { success: false, message: null };
  }
}
