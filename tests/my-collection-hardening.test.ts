// My Collection browser storage: storage that throws (private mode), a full quota, corrupt data, duplicate adds,
// the 500 cap, two tabs changing at once, and the heart's keyboard use and label.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  readList, writeList, loadWishlist, cleanWishlist, cleanCollection, addWish, addOwned,
  MY_SETS_LIMIT, WISHLIST_KEY, COLLECTION_KEY, CHANGED_EVENT,
} from '../src/lib/my-collection';

const root = join(__dirname, '..');
const NOW = '2026-10-18T09:00:00.000Z';
afterEach(() => vi.unstubAllGlobals());

/** A fake window with localStorage, with an optional failure mode. */
function fakeWindow(mode: 'ok' | 'throw' | 'quota' = 'ok', initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  const events: string[] = [];
  const win = {
    localStorage: {
      getItem: (k: string) => {
        if (mode === 'throw') throw new Error('SecurityError: storage disabled');
        return store.get(k) ?? null;
      },
      setItem: (k: string, v: string) => {
        if (mode === 'throw') throw new Error('SecurityError: storage disabled');
        if (mode === 'quota') {
          const e = new Error('The quota has been exceeded.');
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
  };
  vi.stubGlobal('window', win);
  return { store, events };
}

describe('storage that throws (private mode)', () => {
  it('reads give an empty list, and nothing is thrown', () => {
    fakeWindow('throw');
    expect(readList(WISHLIST_KEY)).toEqual([]);
    expect(loadWishlist()).toEqual([]);
  });
  it('a write reports failure, so the page never says "saved"', () => {
    fakeWindow('throw');
    expect(writeList(WISHLIST_KEY, [{ set: '10307' }])).toBe(false);
  });
});

describe('quota full', () => {
  it('a write reports failure and leaves the stored list as it was', () => {
    const before = JSON.stringify([{ set: '10307', name: 'A', added_at: NOW }]);
    const { store } = fakeWindow('quota', { [WISHLIST_KEY]: before });
    expect(writeList(WISHLIST_KEY, [{ set: '10308' }])).toBe(false);
    expect(store.get(WISHLIST_KEY)).toBe(before);
  });
  it('no change event fires when a write fails', () => {
    const { events } = fakeWindow('quota');
    writeList(COLLECTION_KEY, []);
    expect(events).toEqual([]);
  });
});

describe('corrupted data', () => {
  it.each([
    ['not JSON', '{not json'],
    ['an object, not a list', '{"set":"10307"}'],
    ['a list of junk', '[null, 5, "x", {"set":"abc"}]'],
  ])('%s reads as an empty list', (_label, raw) => {
    fakeWindow('ok', { [WISHLIST_KEY]: raw });
    expect(loadWishlist()).toEqual([]);
  });
  it('bad fields are cleaned, not shown: a javascript: image, negative pieces, a bad date', () => {
    fakeWindow('ok', { [WISHLIST_KEY]: JSON.stringify([{ set: '10307', name: 'A', added_at: 'nope', image_url: 'javascript:alert(1)', pieces: -4 }]) });
    const [w] = loadWishlist();
    expect(w.image_url).toBeNull();
    expect(w.pieces).toBeNull();
    expect(w.added_at).toBe(new Date(0).toISOString());
  });
});

describe('duplicate adds', () => {
  it('adding a set already on the wishlist is "present" and leaves the list unchanged', () => {
    const first = addWish([], { set: '10307', name: 'A' }, NOW);
    const again = addWish(first.list, { set: '10307', name: 'A' }, NOW);
    expect(again.status).toBe('present');
    expect(again.list).toBe(first.list);
  });
  it('duplicates already in storage are dropped on read, keeping the first', () => {
    const rows = [{ set: '10307', name: 'first', added_at: NOW }, { set: '10307', name: 'second', added_at: NOW }];
    expect(cleanWishlist(rows).map((w) => w.name)).toEqual(['first']);
  });
  it('the same set cannot appear twice in the collection either', () => {
    const r = addOwned([], { set: '10307', name: 'A' }, NOW);
    expect(addOwned(r.list, { set: '10307', name: 'A' }, NOW).status).toBe('present');
    expect(cleanCollection([...r.list, ...r.list])).toHaveLength(1);
  });
});

describe('the 500 cap', () => {
  const full = Array.from({ length: MY_SETS_LIMIT }, (_, i) => ({ set: String(10000 + i), name: 'x', added_at: NOW }));
  it('a full list refuses a new set, and the list stays at 500', () => {
    expect(addWish(cleanWishlist(full), { set: '99999', name: 'y' }, NOW)).toMatchObject({ status: 'limit' });
    expect(addOwned(cleanCollection(full), { set: '99999', name: 'y' }, NOW)).toMatchObject({ status: 'limit' });
  });
  it('stored data over 500 is cut to 500 on read', () => {
    fakeWindow('ok', { [WISHLIST_KEY]: JSON.stringify([...full, { set: '99999', name: 'y', added_at: NOW }]) });
    expect(loadWishlist()).toHaveLength(MY_SETS_LIMIT);
  });
});

describe('two tabs changing at once', () => {
  it('each read sees what the other tab wrote: nothing is cached across reads', () => {
    const { store } = fakeWindow('ok', {});
    writeList(WISHLIST_KEY, [{ set: '10307', name: 'A', added_at: NOW }]);
    // Another tab writes to the shared store.
    store.set(WISHLIST_KEY, JSON.stringify([{ set: '10308', name: 'B', added_at: NOW }]));
    expect(loadWishlist().map((w) => w.set)).toEqual(['10308']);
  });
  it('a write fires the change event, so this tab redraws', () => {
    const { events } = fakeWindow('ok');
    writeList(WISHLIST_KEY, []);
    expect(events).toEqual([CHANGED_EVENT]);
  });
  it('the My Collection page listens for the storage event (another tab)', () => {
    const src = readFileSync(join(root, 'src/app/my/MyCollection.tsx'), 'utf8');
    expect(src).toContain("window.addEventListener('storage', load)");
  });
});

describe('the heart: keyboard and label', () => {
  it('the heart is a native button, so Enter and Space work without extra code', () => {
    const src = readFileSync(join(root, 'src/components/saved/SaveButtons.tsx'), 'utf8');
    expect(src).toMatch(/<button\s+type="button"\s+onClick=\{onClick\}/);
    expect(src).not.toContain('aria-pressed={saved}');
  });
  it('the label says what a press will do: remove when saved, save when not', () => {
    const src = readFileSync(join(root, 'src/components/saved/SaveButtons.tsx'), 'utf8');
    expect(src).toContain('aria-label={saved ? `Remove ${name} from your wishlist` : `Save ${name} to your wishlist`}');
  });
  it('the CMF tracker heart uses the same label rule on a native button', () => {
    const src = readFileSync(join(root, 'src/app/lab/cmf-tracker/FigureHeart.tsx'), 'utf8');
    expect(src).toContain('aria-label={saved ? `Remove ${name} from your saved figures` : `Save ${name} to your saved figures`}');
    expect(src).toMatch(/<button\s+type="button"/);
  });
  it('the status message is announced to assistive tech', () => {
    const src = readFileSync(join(root, 'src/components/saved/SaveButtons.tsx'), 'utf8');
    expect(src).toContain('role="status"');
  });
});
