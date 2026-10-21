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
