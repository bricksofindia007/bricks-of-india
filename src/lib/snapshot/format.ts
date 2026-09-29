// FP1.1 snapshot format, shared by the publisher (scripts/snapshot), the
// boi-scheduler Worker, the parity job and the site reader (PR 2; design
// docs/plans/FP1.1_snapshot_design.md §1/§1a, ADR 0003). Dependency-free:
// it runs on Workers and on Node 20+ (globalThis.crypto).
//
// Exactness rule: a snapshot carries the SAME fields public.set_page_data
// returns, split by how often they change, so the reader rebuilds the RPC's
// output exactly and the page code doesn't change:
//   cat:{n}:v1           {set, related, coverage} for the canonical slug (catalogue side; A1)
//   set:{n}:v1           {store_prices, summary} (price side; only for sets with >= 1 store row)
//   list:priced-sets:v1  every set with >= 1 store row -> its best in-stock price
//   meta:heartbeat       written LAST by the Worker (auth.ts), so data is never older than it claims
// Every value carries v (version) and a checksum over its canonical JSON.

export const SNAPSHOT_VERSION = 1 as const;
export const HEARTBEAT_FRESH_MS = 12 * 3600_000;   // PRICE_STALE_HOURS: absence from the list is trusted only this long

export const KEYS = {
  set: (n: string) => `set:${n}:v1`,
  cat: (n: string) => `cat:${n}:v1`,
  priced: 'list:priced-sets:v1',
  heartbeat: 'meta:heartbeat',
  flags: 'flag:v1',
  parity: 'meta:parity:v1',
} as const;

// No per-cycle fields in set:/cat: values: an unchanged set keeps its checksum and isn't rewritten.
export type SetSnap = { v: 1; set: string; store_prices: unknown[]; summary: unknown | null; checksum?: string };
export type CatSnap = { v: 1; set: string; slug: string; data: { set: unknown; related: unknown[]; coverage: { news: unknown[]; guides: unknown[]; reviews: unknown[] } }; checksum?: string };
// offers = store rows (any stock); 0 = a catalogue-only MRP anchor (summary row, no offers).
export type PricedEntry = { best: number | null; offers: number };
export type PricedList = { v: 1; cycle_id: string; sets: Record<string, PricedEntry>; checksum?: string };
export type Heartbeat = { v: 1; cycle_id: string; scrape_finished_at: string | null; publisher_finished_at: string; sets_written: number; cat_cursor: string | null; version: string };

/** JSON with object keys sorted at every level: the same value always hashes the same. */
export function canonicalJson(x: unknown): string {
  if (x === null || typeof x !== 'object') return JSON.stringify(x) ?? 'null';
  if (Array.isArray(x)) return `[${x.map(canonicalJson).join(',')}]`;
  const o = x as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(',')}}`;
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** The checksum covers everything except the checksum field itself. */
export async function checksumOf(value: Record<string, unknown>): Promise<string> {
  const { checksum: _omit, ...rest } = value; // eslint-disable-line @typescript-eslint/no-unused-vars
  return (await sha256Hex(canonicalJson(rest))).slice(0, 32);
}

export async function withChecksum<T extends Record<string, unknown>>(value: T): Promise<T & { checksum: string }> {
  return { ...value, checksum: await checksumOf(value) };
}

export async function verifySnapshot(value: unknown): Promise<boolean> {
  if (!value || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  return o.v === SNAPSHOT_VERSION && typeof o.checksum === 'string' && o.checksum === (await checksumOf(o));
}

/** The URL slug the site links to (SetCard, sitemap): `${set_number}-${slugify(name)}`. */
export function canonicalSetSlug(setNumber: string, name: string): string {
  const s = name.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
  return `${setNumber}-${s}`;
}

type Rpc = { set: unknown; related: unknown[]; coverage: CatSnap['data']['coverage']; store_prices: unknown[]; summary: unknown | null };

/** Split one set_page_data result into its cat and set snapshots. */
export async function snapshotsFromRpc(n: string, slug: string, rpc: Rpc): Promise<{ cat: CatSnap; set: SetSnap | null }> {
  const cat = await withChecksum({ v: SNAPSHOT_VERSION, set: n, slug, data: { set: rpc.set, related: rpc.related ?? [], coverage: rpc.coverage } });
  const set = (rpc.store_prices ?? []).length
    ? await withChecksum({ v: SNAPSHOT_VERSION, set: n, store_prices: rpc.store_prices, summary: rpc.summary ?? null })
    : null;
  return { cat: cat as CatSnap, set: set as SetSnap | null };
}

/**
 * list:priced-sets entries: every set with a store row or a summary row (so the
 * reader knows which sets have a set:{n} snapshot). best = lowest in-stock price.
 */
export function pricedEntries(rows: { set_id: string; price_inr: number | null; in_stock: boolean | null }[], summaryIds: Iterable<string>): Record<string, PricedEntry> {
  const out: Record<string, PricedEntry> = {};
  for (const id of summaryIds) out[id] ??= { best: null, offers: 0 };
  for (const r of rows) {
    const e = (out[r.set_id] ??= { best: null, offers: 0 });
    e.offers++;
    if (r.in_stock && r.price_inr != null && (e.best == null || Number(r.price_inr) < e.best)) e.best = Number(r.price_inr);
  }
  return out;
}

/** FP1.6: sets whose pages must be revalidated now -- first listing gained, or last listing gone. */
export function listingTransitions(prev: Record<string, PricedEntry> | null, next: Record<string, PricedEntry>): { gained: string[]; lost: string[] } {
  if (!prev) return { gained: [], lost: [] };  // first run: no baseline, nothing to revalidate
  const has = (m: Record<string, PricedEntry>, n: string) => (m[n]?.offers ?? 0) > 0;
  const ids = new Set([...Object.keys(prev), ...Object.keys(next)]);
  const gained: string[] = [], lost: string[] = [];
  for (const n of ids) {
    if (has(next, n) && !has(prev, n)) gained.push(n);
    else if (!has(next, n) && has(prev, n)) lost.push(n);
  }
  return { gained: gained.sort(), lost: lost.sort() };
}

/** Parity normal form: drop as_of and sort the arrays whose order is not part of the RPC's contract. */
export function parityForm(d: Record<string, any>): Record<string, any> {
  const by = (...ks: string[]) => (a: any, b: any) => ks.map((k) => String(a?.[k] ?? '').localeCompare(String(b?.[k] ?? ''))).find((x) => x !== 0) ?? 0;
  const { as_of: _drop, ...rest } = d; // eslint-disable-line @typescript-eslint/no-unused-vars
  return {
    ...rest,
    related_prices: [...(d.related_prices ?? [])].sort(by('set_id', 'store_id')),
    related_summaries: [...(d.related_summaries ?? [])].sort(by('set_id')),
    coverage: {
      news: [...(d.coverage?.news ?? [])].sort(by('slug')),
      guides: [...(d.coverage?.guides ?? [])].sort(by('slug')),
      reviews: [...(d.coverage?.reviews ?? [])].sort(by('slug')),
    },
  };
}

export function heartbeatFresh(hb: Pick<Heartbeat, 'publisher_finished_at'> | null, nowMs: number): boolean {
  if (!hb?.publisher_finished_at) return false;
  const t = Date.parse(hb.publisher_finished_at);
  return Number.isFinite(t) && nowMs - t <= HEARTBEAT_FRESH_MS && t <= nowMs + 60_000;
}
