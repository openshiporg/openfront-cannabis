export type PreparationIntent = {
  authorityFingerprint: string;
  input: { cartId: string; expectedVersion: number; nextStatus: string; reasonCode: string; idempotencyKey: string };
  state: 'pending' | 'acknowledged';
};

/** Saved intents, keyed by authority fingerprint and cart, so one cart's command never blocks another. */
export const PREPARATION_INTENTS_KEY = 'cannabis.preparation.original-intents.v2';
export const PREPARATION_SCOPE = 'transitionCannabisCartPreparation';
export const REASON_CODE_PATTERN = /^[a-z][a-z0-9_]{2,99}$/;
export const REASON_CODE_HTML_PATTERN = '[a-z][a-z0-9_]{2,99}';
const MAX_INTENTS = 50;

export const preparationKey = (cartId: string, expectedVersion: number, nextStatus: string) => `preparation:${cartId}:${expectedVersion}:${nextStatus}`;
export const intentSlot = (authorityFingerprint: string, cartId: string) => `${authorityFingerprint}:${cartId}`;

export function parsePreparationIntent(value: unknown): PreparationIntent | undefined {
  const intent = value as PreparationIntent | null;
  const input = intent?.input;
  if (!intent || typeof intent.authorityFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(intent.authorityFingerprint) ||
      !['pending', 'acknowledged'].includes(intent.state) || !input || typeof input.cartId !== 'string' ||
      !input.cartId || input.cartId.length > 100 || !Number.isSafeInteger(input.expectedVersion) ||
      input.expectedVersion < 1 || input.expectedVersion >= 2_147_483_647 ||
      !['reserved', 'picking', 'staged'].includes(input.nextStatus) || typeof input.reasonCode !== 'string' ||
      !REASON_CODE_PATTERN.test(input.reasonCode) ||
      input.idempotencyKey !== preparationKey(input.cartId, input.expectedVersion, input.nextStatus)) return undefined;
  return { authorityFingerprint: intent.authorityFingerprint, state: intent.state, input: {
    cartId: input.cartId, expectedVersion: input.expectedVersion, nextStatus: input.nextStatus,
    reasonCode: input.reasonCode, idempotencyKey: input.idempotencyKey,
  } };
}

/** Parse the whole journal; an invalid entry is dropped only from the in-memory view, never rewritten. */
export function parsePreparationIntents(text: string | null): Record<string, PreparationIntent> | undefined {
  if (!text) return {};
  if (text.length > 100_000) return undefined;
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const result: Record<string, PreparationIntent> = {};
    for (const [slot, entry] of Object.entries(value)) {
      const intent = parsePreparationIntent(entry);
      if (intent && slot === intentSlot(intent.authorityFingerprint, intent.input.cartId)) result[slot] = intent;
    }
    return result;
  } catch { return undefined; }
}

/** Store one intent before I/O, preserving every other slot (including other accounts' entries). */
export function storePreparationIntent(storage: Pick<Storage, 'getItem' | 'setItem'>, intent: PreparationIntent) {
  if (!parsePreparationIntent(intent)) throw new Error('Preparation command is invalid');
  const raw = storage.getItem(PREPARATION_INTENTS_KEY);
  const current = raw ? JSON.parse(raw) : {};
  if (!current || typeof current !== 'object' || Array.isArray(current)) throw new Error('Saved commands need review');
  const slot = intentSlot(intent.authorityFingerprint, intent.input.cartId);
  if (!(slot in current) && Object.keys(current).length >= MAX_INTENTS) throw new Error('Too many saved commands');
  current[slot] = intent;
  storage.setItem(PREPARATION_INTENTS_KEY, JSON.stringify(current));
}

/** Remove only the caller's own acknowledged intent. */
export function removePreparationIntent(storage: Pick<Storage, 'getItem' | 'setItem'>, intent: PreparationIntent) {
  const raw = storage.getItem(PREPARATION_INTENTS_KEY);
  const current = raw ? JSON.parse(raw) : {};
  if (!current || typeof current !== 'object' || Array.isArray(current)) return;
  delete current[intentSlot(intent.authorityFingerprint, intent.input.cartId)];
  storage.setItem(PREPARATION_INTENTS_KEY, JSON.stringify(current));
}

export function preparationIntentForm(intent: PreparationIntent) {
  const form = new FormData();
  for (const [key, value] of Object.entries(intent.input)) form.set(key, String(value));
  return form;
}
