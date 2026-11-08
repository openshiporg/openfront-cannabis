function zoneOffsetMs(instant: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find(part => part.type === type)?.value);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - Math.floor(instant / 1000) * 1000;
}

export function isValidTimeZone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== 'string' || !timeZone) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone }); return true; } catch { return false; }
}

/**
 * A date-only expiry ("2027-03-31") means the package may be used through that
 * calendar day at the premises: it expires at the start of the following local day.
 */
export function endOfLocalDate(date: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match || !isValidTimeZone(timeZone)) throw new Error('Expiry must be a calendar date (YYYY-MM-DD) at a premises with a valid time zone');
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) throw new Error('Expiry date is not a real calendar date');
  const localMidnight = Date.UTC(year, month - 1, day + 1);
  let instant = localMidnight - zoneOffsetMs(localMidnight, timeZone);
  instant = localMidnight - zoneOffsetMs(instant, timeZone);
  return new Date(instant);
}

/** The calendar date at the premises for an instant: what "today" means at the counter. */
export function localDateParts(now: Date, timeZone: string) {
  if (!isValidTimeZone(timeZone)) throw new Error('The premises needs a valid time zone');
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (type: string) => Number(parts.find(part => part.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A real YYYY-MM-DD calendar date, or null. */
export function calendarDate(value: unknown) {
  const text = value instanceof Date ? (Number.isFinite(value.getTime()) ? value.toISOString().slice(0, 10) : '') : typeof value === 'string' ? value.trim() : '';
  const match = DATE_ONLY.exec(text);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return { year, month, day, text };
}

/**
 * Whole years old on today's date at the premises. A birthday counts from local
 * midnight at the store, not UTC midnight (which in Denver is 5 or 6 pm the day before).
 * Date-of-birth values stored as timestamps are UTC midnight of the calendar date.
 * Returns null for a date that is not real or is after today.
 */
export function ageAtPremises(dateOfBirth: unknown, now: Date, timeZone: string): number | null {
  const dob = calendarDate(dateOfBirth);
  if (!dob) return null;
  const today = localDateParts(now, timeZone);
  if (dob.year * 10000 + dob.month * 100 + dob.day > today.year * 10000 + today.month * 100 + today.day) return null;
  let age = today.year - dob.year;
  if (today.month < dob.month || (today.month === dob.month && today.day < dob.day)) age -= 1;
  return age;
}
