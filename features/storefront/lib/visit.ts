import type { PublicVisit } from './data/menu';

const TENDER_LABEL: Record<string, string> = { cash: 'Cash', debit: 'Debit', ach: 'ACH', wallet: 'Wallet', other: 'Other' };

export function minuteLabel(minute: number) {
  const hour = Math.floor(minute / 60); const rest = minute % 60;
  return `${hour % 12 || 12}${rest ? `:${String(rest).padStart(2, '0')}` : ''} ${hour < 12 ? 'AM' : 'PM'}`;
}

/** Open or closed now, in the premises zone; the rule pack's window applies every day and may cross midnight. */
export function openState(visit: PublicVisit | undefined, now = new Date()) {
  if (!visit?.hours) return null;
  const { opensMinute: start, closesMinute: end } = visit.hours;
  let minute: number;
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: visit.timezone || 'UTC', hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).formatToParts(now).map(part => [part.type, part.value]));
    minute = Number(parts.hour) * 60 + Number(parts.minute);
  } catch { return null; }
  const open = start <= end ? minute >= start && minute < end : minute >= start || minute < end;
  return { open, label: open ? `Open now · until ${minuteLabel(end)}` : `Closed · opens ${minuteLabel(start)}`, hours: `${minuteLabel(start)} – ${minuteLabel(end)}` };
}

export function addressLines(visit: PublicVisit | undefined) {
  if (!visit) return [];
  const { line1, city, region, postalCode } = visit.address;
  return [line1, [city, [region, postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ')].filter((line): line is string => Boolean(line));
}

export function directionsHref(visit: PublicVisit | undefined) {
  const lines = addressLines(visit);
  return lines.length ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lines.join(', '))}` : null;
}

export const tenderLabels = (visit: PublicVisit | undefined) => (visit?.tenders ?? []).map(type => TENDER_LABEL[type] ?? type);

/** Adult-use age from the rules (21 when unknown); the medical age only when medical sales are on and lower. */
export function ageRule(visit: PublicVisit | undefined) {
  const adult = Number.isInteger(visit?.minimumAge) ? visit!.minimumAge! : 21;
  const medical = Number.isInteger(visit?.medicalMinimumAge) && visit!.medicalMinimumAge! < adult ? visit!.medicalMinimumAge! : null;
  return { adult, medical };
}
