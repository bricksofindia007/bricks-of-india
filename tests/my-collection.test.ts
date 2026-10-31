// My Collection storage and list rules: the 500-set limit, the 150-set price read, pagination,
// guarded browser storage (missing or throwing), and the exact voice lines.
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  MY_SETS_LIMIT, PAGE_SIZE, PRICE_READ_CAP, VOICE, addWish, removeWish, addOwned, setOwnedQty,
  cleanWishlist, cleanCollection, priceIds, pageOf, readList, writeList, loadWishlist, type WishItem, type OwnedItem,
} from '../src/lib/my-collection';

const NOW = '2026-10-18T06:00:00.000Z';
const ref = (set: string) => ({ set, name: `Set ${set}` });
const many = (n: number) => Array.from({ length: n }, (_, i) => ({ set: String(10000 + i), name: 'x', added_at: NOW }));

afterEach(() => vi.unstubAllGlobals());

describe('500-set limit', () => {
  it('a full wishlist refuses a new heart and says so', () => {
    const full = cleanWishlist(many(MY_SETS_LIMIT)) as WishItem[];
    expect(full).toHaveLength(MY_SETS_LIMIT);
    const r = addWish(full, ref('99999'), NOW);
    expect(r.status).toBe('limit');
    expect(r.list).toHaveLength(MY_SETS_LIMIT);
  });
  it('a full collection refuses a new set and says so', () => {
    const full = cleanCollection(many(MY_SETS_LIMIT)) as OwnedItem[];
    const r = addOwned(full, ref('99999'), NOW);
    expect(r.status).toBe('limit');
    expect(r.list).toHaveLength(MY_SETS_LIMIT);
  });
  it('a set already in the list is "present", not a limit failure, even when full', () => {
    const full = cleanWishlist(many(MY_SETS_LIMIT)) as WishItem[];
    expect(addWish(full, ref('10000'), NOW).status).toBe('present');
  });
  it('stored data over the limit is cut to the limit on read', () => {
    expect(cleanWishlist(many(MY_SETS_LIMIT + 20))).toHaveLength(MY_SETS_LIMIT);
  });
});

describe('the one batched price read', () => {
  it('asks for at most 150 sets, newest added first, each set once', () => {
    const wish: WishItem[] = [{ ...ref('1001'), added_at: '2026-10-01T00:00:00.000Z' }, { ...ref('1002'), added_at: '2026-10-05T00:00:00.000Z' }];
    const owned: OwnedItem[] = [{ ...ref('1002'), qty: 1, added_at: '2026-10-02T00:00:00.000Z' }, ...many(200).map((m) => ({ ...m, qty: 1, added_at: '2026-09-01T00:00:00.000Z' }))];
    const ids = priceIds(wish, owned);
    expect(ids).toHaveLength(PRICE_READ_CAP);
    expect(ids[0]).toBe('1002');
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('pagination', () => {
  it('50 rows a page', () => {
    expect(PAGE_SIZE).toBe(50);
    const p = pageOf(many(120), 2);
    expect(p.rows).toHaveLength(50);
    expect(p.pages).toBe(3);
    expect(pageOf(many(120), 3).rows).toHaveLength(20);
  });
  it('a page past the end shows the last page; an empty list is one empty page', () => {
    expect(pageOf(many(120), 9).page).toBe(3);
    expect(pageOf([], 1)).toMatchObject({ rows: [], page: 1, pages: 1 });
  });
});

describe('list operations', () => {
  it('hearts add, remove and report a repeat as present', () => {
    let r = addWish([], ref('10696'), NOW);
    expect(r.status).toBe('added');
    expect(addWish(r.list, ref('10696'), NOW).status).toBe('present');
    expect(removeWish(r.list, '10696')).toEqual([]);
  });
  it('adding to the collection starts at one copy; a repeat keeps its quantity', () => {
    const r = addOwned([], ref('10696'), NOW);
    expect(r.list[0].qty).toBe(1);
    const q = setOwnedQty(r.list, '10696', 4);
    expect(addOwned(q, ref('10696'), NOW).list[0].qty).toBe(4);
    expect(setOwnedQty(q, '10696', 0)).toEqual([]);
  });
});

describe('guest storage that is missing or throws', () => {
  it('reads give an empty list and writes report failure, with no error thrown', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => { throw new Error('denied'); },
        setItem: () => { throw new Error('denied'); },
      },
      dispatchEvent: () => true,
    });
    expect(readList('boi_wishlist')).toEqual([]);
    expect(writeList('boi_wishlist', [{ set: '10696' }])).toBe(false);
    expect(loadWishlist()).toEqual([]);
  });
  it('no window at all (server or blocked): reads are empty and writes fail quietly', () => {
    vi.stubGlobal('window', undefined);
    expect(readList('boi_wishlist')).toEqual([]);
    expect(writeList('boi_wishlist', [])).toBe(false);
  });
  it('a corrupt stored value is dropped, not shown', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => '{not json', setItem: () => {} }, dispatchEvent: () => true });
    expect(loadWishlist()).toEqual([]);
  });
  it('a working store saves and reads back', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } },
      dispatchEvent: () => true,
    });
    expect(writeList('boi_wishlist', [{ set: '10696', name: 'Creative Brick Box', added_at: NOW }])).toBe(true);
    expect(loadWishlist()).toEqual([expect.objectContaining({ set: '10696', name: 'Creative Brick Box' })]);
  });
});

describe('voice lines are exact', () => {
  it('matches the spec wording', () => {
    expect(VOICE.heartAdded).toBe('Saved. Your wallet has been notified.');
    expect(VOICE.heartRemoved).toBe('Removed. Your wallet is relieved.');
    expect(VOICE.ownedAdded).toBe('Yours now. Own it proudly.');
    expect(VOICE.wishlistEmpty).toBe('Nothing saved yet. Your wallet admires your patience.');
    expect(VOICE.collectionEmpty).toBe('Your shelf is empty. Your wallet is suspiciously calm.');
    expect(VOICE.limitReached).toBe('Your shelf is full. Impressive. Contact us and we will open a bank for you.');
  });
});
