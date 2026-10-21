/** Amounts are stored as integer minor units ("cents") of the premises currency. */
export function isSupportedCurrencyCode(value: unknown): value is string {
  if (typeof value !== 'string' || !/^[A-Z]{3}$/.test(value)) return false;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: value }).resolvedOptions().maximumFractionDigits === 2;
  } catch {
    return false;
  }
}

/** Format minor units with the recorded currency; without one, show the bare amount rather than guessing. */
export function formatMinorUnits(cents: unknown, currencyCode?: string | null) {
  if (typeof cents !== 'number' || !Number.isSafeInteger(cents)) return 'Unknown';
  const amount = cents / 100;
  if (isSupportedCurrencyCode(currencyCode)) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(amount);
  }
  return `${amount.toFixed(2)} (currency not recorded)`;
}
