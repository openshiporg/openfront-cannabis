export interface SafeGraphQLError {
  message: string;
  path?: Array<string | number>;
}

export type SafeKeystoneFailure = {
  success: false;
  error: string;
  errors?: SafeGraphQLError[];
  data?: never;
};

export type SafeGraphQLPayload<T = unknown> =
  | { success: true; data: T }
  | SafeKeystoneFailure;

export const GENERIC_GRAPHQL_FAILURE = 'The request could not be completed. Please try again.';
export const GRAPHQL_AUTHENTICATION_FAILURE = 'Your session may have expired. Sign in again.';
export const GRAPHQL_ACCESS_DENIED = 'You do not have permission to complete this action.';
export const GRAPHQL_INPUT_FAILURE = 'Check the entered information and try again.';
export const GRAPHQL_LIMIT_FAILURE = 'This request exceeds the allowed limit. Reduce it and try again.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function publicMessageForCode(code: unknown): string {
  switch (code) {
    case 'UNAUTHENTICATED':
      return GRAPHQL_AUTHENTICATION_FAILURE;
    case 'FORBIDDEN':
    case 'KS_ACCESS_DENIED':
    case 'KS_FILTER_DENIED':
      return GRAPHQL_ACCESS_DENIED;
    case 'BAD_USER_INPUT':
    case 'KS_USER_INPUT_ERROR':
    case 'KS_VALIDATION_FAILURE':
      return GRAPHQL_INPUT_FAILURE;
    case 'KS_LIMITS_EXCEEDED':
      return GRAPHQL_LIMIT_FAILURE;
    default:
      return GENERIC_GRAPHQL_FAILURE;
  }
}

function publicMessageForStatus(status: number | undefined): string | undefined {
  if (status === 401) return GRAPHQL_AUTHENTICATION_FAILURE;
  if (status === 403) return GRAPHQL_ACCESS_DENIED;
  if (status !== undefined && status >= 500) return GENERIC_GRAPHQL_FAILURE;
  return undefined;
}

function safePathShape(path: unknown): Array<string | number> | undefined {
  if (!Array.isArray(path) || path.length === 0 || path.length > 32) return undefined;
  if (!path.every((segment) => typeof segment === 'string' || (typeof segment === 'number' && Number.isSafeInteger(segment)))) {
    return undefined;
  }

  // Callers use path depth to distinguish top-level errors; field names and indices are not needed.
  return path.map(() => 'field');
}

function sanitizeGraphQLError(error: unknown, status?: number): SafeGraphQLError {
  const statusMessage = publicMessageForStatus(status);
  const path = isRecord(error) ? safePathShape(error.path) : undefined;
  if (statusMessage) return { message: statusMessage, ...(path ? { path } : {}) };

  const extensions = isRecord(error) && isRecord(error.extensions) ? error.extensions : undefined;
  const message = publicMessageForCode(extensions?.code);
  return { message, ...(path ? { path } : {}) };
}

export function safeGraphQLFailureFromErrors(errors: unknown, status?: number): SafeKeystoneFailure {
  const safeErrors = Array.isArray(errors) && errors.length > 0
    ? errors.map((error) => sanitizeGraphQLError(error, status))
    : undefined;
  const statusMessage = publicMessageForStatus(status);
  const message = statusMessage ?? safeErrors?.[0]?.message ?? GENERIC_GRAPHQL_FAILURE;

  return {
    success: false,
    error: message,
    ...(safeErrors ? { errors: safeErrors } : {}),
  };
}

export function safeGraphQLFailureFromHttpStatus(status: number): SafeKeystoneFailure {
  return {
    success: false,
    error: publicMessageForStatus(status) ?? GENERIC_GRAPHQL_FAILURE,
  };
}

export function safeGraphQLFailure(): SafeKeystoneFailure {
  return { success: false, error: GENERIC_GRAPHQL_FAILURE };
}

export function toSafeGraphQLPayload(payload: unknown): SafeGraphQLPayload {
  if (!isRecord(payload)) return safeGraphQLFailure();

  if (Object.hasOwn(payload, 'errors')) {
    if (Array.isArray(payload.errors) && payload.errors.length > 0) {
      return safeGraphQLFailureFromErrors(payload.errors);
    }
    return safeGraphQLFailure();
  }

  if (!Object.hasOwn(payload, 'data') || !isRecord(payload.data)) return safeGraphQLFailure();
  return { success: true, data: payload.data };
}

export type SafeFailureLogger = (message: string) => void;

export function logSafeGraphQLFailure(
  scope: 'request' | 'upload' | 'middleware',
  cause?: unknown,
  logger: SafeFailureLogger = (message) => console.error(message),
): void {
  void cause;
  logger(`GraphQL ${scope} failed`);
}
