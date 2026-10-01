#!/usr/bin/env node
// FP5 contract dry run + FP5.6 match audit (P4 Step 4e-g). NEVER WRITES to
// the database. For each current retailer (MyBrickHouse, Toycra):
//   1. fetch the feed through the FP5.2 contract (bot UA, pacing, policy hashes)
//   2. resolve identities with the FP5.4 ladder, validate every listing
//   3. diff against
//        (a) the LEGACY parser on the SAME feed  -> pure logic differences
//        (b) today's store_prices                -> (a) + real price movement since the last scrape
//   4. FP5.3 breaker evaluation vs today's store_prices (would it trip?)
//   5. deal / hot / tie counts via the validated JS model of set_price_summary
// Report: stdout, $GITHUB_STEP_SUMMARY, and out/match-audit/<store>.json (artifact).
//
//   npx tsx scripts/scraper-contract-dryrun.mjs [--out out/match-audit]

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { getSecret } from '../src/lib/get-secret';
import { pacedFetcher, checkPolicy, validateListing, newRunSummary, tally, BOT_UA } from './lib/scraper-contract.mjs';
import { resolveIdentity, isMoreCanonical } from './lib/identity-ladder.mjs';
import { evaluateBreaker } from './lib/circuit-breaker.mjs';
import { modelSummary, summaryCounts } from './lib/price-summary-model.mjs';
import { parseProduct, isMoreCanonical as legacyMoreCanonical } from './lib/retailer-fetch.mjs';

for (const f of ['.env.local']) {
  try {
    for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
      const i = line.indexOf('='); if (i < 1 || line.trim().startsWith('#')) continue;
      const k = line.slice(0, i).trim(); if (!process.env[k]) process.env[k] = line.slice(i + 1).trim();
    }
  } catch { /* CI */ }
}
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'out/match-audit';
// --from-cache DIR: read the catalogue + feeds the scrape run already fetched (scrape-now.mjs
// CONTRACT_CACHE_DIR) instead of fetching them again -- the per-cycle CI mode (G2).
const CACHE = process.argv.includes('--from-cache') ? process.argv[process.argv.indexOf('--from-cache') + 1] : null;
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, getSecret('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

async function all(q) {
  const out = [];
  for (let off = 0; ; off += 1000) {
    const { data, error } = await q(off, off + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

async function fetchFeed(get, domain, feedPath) {
  const products = [];
  for (let page = 1; page <= 20; page++) {
    const sep = feedPath.includes('?') ? '&' : '?';
    const r = await get(`https://${domain}${feedPath}${sep}limit=250&page=${page}`);
    if (!r.ok) throw new Error(`${domain} page ${page}: HTTP ${r.status}`);
    const j = await r.json();
    if (!j.products?.length) break;
    products.push(...j.products);
    if (j.products.length < 250) break;
  }
  return products;
}

/** Same price/stock rule as today's scraper: cheapest in-stock variant, else cheapest overall. */
function pickVariant(product) {
  const vs = product.variants ?? [];
  const inStock = vs.filter((v) => v.available);
  const pool = inStock.length ? inStock : vs;
  const v = [...pool].sort((a, b) => parseFloat(a.price) - parseFloat(b.price))[0];
  return v ? { priceInr: v.price ? Math.round(parseFloat(v.price)) : null, inStock: inStock.length > 0 } : null;
}

(async () => {
  const cmf = await all((a, b) => sb.from('cmf_figures').select('series_set_number, series_name').range(a, b));
  const [sets, stores, storePrices] = await Promise.all([
    CACHE ? JSON.parse(fs.readFileSync(path.join(CACHE, 'catalogue.json'), 'utf8')).map(([set_number, name]) => ({ set_number, name }))
          : all((a, b) => sb.from('sets').select('set_number, name, lego_mrp_inr, mrp_verified').range(a, b)),
    sb.from('stores').select('*').then((r) => r.data),
    all((a, b) => sb.from('store_prices').select('set_id, store_id, price_inr, compare_at_price_inr, in_stock, scraped_at').range(a, b)),
  ]);
  const catalogue = {
    byNumber: new Map(sets.map((s) => [s.set_number, { set_number: s.set_number, name: s.name }])),
    byName: new Map(sets.map((s) => [String(s.name).toLowerCase().replace(/[™®©]/g, '').replace(/\s+/g, ' ').trim().replace(/^the\s+/, ''), s.set_number])),
  };
  catalogue.cmfSeries = new Map(cmf.map((c) => [c.series_set_number, c.series_name]));
  const known = new Set(sets.map((s) => s.set_number));
  const now = new Date();
  // MRP only matters for sets that have a price row -- fetch just those in cache mode.
  if (CACHE) {
    const need = [...new Set(storePrices.map((r) => r.set_id))];
    const mrp = new Map();
    for (let i = 0; i < need.length; i += 150) {
      const { data, error } = await sb.from('sets').select('set_number, lego_mrp_inr, mrp_verified').in('set_number', need.slice(i, i + 150));
      if (error) throw error;
      for (const r of data) mrp.set(r.set_number, r);
    }
    for (const s of sets) { const m = mrp.get(s.set_number); if (m) { s.lego_mrp_inr = m.lego_mrp_inr; s.mrp_verified = m.mrp_verified; } }
  }
  const setMeta = new Map(sets.map((s) => [s.set_number, { mrp: s.lego_mrp_inr ?? null, v: !!s.mrp_verified }]));
  fs.mkdirSync(OUT, { recursive: true });

  const lines = [`## FP5 scraper-contract dry run (no writes), ${now.toISOString()}`, '', `UA: \`${BOT_UA}\``, ''];
  const contractRows = [];
  let totalDiff = 0;
  const fp58Keys = [];

  for (const store of stores.filter((s) => s.scraper_kind === 'shopify_json')) {
    const cfg = store.scraper_config ?? {};
    const get = pacedFetcher();
    const summary = newRunSummary(store.id);
    summary.policy = await checkPolicy(cfg.domain, { robots_sha256: cfg.robots_sha256 ?? null, agents_sha256: cfg.agents_sha256 ?? null }, get);
    // FP5.9 (#460): a per-store scrape run caches only that store's feed; skip the others.
    if (CACHE && !fs.existsSync(path.join(CACHE, `feed-${store.id}.json`))) { lines.push(`### ${store.name}`, '- not scraped in this run (store filter); skipped', ''); continue; }
    const products = CACHE ? JSON.parse(fs.readFileSync(path.join(CACHE, `feed-${store.id}.json`), 'utf8')) : await fetchFeed(get, cfg.domain, cfg.path);
    summary.fetched = products.length;

    // contract path
    const chosen = new Map();
    const unmatched = [];
    for (const p of products) {
      if (store.id !== 'mybrickhouse' && !/lego/i.test(`${p.title} ${p.handle}`)) continue; // same LEGO filter as today
      const id = resolveIdentity({ store: store.id, title: p.title, handle: p.handle, skus: (p.variants ?? []).map((v) => v.sku) }, catalogue);
      const pv = pickVariant(p);
      const listing = { priceInr: pv?.priceInr ?? null, inStock: pv?.inStock, url: `https://${cfg.domain}/products/${p.handle}` };
      const errs = validateListing(listing);
      if (errs.length) { summary.invalid++; errs.forEach((e) => tally(summary, 'invalid_reasons', e)); continue; }
      summary.parsed++;
      if (!id.ok) { summary.unmatched++; tally(summary, 'unmatched_reasons', id.reason); unmatched.push({ title: p.title, handle: p.handle, reason: id.reason, detail: id.detail }); continue; }
      const cand = { ...listing, setNumber: id.setNumber, method: id.method, createdAt: p.created_at, productId: p.id,
        compareAt: (() => { const v = (p.variants ?? []).find((x) => Math.round(parseFloat(x.price)) === listing.priceInr); return v?.compare_at_price ? Math.round(parseFloat(v.compare_at_price)) : null; })() };
      const ex = chosen.get(id.setNumber);
      if (!ex || isMoreCanonical(cand, ex)) chosen.set(id.setNumber, cand);
    }
    summary.matched = chosen.size;
    for (const c of chosen.values()) summary.by_method[c.method]++;

    // legacy parser on the SAME feed
    const legacy = new Map();
    for (const p of products) {
      const r = parseProduct(p, store.id, cfg.domain, catalogue.byName, known);
      if (!r || !known.has(r.setNumber)) continue;
      const ex = legacy.get(r.setNumber);
      if (!ex || legacyMoreCanonical(r, ex)) legacy.set(r.setNumber, r);
    }

    // (a) contract vs legacy on the same feed
    const onlyContract = [...chosen.keys()].filter((k) => !legacy.has(k));
    const onlyLegacy = [...legacy.keys()].filter((k) => !chosen.has(k));
    const priceDiff = [...chosen.keys()].filter((k) => legacy.has(k) && legacy.get(k).priceInr !== chosen.get(k).priceInr);
    const stockDiff = [...chosen.keys()].filter((k) => legacy.has(k) && legacy.get(k).inStock !== chosen.get(k).inStock);
    // (b) contract vs today's store_prices
    const prev = new Map(storePrices.filter((r) => r.store_id === store.id).map((r) => [r.set_id, { priceInr: Number(r.price_inr), inStock: r.in_stock }]));
    const curr = new Map([...chosen].map(([k, c]) => [k, { priceInr: c.priceInr, inStock: c.inStock }]));
    const vsPrev = {
      onlyContract: [...curr.keys()].filter((k) => !prev.has(k)).length,
      onlyStorePrices: [...prev.keys()].filter((k) => !curr.has(k)).length,
      price: [...curr.keys()].filter((k) => prev.has(k) && prev.get(k).priceInr !== curr.get(k).priceInr).length,
      stock: [...curr.keys()].filter((k) => prev.has(k) && prev.get(k).inStock !== curr.get(k).inStock).length,
    };
    // FP5.3 baseline = the listings the PREVIOUS RUN saw (scraped_at within 30 min
    // of the store's newest row). store_prices also keeps delisted rows forever
    // (#140 reconcile flips them to out of stock), which must not count as "parsed".
    const storeRows = storePrices.filter((r) => r.store_id === store.id);
    const lastRun = Math.max(...storeRows.map((r) => Date.parse(r.scraped_at)));
    const prevRun = new Map(storeRows.filter((r) => r.price_inr != null && lastRun - Date.parse(r.scraped_at) < 30 * 60_000)
      .map((r) => [r.set_id, { priceInr: Number(r.price_inr), inStock: r.in_stock }]));
    summary.breaker = evaluateBreaker(prevRun, curr);
    const logicDiff = onlyContract.length + onlyLegacy.length + priceDiff.length + stockDiff.length;
    // FP5.8 bar (P7 item 5): record this store's exact difference keys for the per-cycle verdict below.
    fp58Keys.push(...onlyContract.map((k) => `${store.id}:${k}:only-contract`), ...onlyLegacy.map((k) => `${store.id}:${k}:only-legacy`),
      ...priceDiff.map((d) => `${store.id}:${d.set ?? d}:price`), ...stockDiff.map((d) => `${store.id}:${d.set ?? d}:stock`));
    totalDiff += logicDiff;
    for (const [k, c] of chosen) contractRows.push({ set_id: k, store_id: store.id, price_inr: c.priceInr, compare_at: c.compareAt, in_stock: c.inStock, scraped_at: now.toISOString() });

    fs.writeFileSync(path.join(OUT, `${store.id}.json`), JSON.stringify({ summary, vsLegacy: { onlyContract, onlyLegacy, priceDiff, stockDiff }, vsStorePrices: vsPrev,
      unmatched, examples: { onlyContract: onlyContract.slice(0, 20).map((k) => ({ set: k, ...chosen.get(k) })), onlyLegacy: onlyLegacy.slice(0, 20).map((k) => ({ set: k, ...legacy.get(k) })) } }, null, 2));
    lines.push(`### ${store.name}`,
      `- fetched ${summary.fetched}, parsed ${summary.parsed}, invalid ${summary.invalid} ${JSON.stringify(summary.invalid_reasons)}, matched ${summary.matched} (sku ${summary.by_method.sku} / text ${summary.by_method.text} / name ${summary.by_method.name}), unmatched ${summary.unmatched} ${JSON.stringify(summary.unmatched_reasons)}`,
      `- policy: ${summary.policy.ok ? 'unchanged' : `CHANGED (${summary.policy.changed.join(', ')})`}; robots ${summary.policy.hashes.robots_sha256?.slice(0, 12) ?? 'none'}, agents ${summary.policy.hashes.agents_sha256?.slice(0, 12) ?? 'none'}`,
      `- **vs legacy parser, same feed: ${logicDiff} differences** (only-contract ${onlyContract.length}, only-legacy ${onlyLegacy.length}, price ${priceDiff.length}, stock ${stockDiff.length})`,
      `- vs today's store_prices: only-contract ${vsPrev.onlyContract}, only-store_prices ${vsPrev.onlyStorePrices}, price ${vsPrev.price}, stock ${vsPrev.stock}`,
      `- breaker (vs store_prices): ${summary.breaker.trip ? `WOULD TRIP: ${summary.breaker.reasons.join('; ')}` : `ok (parsed ratio ${summary.breaker.parsedRatio.toFixed(3)}, changed ${(summary.breaker.changedRatio * 100).toFixed(2)}%)`}`, '');
    console.log(lines.slice(-7).join('\n'));
  }

  // deal / hot / tie counts: today's view vs the contract's rows (model validated on live data)
  const liveModel = modelSummary(storePrices.map((r) => ({ ...r, price_inr: Number(r.price_inr), compare_at: r.compare_at_price_inr == null ? null : Number(r.compare_at_price_inr) })), setMeta, stores, now);
  const contractModel = modelSummary(contractRows, setMeta, stores, now);
  const a = summaryCounts(liveModel), b = summaryCounts(contractModel);
  const tierDiffs = [...new Set([...liveModel.keys(), ...contractModel.keys()])]
    .filter((k) => (liveModel.get(k)?.deal_tier ?? null) !== (contractModel.get(k)?.deal_tier ?? null)
      || JSON.stringify(liveModel.get(k)?.best_store_ids ?? null) !== JSON.stringify(contractModel.get(k)?.best_store_ids ?? null))
    .map((k) => {
      const l = liveModel.get(k), c = contractModel.get(k);
      return `${k}: tier ${l?.deal_tier ?? '-'} -> ${c?.deal_tier ?? '-'}, best ${l?.best_price_inr ?? '-'} ${JSON.stringify(l?.best_store_ids ?? null)} -> ${c?.best_price_inr ?? '-'} ${JSON.stringify(c?.best_store_ids ?? null)}, stale-in-store_prices=${storePrices.filter((r) => r.set_id === k).map((r) => `${r.store_id}@${r.scraped_at.slice(0, 16)}`).join(',')}`;
    });
  lines.push('### Deal counts (JS model of set_price_summary)', `- today's store_prices: rows ${a.rows}, deals ${a.deals} (hot ${a.hot}, deal ${a.deal}), ties ${a.tie}`,
    `- contract dry run:     rows ${b.rows}, deals ${b.deals} (hot ${b.hot}, deal ${b.deal}), ties ${b.tie}`,
    `- sets whose tier or best-store list differs: ${tierDiffs.length}`, ...tierDiffs.slice(0, 20).map((d) => `  - ${d}`),
    '', `**Total logic differences vs the legacy parser: ${totalDiff}**`);
  // FP5.8 bar (P7 item 5): this cycle counts toward the 12 only if its differences are EXACTLY the
  // approved set in scripts/lib/fp58-approved-diffs.json (docs/plans/FP5.8_retrofit_bar.md).
  const approved = JSON.parse(fs.readFileSync(new URL('./lib/fp58-approved-diffs.json', import.meta.url), 'utf8')).approved;
  const got = [...new Set(fp58Keys)].sort(), want = [...approved].sort();
  const extra = got.filter((k) => !want.includes(k)), missing = want.filter((k) => !got.includes(k));
  const fp58ok = extra.length === 0 && missing.length === 0;
  lines.push(`**FP5.8 cycle verdict: ${fp58ok ? 'COUNTS' : 'RESETS'}**: differences ${fp58ok ? 'are exactly the 3 approved ones' : `unexpected ${JSON.stringify(extra)}, approved-but-absent ${JSON.stringify(missing)}`}`);
  fs.writeFileSync(path.join(OUT, 'fp58.json'), JSON.stringify({ at: now.toISOString(), counts: fp58ok, got, extra, missing }, null, 1));
  console.log(lines.slice(-(8 + Math.min(tierDiffs.length, 20))).join('\n'));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
  fs.writeFileSync(path.join(OUT, 'summary.md'), lines.join('\n') + '\n');
})().catch((e) => { console.error('dry run failed:', e); process.exit(1); });
