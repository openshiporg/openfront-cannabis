export function formatPrice(priceCents: number, currencyCode?: string | null) {
  const amount = priceCents / 100;
  if (currencyCode) {
    try {
      return new Intl.NumberFormat('en', { style: 'currency', currency: currencyCode }).format(amount);
    } catch {
      // Unknown currency code: show the plain amount rather than guessing a symbol.
    }
  }
  return amount.toFixed(2);
}

/** Group key for the form filter: "pre-roll" and "Pre-roll" are one form. */
export const formKey = (form: string) => form.trim().toLowerCase().replace(/\s+/g, '-');
