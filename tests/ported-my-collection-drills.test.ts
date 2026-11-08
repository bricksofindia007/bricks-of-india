// Failure drills for the My Collection stack (spec section 8). Each drill is a test that fails if the failure
// behaviour changes. Drills that need a rendered page (buttons, banners in the DOM) are checked against the source
// and the pure rules they depend on; the rest is listed in the report as not tested.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { NextRequest } from 'next/server';

const flags = vi.hoisted(() => ({ myCollectionHearts: true, myCollectionPage: true }));
vi.mock('../src/lib/feature-flags', () => ({ FEATURE_FLAGS: flags }));

vi.mock('next/navigation', () => ({
  notFound: () => { throw new Error('NEXT_NOT_FOUND'); },
  redirect: () => { throw new Error('NEXT_REDIRECT'); },
}));

// Supabase stand-in: a chainable builder. `sb.fail` makes every read return an error.
const sb = vi.hoisted(() => ({ fail: false, tables: {} as Record<string, unknown[]>, from: [] as string[] }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      sb.from.push(table);
      const result = () => (sb.fail ? { data: null, error: { message: 'down' } } : { data: sb.tables[table] ?? [], error: null });
      const c: Record<string, unknown> = {
        select: () => c,
        in: () => c,
        eq: () => c,
        then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(result()).then(res, rej),
      };
      return c;
    },
  }),
}));
vi.mock('../src/lib/get-secret', () => ({ getSecret: () => 'reader-key' }));

import { GET as savedSets } from '../src/app/api/saved-sets/route';
import { GET as lastSeen } from '../src/app/api/last-seen-prices/route';
import MyPage from '../src/app/my/page';
import { addOwned, addWish, cleanWishlist, MY_SETS_LIMIT, PRICE_READ_CAP, priceIds, VOICE, type OwnedItem, type WishItem } from '../src/lib/my-collection';
import { worthInputFor, worthOf, worthTotal, usableRate, WISHLIST_NO_PRICE_LINE, WORTH_UNKNOWN_LINE, RETIRED_LINE } from '../src/lib/collection-worth';

const root = join(__dirname, '..');
const SITE = { 'sec-fetch-site': 'same-origin' };
const req = (path: string, qs: string) =>
  new NextRequest(new URL(`https://bricksofindia.com${path}${qs}`), { headers: SITE });
const ids = (n: number) => Array.from({ length: n }, (_, i) => String(10000 + i));
const NOW = new Date('2026-10-18T06:00:00Z');

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abcdefghijklmnopqrst.supabase.co';
  flags.myCollectionHearts = true;
  flags.myCollectionPage = true;
  sb.fail = false;
  sb.tables = {};
  sb.from = [];
});

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(full);
  }
  return out;
}
const srcFiles = walk(join(root, 'src')).map((f) => ({ file: relative(root, f).split(sep).join('/'), src: readFileSync(f, 'utf8') }));

describe('flags off: the page and the routes are absent', () => {
  it('My Collection page: flag off is not found', () => {
    flags.myCollectionPage = false;
    expect(() => MyPage()).toThrow('NEXT_NOT_FOUND');
  });
  it('My Collection page: flag on renders', () => {
    flags.myCollectionPage = true;
    expect(() => MyPage()).not.toThrow();
  });
  it('the saved-sets route returns 404 with the flag off, and reads nothing', async () => {
    flags.myCollectionPage = false;
    const res = await savedSets(req('/api/saved-sets', `?ids=${ids(1)}`));
    expect(res.status).toBe(404);
    expect(sb.from).toHaveLength(0);
  });
  it('the last-seen route returns 404 with the flag off, and reads nothing', async () => {
    flags.myCollectionPage = false;
    const res = await lastSeen(req('/api/last-seen-prices', `?ids=${ids(1)}`));
    expect(res.status).toBe(404);
    expect(sb.from).toHaveLength(0);
  });
  it('hearts and add-to-collection are rendered only inside the hearts flag (set card, set page, figure tracker)', () => {
    const gate = /FEATURE_FLAGS\.myCollectionHearts/;
    for (const f of ['src/components/sets/SetCard.tsx', 'src/app/sets/[slug]/page.tsx', 'src/app/lab/cmf-tracker/CmfTracker.tsx']) {
      expect(readFileSync(join(root, f), 'utf8')).toMatch(gate);
    }
  });
});

describe('no verified Indian price', () => {
  it('the copy is "No Indian price yet. We\'re watching the shelves." for a wishlist row and "Worth not known yet" for an owned row (approved list, items 27 and 28)', () => {
    expect(WISHLIST_NO_PRICE_LINE).toBe('No Indian price yet. We\'re watching the shelves.');
    expect(WORTH_UNKNOWN_LINE).toBe('Worth not known yet');
    const src = readFileSync(join(root, 'src/app/my/MyCollection.tsx'), 'utf8');
    expect(src).toContain('<OwnedWorthLine line={w.line} />');
    expect(readFileSync(join(root, 'src/app/my/PriceNotes.tsx'), 'utf8')).toContain('WISHLIST_NO_PRICE_LINE');
  });
  it('the set is left out of the worth total', () => {
    const unpriced = worthInputFor({ set: '10307', qty: 2 }, undefined, true);
    const priced = worthInputFor({ set: '10001', qty: 1 }, { best_price_inr: 1000, us_price_usd: null }, true);
    const t = worthTotal([unpriced, priced], null, () => false);
    expect(worthOf(unpriced, null, false).inr).toBeNull();
    expect(t.inr).toBe(1000);
  });
});

describe('price read fails', () => {
  it('the route answers 503 (the page then shows the unavailable line), never an empty success', async () => {
    sb.fail = true;
    const res = await savedSets(req('/api/saved-sets', `?ids=${ids(3)}`));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.sets).toBeUndefined();
  });
  it('the page says prices are unavailable and still lists the rows (names and pieces come from the browser copy)', () => {
    expect(VOICE.pricesUnavailable).toBe('Prices are unavailable right now. Names and pieces are still shown.');
    const src = readFileSync(join(root, 'src/app/my/MyCollection.tsx'), 'utf8');
    expect(src).toContain("{priceState === 'failed' && <PricesUnavailable />}");
    expect(readFileSync(join(root, 'src/app/my/PriceNotes.tsx'), 'utf8')).toContain('role="alert"');
    // Rows are not inside a priceState gate: only the price figure is.
    expect(src).toContain("{priceState !== 'loading' && <OwnedWorthLine");
  });
});

describe('the 500-set limit', () => {
  const full = (n: number) => Array.from({ length: n }, (_, i) => ({ set: String(10000 + i), name: 'x', qty: 1, added_at: '2026-10-18T00:00:00Z' })) as OwnedItem[];
  it('the 501st owned set is blocked, and the list stays at 500', () => {
    const r = addOwned(full(MY_SETS_LIMIT), { set: '99999', name: 'New' }, NOW.toISOString());
    expect(r.status).toBe('limit');
    expect(r.list).toHaveLength(MY_SETS_LIMIT);
  });
  it('the 501st wishlist set is blocked too', () => {
    const wish = Array.from({ length: MY_SETS_LIMIT }, (_, i) => ({ set: String(10000 + i), name: 'x', added_at: 'a' })) as WishItem[];
    const r = addWish(wish, { set: '99999', name: 'New' }, NOW.toISOString());
    expect(r.status).toBe('limit');
    expect(r.list).toHaveLength(MY_SETS_LIMIT);
  });
  it('the approved limit line is shown on the buttons when blocked', () => {
    expect(VOICE.limitReached).toBe('That is a proper collection. Remove one to add another.');
    expect(readFileSync(join(root, 'src/components/saved/SaveButtons.tsx'), 'utf8')).toMatch(/if \(out\.result === 'limit'\) return setNote\(VOICE\.limitReached\)/);
  });
  it('stored lists above the limit are cut back to it on read', () => {
    const big = Array.from({ length: MY_SETS_LIMIT + 20 }, (_, i) => ({ set: String(10000 + i), name: 'x', added_at: 'a' }));
    expect(cleanWishlist(big)).toHaveLength(MY_SETS_LIMIT);
  });
});

describe('the batch read', () => {
  it('a page asks for at most 150 ids, however many sets are saved', () => {
    const owned = Array.from({ length: 400 }, (_, i) => ({ set: String(10000 + i), name: 'x', qty: 1, added_at: 'a' })) as OwnedItem[];
    expect(priceIds([], owned)).toHaveLength(PRICE_READ_CAP);
    expect(PRICE_READ_CAP).toBe(150);
  });
  it('the route refuses more than 150 ids and reads nothing', async () => {
    const res = await savedSets(req('/api/saved-sets', `?ids=${ids(151).join(',')}`));
    expect(res.status).toBe(400);
    expect(sb.from).toHaveLength(0);
  });
  it('one call per page view, never one per card: only the page calls the saved-sets route (no last-seen read, owner ruling)', () => {
    const callers = srcFiles.filter((f) => f.file !== 'src/lib/route-cadence.ts' && /\/api\/saved-sets/.test(f.src)).map((f) => f.file);
    expect(callers.sort()).toEqual(['src/app/my/MyCollection.tsx']);
    const page = readFileSync(join(root, 'src/app/my/MyCollection.tsx'), 'utf8');
    expect(page.match(/fetch\(`\/api\/saved-sets/g)).toHaveLength(1);
    expect(srcFiles.some((f) => /\/api\/last-seen-prices/.test(f.src) && !/^src\/app\/api\//.test(f.file) && f.file !== 'src/lib/route-cadence.ts')).toBe(false);
  });
  it('cards never fetch prices', () => {
    for (const f of srcFiles.filter((x) => /components\/sets\/|components\/saved\//.test(x.file))) {
      expect(f.src, f.file).not.toMatch(/fetch\(/);
    }
  });
});

describe('the retired line', () => {
  it('appears only in My Collection: no other source file imports the worth rules', () => {
    const importers = srcFiles.filter((f) => /from ['"]@\/lib\/collection-worth['"]/.test(f.src)).map((f) => f.file).sort();
    expect(importers).toEqual(['src/app/my/MyCollection.tsx', 'src/app/my/PriceNotes.tsx']);
  });
  it('the approved retired line carries no number', () => {
    expect(RETIRED_LINE).not.toMatch(/\d|₹/);
  });
  it('a retired set is never valued, so it never adds a figure to the total', () => {
    const item = worthInputFor({ set: '10307', qty: 1 }, { best_price_inr: null, us_price_usd: 499 }, true);
    const w = worthOf(item, usableRate({ rate: 88, asOf: '2026-10-18' }, NOW), true);
    expect(w.inr).toBeNull();
    expect(worthTotal([item], usableRate({ rate: 88, asOf: '2026-10-18' }, NOW), () => true).inr ?? 0).toBe(0);
  });
});
