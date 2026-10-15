import { describe, expect, it } from 'vitest';
import { createId, isRemix, loadRemixes, loadReviewed, MAX_REMIXES, saveRemixes, saveReviewed } from './storage';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
}

const throwing = {
  getItem: () => { throw new Error('SecurityError'); },
  setItem: () => { throw new Error('QuotaExceededError'); },
  removeItem: () => { throw new Error('SecurityError'); },
};

const remix = { id: 'r1', name: '拼图｜迎新夜', templateId: 'word-puzzle' as const, rules: ['规则一', '规则二'] };

describe('remix storage', () => {
  it('round-trips saved remixes', () => {
    const storage = fakeStorage();
    expect(saveRemixes([remix], storage)).toBe(true);
    expect(loadRemixes(storage)).toEqual([remix]);
  });

  it('returns an empty list when nothing is stored or storage is unavailable', () => {
    expect(loadRemixes(fakeStorage())).toEqual([]);
    expect(loadRemixes(null)).toEqual([]);
    expect(loadRemixes(throwing)).toEqual([]);
  });

  it('drops corrupted JSON and non-array values instead of crashing', () => {
    const corrupted = fakeStorage({ 'liveplay-remixes-v1': '{oops' });
    expect(loadRemixes(corrupted)).toEqual([]);
    expect(corrupted.data.has('liveplay-remixes-v1')).toBe(false);
    expect(loadRemixes(fakeStorage({ 'liveplay-remixes-v1': '{"id":"x"}' }))).toEqual([]);
  });

  it('keeps valid entries and filters malformed ones', () => {
    const stored = JSON.stringify([remix, { id: 'bad', name: 'x', templateId: 'nope', rules: [] }, { id: 'bad2', name: 'x', templateId: 'relay', rules: [1] }, null, 'text']);
    expect(loadRemixes(fakeStorage({ 'liveplay-remixes-v1': stored }))).toEqual([remix]);
  });

  it('caps the library size on load', () => {
    const many = Array.from({ length: MAX_REMIXES + 5 }, (_, index) => ({ ...remix, id: `r${index}` }));
    expect(loadRemixes(fakeStorage({ 'liveplay-remixes-v1': JSON.stringify(many) }))).toHaveLength(MAX_REMIXES);
  });

  it('reports a failed write so the UI does not claim it saved', () => {
    expect(saveRemixes([remix], throwing)).toBe(false);
    expect(saveRemixes([remix], null)).toBe(false);
  });

  it('validates the shape of a remix', () => {
    expect(isRemix(remix)).toBe(true);
    expect(isRemix({ ...remix, id: '' })).toBe(false);
    expect(isRemix({ ...remix, rules: 'x' })).toBe(false);
    expect(isRemix(undefined)).toBe(false);
  });
});

describe('reviewed storage', () => {
  it('round-trips and de-duplicates ids', () => {
    const storage = fakeStorage();
    expect(saveReviewed(['LP-01', 'LP-02'], storage)).toBe(true);
    expect(loadReviewed(storage)).toEqual(['LP-01', 'LP-02']);
    expect(loadReviewed(fakeStorage({ 'liveplay-reviewed-v1': '["LP-01","LP-01"]' }))).toEqual(['LP-01']);
  });

  it('ignores unknown ids and wrong types so the counter cannot exceed the real case count', () => {
    expect(loadReviewed(fakeStorage({ 'liveplay-reviewed-v1': '["LP-01","LP-99",42,null]' }))).toEqual(['LP-01']);
    expect(loadReviewed(fakeStorage({ 'liveplay-reviewed-v1': '"LP-01"' }))).toEqual([]);
    expect(loadReviewed(throwing)).toEqual([]);
  });
});

describe('createId', () => {
  it('uses crypto.randomUUID when available', () => {
    expect(createId({ randomUUID: () => 'fixed-id' })).toBe('fixed-id');
  });

  it('falls back to a unique-enough id when crypto.randomUUID is unavailable (non-secure context)', () => {
    const first = createId({});
    const second = createId({});
    expect(first).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
    expect(first === second).toBe(false);
  });
});
