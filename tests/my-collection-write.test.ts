// The My Collection write reads the stored list at the moment of writing, so another tab's change is kept.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { updateList, loadWishlist, cleanWishlist, addWish, removeWish, WISHLIST_KEY, CHANGED_EVENT } from '../src/lib/my-collection';

const NOW = '2026-10-18T09:00:00.000Z';
afterEach(() => vi.unstubAllGlobals());

function fakeWindow(opts: { readThrows?: boolean; writeFails?: boolean } = {}) {
  const store = new Map<string, string>();
  const events: string[] = [];
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k: string) => {
        if (opts.readThrows) throw new Error('SecurityError');
        return store.get(k) ?? null;
      },
      setItem: (k: string, v: string) => {
        if (opts.writeFails) {
          const e = new Error('quota');
          e.name = 'QuotaExceededError';
          throw e;
        }
        store.set(k, v);
      },
    },
    dispatchEvent: (e: Event) => {
      events.push(e.type);
      return true;
    },
  });
  return { store, events };
}

describe('the write reads at the moment of writing', () => {
  it('a change another tab made after this tab read the list is kept', () => {
    const { store } = fakeWindow();
    store.set(WISHLIST_KEY, JSON.stringify([{ set: '10307', name: 'A', added_at: NOW }]));
    const snapshot = loadWishlist(); // this tab reads, then the user taps
    store.set(WISHLIST_KEY, JSON.stringify([{ set: '10307', name: 'A', added_at: NOW }, { set: '10308', name: 'B', added_at: NOW }])); // other tab
    const out = updateList(WISHLIST_KEY, cleanWishlist, (list) => {
      const r = addWish(list, { set: '10309', name: 'C' }, NOW);
      return { list: r.list, result: r.status, changed: r.status === 'added' };
    });
    expect(out).toEqual({ ok: true, result: 'added' });
    expect(cleanWishlist(JSON.parse(store.get(WISHLIST_KEY)!)).map((w) => w.set).sort()).toEqual(['10307', '10308', '10309']);
    // The snapshot the page had would have lost the other tab's change.
    expect(snapshot.map((w) => w.set)).toEqual(['10307']);
  });
  it('removing a set keeps what another tab added', () => {
    const { store } = fakeWindow();
    store.set(WISHLIST_KEY, JSON.stringify([{ set: '10307', name: 'A', added_at: NOW }]));
    store.set(WISHLIST_KEY, JSON.stringify([{ set: '10307', name: 'A', added_at: NOW }, { set: '10308', name: 'B', added_at: NOW }]));
    updateList(WISHLIST_KEY, cleanWishlist, (list) => ({ list: removeWish(list, '10307'), result: null, changed: true }));
    expect(cleanWishlist(JSON.parse(store.get(WISHLIST_KEY)!)).map((w) => w.set)).toEqual(['10308']);
  });
  it('no change means no write and no event', () => {
    const { store, events } = fakeWindow();
    store.set(WISHLIST_KEY, JSON.stringify([{ set: '10307', name: 'A', added_at: NOW }]));
    const before = store.get(WISHLIST_KEY);
    const out = updateList(WISHLIST_KEY, cleanWishlist, (list) => ({ list, result: 'present', changed: false }));
    expect(out).toEqual({ ok: true, result: 'present' });
    expect(store.get(WISHLIST_KEY)).toBe(before);
    expect(events).toEqual([]);
  });
  it('a refused write reports failure and no result, and the stored list is unchanged', () => {
    const { store, events } = fakeWindow({ writeFails: true });
    store.set(WISHLIST_KEY, JSON.stringify([{ set: '10307', name: 'A', added_at: NOW }]));
    const out = updateList(WISHLIST_KEY, cleanWishlist, (list) => ({ list: [...list, { set: '10308', name: 'B', added_at: NOW }], result: 'added', changed: true }));
    expect(out).toEqual({ ok: false, result: null });
    expect(events).toEqual([]);
  });
  it('an unreadable list refuses the write, so it is never overwritten as if empty', () => {
    fakeWindow({ readThrows: true });
    let called = false;
    const out = updateList(WISHLIST_KEY, cleanWishlist, (list) => { called = true; return { list, result: null, changed: true }; });
    expect(out).toEqual({ ok: false, result: null });
    expect(called).toBe(false);
  });
  it('corrupt stored data is replaced by the next valid write', () => {
    const { store } = fakeWindow();
    store.set(WISHLIST_KEY, '{broken');
    const out = updateList(WISHLIST_KEY, cleanWishlist, (list) => ({ list: addWish(list, { set: '10307', name: 'A' }, NOW).list, result: null, changed: true }));
    expect(out.ok).toBe(true);
    expect(cleanWishlist(JSON.parse(store.get(WISHLIST_KEY)!))).toHaveLength(1);
  });
  it('a successful write tells the other pages on this tab to redraw', () => {
    const { events } = fakeWindow();
    updateList(WISHLIST_KEY, cleanWishlist, (list) => ({ list, result: null, changed: true }));
    expect(events).toEqual([CHANGED_EVENT]);
  });
});
