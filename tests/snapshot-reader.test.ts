import { describe, it, expect, beforeEach } from 'vitest';
import {
  KEYS, withChecksum, verifySnapshot, canonicalJson, canonicalSetSlug, pricedEntries, listingTransitions, parityForm, heartbeatFresh,
} from '../src/lib/snapshot/format';
import { readSetPageSnapshot, crossesFreshness, _resetSnapshotCache } from '../src/lib/snapshot/reader';
import { parseFlags, getRuntimeFlags, SAFE_DEFAULTS, _resetFlagCache } from '../src/lib/runtime-flags';
import { verifyRevalidate, rememberNonce } from '../src/lib/snapshot/revalidate-auth';
import { sign } from '../workers/boi-scheduler/src/auth';

const NOW = Date.parse('2026-09-28T12:00:00Z');
const iso = (hAgo: number) => new Date(NOW - hAgo * 3600_000).toISOString();

async function fixture(opts: { hbAgeH?: number; priced?: boolean; rowAgeH?: number } = {}) {
  const row = { set_id: '10305', store_id: 'toycra', price_inr: 32999, in_stock: true, product_url: 'u', scraped_at: iso(opts.rowAgeH ?? 2) };
  const relRow = { set_id: '10332', store_id: 'mybrickhouse', price_inr: 20999, in_stock: true, product_url: 'r', scraped_at: iso(2) };
  const kv: Record<string, unknown> = {
    [KEYS.heartbeat]: { v: 1, cycle_id: 'c', scrape_finished_at: iso(2), publisher_finished_at: iso(opts.hbAgeH ?? 1), sets_written: 3, cat_cursor: null, version: 't' },
    [KEYS.priced]: await withChecksum({ v: 1, cycle_id: 'c', sets: { ...(opts.priced === false ? {} : { '10305': { best: 32999, offers: 1 } }), '10332': { best: 20999, offers: 1 } } }),
    [KEYS.cat('10305')]: await withChecksum({ v: 1, set: '10305', slug: '10305-lion-knights-castle', data: {
      set: { set_number: '10305', name: "Lion Knights' Castle", reviews: [] },
      related: [{ set_number: '10332' }, { set_number: '10333' }],
      coverage: { news: [{ slug: 'b' }, { slug: 'a' }], guides: [], reviews: [] },
    } }),
    [KEYS.set('10305')]: await withChecksum({ v: 1, set: '10305', store_prices: [row], summary: { set_id: '10305', best_price_inr: 32999 } }),
    [KEYS.set('10332')]: await withChecksum({ v: 1, set: '10332', store_prices: [relRow], summary: { set_id: '10332' } }),
  };
  return { kv, mem: { get: async (k: string) => kv[k] ?? null } };
}

describe('snapshot format (FP1.1 PR 2)', () => {
  it('checksums canonical JSON and rejects tampering or a wrong version', async () => {
    expect(canonicalJson({ b: 1, a: { d: [2, { z: 1, y: 2 }], c: null } })).toBe('{"a":{"c":null,"d":[2,{"y":2,"z":1}]},"b":1}');
    const v = await withChecksum({ v: 1, set: '1', x: 1 });
    expect(await verifySnapshot(v)).toBe(true);
    expect(await verifySnapshot({ ...v, x: 2 })).toBe(false);
    expect(await verifySnapshot({ ...(await withChecksum({ v: 2, set: '1' })) })).toBe(false);
    expect(await verifySnapshot(null)).toBe(false);
  });

  it('canonical slug matches SetCard/sitemap', () => {
    expect(canonicalSetSlug('10305', "Lion Knights' Castle")).toBe('10305-lion-knights-castle');
    expect(canonicalSetSlug('75192', 'Millennium Falcon™ – UCS')).toBe('75192-millennium-falcon-ucs');
  });

  it('priced list: store rows and summary-only (catalogue MRP) sets; best = lowest in-stock', () => {
    const e = pricedEntries([
      { set_id: 'A', price_inr: 900, in_stock: false }, { set_id: 'A', price_inr: 1000, in_stock: true }, { set_id: 'A', price_inr: 950, in_stock: true },
    ], ['A', 'M']);
    expect(e).toEqual({ A: { best: 950, offers: 3 }, M: { best: null, offers: 0 } });
  });

  it('FP1.6 transitions: first listing gained / last listing gone; none on the first run', () => {
    expect(listingTransitions(null, { A: { best: 1, offers: 1 } })).toEqual({ gained: [], lost: [] });
    expect(listingTransitions({ A: { best: 1, offers: 1 }, M: { best: null, offers: 0 } }, { M: { best: 2, offers: 1 }, B: { best: null, offers: 0 } }))
      .toEqual({ gained: ['M'], lost: ['A'] });
  });

  it('parity form ignores as_of and the order of unordered arrays only', () => {
    const a = { as_of: 'x', store_prices: [1, 2], related_prices: [{ set_id: 'b', store_id: 't' }, { set_id: 'a', store_id: 't' }], related_summaries: [], coverage: { news: [{ slug: 'b' }, { slug: 'a' }] } };
    const b = { store_prices: [1, 2], related_prices: [{ set_id: 'a', store_id: 't' }, { set_id: 'b', store_id: 't' }], related_summaries: [], coverage: { news: [{ slug: 'a' }, { slug: 'b' }], guides: [], reviews: [] } };
    expect(canonicalJson(parityForm(a))).toBe(canonicalJson(parityForm(b)));
    expect(canonicalJson(parityForm({ ...b, store_prices: [2, 1] }))).not.toBe(canonicalJson(parityForm(b)));
  });

  it('heartbeat freshness is 12 h', () => {
    expect(heartbeatFresh({ publisher_finished_at: iso(11.9) }, NOW)).toBe(true);
    expect(heartbeatFresh({ publisher_finished_at: iso(12.1) }, NOW)).toBe(false);
    expect(heartbeatFresh(null, NOW)).toBe(false);
  });
});

describe('snapshot reader: rebuilds set_page_data or falls back', () => {
  beforeEach(() => _resetSnapshotCache());

  it('priced set: set + cat + related prices from KV, as_of = publisher run', async () => {
    const { mem } = await fixture();
    const r = await readSetPageSnapshot(mem, '10305', '10305-lion-knights-castle', NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.priced).toBe(true);
    expect(r.data.store_prices).toHaveLength(1);
    expect(r.data.related_prices).toEqual([{ set_id: '10332', price_inr: 20999, store_id: 'mybrickhouse', product_url: 'r', in_stock: true, scraped_at: iso(2) }]);
    expect(r.data.related_summaries).toEqual([{ set_id: '10332' }]);
    expect(r.data.as_of).toBe(iso(1));
  });

  it('unpriced set (absent from a fresh list): no set:{n} read, empty prices (A1)', async () => {
    const { mem, kv } = await fixture({ priced: false });
    const reads: string[] = [];
    const r = await readSetPageSnapshot({ get: async (k) => { reads.push(k); return kv[k] ?? null; } }, '10305', '10305-lion-knights-castle', NOW);
    expect(r.ok && r.priced).toBe(false);
    expect(r.ok && r.data.store_prices).toEqual([]);
    expect(r.ok && r.data.summary).toBeNull();
    expect(reads).not.toContain(KEYS.set('10305'));
    void mem;
  });

  it.each([
    ['no-binding', async () => ({ kv: null, slug: '10305-lion-knights-castle' })],
    ['heartbeat', async () => { const f = await fixture({ hbAgeH: 13 }); return { kv: f.mem, slug: '10305-lion-knights-castle' }; }],
    ['slug', async () => { const f = await fixture(); return { kv: f.mem, slug: '10305-other' }; }],
    ['aging', async () => { const f = await fixture({ rowAgeH: 12.5 }); return { kv: f.mem, slug: '10305-lion-knights-castle' }; }],
  ])('falls back: %s', async (reason, make) => {
    const { kv, slug } = await make();
    expect(await readSetPageSnapshot(kv as any, '10305', slug, NOW)).toEqual({ ok: false, reason });
  });

  it('falls back on a bad checksum, a missing set:{n} for a listed set, a missing related snapshot, a throwing KV', async () => {
    let f = await fixture(); (f.kv[KEYS.cat('10305')] as any).data.set.name = 'tampered';
    expect(await readSetPageSnapshot(f.mem, '10305', '10305-lion-knights-castle', NOW)).toEqual({ ok: false, reason: 'cat' });
    _resetSnapshotCache(); f = await fixture(); delete f.kv[KEYS.set('10305')];
    expect(await readSetPageSnapshot(f.mem, '10305', '10305-lion-knights-castle', NOW)).toEqual({ ok: false, reason: 'set' });
    _resetSnapshotCache(); f = await fixture(); delete f.kv[KEYS.set('10332')];
    expect(await readSetPageSnapshot(f.mem, '10305', '10305-lion-knights-castle', NOW)).toEqual({ ok: false, reason: 'related' });
    _resetSnapshotCache(); f = await fixture(); (f.kv[KEYS.priced] as any).sets.X = { best: 1, offers: 1 };
    expect(await readSetPageSnapshot(f.mem, '10305', '10305-lion-knights-castle', NOW)).toEqual({ ok: false, reason: 'list' });
    _resetSnapshotCache();
    expect(await readSetPageSnapshot({ get: async () => { throw new Error('kv down'); } }, '10305', 'x', NOW)).toEqual({ ok: false, reason: 'error' });
  });

  it('aging rule: only rows crossing the 12 h line between publish and now', () => {
    const pub = NOW - 3 * 3600_000;
    expect(crossesFreshness([{ price_inr: 1, scraped_at: iso(13) }], pub, NOW)).toBe(true);    // fresh at publish, stale now
    expect(crossesFreshness([{ price_inr: 1, scraped_at: iso(16) }], pub, NOW)).toBe(false);   // already stale at publish
    expect(crossesFreshness([{ price_inr: 1, scraped_at: iso(5) }], pub, NOW)).toBe(false);    // still fresh
    expect(crossesFreshness([{ price_inr: null, scraped_at: iso(13) }], pub, NOW)).toBe(false);
  });
});

describe('FP2.4 runtime flags', () => {
  beforeEach(() => _resetFlagCache());
  it('safe defaults when KV is absent, throws, or holds junk; only booleans override', async () => {
    expect(await getRuntimeFlags(null)).toEqual(SAFE_DEFAULTS);
    expect(await getRuntimeFlags({ get: async () => { throw new Error('x'); } }, 1)).toEqual(SAFE_DEFAULTS);
    expect(parseFlags('junk')).toEqual(SAFE_DEFAULTS);
    expect(parseFlags({ snapshot_read: 'yes', alerts_enabled: true, other: true })).toEqual({ ...SAFE_DEFAULTS, alerts_enabled: true });
    expect(SAFE_DEFAULTS.snapshot_read).toBe(false);
    expect(SAFE_DEFAULTS['email_stream:transactional']).toBe(true);
  });
  it('reads flag:v1 and caches it 60 s', async () => {
    let n = 0;
    const kv = { get: async (k: string) => { n++; expect(k).toBe('flag:v1'); return { snapshot_read: true }; } };
    expect((await getRuntimeFlags(kv, 1000)).snapshot_read).toBe(true);
    await getRuntimeFlags(kv, 50_000);
    expect(n).toBe(1);
    await getRuntimeFlags(kv, 62_000);
    expect(n).toBe(2);
  });
});

describe('FP1.6 /api/revalidate auth', () => {
  const key = 'k'.repeat(40);
  const nowS = 1_790_000_000;
  const req = async (body: object, over: Partial<{ ts: string; nonce: string; sig: string; key: string }> = {}) => {
    const b = JSON.stringify(body); const ts = over.ts ?? String(nowS); const nonce = over.nonce ?? 'n'.repeat(20) + Math.random().toString(36).slice(2, 8);
    return verifyRevalidate({ key: over.key ?? key, ts, nonce, sig: over.sig ?? (await sign(key, ts, nonce, b)), body: b, nowS, seenNonce: (x) => rememberNonce(x, nowS) });
  };
  it('accepts set paths and set tags', async () => {
    expect(await req({ paths: ['/sets/10305-lion-knights-castle'], tags: ['set:10305'] })).toEqual({ ok: true, paths: ['/sets/10305-lion-knights-castle'], tags: ['set:10305'] });
  });
  it('rejects: wrong key, stale ts, reused nonce, non-set path, too many, empty', async () => {
    expect((await req({ paths: ['/sets/1-a'] }, { key: 'x'.repeat(40) })).ok).toBe(false);
    expect((await req({ paths: ['/sets/1-a'] }, { ts: String(nowS - 400) })).ok).toBe(false);
    const nonce = 'r'.repeat(24);
    expect((await req({ paths: ['/sets/1-a'] }, { nonce })).ok).toBe(true);
    expect(await req({ paths: ['/sets/1-a'] }, { nonce })).toEqual({ ok: false, reason: 'reused nonce' });
    expect(await req({ paths: ['/admin/pending'] })).toEqual({ ok: false, reason: 'path not allowed' });
    expect(await req({ paths: Array.from({ length: 101 }, (_, i) => `/sets/${i}-x`) })).toEqual({ ok: false, reason: 'too many' });
    expect(await req({})).toEqual({ ok: false, reason: 'empty' });
    expect((await verifyRevalidate({ key: undefined, ts: String(nowS), nonce: 'n'.repeat(20), sig: 'a'.repeat(64), body: '{}', nowS, seenNonce: () => false })).ok).toBe(false);
  });
});
