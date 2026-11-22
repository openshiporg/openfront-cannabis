import { parseQuantityToMicrounits } from '@/features/lib/quantity';

/** Every license and owner credential must cover these activities (the server refuses a pack without them). */
export const REQUIRED_ACTIVITIES = ['authority', 'eligibility', 'inventory', 'sale', 'cash', 'state_reporting', 'incident'] as const;
export const TENDER_TYPES = [
  { value: 'cash', label: 'Cash' }, { value: 'debit', label: 'Debit' }, { value: 'ach', label: 'ACH' }, { value: 'wallet', label: 'Wallet' }, { value: 'other', label: 'Other' },
] as const;
export const CAPACITIES = [{ value: 'adult_use', label: 'Adult-use' }, { value: 'patient', label: 'Patient' }, { value: 'caregiver', label: 'Caregiver' }] as const;
export const LIMIT_WINDOWS = [{ value: 'transaction', label: 'Per transaction' }, { value: 'day', label: 'Per day' }, { value: 'rolling', label: 'Rolling days' }, { value: 'allotment', label: 'Allotment' }] as const;

export type LimitRow = { capacity: string; categoryCode: string; window: string; windowDays: string; max: string };
export type TaxRow = { categoryCode: string; capacity: string; rate: string };

export const emptyLimit = (): LimitRow => ({ capacity: 'adult_use', categoryCode: '', window: 'transaction', windowDays: '', max: '' });
export const emptyTax = (): TaxRow => ({ categoryCode: '', capacity: 'all', rate: '' });

export type DiscountRow = { code: string; categoryCode: string; capacity: string; kind: 'percent' | 'amount'; value: string; endsOn: string; startsAt: string };
export const emptyDiscount = (categoryCode = ''): DiscountRow => ({ code: '', categoryCode, capacity: 'all', kind: 'percent', value: '', endsOn: '', startsAt: '' });

export type RuleErrors = Record<string, string>;

/** Discount rows to stored rules. A discount runs from when it was first saved to the end of its last day. */
export function buildDiscounts(rows: DiscountRow[], errors: RuleErrors) {
  const seen = new Set<string>();
  return rows.map((row, index) => {
    const code = row.code.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9-]{1,29}$/.test(code)) errors[`discount-${index}-code`] = 'Letters, numbers or dashes, e.g. FRIDAY10';
    if (!row.categoryCode) errors[`discount-${index}-categoryCode`] = 'Choose what it applies to';
    const match = /^(\d{1,5})(?:\.(\d{1,2}))?$/.exec(row.value.trim());
    const hundredths = match ? Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0')) : 0;
    if (!match || hundredths < 1 || (row.kind === 'percent' && hundredths > 100_00)) errors[`discount-${index}-value`] = row.kind === 'percent' ? 'Percent off, e.g. 10' : 'Amount off, e.g. 5.00';
    const ends = /^\d{4}-\d{2}-\d{2}$/.test(row.endsOn) ? new Date(`${row.endsOn}T23:59:59`) : null;
    if (!ends || ends.getTime() <= Date.now()) errors[`discount-${index}-endsOn`] = 'Choose a last day, today or later';
    const key = `${code}:${row.categoryCode}:${row.capacity}`;
    if (seen.has(key)) errors[`discount-${index}-code`] = 'Already listed for this category and buyer';
    seen.add(key);
    return { code, categoryCode: row.categoryCode, capacity: row.capacity, type: row.kind === 'percent' ? 'basis_points' : 'fixed_cents', value: hundredths, startsAt: row.startsAt || new Date().toISOString(), expiresAt: (ends ?? new Date()).toISOString() };
  });
}

export function discountsToRows(value: unknown): DiscountRow[] {
  if (!Array.isArray(value)) return [];
  const day = (iso: unknown) => { const date = new Date(String(iso)); if (!Number.isFinite(date.getTime())) return ''; return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
  return value.map(rule => ({ code: String(rule?.code ?? ''), categoryCode: String(rule?.categoryCode ?? ''), capacity: String(rule?.capacity ?? 'all'), kind: rule?.type === 'fixed_cents' ? 'amount' as const : 'percent' as const,
    value: Number.isSafeInteger(rule?.value) ? String(rule.value / 100) : '', endsOn: day(rule?.expiresAt), startsAt: typeof rule?.startsAt === 'string' ? rule.startsAt : '' }));
}

const CATEGORY = /^[a-z0-9][a-z0-9_-]{0,59}$/;

/** Rows to the server's purchase-limit shape; errors are keyed `limit-<index>-<field>`. */
export function buildLimits(rows: LimitRow[], errors: RuleErrors) {
  if (!rows.length) errors.limits = 'Add at least one purchase limit';
  const seen = new Set<string>();
  return rows.map((row, index) => {
    const categoryCode = row.categoryCode.trim();
    if (!CATEGORY.test(categoryCode)) errors[`limit-${index}-categoryCode`] = 'Lowercase code, e.g. flower';
    const maxEquivalencyMicrounits = parseQuantityToMicrounits(row.max) ?? (row.max.trim() === '0' ? 0 : null);
    if (maxEquivalencyMicrounits == null) errors[`limit-${index}-max`] = 'Enter the maximum, e.g. 28';
    const windowDays = row.window === 'rolling' ? Number(row.windowDays) : undefined;
    if (row.window === 'rolling' && (!Number.isInteger(windowDays) || windowDays! < 1 || windowDays! > 366)) errors[`limit-${index}-windowDays`] = '1–366 days';
    const key = `${row.capacity}:${row.window}:${categoryCode}:${windowDays ?? ''}`;
    if (seen.has(key)) errors[`limit-${index}-categoryCode`] = 'Duplicate limit';
    seen.add(key);
    return { capacity: row.capacity, categoryCode, window: row.window, ...(windowDays !== undefined ? { windowDays } : {}), maxEquivalencyMicrounits: maxEquivalencyMicrounits ?? 0 };
  });
}

/** Rows to the server's tax-rule shape; the rate is a percentage with up to two decimals. */
export function buildTaxes(rows: TaxRow[], errors: RuleErrors) {
  if (!rows.length) errors.taxes = 'Add at least one tax rule';
  const seen = new Set<string>();
  return rows.map((row, index) => {
    const categoryCode = row.categoryCode.trim();
    if (!CATEGORY.test(categoryCode)) errors[`tax-${index}-categoryCode`] = 'Lowercase code, e.g. flower';
    const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(row.rate.trim());
    const basisPoints = match ? Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0')) : null;
    if (basisPoints == null || basisPoints > 100_00) errors[`tax-${index}-rate`] = 'Rate in %, e.g. 15';
    const key = `${categoryCode}:${row.capacity}`;
    if (seen.has(key)) errors[`tax-${index}-categoryCode`] = 'Duplicate rule';
    seen.add(key);
    return { categoryCode, capacity: row.capacity, basisPoints: basisPoints ?? 0 };
  });
}

export function limitsToRows(value: unknown): LimitRow[] {
  if (!Array.isArray(value)) return [];
  return value.map(rule => ({
    capacity: String(rule?.capacity ?? 'adult_use'), categoryCode: String(rule?.categoryCode ?? ''), window: String(rule?.window ?? 'transaction'),
    windowDays: rule?.windowDays != null ? String(rule.windowDays) : '',
    max: Number.isSafeInteger(rule?.maxEquivalencyMicrounits) ? String(rule.maxEquivalencyMicrounits / 1_000_000) : '',
  }));
}

export function taxesToRows(value: unknown): TaxRow[] {
  if (!Array.isArray(value)) return [];
  return value.map(rule => ({ categoryCode: String(rule?.categoryCode ?? ''), capacity: String(rule?.capacity ?? 'all'), rate: Number.isSafeInteger(rule?.basisPoints) ? String(rule.basisPoints / 100) : '' }));
}

/** "HH:MM" to minutes after midnight, or null. */
export function timeToMinute(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const minute = Number(match[1]) * 60 + Number(match[2]);
  return minute >= 0 && minute <= 1439 ? minute : null;
}

export const minuteToTime = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;

/** A date-only input as the start of that day in the browser's zone, as an ISO instant. */
export function dayStart(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function localDate(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 86_400_000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
