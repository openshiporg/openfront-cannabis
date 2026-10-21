/** Regulated quantities are stored as integer microunits of the product's unit of measure. */
export const MICROUNITS_PER_UNIT = 1_000_000;
const MAX_INT = 2_147_483_647;

/** Exact decimal rendering of stored microunits; no floating-point rounding. */
export function formatMicrounits(value: number, unitOfMeasure?: string | null) {
  if (!Number.isSafeInteger(value)) return 'Unknown';
  const sign = value < 0 ? '-' : '';
  const magnitude = Math.abs(value);
  const whole = Math.floor(magnitude / MICROUNITS_PER_UNIT);
  const fraction = String(magnitude % MICROUNITS_PER_UNIT).padStart(6, '0').replace(/0+$/, '');
  const amount = `${sign}${whole.toLocaleString('en-US')}${fraction ? `.${fraction}` : ''}`;
  return unitOfMeasure ? `${amount} ${unitOfMeasure}` : amount;
}

/** Parse a decimal business quantity (e.g. "3.5") into microunits exactly, or null if invalid. */
export function parseQuantityToMicrounits(input: string) {
  const text = input.trim();
  const match = /^(\d{1,7})(?:\.(\d{1,6}))?$/.exec(text);
  if (!match) return null;
  const value = Number(match[1]) * MICROUNITS_PER_UNIT + Number((match[2] || '').padEnd(6, '0'));
  return Number.isSafeInteger(value) && value > 0 && value <= MAX_INT ? value : null;
}
