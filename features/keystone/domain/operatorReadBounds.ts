export const OPERATOR_WORKSPACE_PAGE_SIZE = 50;
export const MAX_SHIFT_CASH_EVENTS = 500;

const CASH_EVENT_TYPES = new Set([
  'opening_float', 'sale', 'refund', 'paid_in', 'paid_out', 'safe_drop', 'count', 'deposit',
]);

export interface OperatorWorkspacePage<T> {
  items: T[];
  hasMore: boolean;
}

export interface ShiftCashEventReadItem {
  type: string;
  amountCents: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Split one `pageSize + 1` lookahead result; reject malformed or unexpectedly oversized reads. */
export function splitOperatorWorkspacePage<T>(rows: unknown): OperatorWorkspacePage<T> | undefined {
  if (!Array.isArray(rows) || rows.length > OPERATOR_WORKSPACE_PAGE_SIZE + 1) return undefined;
  return {
    items: rows.slice(0, OPERATOR_WORKSPACE_PAGE_SIZE) as T[],
    hasMore: rows.length > OPERATOR_WORKSPACE_PAGE_SIZE,
  };
}

/** A full bounded relation page is ambiguous, so never use it to compute shift cash. */
export function isCompleteShiftCashEventRead(value: unknown): value is ShiftCashEventReadItem[] {
  if (!Array.isArray(value) || value.length >= MAX_SHIFT_CASH_EVENTS) return false;
  for (let index = 0; index < value.length; index += 1) {
    const event = value[index];
    if (!Object.hasOwn(value, index) || !isRecord(event) || typeof event.type !== 'string' ||
        !CASH_EVENT_TYPES.has(event.type) || !Number.isSafeInteger(event.amountCents)) return false;
  }
  return true;
}
