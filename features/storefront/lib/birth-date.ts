// Date of birth as a plain MM/DD/YYYY text field. A native date input renders today's date inside the empty
// field on iOS, which reads as prefilled; a text field stays empty until the shopper types.

/** Types the slashes for the shopper ("04091986" reads 04/09/1986); browser autofill's YYYY-MM-DD is reordered. */
export function formatBirthDateInput(input: HTMLInputElement) {
  const iso = input.value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) { input.value = `${iso[2]}/${iso[3]}/${iso[1]}`; return; }
  const digits = input.value.replace(/\D/g, '').slice(0, 8);
  input.value = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('/');
}

/** MM/DD/YYYY as typed, sent to the server as YYYY-MM-DD; anything else is passed through for the server to reject. */
export function isoBirthDate(value: FormDataEntryValue | null) {
  const text = typeof value === 'string' ? value.trim() : '';
  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[1]}-${match[2]}` : text;
}

export const BIRTH_DATE_PATTERN = '(0[1-9]|1[0-2])/(0[1-9]|[12][0-9]|3[01])/(19|20)[0-9]{2}';
