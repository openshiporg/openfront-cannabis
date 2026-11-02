/**
 * Pickup windows for online orders: half-hour slots inside the rule pack's operating hours, in the
 * premises' own time zone. The server regenerates the list when an order is placed, so a window the
 * shopper submits is only accepted if it is one the store would have offered.
 */
export const SLOT_MINUTES = 30;
const LEAD_MINUTES = 45;
const DAYS_AHEAD = 2;
const MAX_SLOTS = 24;

function offsetMs(instant: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find(part => part.type === type)?.value);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - Math.floor(instant / 1000) * 1000;
}

/** The instant at which the wall clock in `timeZone` reads `year-month-day` plus `minute` minutes after midnight. */
export function localInstant(year: number, month: number, day: number, minute: number, timeZone: string) {
  const wall = Date.UTC(year, month - 1, day, 0, minute);
  let instant = wall - offsetMs(wall, timeZone);
  instant = wall - offsetMs(instant, timeZone);
  return new Date(instant);
}

function localDate(instant: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find(part => part.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

export type PickupSlot = { start: string; end: string };

/** Slots that start at least LEAD_MINUTES from now and end by closing time (closing may be after midnight). */
export function pickupSlots(opensMinute: number, closesMinute: number, timeZone: string, now = new Date()): PickupSlot[] {
  const slots: PickupSlot[] = [];
  const today = localDate(now.getTime(), timeZone);
  const earliest = now.getTime() + LEAD_MINUTES * 60_000;
  const closeAbs = closesMinute > opensMinute ? closesMinute : closesMinute + 1440;
  for (let offset = 0; offset <= DAYS_AHEAD && slots.length < MAX_SLOTS; offset += 1) {
    const base = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
    const [year, month, day] = [base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate()];
    for (let minute = opensMinute; minute + SLOT_MINUTES <= closeAbs && slots.length < MAX_SLOTS; minute += SLOT_MINUTES) {
      const start = localInstant(year, month, day, minute, timeZone);
      if (start.getTime() < earliest) continue;
      slots.push({ start: start.toISOString(), end: new Date(start.getTime() + SLOT_MINUTES * 60_000).toISOString() });
    }
  }
  return slots;
}

/** Whole years between a calendar date of birth (YYYY-MM-DD) and `now`, or null when it is not a real past date. */
export function ageOnDate(dateOfBirth: string, now = new Date()): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day || check.getTime() > now.getTime()) return null;
  let age = now.getUTCFullYear() - year;
  if (now.getUTCMonth() + 1 < month || (now.getUTCMonth() + 1 === month && now.getUTCDate() < day)) age -= 1;
  return age;
}
