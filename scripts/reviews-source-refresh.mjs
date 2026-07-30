/**
 * Reviews weekly source refresh — MyBrickHouse/Toycra direct sourcing.
 *
 * Single combined job (per spec — not two separate crons):
 *   Pass 1: re-verify every published review sourced from this pipeline
 *           (reviews.source_retailer IS NOT NULL).
 *   Pass 2: discover new review-eligible sets from the SAME fetch pass.
 *
 * This fully replaces RADAR-08 (scripts/radar-08-reviews.js) as the source
 * of review candidates. RADAR-08 is left in place but is no longer invoked
 * by anything after this ships — see BOI_MASTER_TRACKER.md for the note on
 * whether to decommission it.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/reviews-source-refresh.mjs --dry-run
 *   npx tsx --env-file=.env.local scripts/reviews-source-refresh.mjs
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { fetchLiveListings, resolveEligibleListing, STORE_DISPLAY_NAME } from './lib/reviews-source.mjs';
import { resplicePublishedIndiaParagraph, extractIndiaParagraphBlock } from '../src/lib/publish-draft.ts';
import { assertFlipFreezeGuarantee } from '../src/lib/flip-freeze-assertion.ts';
import { getSecret } from '../src/lib/get-secret.ts';

const DRY_RUN = process.argv.includes('--dry-run');
const PAGE    = 1000;

// New-candidate cap per run — mirrors RADAR-08's CAP=10, keeping Pass 2's
// output within generate-drafts.yml's existing daily Gemini-quota budget
// rather than dumping a whole week's discoveries into the queue at once.
const DISCOVERY_CAP = 10;
const MIN_PRICE_INR = 1000; // inherited from radar-08-reviews.js — flagged in the plan as a carried-over default, not a new requirement
const ACCESSORY_RE  = /\b(pen|keychain|key chain|magnet|bag charm|pin)\b/i;

// A price move at/above this magnitude is treated as "plausibly flips the
// verdict" and routed to content_quality_issues for manual approval rather
// than auto-applied. There is no deterministic verdict formula anywhere in
// this codebase to re-derive a verdict from (verdict is genuinely an LLM
// judgment call at generation time, per draft-prompt.ts's RATING CRITERIA
// commentary) — re-running the LLM on every published review every week
// was considered and rejected as unnecessary weekly API cost/complexity for
// what is, in practice, rare (most weekly price moves are small). This
// threshold is a deliberate, documented simplification — flagged as such
// in the implementation report, not a literal spec requirement.
const FLIP_THRESHOLD_PCT = 0.15;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = getSecret('SUPABASE_SERVICE_ROLE_KEY');
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function fmtInr(n) {
  const s = Math.round(n).toString();
  const last3 = s.slice(-3);
  const rest  = s.slice(0, -3);
  if (!rest) return last3;
  return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
}

async function paginate(query) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await query(offset);
    if (error) throw error;
    for (const r of data ?? []) rows.push(r);
    if ((data ?? []).length < PAGE) break;
  }
  return rows;
}

async function flagIssue(articleSlug, checkName, severity, detail) {
  console.log(`  [FLAG:${severity}] ${checkName} — ${articleSlug ?? '(new candidate)'}: ${detail}`);
  if (DRY_RUN) return;
  const { error } = await sb.from('content_quality_issues').insert({
    section: 'reviews', article_slug: articleSlug, check_name: checkName, severity, detail,
  });
  if (error) console.error('  [supabase-write] table=content_quality_issues op=insert error:', error.message);
}

(async () => {
  console.log(`━━ reviews-source-refresh${DRY_RUN ? ' [DRY-RUN]' : ''} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  const t0 = Date.now();

  // ── Load sets catalogue (paginated — bypasses PostgREST 1000-row cap) ──────
  console.log('Loading sets catalogue...');
  const knownSetsByName = new Map();          // lowercased name -> set_number (MBH fallback matching)
  const setByNumber     = new Map();          // set_number -> { id, name }
  const setNumberById   = new Map();          // id -> set_number
  const setsRows = await paginate(offset =>
    sb.from('sets').select('id, set_number, name').range(offset, offset + PAGE - 1),
  );
  for (const s of setsRows) {
    setByNumber.set(s.set_number, s);
    setNumberById.set(s.id, s.set_number);
    if (s.name) knownSetsByName.set(s.name.toLowerCase().replace(/[™®©\s]+/g, ' ').trim(), s.set_number);
  }
  console.log(`Loaded ${setsRows.length} sets.\n`);

  // ── Single live fetch — serves both passes ─────────────────────────────────
  console.log('Fetching live retailer listings (MyBrickHouse + Toycra)...');
  const { listings, failedStores } = await fetchLiveListings(knownSetsByName);
  console.log(`Fetched ${listings.size} distinct set numbers across both stores.`);
  if (failedStores.length > 0) {
    console.warn(`WARNING: ${failedStores.length} store(s) failed to fetch entirely this run: ${failedStores.map(f => f.storeName).join(', ')}`);
  }
  const failedStoreIds = new Set(failedStores.map(f => f.storeId));
  console.log('');

  const now = new Date().toISOString();

  // ══ PASS 1 — re-verification of published reviews ══════════════════════════
  console.log('── PASS 1: re-verification ──');
  const publishedReviews = await paginate(offset =>
    sb.from('reviews')
      .select('id, slug, title, content, verdict, verdict_disclaimer_variant, set_id, source_retailer, source_price_inr, source_stock_status, source_checked_at')
      .not('source_retailer', 'is', null)
      .range(offset, offset + PAGE - 1),
  );
  console.log(`Reviews sourced from this pipeline: ${publishedReviews.length}`);

  // Self-verifying flip-freeze assertion: snapshot the three fields that
  // must NEVER change for a row flagged as a verdict-flip candidate, before
  // any Pass 1 write happens. Checked against a live re-read after the loop
  // completes, for every row actually flagged this run — not a log-only
  // check, a hard failure (non-zero exit) if anything moved.
  const preRunSnapshot = new Map(); // review.id -> { verdict, verdict_disclaimer_variant, indiaParagraphBlock }
  for (const review of publishedReviews) {
    preRunSnapshot.set(review.id, {
      verdict: review.verdict,
      verdict_disclaimer_variant: review.verdict_disclaimer_variant,
      indiaParagraphBlock: extractIndiaParagraphBlock(review.content),
    });
  }
  const flipFlaggedReviewIds = [];

  let p1Updated = 0, p1Flagged = 0, p1OutOfStock = 0, p1FetchIncomplete = 0;

  for (const review of publishedReviews) {
    const setNumber = setNumberById.get(review.set_id);
    if (!setNumber) {
      await flagIssue(review.slug, 'review_set_unmatched', 'warning', `set_id ${review.set_id} has no matching sets row — cannot re-verify`);
      continue;
    }

    const entry = listings.get(setNumber);
    const involvedStores = ['toycra', 'mybrickhouse'].filter(id =>
      review.source_retailer === 'both' || review.source_retailer === id || (entry && entry[id]),
    );
    const hadFetchFailure = involvedStores.some(id => failedStoreIds.has(id));

    if (hadFetchFailure) {
      // Can't tell "genuinely out of stock" from "we couldn't check this
      // store this week" — exclude from auto-update, flag, move on. Still
      // record that we attempted a check.
      p1FetchIncomplete++;
      await flagIssue(review.slug, 'review_source_fetch_incomplete', 'warning',
        `Re-verification incomplete — store fetch failed this run for ${setNumber}; not auto-updated, not treated as out-of-stock`);
      if (!DRY_RUN) {
        await sb.from('reviews').update({ source_checked_at: now }).eq('id', review.id);
      }
      continue;
    }

    const resolved = resolveEligibleListing(entry);

    if (!resolved || resolved.sourceStockStatus === 'out_of_stock') {
      // Confirmed out of stock everywhere (both stores queried cleanly, both
      // say out of stock) OR delisted entirely from both feeds. Per spec:
      // never auto-unpublish/delete — flag for a manual decision.
      p1OutOfStock++;
      await flagIssue(review.slug, 'review_out_of_stock', 'critical',
        `${setNumber} is ${resolved ? 'confirmed out of stock at both stores' : 'no longer listed at either store'} — was ${review.source_retailer} at ₹${review.source_price_inr}. Manual decision needed (add out-of-stock note, or pull down).`);
      if (!DRY_RUN) {
        await sb.from('reviews').update({ source_checked_at: now }).eq('id', review.id);
      }
      continue;
    }

    const oldPrice = Number(review.source_price_inr);
    const newPrice = resolved.sourcePriceInr;
    const pctChange = oldPrice > 0 ? Math.abs(newPrice - oldPrice) / oldPrice : 1;

    if (pctChange >= FLIP_THRESHOLD_PCT) {
      p1Flagged++;
      flipFlaggedReviewIds.push(review.id);
      await flagIssue(review.slug, 'verdict_flip_candidate', 'critical',
        `${setNumber}: ₹${review.source_price_inr} -> ₹${newPrice} (${(pctChange * 100).toFixed(1)}% change) at ${resolved.sourceRetailer}, current verdict ${review.verdict} — plausibly flips the verdict. Frozen pending chat approval; only source_checked_at updated.`);
      if (!DRY_RUN) {
        await sb.from('reviews').update({ source_checked_at: now }).eq('id', review.id);
      }
      continue;
    }

    // Non-flip price/retailer change — safe to auto-update price + content
    // (disclaimer variant recomputed mechanically; verdict itself unchanged).
    if (newPrice !== oldPrice || resolved.sourceRetailer !== review.source_retailer) {
      p1Updated++;
      console.log(`  [UPDATE] ${review.slug}: ₹${oldPrice} -> ₹${newPrice} @ ${resolved.sourceRetailer} (verdict unchanged: ${review.verdict})`);
      if (!DRY_RUN) {
        try {
          const { content, disclaimerVariant } = resplicePublishedIndiaParagraph(review.content, review.verdict, {
            source_retailer:     resolved.sourceRetailer,
            source_price_inr:    resolved.sourcePriceInr,
            source_stock_status: resolved.sourceStockStatus,
            source_checked_at:   now,
          });
          await sb.from('reviews').update({
            content,
            source_retailer:            resolved.sourceRetailer,
            source_price_inr:           resolved.sourcePriceInr,
            source_stock_status:        resolved.sourceStockStatus,
            source_checked_at:          now,
            verdict_disclaimer_variant: disclaimerVariant,
          }).eq('id', review.id);
        } catch (err) {
          await flagIssue(review.slug, 'review_resplice_failed', 'critical', `Re-splice failed: ${err.message} — source_checked_at updated only, content untouched`);
          await sb.from('reviews').update({ source_checked_at: now }).eq('id', review.id);
        }
      }
    } else {
      // No change at all — still record that we checked.
      if (!DRY_RUN) await sb.from('reviews').update({ source_checked_at: now }).eq('id', review.id);
    }
  }

  console.log(`Pass 1 summary: ${p1Updated} auto-updated, ${p1Flagged} flagged (possible verdict flip), ${p1OutOfStock} flagged (out of stock), ${p1FetchIncomplete} skipped (fetch incomplete)\n`);

  // ── Self-verifying flip-freeze assertion ────────────────────────────────────
  // For every row flagged verdict_flip_candidate THIS run, re-read the LIVE
  // row (fresh from the DB, not the in-memory copy) and assert verdict,
  // verdict_disclaimer_variant, and the India Paragraph block text are
  // byte-identical to the pre-run snapshot. This is the one guarantee that
  // absolutely cannot silently fail — a mismatch here means a flip candidate
  // was live-changed without chat approval, which is a hard failure (thrown,
  // non-zero exit), not a log line alongside the flag. Skipped in DRY_RUN —
  // nothing was written, so there is nothing to verify.
  if (!DRY_RUN && flipFlaggedReviewIds.length > 0) {
    console.log(`── Verifying flip-freeze guarantee for ${flipFlaggedReviewIds.length} flagged row(s) ──`);
    const { data: liveRows, error: liveErr } = await sb
      .from('reviews')
      .select('id, slug, verdict, verdict_disclaimer_variant, content')
      .in('id', flipFlaggedReviewIds);
    if (liveErr) {
      throw new Error(`[flip-freeze-assertion] Could not re-read flagged rows to verify: ${liveErr.message}`);
    }
    assertFlipFreezeGuarantee(preRunSnapshot, liveRows);
    console.log(`Flip-freeze guarantee held for all ${flipFlaggedReviewIds.length} flagged row(s) — verdict/disclaimer/India Paragraph unchanged.\n`);
  }

  // ══ PASS 2 — discovery of new qualifying sets ═══════════════════════════════
  console.log('── PASS 2: discovery ──');

  const reviewedSetIds = new Set(await paginate(offset =>
    sb.from('reviews').select('set_id').range(offset, offset + PAGE - 1),
  ).then(rows => rows.map(r => r.set_id).filter(Boolean)));

  const pendingSourceUrls = new Set(await paginate(offset =>
    sb.from('pending_drafts').select('source_url').range(offset, offset + PAGE - 1),
  ).then(rows => rows.map(r => r.source_url)));

  const candidates = [];
  for (const [setNumber, entry] of listings) {
    const setRow = setByNumber.get(setNumber);
    if (!setRow) continue; // no catalogue match — set number, not fuzzy name matching, per spec
    if (reviewedSetIds.has(setRow.id)) continue;
    if (ACCESSORY_RE.test(setRow.name ?? '')) continue;

    const involvedStores = Object.keys(entry).filter(id => !failedStoreIds.has(id));
    if (involvedStores.length === 0) continue; // every store carrying this set failed to fetch this run

    const resolved = resolveEligibleListing(entry);
    if (!resolved || resolved.sourceStockStatus !== 'in_stock') continue; // must be genuinely purchasable to become a NEW review
    if (resolved.sourcePriceInr < MIN_PRICE_INR) continue;

    const sourceUrl = resolved.sourceProductUrl;
    if (pendingSourceUrls.has(sourceUrl)) continue;

    candidates.push({ setNumber, setRow, resolved, sourceUrl });
  }

  candidates.sort((a, b) => b.resolved.sourcePriceInr - a.resolved.sourcePriceInr);
  const selected = candidates.slice(0, DISCOVERY_CAP);

  console.log(`Candidates after filters: ${candidates.length}, queuing ${selected.length} (cap ${DISCOVERY_CAP})`);

  for (const c of selected) {
    const retailerDisplay = STORE_DISPLAY_NAME[c.resolved.sourceRetailer] ?? c.resolved.sourceRetailer;
    const draftTitle  = `LEGO ${c.setRow.name} (${c.setNumber}) — Worth ₹${fmtInr(c.resolved.sourcePriceInr)} in India?`;
    const sourceTitle = `LEGO ${c.setRow.name} (${c.setNumber}) — ${retailerDisplay}`;
    console.log(`  [QUEUE] ${draftTitle}`);
    if (DRY_RUN) continue;

    const { error } = await sb.from('pending_drafts').insert({
      source_url:          c.sourceUrl,
      source_title:        sourceTitle,
      source_excerpt:      null,
      source_published_at: null,
      draft_title:         draftTitle,
      draft_format:        'review',
      status:              'approved',
      source_retailer:     c.resolved.sourceRetailer,
      source_price_inr:    c.resolved.sourcePriceInr,
      source_stock_status: c.resolved.sourceStockStatus,
      source_checked_at:   now,
    });
    if (error) console.error(`  [supabase-write] table=pending_drafts op=insert error (${c.setNumber}):`, error.message);
  }

  console.log(`\n${DRY_RUN ? 'DRY RUN COMPLETE' : 'RUN COMPLETE'} — ${((Date.now() - t0) / 1000).toFixed(1)}s`);
})().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
