/**
 * Retirement check — weekly, REPORT ONLY (item 0, P14 round 8, 2 Oct 2026).
 *
 * Abhinav's India-only availability rule: public wording follows the set's
 * India status (src/lib/india-status.ts), never the global `sets.retired`
 * flag. Until 1 Oct this job rewrote every review of a `sets.retired` set to
 * verdict RETIRED with "no longer available ... nothing left to buy"; 19 of
 * the 22 RETIRED reviews were for sets on sale in India (e.g. 71848 at LEGO.in
 * and Toycra). It now writes NOTHING to reviews or news_articles. For each
 * published review (and category='Review' news article) it computes the India
 * status and flags, in content_quality_issues (unresolved, for a person):
 *   - retired_verdict_needs_buying_call: verdict RETIRED (never a verdict);
 *   - retired_wording_on_set_sold_in_india: the text calls the set retired or
 *     unavailable while an Indian store lists it (or listed it in 14 days).
 * Corrections then go through db-migrate (staging first), as for any data fix.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/retirement-check.mjs --dry-run
 *   npx tsx --env-file=.env.local scripts/retirement-check.mjs
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { computeIndiaStatus, RETIRED_IN_INDIA_DAYS } from '../src/lib/india-status.ts';
import { reviewAvailabilityFindings } from './lib/retirement-report.mjs';

const DRY_RUN = process.argv.includes('--dry-run');
const PAGE = 1000;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/^﻿/, '').trim();
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function paginate(table, cols, filter = (q) => q) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await filter(sb.from(table).select(cols)).range(offset, offset + PAGE - 1);
    if (error) throw error;
    for (const r of data ?? []) rows.push(r);
    if ((data ?? []).length < PAGE) break;
  }
  return rows;
}

async function flag(section, slug, id, f) {
  if (DRY_RUN) return false;
  const { data: open, error: e1 } = await sb.from('content_quality_issues').select('id')
    .eq('check_name', f.check).eq('article_slug', slug).eq('resolved', false).limit(1);
  if (e1) { console.error(`  [supabase-read] content_quality_issues for ${slug}:`, e1.message); return false; }
  if ((open ?? []).length > 0) return false; // already open; one flag per issue
  const at = new Date().toISOString();
  const { error } = await sb.from('content_quality_issues').insert({
    section, article_slug: slug, article_id: id ? String(id) : null,
    check_name: f.check, severity: 'warning', detail: f.detail,
    resolved: false, auto_fixable: false, checked_at: at, first_seen_at: at,
  });
  if (error) { console.error(`  [supabase-write] content_quality_issues insert error for ${slug}:`, error.message); return false; }
  return true;
}

(async () => {
  console.log(`━━ retirement-check (report only)${DRY_RUN ? ' [DRY-RUN]' : ''} ━━━━━━━━━━━━━━━━━━━━━`);
  const t0 = Date.now();

  const sets = await paginate('sets', 'id, set_number, retired');
  const setById = new Map(sets.map((s) => [s.id, s]));
  const setByNumber = new Map(sets.map((s) => [s.set_number, s]));

  const stores = await paginate('stores', 'id, name, display_enabled');
  const shown = new Map(stores.filter((s) => s.display_enabled).map((s) => [s.id, s.name]));
  const listingsBySet = new Map();
  for (const r of await paginate('store_prices', 'set_id, store_id, in_stock')) {
    if (!shown.has(r.store_id)) continue;
    if (!listingsBySet.has(r.set_id)) listingsBySet.set(r.set_id, []);
    listingsBySet.get(r.set_id).push({ storeName: shown.get(r.store_id), inStock: r.in_stock === true });
  }
  const since = new Date(Date.now() - RETIRED_IN_INDIA_DAYS * 864e5).toISOString();
  const eventsBySet = new Map();
  for (const r of await paginate('price_history', 'set_id, store_id, recorded_at', (q) => q.gte('recorded_at', since))) {
    if (!shown.has(r.store_id)) continue;
    if (!eventsBySet.has(r.set_id)) eventsBySet.set(r.set_id, []);
    eventsBySet.get(r.set_id).push(r.recorded_at);
  }
  // store_prices.set_id and price_history.set_id hold the set NUMBER.
  const statusOf = (set) => computeIndiaStatus({
    legoRetired: set.retired === true,
    listings: listingsBySet.get(set.set_number) ?? [],
    recentStockEventsAt: eventsBySet.get(set.set_number) ?? [],
  });

  const counts = { checked: 0, findings: 0, flagged: 0, byStatus: {} };
  const report = async (section, row, set) => {
    const status = statusOf(set);
    counts.checked++;
    counts.byStatus[status.kind] = (counts.byStatus[status.kind] ?? 0) + 1;
    for (const f of reviewAvailabilityFindings(row, status)) {
      counts.findings++;
      console.log(`  [${f.check}] ${section}/${row.slug} (set ${set.set_number}, India: ${status.kind})`);
      if (await flag(section, row.slug, row.id, f)) counts.flagged++;
    }
  };

  for (const review of await paginate('reviews', 'id, slug, content, verdict, set_id', (q) => q.not('published_at', 'is', null))) {
    const set = setById.get(review.set_id);
    if (set) await report('reviews', review, set);
  }
  const news = await paginate('news_articles', 'id, slug, content, verdict, category, set_number', (q) => q.not('published_at', 'is', null));
  for (const article of news.filter((n) => n.category === 'Review' && n.verdict !== null)) {
    const set = article.set_number ? setByNumber.get(article.set_number) : null;
    if (set) await report('news_articles', article, set);
  }

  console.log(`\nSUMMARY: checked=${counts.checked} findings=${counts.findings} newly flagged=${counts.flagged} India status=${JSON.stringify(counts.byStatus)}`);
  console.log('No review or article was changed (report only).');
  console.log(`${DRY_RUN ? 'DRY RUN COMPLETE' : 'RUN COMPLETE'} — ${((Date.now() - t0) / 1000).toFixed(1)}s`);
})().catch((err) => { console.error('FATAL:', err); process.exit(1); });
