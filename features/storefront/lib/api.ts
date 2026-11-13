/** Browser calls to the public GraphQL endpoint. Errors are the shopper-facing messages the server wrote. */
export async function publicGraphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch('/api/graphql', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query, variables }) });
  } catch { throw new Error('We couldn’t reach the store. Check your connection and try again.'); }
  const body = await response.json().catch(() => null);
  if (body?.errors?.length) {
    const message = String(body.errors[0]?.message || '');
    throw new Error(message && message.length <= 300 && body.errors[0]?.extensions?.code === 'BAD_USER_INPUT' ? message : 'Something went wrong. Please try again.');
  }
  if (!body?.data) throw new Error('Something went wrong. Please try again.');
  return body.data as T;
}

export type PickupOptions = {
  pickupEnabled: boolean; minimumAge: number; currencyCode: string; timezone: string; payAtPickup: boolean;
  slots: Array<{ start: string; end: string }>;
  card: { provider: 'authorizenet'; apiLoginId: string; clientKey: string; env: 'test' | 'production' } | null;
};

export const getPickupOptions = async () => (await publicGraphql<{ cannabisPickupOptions: PickupOptions }>('query { cannabisPickupOptions }')).cannabisPickupOptions;
