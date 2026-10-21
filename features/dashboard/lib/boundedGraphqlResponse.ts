export const MAX_GRAPHQL_RESPONSE_BYTES = 10 * 1024 * 1024;
const RESPONSE_LIMIT_ERROR = 'GraphQL response exceeds the configured byte limit';

async function cancelResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Cancellation is best-effort; the caller still fails closed.
  }
}

/** Read response bytes with a hard actual-byte cap; Content-Length is only an early hint. */
export async function readBoundedResponseBytes(
  response: Response,
  maxBytes = MAX_GRAPHQL_RESPONSE_BYTES,
): Promise<Uint8Array> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) throw new Error('Invalid response byte limit');

  const declaredLength = response.headers.get('content-length')?.trim();
  if (declaredLength && /^\d+$/.test(declaredLength)) {
    const declaredBytes = Number(declaredLength);
    if (!Number.isSafeInteger(declaredBytes) || declaredBytes > maxBytes) {
      await cancelResponseBody(response);
      throw new Error(RESPONSE_LIMIT_ERROR);
    }
  }

  if (!response.body) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) throw new Error('Invalid GraphQL response stream chunk');

      if (value.byteLength > maxBytes - totalBytes) {
        try {
          await reader.cancel();
        } catch {
          // Preserve the fixed size failure if cancellation itself fails.
        }
        throw new Error(RESPONSE_LIMIT_ERROR);
      }

      totalBytes += value.byteLength;
      chunks.push(value);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // The body may already be closed or cancelled.
    }
  }

  const result = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

export async function readBoundedJsonResponse(
  response: Response,
  maxBytes = MAX_GRAPHQL_RESPONSE_BYTES,
): Promise<unknown> {
  const bytes = await readBoundedResponseBytes(response, maxBytes);
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  return JSON.parse(text) as unknown;
}

export type BoundedSessionFetch = typeof fetch;

/**
 * Buffer only a bounded response before graphql-request calls response.text().
 * Preserve status and useful headers while removing representation headers that
 * may no longer describe the reconstructed body.
 */
export function createBoundedResponseFetch(fetchImpl: typeof fetch = fetch): BoundedSessionFetch {
  return async (input, init) => {
    const response = await fetchImpl(input, init);
    const bytes = await readBoundedResponseBytes(response);
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.delete('content-encoding');
    headers.delete('transfer-encoding');
    headers.delete('content-md5');

    const body = bytes.byteLength > 0 ? bytes.buffer as ArrayBuffer : null;
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}
