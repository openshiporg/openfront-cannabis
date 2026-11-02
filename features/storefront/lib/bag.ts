'use client';

import { useCallback, useEffect, useState } from 'react';

export type BagItem = { id: string; name: string; priceCents: number; units: number };
const KEY = 'cn-bag-v1';
const EVENT = 'cn-bag-change';
export const MAX_UNITS = 20;

function read(): BagItem[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(item => item && typeof item.id === 'string' && Number.isInteger(item.units) && item.units > 0).slice(0, 10) : [];
  } catch { return []; }
}

function write(items: BagItem[]) {
  window.localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(EVENT));
}

/** The shopper's bag, kept in this browser. Prices here are only for display: the server prices the order. */
export function useBag() {
  const [items, setItems] = useState<BagItem[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sync = () => setItems(read());
    sync(); setReady(true);
    window.addEventListener(EVENT, sync); window.addEventListener('storage', sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);
  const add = useCallback((item: Omit<BagItem, 'units'>, units = 1) => {
    const current = read(); const found = current.find(entry => entry.id === item.id);
    if (found) { found.units = Math.min(MAX_UNITS, found.units + units); found.priceCents = item.priceCents; }
    else current.push({ ...item, units: Math.min(MAX_UNITS, units) });
    write(current);
  }, []);
  const setUnits = useCallback((id: string, units: number) => write(read().flatMap(entry => entry.id !== id ? [entry] : units > 0 ? [{ ...entry, units: Math.min(MAX_UNITS, units) }] : [])), []);
  const clear = useCallback(() => write([]), []);
  return { items, ready, add, setUnits, clear, count: items.reduce((sum, item) => sum + item.units, 0), subtotalCents: items.reduce((sum, item) => sum + item.units * item.priceCents, 0) };
}
