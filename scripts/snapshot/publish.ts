/**
 * FP1.1 PR 2: snapshot publisher + parity job (design docs/plans/FP1.1_snapshot_design.md
 * §1, §1a (A1), §4; FP1.6 §3). Writes ONLY through boi-scheduler's signed /publish; reads
 * KV back only through its signed /read. The site never writes KV.
 *
 *   npx tsx scripts/snapshot/publish.ts cycle [--parity]   every scrape cycle (after the scrape)
 *   npx tsx scripts/snapshot/publish.ts cat-backfill       one-off: cat:{n} for the whole catalogue
 *   npx tsx scripts/snapshot/publish.ts parity             parity only
 *
 * Env: BOI_SCHEDULER_URL, SNAPSHOT_HMAC_KEY; Supabase from SNAPSHOT_SUPABASE_URL/KEY (staging
 * rehearsal) else NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. Optional FP1.6:
 * SITE_URL + SITE_REVALIDATE_HMAC_KEY. Optional SNAPSHOT_TARGET (label only).
 *
 * cycle:
 *  1. price side from two bulk reads (store_prices, set_price_summary) -> set:{n} for every set
 *     with a store row or a summary row; list:priced-sets.
 *  2. catalogue side (A1): cat:{n} re-read through set_page_data for the sets whose catalogue
 *     row, theme "related" top-5, coverage links or reviews changed since the last cursor.
 *  3. writes: set:/cat: first, then the list, then meta:heartbeat LAST, alone.
 *  4. FP1.6: pages of sets that gained their first listing or lost their last one are
 *     revalidated (if the site endpoint is configured).
 * parity: 50 random priced sets + 50 random catalogue sets (+ this cycle's changed sets, <= 50):
 *   the page data rebuilt from KV by the real reader vs a live set_page_data call, field by
 *   field; and list:priced-sets vs the live set of ids. Logged to meta:parity:v1 (streak,
 *   days, site builds); any mismatch alerts through Check 11's sender (scripts/lib/alert.mjs).
 *
 * Failure behaviour (G14): any failed read or write throws before meta:heartbeat is written,
 * so readers keep treating the previous snapshot by its own age and fall back once it's
 * older than 12 h. The publisher never writes a partial list or a heartbeat for unwritten data.
 */
import dotenv from 'dotenv';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { sign } from '../../workers/boi-scheduler/src/auth';
import {
  KEYS, SNAPSHOT_VERSION, withChecksum, canonicalJson, canonicalSetSlug, snapshotsFromRpc, pricedEntries,
  listingTransitions, parityForm, type PricedList, type Heartbeat,
} from '../../src/lib/snapshot/format';
import { readSetPageSnapshot, _resetSnapshotCache, type KvLike } from '../../src/lib/snapshot/reader';
// Check 11's sender (plain ESM helper)
import { sendAlert } from '../lib/alert.mjs';

dotenv.config({ path: '.env.local', quiet: true });
const clean = (v?: string) => (v ?? '').replace(/^﻿/, '').trim();
const VERSION = 'publisher/1';
const TARGET = clean(process.env.SNAPSHOT_TARGET) || 'production';
const SCHED = clean(process.env.BOI_SCHEDULER_URL).replace(/\/$/, '');
const HMAC = clean(process.env.SNAPSHOT_HMAC_KEY);
const SITE = clean(process.env.SITE_URL).replace(/\/$/, '');
const SITE_KEY = clean(process.env.SITE_REVALIDATE_HMAC_KEY);
const CAT_CURSOR_KEY = 'meta:catcursor:v1';
const CONCURRENCY = Number(process.env.SNAPSHOT_CONCURRENCY ?? 6);

function db(): SupabaseClient {
  const url = clean(process.env.SNAPSHOT_SUPABASE_URL) || clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = clean(process.env.SNAPSHOT_SUPABASE_KEY) || clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !key) throw new Error('Supabase URL/key not configured');
  return createClient(url, key, { auth: { persistSession: false } });
}

// ── signed calls ──────────────────────────────────────────────────────────────
async function signedPost(base: string, key: string, path: string, payload: unknown): Promise<any> {
  const body = JSON.stringify(payload);
  const ts = String(Math.floor(Date.now() / 1000));
  const nonce = randomUUID().replace(/-/g, '');
  const r = await fetch(`${base}${path}`, {
    method: 'POST', body,
    headers: { 'content-type': 'application/json', 'x-boi-ts': ts, 'x-boi-nonce': nonce, 'x-boi-sig': await sign(key, ts, nonce, body) },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${path} -> HTTP ${r.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}
const sched = (path: string, payload: unknown) => signedPost(SCHED, HMAC, path, payload);

async function kvRead(keys: string[]): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < keys.length; i += 100) Object.assign(out, (await sched('/read', { keys: keys.slice(i, i + 100) })).values);
  return out;
}

/** Chunks of <= 500 keys and ~900 KB (the Worker's limits are 500 and 1 MiB). */
async function kvWrite(writes: { key: string; value: unknown }[]): Promise<{ written: number; unchanged: number; requests: number }> {
  let written = 0, unchanged = 0, requests = 0, chunk: typeof writes = [], bytes = 0;
  const flush = async () => {
    if (!chunk.length) return;
    const r = await sched('/publish', { writes: chunk });
    written += r.written; unchanged += r.unchanged ?? 0; requests++; chunk = []; bytes = 0;
  };
  for (const w of writes) {
    const n = JSON.stringify(w).length;
    if (chunk.length >= 500 || bytes + n > 900_000) await flush();
    chunk.push(w); bytes += n;
  }
  await flush();
  return { written, unchanged, requests };
}

// ── Supabase helpers ──────────────────────────────────────────────────────────
async function all<T>(q: (a: number, b: number) => any): Promise<T[]> {
  const out: T[] = [];
  for (let off = 0; ; off += 1000) {
    const { data, error } = await q(off, off + 999);
    if (error) throw new Error(error.message);
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

async function pool<T, R>(items: T[], fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

async function names(sb: SupabaseClient, ids: string[]): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await sb.from('sets').select('set_number, name').in('set_number', ids.slice(i, i + 200));
    if (error) throw new Error(error.message);
    for (const r of data ?? []) m.set(r.set_number, r.name);
  }
  return m;
}

async function rpc(sb: SupabaseClient, n: string, slug: string): Promise<any> {
  const { data, error } = await sb.rpc('set_page_data', { p_set_number: n, p_slug: slug });
  if (error) throw new Error(`set_page_data(${n}): ${error.message}`);
  return data;
}

async function buildCats(sb: SupabaseClient, ids: string[]) {
  const nm = await names(sb, ids);
  const present = ids.filter((n) => nm.has(n));
  return pool(present, async (n) => {
    const slug = canonicalSetSlug(n, nm.get(n)!);
    const { cat } = await snapshotsFromRpc(n, slug, await rpc(sb, n, slug));
    return { key: KEYS.cat(n), value: cat };
  });
}

// ── price side ────────────────────────────────────────────────────────────────
async function priceSide(sb: SupabaseClient, cycleId: string) {
  const rows = await all<any>((a, b) => sb.from('store_prices').select('*').order('set_id').order('store_id').range(a, b));
  const summ = await all<any>((a, b) => sb.from('set_price_summary').select('*').order('set_id').range(a, b));
  const bySet = new Map<string, any[]>();
  for (const r of rows) (bySet.get(r.set_id) ?? bySet.set(r.set_id, []).get(r.set_id)!).push(r);
  const summary = new Map(summ.map((s) => [s.set_id, s]));
  const ids = [...new Set([...bySet.keys(), ...summary.keys()])].sort();
  const setWrites = await Promise.all(ids.map(async (n) => ({
    key: KEYS.set(n),
    value: await withChecksum({ v: SNAPSHOT_VERSION, set: n, store_prices: bySet.get(n) ?? [], summary: summary.get(n) ?? null }),
  })));
  const entries = pricedEntries(rows, summary.keys());
  const list = (await withChecksum({ v: SNAPSHOT_VERSION, cycle_id: cycleId, sets: entries })) as PricedList;
  const scrapeFinished = rows.reduce<string | null>((m, r) => (r.scraped_at && (!m || r.scraped_at > m) ? r.scraped_at : m), null);
  return { setWrites, list, entries, scrapeFinished, rowCount: rows.length };
}

// ── catalogue side (A1): what changed since the cursor ────────────────────────
const LINK_RE = /\]\(\/sets\/([0-9a-z][0-9a-z-]*)\)/g;
export async function affectedCatSets(sb: SupabaseClient, cursor: string): Promise<{ ids: string[]; why: Record<string, number> }> {
  const why = { catalogue: 0, theme: 0, coverage: 0, reviews: 0 };
  const out = new Set<string>();
  const changed = await all<any>((a, b) => sb.from('sets').select('set_number, theme').or(`updated_at.gt.${cursor},created_at.gt.${cursor}`).range(a, b));
  for (const c of changed) out.add(c.set_number);
  why.catalogue = changed.length;
  // "related" = the 4 newest others in the theme: a change to one of a theme's 5 newest sets
  // can change every set's related list in that theme.
  const byTheme = new Map<string, Set<string>>();
  for (const c of changed) if (c.theme) (byTheme.get(c.theme) ?? byTheme.set(c.theme, new Set()).get(c.theme)!).add(c.set_number);
  for (const [theme, members] of byTheme) {
    const { data, error } = await sb.from('sets').select('set_number').eq('theme', theme)
      .order('year', { ascending: false, nullsFirst: false }).order('set_number', { ascending: false }).limit(5);
    if (error) throw new Error(error.message);
    if (!(data ?? []).some((r) => members.has(r.set_number))) continue;
    const inTheme = await all<any>((a, b) => sb.from('sets').select('set_number').eq('theme', theme).range(a, b));
    for (const r of inTheme) if (!out.has(r.set_number)) { out.add(r.set_number); why.theme++; }
  }
  for (const t of ['news_articles', 'guides', 'reviews']) {
    const arts = await all<any>((a, b) => sb.from(t).select('content').gt('published_at', cursor).range(a, b));
    for (const x of arts) for (const m of String(x.content ?? '').matchAll(LINK_RE)) {
      const n = m[1].split('-')[0];
      if (!out.has(n)) { out.add(n); why.coverage++; }
    }
  }
  const revs = await all<any>((a, b) => sb.from('reviews').select('set_id').or(`published_at.gt.${cursor},updated_at.gt.${cursor}`).not('set_id', 'is', null).range(a, b));
  const uuids = [...new Set(revs.map((r) => r.set_id))];
  for (let i = 0; i < uuids.length; i += 200) {
    const { data, error } = await sb.from('sets').select('set_number').in('id', uuids.slice(i, i + 200));
    if (error) throw new Error(error.message);
    for (const r of data ?? []) if (!out.has(r.set_number)) { out.add(r.set_number); why.reviews++; }
  }
  return { ids: [...out].sort(), why };
}

// ── FP1.6 ─────────────────────────────────────────────────────────────────────
async function revalidate(sb: SupabaseClient, ids: string[]): Promise<string> {
  if (!ids.length) return 'none needed';
  if (!SITE || !SITE_KEY) return `skipped (site endpoint not configured): ${ids.length} sets`;
  const nm = await names(sb, ids);
  let done = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const part = ids.slice(i, i + 100).filter((n) => nm.has(n));
    await signedPost(SITE, SITE_KEY, '/api/revalidate', { paths: part.map((n) => `/sets/${canonicalSetSlug(n, nm.get(n)!)}`), tags: part.map((n) => `set:${n}`) });
    done += part.length;
  }
  return `revalidated ${done}`;
}

// ── parity ────────────────────────────────────────────────────────────────────
function pick<T>(xs: T[], k: number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, k);
}

function diffFields(a: Record<string, any>, b: Record<string, any>): string[] {
  const out: string[] = [];
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (canonicalJson(a[k]) === canonicalJson(b[k])) continue;
    if (a[k] && b[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) {
      for (const f of new Set([...Object.keys(a[k]), ...Object.keys(b[k])])) if (canonicalJson(a[k][f]) !== canonicalJson(b[k][f])) out.push(`${k}.${f}`);
    } else out.push(k);
  }
  return out;
}

async function siteBuild(): Promise<string | null> {
  if (!SITE) return null;
  try {
    const html = await (await fetch(`${SITE}/`, { headers: { 'user-agent': 'boi-snapshot-parity' } })).text();
    return html.match(/\/_next\/static\/([A-Za-z0-9_-]{8,})\/_(?:buildManifest|ssgManifest)/)?.[1] ?? null;
  } catch { return null; }
}

export async function parity(sb: SupabaseClient, extra: string[] = []) {
  _resetSnapshotCache();
  const nowMs = Date.now();
  const base = await kvRead([KEYS.heartbeat, KEYS.priced, KEYS.parity]);
  const hb = base[KEYS.heartbeat] as Heartbeat | null;
  const list = base[KEYS.priced] as PricedList | null;
  if (!hb || !list) throw new Error('parity: no heartbeat or list in KV yet');

  // list:priced-sets must equal the live ids exactly
  const liveRows = await all<any>((a, b) => sb.from('store_prices').select('set_id').range(a, b));
  const liveSumm = await all<any>((a, b) => sb.from('set_price_summary').select('set_id').range(a, b));
  const live = new Set([...liveRows.map((r) => r.set_id), ...liveSumm.map((r) => r.set_id)]);
  const kvIds = new Set(Object.keys(list.sets));
  const listDiff = [...[...live].filter((n) => !kvIds.has(n)).map((n) => `+${n}`), ...[...kvIds].filter((n) => !live.has(n)).map((n) => `-${n}`)];

  // sample: 50 priced + 50 catalogue (5 random pages of 10) + changed (<= 50)
  const priced = pick(Object.keys(list.sets).filter((n) => list.sets[n].offers > 0), 50);
  const { count } = await sb.from('sets').select('set_number', { count: 'exact', head: true });
  const catalogue: string[] = [];
  for (let p = 0; p < 5 && count; p++) {
    const off = Math.floor(Math.random() * Math.max(1, count - 10));
    const { data, error } = await sb.from('sets').select('set_number').order('set_number').range(off, off + 9);
    if (error) throw new Error(error.message);
    catalogue.push(...(data ?? []).map((r) => r.set_number));
  }
  const sample = [...new Set([...priced, ...catalogue, ...extra.slice(0, 50)])];
  const nm = await names(sb, sample);

  // prefetch the KV values the reader will ask for (cat + set, then related sets)
  const kv: Record<string, unknown> = { [KEYS.heartbeat]: hb, [KEYS.priced]: list };
  Object.assign(kv, await kvRead(sample.flatMap((n) => [KEYS.cat(n), KEYS.set(n)])));
  const relKeys = new Set<string>();
  for (const n of sample) for (const r of ((kv[KEYS.cat(n)] as any)?.data?.related ?? []) as any[]) if (!(KEYS.set(r.set_number) in kv)) relKeys.add(KEYS.set(r.set_number));
  Object.assign(kv, await kvRead([...relKeys]));
  const mem: KvLike = { get: async (k) => (k in kv ? kv[k] : null) };

  const mismatches: { set: string; reason: string }[] = [];
  await pool(sample.filter((n) => nm.has(n)), async (n) => {
    const slug = canonicalSetSlug(n, nm.get(n)!);
    const [r, live] = await Promise.all([readSetPageSnapshot(mem, n, slug, nowMs), rpc(sb, n, slug)]);
    if (!r.ok) { mismatches.push({ set: n, reason: `reader fallback: ${r.reason}` }); return; }
    const a = parityForm(r.data as any), b = parityForm(live);
    if (canonicalJson(a) !== canonicalJson(b)) mismatches.push({ set: n, reason: `fields: ${diffFields(a, b).join(', ')}` });
  });
  if (listDiff.length) mismatches.push({ set: 'list:priced-sets', reason: `${listDiff.length} ids differ: ${listDiff.slice(0, 10).join(' ')}` });

  // log + streak (cutover gate: 100% over >= 12 consecutive cycles, >= 3 days, >= 1 site deploy)
  const prev = (base[KEYS.parity] as any)?.runs ?? [];
  const run = { cycle_id: hb.cycle_id, at: new Date(nowMs).toISOString(), checked: sample.length, mismatches: mismatches.length, site_build: await siteBuild() };
  const runs = [...prev, run].slice(-300);
  let i = runs.length; while (i > 0 && runs[i - 1].mismatches === 0) i--;
  const streak = runs.slice(i);
  const builds = [...new Set(streak.map((r: any) => r.site_build).filter(Boolean))];
  const days = streak.length ? (Date.parse(streak[streak.length - 1].at) - Date.parse(streak[0].at)) / 86_400_000 : 0;
  const gate = { consecutive_ok: streak.length, since: streak[0]?.at ?? null, days: Math.round(days * 100) / 100, site_builds: builds.length, deploys_in_streak: Math.max(0, builds.length - 1) };
  await kvWrite([{ key: KEYS.parity, value: { v: SNAPSHOT_VERSION, target: TARGET, gate, runs } }]);

  if (mismatches.length) {
    await sendAlert(`[BOI] snapshot parity: ${mismatches.length} mismatch(es) (${TARGET})`,
      `cycle ${hb.cycle_id}: ${mismatches.length} of ${sample.length} checks failed.\n\n${mismatches.slice(0, 30).map((m) => `${m.set}: ${m.reason}`).join('\n')}\n\nThe parity streak restarts at 0. snapshot_read stays as it is (OFF until sign-off).`);
  }
  return { run, gate, mismatches: mismatches.slice(0, 50) };
}

// ── commands ──────────────────────────────────────────────────────────────────
async function cycle(withParity: boolean) {
  const sb = db();
  const cycleId = new Date().toISOString();
  const t0 = Date.now();
  const prev = await kvRead([KEYS.priced, CAT_CURSOR_KEY]);
  const prevList = prev[KEYS.priced] as PricedList | null;
  const cursor = (prev[CAT_CURSOR_KEY] as { cursor?: string } | null)?.cursor ?? null;

  const p = await priceSide(sb, cycleId);
  let cat = { ids: [] as string[], why: {} as Record<string, number>, note: 'no cat cursor yet: run cat-backfill first' };
  let catWrites: { key: string; value: unknown }[] = [];
  if (cursor) {
    const a = await affectedCatSets(sb, cursor);
    catWrites = await buildCats(sb, a.ids);
    cat = { ...a, note: `since ${cursor}` };
  }
  const data = await kvWrite([...p.setWrites, ...catWrites]);
  const listW = await kvWrite([{ key: KEYS.priced, value: p.list }]);
  if (cursor) await kvWrite([{ key: CAT_CURSOR_KEY, value: { cursor: cycleId } }]);
  const hb: Heartbeat = {
    v: SNAPSHOT_VERSION, cycle_id: cycleId, scrape_finished_at: p.scrapeFinished, publisher_finished_at: new Date().toISOString(),
    sets_written: data.written, cat_cursor: cursor ? cycleId : null, version: VERSION,
  };
  await kvWrite([{ key: KEYS.heartbeat, value: hb }]);   // LAST, alone

  const tr = listingTransitions(prevList?.sets ?? null, p.entries);
  const reval = await revalidate(sb, [...tr.gained, ...tr.lost]);
  const report: any = {
    target: TARGET, cycle_id: cycleId, seconds: Math.round((Date.now() - t0) / 1000),
    price_side: { store_rows: p.rowCount, set_keys: p.setWrites.length, list_entries: Object.keys(p.entries).length },
    cat_side: { affected: cat.ids.length, why: cat.why, note: cat.note },
    kv: { written: data.written + listW.written + 1, unchanged: data.unchanged, publish_requests: data.requests + listW.requests + 1 + (cursor ? 1 : 0) },
    fp16: { gained: tr.gained, lost: tr.lost, result: reval },
  };
  if (withParity) report.parity = await parity(sb, [...new Set([...tr.gained, ...tr.lost, ...cat.ids])]);
  return report;
}

async function catBackfill() {
  const sb = db();
  const started = clean(process.env.CAT_BACKFILL_STARTED) || new Date().toISOString();
  const offset = Number(process.env.CAT_OFFSET ?? 0);
  const ids = (await all<any>((a, b) => sb.from('sets').select('set_number').order('set_number').range(a, b))).map((r) => r.set_number);
  const todo = ids.slice(offset);
  let written = 0, unchanged = 0;
  for (let i = 0; i < todo.length; i += 500) {
    const w = await kvWrite(await buildCats(sb, todo.slice(i, i + 500)));
    written += w.written; unchanged += w.unchanged;
    console.log(`cat-backfill: ${offset + Math.min(i + 500, todo.length)}/${ids.length} (written ${written}, unchanged ${unchanged}); resume with CAT_OFFSET=${offset + i + 500} CAT_BACKFILL_STARTED=${started}`);
  }
  // The cursor is the backfill's START, so anything that changed during it is picked up next cycle.
  await kvWrite([{ key: CAT_CURSOR_KEY, value: { cursor: started } }]);
  return { target: TARGET, sets: ids.length, from_offset: offset, written, unchanged, cursor: started };
}

(async () => {
  if (!SCHED || HMAC.length < 32) throw new Error('BOI_SCHEDULER_URL / SNAPSHOT_HMAC_KEY not configured');
  const cmd = process.argv[2];
  const out = cmd === 'cycle' ? await cycle(process.argv.includes('--parity'))
    : cmd === 'cat-backfill' ? await catBackfill()
    : cmd === 'parity' ? await parity(db(), clean(process.env.PARITY_EXTRA).split(',').filter(Boolean))  // PARITY_EXTRA: drill sets always checked
    : (() => { throw new Error('usage: publish.ts cycle [--parity] | cat-backfill | parity'); })();
  const text = JSON.stringify(out, null, 1);
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### snapshot ${cmd} (${TARGET})\n\`\`\`json\n${text.slice(0, 60_000)}\n\`\`\`\n`);
})().catch((e) => { console.error(e); process.exit(1); });
