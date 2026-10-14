import { evaluationCases, templates } from '../data';
import type { Remix } from '../types';

const REMIX_KEY = 'liveplay-remixes-v1';
const REVIEWED_KEY = 'liveplay-reviewed-v1';

/** Upper bound so the local library cannot grow without limit. */
export const MAX_REMIXES = 50;

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** localStorage can be missing or throw (private mode, blocked site data), so access it defensively. */
function browserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function readJson(key: string, storage: StorageLike | null): unknown {
  if (!storage) return undefined;
  try {
    const raw = storage.getItem(key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    // Corrupted value: drop it so it does not fail on every load.
    try { storage.removeItem(key); } catch { /* nothing more to do */ }
    return undefined;
  }
}

function writeJson(key: string, value: unknown, storage: StorageLike | null): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

const templateIds: readonly string[] = templates.map((template) => template.id);
const evaluationIds = new Set(evaluationCases.map((item) => item.id));

export function isRemix(value: unknown): value is Remix {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string' && item.id !== ''
    && typeof item.name === 'string'
    && typeof item.templateId === 'string' && templateIds.includes(item.templateId)
    && Array.isArray(item.rules) && item.rules.every((rule) => typeof rule === 'string');
}

export function loadRemixes(storage: StorageLike | null = browserStorage()): Remix[] {
  const value = readJson(REMIX_KEY, storage);
  return Array.isArray(value) ? value.filter(isRemix).slice(0, MAX_REMIXES) : [];
}

/** Returns false when the browser refused the write, so the UI can say so. */
export function saveRemixes(remixes: Remix[], storage: StorageLike | null = browserStorage()): boolean {
  return writeJson(REMIX_KEY, remixes, storage);
}

/** Only ids of cases that still exist are kept, so stale data cannot inflate the "x / 50" counter. */
export function loadReviewed(storage: StorageLike | null = browserStorage()): string[] {
  const value = readJson(REVIEWED_KEY, storage);
  if (!Array.isArray(value)) return [];
  const ids = value.filter((item): item is string => typeof item === 'string' && evaluationIds.has(item));
  return [...new Set(ids)];
}

export function saveReviewed(ids: string[], storage: StorageLike | null = browserStorage()): boolean {
  return writeJson(REVIEWED_KEY, ids, storage);
}

/** crypto.randomUUID only exists in secure contexts (https or localhost), so provide a fallback for LAN http. */
export function createId(cryptoLike: { randomUUID?: () => string } | undefined = globalThis.crypto): string {
  if (cryptoLike && typeof cryptoLike.randomUUID === 'function') return cryptoLike.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
