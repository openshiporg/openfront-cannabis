// Premises-zone time helpers. Output depends only on the value and the zone (UTC when the
// premises has none), never on the server or browser zone, so server and client render alike.

const zoneOf = (timeZone?: string | null) => timeZone || 'UTC';

export function formatInstant(value: string | null | undefined, timeZone?: string | null) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Unknown';
  try {
    return date.toLocaleString('en-US', { timeZone: zoneOf(timeZone), year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  } catch {
    return date.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  }
}

/** Expiry is stored as the exclusive start of the next premises day; show the last usable day. */
export function formatUsableThrough(value: string | null | undefined, timeZone?: string | null) {
  if (!value) return 'Not recorded';
  const date = new Date(new Date(value).getTime() - 1);
  if (!Number.isFinite(date.getTime())) return 'Unknown';
  try { return date.toLocaleDateString('en-US', { timeZone: zoneOf(timeZone), year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return date.toISOString().slice(0, 10); }
}

function offsetMs(instant: number, timeZone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(new Date(instant)).map(part => [part.type, part.value]));
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second)) - Math.floor(instant / 1000) * 1000;
}

/** A datetime-local value ("2026-10-23T10:00") read as wall time in the premises zone, as an ISO instant. */
export function zonedLocalToInstant(value: string, timeZone?: string | null) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const wall = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
  try {
    const zone = zoneOf(timeZone);
    let instant = wall - offsetMs(wall, zone);
    instant = wall - offsetMs(instant, zone);
    return new Date(instant).toISOString();
  } catch {
    return null;
  }
}
