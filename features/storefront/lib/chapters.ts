import { formKey } from './format';

// One process ink per chapter (form), used only for its band, its index mark and its item plate.
// State colours (open, closed, caution) never come from this list.
const INKS: Record<string, string> = {
  flower: '#a2c25a',
  'pre-roll': '#e8955a',
  preroll: '#e8955a',
  edible: '#e9879a',
  edibles: '#e9879a',
  concentrate: '#dcbb55',
  concentrates: '#dcbb55',
  vape: '#7ebbd3',
  vapes: '#7ebbd3',
  cartridge: '#7ebbd3',
  topical: '#bba6e0',
  topicals: '#bba6e0',
  tincture: '#82c7a8',
  tinctures: '#82c7a8',
  beverage: '#d8987a',
  beverages: '#d8987a',
};
const SPARE = ['#82c7a8', '#d8987a', '#c9c27a', '#9fb0e0'];

export function chapterInk(form: string) {
  const key = formKey(form);
  if (INKS[key]) return INKS[key];
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return SPARE[hash % SPARE.length];
}

export const chapterId = (form: string) => `chapter-${formKey(form)}`;
