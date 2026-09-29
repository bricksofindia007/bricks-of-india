// FP1.1 PR 2: set-page snapshot reader (design §1a reader rule, §3). Rebuilds
// exactly what public.set_page_data returns, from KV, so the page code is
// unchanged. Returns {ok:false, reason} for EVERY doubt, and the caller then
// uses today's Supabase path and logs snapshot_fallback{reason} (G3 fallback,
// G14: older-but-labelled or the RPC, never a wrong page).
//
// Fallback reasons:
//   no-binding     KV binding absent (local dev, tests, staging without KV)
//   heartbeat      heartbeat missing, bad, or older than 12 h (pricedness unknown)
//   list           list:priced-sets missing / bad checksum / wrong version
//   cat            cat:{n} missing / bad checksum / wrong version
//   slug           the requested slug isn't the canonical one (coverage is slug-keyed)
//   set            the set is in the list but set:{n} is missing or bad
//   related        a related set is in the list but its set:{n} is missing or bad
//   aging          a store row crosses the 12 h freshness line between publish and now,
//                  so the stored summary could differ from the live view's
//   error          a KV call threw

import { KEYS, SNAPSHOT_VERSION, verifySnapshot, heartbeatFresh, type CatSnap, type SetSnap, type PricedList, type Heartbeat } from './format';

export type KvLike = { get(key: string, type: 'json'): Promise<unknown> };
export type SnapshotPageData = {
  set: any; store_prices: any[]; related: any[];
  related_prices: { set_id: string; price_inr: number; store_id: string; product_url: string | null; in_stock: boolean; scraped_at: string }[];
  coverage: { news: any[]; guides: any[]; reviews: any[] };
  summary: any | null; related_summaries: any[];
  as_of: string;  // the publisher run this data came from ("as of {time}")
};
export type ReadResult = { ok: true; data: SnapshotPageData; priced: boolean } | { ok: false; reason: string };

const STALE_MS = 12 * 3600_000;
// Per-isolate cache for the two small shared keys (design: list cached <= 60 s per isolate).
let shared: { at: number; hb: Heartbeat | null; list: PricedList | null; listOk: boolean } | null = null;
export function _resetSnapshotCache() { shared = null; }

/** A row whose scraped_at is inside (publishedAt - 12h, now - 12h] left the live view's window since publish. */
export function crossesFreshness(rows: { price_inr?: unknown; scraped_at?: string | null }[], publishedAtMs: number, nowMs: number): boolean {
  return rows.some((r) => {
    if (r.price_inr == null || !r.scraped_at) return false;
    const t = Date.parse(r.scraped_at);
    return t > publishedAtMs - STALE_MS && t <= nowMs - STALE_MS;
  });
}

async function sharedKeys(kv: KvLike, nowMs: number) {
  if (shared && nowMs - shared.at < 60_000) return shared;
  const [hb, list] = await Promise.all([kv.get(KEYS.heartbeat, 'json'), kv.get(KEYS.priced, 'json')]);
  shared = { at: nowMs, hb: (hb as Heartbeat) ?? null, list: (list as PricedList) ?? null, listOk: await verifySnapshot(list) };
  return shared;
}

export async function readSetPageSnapshot(kv: KvLike | null | undefined, setNumber: string, slug: string, nowMs = Date.now()): Promise<ReadResult> {
  if (!kv) return { ok: false, reason: 'no-binding' };
  try {
    const { hb, list, listOk } = await sharedKeys(kv, nowMs);
    if (!hb || hb.v !== SNAPSHOT_VERSION || !heartbeatFresh(hb, nowMs)) return { ok: false, reason: 'heartbeat' };
    if (!list || !listOk) return { ok: false, reason: 'list' };
    const publishedAt = Date.parse(hb.publisher_finished_at);

    const cat = (await kv.get(KEYS.cat(setNumber), 'json')) as CatSnap | null;
    if (!cat || !(await verifySnapshot(cat))) return { ok: false, reason: 'cat' };
    if (cat.slug !== slug) return { ok: false, reason: 'slug' };

    const inList = (n: string) => Object.prototype.hasOwnProperty.call(list.sets, n);
    const readSet = async (n: string) => {
      const s = (await kv.get(KEYS.set(n), 'json')) as SetSnap | null;
      return s && (await verifySnapshot(s)) ? s : null;
    };

    // In the list = has store rows or a summary row (a catalogue-only MRP anchor).
    let store_prices: any[] = [], summary: any = null;
    if (inList(setNumber)) {
      const s = await readSet(setNumber);
      if (!s) return { ok: false, reason: 'set' };
      if (crossesFreshness(s.store_prices as any[], publishedAt, nowMs)) return { ok: false, reason: 'aging' };
      store_prices = s.store_prices as any[]; summary = s.summary;
    }
    const priced = store_prices.length > 0;  // offers present -> the page keeps the 6 h clock

    const related = (cat.data.related ?? []) as { set_number: string }[];
    const relSnaps = await Promise.all(related.filter((r) => inList(r.set_number)).map((r) => readSet(r.set_number)));
    if (relSnaps.some((s) => !s)) return { ok: false, reason: 'related' };
    const related_prices: SnapshotPageData['related_prices'] = [];
    const related_summaries: any[] = [];
    for (const s of relSnaps as SetSnap[]) {
      if (crossesFreshness(s.store_prices as any[], publishedAt, nowMs)) return { ok: false, reason: 'aging' };
      for (const r of s.store_prices as any[]) related_prices.push({ set_id: r.set_id, price_inr: r.price_inr, store_id: r.store_id, product_url: r.product_url, in_stock: r.in_stock, scraped_at: r.scraped_at });
      if (s.summary) related_summaries.push(s.summary);
    }

    return {
      ok: true, priced,
      data: { set: cat.data.set, store_prices, related: cat.data.related ?? [], related_prices, coverage: cat.data.coverage, summary, related_summaries, as_of: hb.publisher_finished_at },
    };
  } catch (e) {
    console.log(`snapshot_fallback{reason=error} ${(e as Error).message?.slice(0, 120)}`);
    return { ok: false, reason: 'error' };
  }
}

export { STALE_MS as _STALE_MS };
