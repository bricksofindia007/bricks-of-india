'use strict';
/**
 * Guides staleness guard (§5, Nav & Content Overhaul, 2026-08-09).
 *
 * Monthly job. Finds the oldest guides (by updated_at) and checks their
 * content for patterns that commonly go stale (a ₹ price figure, an
 * "as of/in 2026"-style date claim). It does NOT auto-correct anything —
 * Guides has no live-price gate (§5 deliberately skips it, unlike
 * Reviews), so there is no source of truth to auto-correct a stale figure
 * TO. Silently rewriting one unverified number into another guess is
 * exactly what BOI's no-fabrication rule exists to prevent (same reasoning
 * already applied to the Reviews weekly job's verdict-flip case — flag,
 * don't guess). Flags into content_quality_issues (the existing CQS table)
 * for manual review instead.
 *
 * Deliberately NOT distinguishing "templated date stamp" (safe to
 * auto-refresh, not a factual claim) from "real stale price/date claim"
 * (needs a human) yet — Abhinav's call, 2026-08-09: build that distinction
 * later, from real flag-queue data, not speculatively now.
 *
 * Idempotent: skips a guide that already has an unresolved
 * guide_staleness issue on file, so re-running monthly doesn't spam
 * duplicate flags for the same still-unreviewed row.
 *
 * Usage:
 *   node scripts/radar/guide-staleness-guard.js [--dry-run] [--limit N]
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = (() => {
  const i = process.argv.indexOf('--limit');
  return i !== -1 ? parseInt(process.argv[i + 1], 10) : 3;
})();

const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

const CHECK_NAME = 'guide_staleness';

// Patterns that commonly go stale in an evergreen guide. Not exhaustive by
// design — this is a lightweight triage net, not a factuality re-verifier;
// a human makes the actual call.
const PRICE_RE = /₹[\d,]+/;
const YEAR_CLAIM_RE = /\b(as of|in|for)\s+20\d{2}\b/i;

function findStalePatterns(content) {
  const hits = [];
  const priceMatches = (content.match(new RegExp(PRICE_RE, 'g')) ?? []);
  if (priceMatches.length > 0) {
    hits.push(`${priceMatches.length} ₹ price mention(s) (e.g. "${priceMatches[0]}") — unverified without a live-price gate, may be stale`);
  }
  const yearMatches = (content.match(new RegExp(YEAR_CLAIM_RE, 'g')) ?? []);
  if (yearMatches.length > 0) {
    hits.push(`${yearMatches.length} date-claim mention(s) (e.g. "${yearMatches[0]}") — may no longer be current`);
  }
  return hits;
}

(async () => {
  const t0 = Date.now();
  console.log(`━━ Guides staleness guard${DRY_RUN ? ' [DRY-RUN]' : ''} (limit=${LIMIT}) ━━━━━━━━━━━━━━━━━`);

  const { data: oldest, error } = await sb
    .from('guides')
    .select('id, slug, title, content, updated_at')
    .order('updated_at', { ascending: true })
    .limit(LIMIT);
  if (error) throw error;

  if (!oldest || oldest.length === 0) {
    console.log('No guides to check.');
    return;
  }

  let flagged = 0, skippedAlreadyFlagged = 0, clean = 0;

  for (const g of oldest) {
    const ageDays = Math.floor((Date.now() - new Date(g.updated_at).getTime()) / 86_400_000);
    const hits = findStalePatterns(g.content || '');

    if (hits.length === 0) {
      clean++;
      console.log(`  [clean] "${g.title}" (${ageDays}d old) — no stale-pattern hits`);
      continue;
    }

    const { data: existingIssue } = await sb
      .from('content_quality_issues')
      .select('id')
      .eq('article_slug', g.slug)
      .eq('section', 'guides')
      .eq('check_name', CHECK_NAME)
      .eq('resolved', false)
      .maybeSingle();
    if (existingIssue) {
      skippedAlreadyFlagged++;
      console.log(`  [already flagged] "${g.title}" (${ageDays}d old) — unresolved issue already on file, not re-flagging`);
      continue;
    }

    const detail = `Guide is ${ageDays} days old with no live-price gate to verify against. Found: ${hits.join('; ')}. Needs manual review, not auto-correction (no source of truth to auto-correct to).`;

    if (DRY_RUN) {
      console.log(`  [DRY-RUN would flag] "${g.title}" (${ageDays}d old) — ${detail}`);
      flagged++;
      continue;
    }

    const { error: insErr } = await sb.from('content_quality_issues').insert({
      article_id:   String(g.id),
      article_slug: g.slug,
      section:      'guides',
      check_name:   CHECK_NAME,
      severity:     'info',
      detail,
      auto_fixable: false,
    });
    if (insErr) {
      console.error('[supabase-write] table=content_quality_issues op=insert error:', insErr);
      continue;
    }
    flagged++;
    console.log(`  [FLAGGED] "${g.title}" (${ageDays}d old) — ${detail}`);
  }

  const dur = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nSUMMARY: checked=${oldest.length} flagged=${flagged} already_flagged=${skippedAlreadyFlagged} clean=${clean} — ${dur}s total`);
})().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
