import { GraphQLClient } from 'graphql-request';
import { createBoundedResponseFetch } from './boundedGraphqlResponse.ts';

export type SessionFetch = typeof fetch;

export function createSessionGraphQLClient(
  endpoint: string,
  headers: Record<string, string>,
  fetchImpl?: SessionFetch,
): GraphQLClient {
  return new GraphQLClient(endpoint, {
    credentials: 'include',
    headers,
    redirect: 'error',
    fetch: createBoundedResponseFetch(fetchImpl),
  });
}

export function postSessionGraphQLUpload(
  endpoint: string,
  headers: Record<string, string>,
  body: FormData,
  fetchImpl: SessionFetch = fetch,
): Promise<Response> {
  return fetchImpl(endpoint, {
    method: 'POST',
    headers,
    credentials: 'include',
    redirect: 'error',
    body,
  });
}
