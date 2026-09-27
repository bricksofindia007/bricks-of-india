/**
 * Gate 14 read-only audit (P4 Step 5): run the deterministic Gate 14 checks
 * over every published review BEFORE the gate is enabled. Writes NOTHING to
 * the database. Catalogue facts, in the prescribed order:
 *   pieces:   sets.pieces -> Rebrickable num_parts -> Brickset (one batched getSets)
 *   minifigs: Brickset (sets.minifigs is empty on every row today)
 * Lookups are cached in GATE14_CACHE_DIR (default boi-db-backups/gate14-cache)
 * so no set is looked up twice. Report -> GATE14_OUT (default boi-db-backups/gate14).
 *
 *   npx tsx scripts/gate14-audit.ts
 */
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { getSecret } from '../src/lib/get-secret';
import { gate14Check, type Gate14Facts } from '../src/lib/gate14';

dotenv.config({ path: '.env.local', quiet: true });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, getSecret('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const CACHE = process.env.GATE14_CACHE_DIR ?? 'C:/Users/bharg/boi-db-backups/gate14-cache';
const OUT = process.env.GATE14_OUT ?? 'C:/Users/bharg/boi-db-backups/gate14';
fs.mkdirSync(CACHE, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });

async function all<T>(q: (a: number, b: number) => any): Promise<T[]> {
  const out: T[] = [];
  for (let off = 0; ; off += 1000) { const { data, error } = await q(off, off + 999); if (error) throw error; out.push(...data); if (data.length < 1000) break; }
  return out;
}
const readCache = (f: string) => { try { return JSON.parse(fs.readFileSync(path.join(CACHE, f), 'utf8')); } catch { return {}; } };
const writeCache = (f: string, d: unknown) => fs.writeFileSync(path.join(CACHE, f), JSON.stringify(d, null, 1));

(async () => {
  const reviews = await all<any>((a, b) => sb.from('reviews').select('id, slug, title, content, verdict, set_id').range(a, b));
  const sets = await all<any>((a, b) => sb.from('sets').select('id, set_number, name, pieces, minifigs, year, lego_mrp_inr, mrp_verified').range(a, b));
  const sp = await all<any>((a, b) => sb.from('store_prices').select('set_id, price_inr').range(a, b));
  const summ = await all<any>((a, b) => sb.from('set_price_summary').select('set_id, anchor_mrp_inr').range(a, b));
  const byId = new Map(sets.map((s) => [s.id, s]));
  const allNumbers = new Set<string>(sets.map((s) => s.set_number));
  const pricesBySet = new Map<string, number[]>();
  for (const r of sp) if (r.price_inr != null) (pricesBySet.get(r.set_id) ?? pricesBySet.set(r.set_id, []).get(r.set_id)!).push(Number(r.price_inr));
  const anchor = new Map(summ.map((r) => [r.set_id, Number(r.anchor_mrp_inr)]));
  const reviewed = [...new Set(reviews.map((r) => byId.get(r.set_id)).filter(Boolean))] as any[];

  // ── piece counts: Rebrickable for sets missing one (cached) ──
  const rb = readCache('rebrickable.json');
  const rbKey = getSecret('REBRICKABLE_API_KEY');
  let rbCalls = 0;
  for (const s of reviewed.filter((x) => !x.pieces && !(x.set_number in rb))) {
    const r = await fetch(`https://rebrickable.com/api/v3/lego/sets/${s.set_number}-1/`, { headers: { Authorization: `key ${rbKey}` } });
    rbCalls++;
    rb[s.set_number] = r.ok ? ((await r.json()).num_parts || null) : null;
    await new Promise((res) => setTimeout(res, 1100)); // Rebrickable: ~1 req/s
  }
  writeCache('rebrickable.json', rb);

  // ── Brickset: ONE batched getSets for every reviewed set not cached (pieces + minifigs) ──
  const bs = readCache('brickset.json');
  const need = reviewed.filter((x) => !(x.set_number in bs)).map((x) => `${x.set_number}-1`);
  let bsCalls = 0;
  for (let i = 0; i < need.length; i += 500) {
    const params = JSON.stringify({ setNumber: need.slice(i, i + 500).join(','), pageSize: 500 });
    const url = `https://brickset.com/api/v3.asmx/getSets?apiKey=${encodeURIComponent(getSecret('BRICKSET_API_KEY')!)}&userHash=&params=${encodeURIComponent(params)}`;
    const j = await (await fetch(url)).json();
    bsCalls++;
    if (j.status !== 'success') throw new Error(`Brickset: ${j.message ?? j.status}`);
    for (const n of need.slice(i, i + 500)) bs[n.replace(/-1$/, '')] = null;
    for (const x of j.sets ?? []) bs[String(x.number)] = { pieces: x.pieces ?? null, minifigs: x.minifigs ?? null };
  }
  writeCache('brickset.json', bs);

  const known57 = new Set<string>(JSON.parse(fs.readFileSync('docs/review-fact-audit/2026-09-27.json', 'utf8')).filter((x: any) => x.severity === 'HIGH').map((x: any) => x.slug));
  const results: any[] = [];
  const sourceOf = { sets: 0, rebrickable: 0, brickset: 0, none: 0 };
  for (const r of reviews) {
    const s = byId.get(r.set_id);
    if (!s) { results.push({ slug: r.slug, title: r.title, findings: [{ rule: 'link', detail: 'review not linked to a catalogue set', sentence: '' }] }); continue; }
    const pieces = s.pieces || rb[s.set_number] || bs[s.set_number]?.pieces || null;
    const src = s.pieces ? 'sets' : rb[s.set_number] ? 'rebrickable' : bs[s.set_number]?.pieces ? 'brickset' : 'none';
    sourceOf[src as keyof typeof sourceOf]++;
    const facts: Gate14Facts = {
      setNumber: s.set_number, name: s.name, pieces, minifigs: s.minifigs ?? bs[s.set_number]?.minifigs ?? null, year: s.year,
      prices: pricesBySet.get(s.set_number) ?? [], mrp: [anchor.get(s.set_number), s.lego_mrp_inr].filter((x) => Number(x) > 0).map(Number),
      verdict: r.verdict, otherSetNumbers: allNumbers,
    };
    results.push({ slug: r.slug, title: r.title, set: s.set_number, pieceSource: src, findings: gate14Check(r.content ?? '', facts) });
  }
  const flagged = results.filter((x) => x.findings.length);
  const caught = [...known57].filter((sl) => flagged.some((f) => f.slug === sl));
  const missed = [...known57].filter((sl) => !flagged.some((f) => f.slug === sl));
  const extra = flagged.filter((f) => !known57.has(f.slug));
  const byRule: Record<string, number> = {};
  for (const f of flagged) for (const x of f.findings) byRule[x.rule] = (byRule[x.rule] ?? 0) + 1;
  const summary = { reviews: reviews.length, flagged: flagged.length, known57: known57.size, caught: caught.length, missed, extraFlagged: extra.length, byRule, pieceSource: sourceOf, apiCalls: { rebrickable: rbCalls, brickset: bsCalls } };
  fs.writeFileSync(path.join(OUT, 'gate14-readonly.json'), JSON.stringify({ summary, results: flagged }, null, 1));
  console.log(JSON.stringify(summary, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
