/**
 * Retirement check — universal, weekly, auto-correcting.
 *
 * Finds every `reviews` row and every category='Review' `news_articles`
 * row whose linked set is marked `sets.retired = true` but still carries
 * a live purchase verdict (anything other than 'RETIRED'), and corrects
 * it: verdict -> 'RETIRED', the embedded "Verdict: ..."/"Standard
 * disclaimer: ..." lines replaced with an accurate retirement notice,
 * and (for reviews) the retailer-pipeline source_* fields cleared if set
 * -- required by the reviews_verdict_no_import_check DB constraint
 * (source_retailer IS NOT NULL rows must carry BUY NOW/WAIT/AVOID), and
 * the honest representation once the retailer no longer carries the set.
 *
 * This is the exact pattern manually verified safe and correct on 2026-
 * 09-21 (25 rows, PR #163) -- this script is that fix turned into a
 * recurring, idempotent job. It is intentionally decoupled from any
 * store_prices/scraper coverage: `sets.retired` is derived purely from
 * Brickset-linked catalogue data (populate-mrp.js / update-retiring-
 * soon.mjs), so this runs against every review/Review-article uniformly,
 * regardless of whether the underlying set was ever scraper-tracked.
 *
 * Auto-correct is safe here (unlike a price-driven verdict flip, which
 * routes to content_quality_issues for manual review instead) because
 * "retired" is not a judgment call -- it's a catalogue fact.
 *
 * Idempotent: skips any row already verdict='RETIRED'. Logs every
 * correction to content_quality_issues (severity=info, resolved=true --
 * an audit-trail record, not an open item needing a decision) and
 * resolves any pre-existing unresolved review_out_of_stock flag on the
 * same slug, same as the manual fix did.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/retirement-check.mjs --dry-run
 *   npx tsx --env-file=.env.local scripts/retirement-check.mjs
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const DRY_RUN = process.argv.includes('--dry-run');
const PAGE = 1000;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const NEW_VERDICT_LINE = 'Verdict: RETIRED. This set has been discontinued by LEGO and is no longer available through MyBrickHouse or Toycra.';
const NEW_DISCLAIMER_LINE = "Standard disclaimer: this set is retired — there's nothing left to buy. Check the secondary/resale market if you still want one.";

async function paginate(table, cols) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await sb.from(table).select(cols).range(offset, offset + PAGE - 1);
    if (error) throw error;
    for (const r of data ?? []) rows.push(r);
    if ((data ?? []).length < PAGE) break;
  }
  return rows;
}

function fixContent(content) {
  let out = content.replace(/^Verdict:.*$/gm, NEW_VERDICT_LINE);
  out = out.replace(/^Standard disclaimer:.*$/gm, NEW_DISCLAIMER_LINE);
  return out;
}

async function logCorrection(section, articleSlug, articleId, detail) {
  if (DRY_RUN) return;
  const { error } = await sb.from('content_quality_issues').insert({
    section, article_slug: articleSlug, article_id: articleId ? String(articleId) : null,
    check_name: 'set_retired_auto_corrected', severity: 'info', detail,
    resolved: true, auto_fixable: true,
    checked_at: new Date().toISOString(), first_seen_at: new Date().toISOString(),
  });
  if (error) console.error(`  [supabase-write] content_quality_issues insert error for ${articleSlug}:`, error.message);
}

async function resolveOutOfStockFlag(articleSlug) {
  if (DRY_RUN) return;
  const { data, error } = await sb.from('content_quality_issues')
    .update({ resolved: true })
    .eq('check_name', 'review_out_of_stock')
    .eq('article_slug', articleSlug)
    .eq('resolved', false)
    .select('id');
  if (error) console.error(`  [supabase-write] resolving review_out_of_stock for ${articleSlug}:`, error.message);
  else if ((data ?? []).length > 0) console.log(`    resolved ${data.length} pre-existing review_out_of_stock flag(s)`);
}

(async () => {
  console.log(`━━ retirement-check${DRY_RUN ? ' [DRY-RUN]' : ''} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  const t0 = Date.now();

  const sets = await paginate('sets', 'id, set_number, retired');
  const setById = new Map(sets.map(s => [s.id, s]));
  const setByNumber = new Map(sets.map(s => [s.set_number, s]));

  let reviewsFixed = 0, newsFixed = 0;

  // ── reviews ──────────────────────────────────────────────────────────────
  const reviews = await paginate('reviews', 'id, slug, content, verdict, set_id, source_retailer');
  for (const review of reviews) {
    if (review.verdict === 'RETIRED') continue;
    const set = setById.get(review.set_id);
    if (!set?.retired) continue;

    const newContent = fixContent(review.content);
    console.log(`  [REVIEW RETIRED] ${review.slug} (was ${review.verdict}, set ${set.set_number})`);
    reviewsFixed++;
    if (DRY_RUN) continue;

    const update = { content: newContent, verdict: 'RETIRED' };
    if (review.source_retailer !== null) {
      update.source_retailer = null;
      update.source_price_inr = null;
      update.source_stock_status = null;
      update.source_checked_at = null;
      update.verdict_disclaimer_variant = null;
    }
    const { error } = await sb.from('reviews').update(update).eq('id', review.id);
    if (error) { console.error(`  [supabase-write] reviews update error for ${review.slug}:`, error.message); continue; }
    await logCorrection('reviews', review.slug, review.id, `Set ${set.set_number} retired — verdict corrected from ${review.verdict} to RETIRED.`);
    await resolveOutOfStockFlag(review.slug);
  }

  // ── news_articles (category='Review') ───────────────────────────────────
  const news = await paginate('news_articles', 'id, slug, content, verdict, category, set_number');
  const reviewNews = news.filter(n => n.category === 'Review' && n.verdict !== null);
  for (const article of reviewNews) {
    if (article.verdict === 'RETIRED') continue;
    const set = article.set_number ? setByNumber.get(article.set_number) : null;
    if (!set?.retired) continue;

    const newContent = fixContent(article.content);
    console.log(`  [NEWS RETIRED] ${article.slug} (was ${article.verdict}, set ${set.set_number})`);
    newsFixed++;
    if (DRY_RUN) continue;

    const { error } = await sb.from('news_articles').update({ content: newContent, verdict: 'RETIRED' }).eq('id', article.id);
    if (error) { console.error(`  [supabase-write] news_articles update error for ${article.slug}:`, error.message); continue; }
    await logCorrection('news_articles', article.slug, article.id, `Set ${set.set_number} retired — verdict corrected from ${article.verdict} to RETIRED.`);
  }

  console.log(`\nSUMMARY: reviews corrected=${reviewsFixed}, news_articles corrected=${newsFixed}`);
  console.log(`${DRY_RUN ? 'DRY RUN COMPLETE' : 'RUN COMPLETE'} — ${((Date.now() - t0) / 1000).toFixed(1)}s`);
})().catch(err => { console.error('FATAL:', err); process.exit(1); });
