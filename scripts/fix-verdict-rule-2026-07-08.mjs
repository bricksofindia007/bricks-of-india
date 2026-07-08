/**
 * Verdict Rule Rollout — immediate pre-approved fixes only (2026-07-08).
 * Scope: (1) close 3 stale missing_verdict CQS rows whose bodies already
 * contain a working verdict marker (checked against pre-fix content, never
 * re-scanned). (2) Correct a stale Jaiman Toys price (removed 2026-05-31)
 * that got relabeled "Toycra" instead of removed on lego-hogsmeade-village.
 * Does NOT touch the 19-article verdict-value rewrite batch — that is
 * pending operator review before any DB write.
 * Run: node --env-file=.env.local scripts/fix-verdict-rule-2026-07-08.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const raw = readFileSync(join(__dirname, '../.env.local'), 'utf-8');
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim(), v = t.slice(eq + 1).trim();
    if (k && !process.env[k]) process.env[k] = v;
  }
} catch {}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ── PASS 1 — close stale missing_verdict rows (Group 1: marker already present) ──

const STALE_GROUP1_SLUGS = [
  'lego-venator-class-republic-attack-cruiser-75367-worth-your-',
  'lego-death-star-75419-is-this-galactic-fortress-worth-your-h',
  'lego-ideas-21365-love-birds-cute-but-does-it-make-sense-for-',
];

console.log('━━ PASS 1: Close stale missing_verdict CQS rows (Group 1) ━━');
for (const slug of STALE_GROUP1_SLUGS) {
  const { data, error } = await sb
    .from('content_quality_issues')
    .update({
      resolved: true,
      resolved_at: new Date().toISOString(),
      fix_detail: 'Stale flag — checked_at predates a body fix already containing a valid verdict marker; re-verified 2026-07-08, no body change needed.',
    })
    .eq('article_slug', slug)
    .eq('check_name', 'missing_verdict')
    .eq('resolved', false)
    .select('id');
  if (error) { console.log(`  ERR ${slug}: ${error.message}`); continue; }
  console.log(`  ✓ ${slug.slice(0, 55)} — ${data.length} row(s) closed`);
}

// ── PASS 2 — Hogsmeade Village: fix stale Jaiman→Toycra price mislabel ──

console.log('\n━━ PASS 2: Fix stale Jaiman-Toys price mislabeled as Toycra (Hogsmeade) ━━');

const HOGSMEADE_SLUG = 'lego-hogsmeade-village-collectors-edition-76457-is-it-worth-';

const { data: art, error: fetchErr } = await sb
  .from('news_articles')
  .select('content')
  .eq('slug', HOGSMEADE_SLUG)
  .single();

if (fetchErr || !art) {
  console.log(`  ERR fetching ${HOGSMEADE_SLUG}: ${fetchErr?.message ?? 'not found'}`);
  process.exit(1);
}

const before = art.content;

const OLD_PARA_1 = "Let's check the damage here in India. At MyBrickHouse, this set is priced at a steep ₹41,199. Toycra offers it for a slightly more palatable ₹20,990. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. To give you some perspective, ₹20,990 is roughly the cost of a decent mid-range smartphone or about 400-500 cups of good filter coffee. The price difference between the two retailers is pretty wild, so definitely shop around! If you're looking at the higher price, that's quite a few months of your Spotify subscription.";
const NEW_PARA_1 = "Let's check the damage here in India. MyBrickHouse has this set for ₹41,199 — Toycra doesn't currently list it. To give you some perspective, that's roughly the cost of a decent mid-range smartphone or about 800 cups of good filter coffee, and quite a few months of your Spotify subscription.";

const OLD_PARA_2 = "So, should you grab it? If you're a mega-fan with deep pockets and this specific scene is your absolute favourite, go for it. But for most of us, the price is just too high for a single scene, even an iconic one. My advice? Keep an eye on sales. The ₹20,990 price from Toycra is much more reasonable. If you see it drop further, or if MyBrickHouse has a massive sale, it might become a more attractive proposition. Otherwise, wait for a good deal.";
const NEW_PARA_2 = "So, should you grab it? If you're a mega-fan with deep pockets and this specific scene is your absolute favourite, go for it. But for most of us, the price is just too high for a single scene, even an iconic one. My advice? Keep an eye on sales — if MyBrickHouse drops this below the current ₹41,199, it becomes a much more attractive proposition. Otherwise, wait for a good deal.";

if (!before.includes(OLD_PARA_1)) { console.log('  ERR: OLD_PARA_1 not found verbatim — aborting, no write made.'); process.exit(1); }
if (!before.includes(OLD_PARA_2)) { console.log('  ERR: OLD_PARA_2 not found verbatim — aborting, no write made.'); process.exit(1); }

let after = before.replace(OLD_PARA_1, NEW_PARA_1).replace(OLD_PARA_2, NEW_PARA_2);

const ratio = after.length / before.length;
if (ratio < 0.8 || ratio > 1.2) {
  console.log(`  ABORT: body length changed by ${Math.round((1 - ratio) * 100)}% (${before.length} → ${after.length}) — outside 20% safety window.`);
  process.exit(1);
}

// Verdict word/marker is untouched — only the price paragraphs changed.
if (!after.includes('Verdict: WAIT')) { console.log('  ERR: verdict marker no longer present after edit — aborting.'); process.exit(1); }

const { error: updateErr } = await sb.from('news_articles').update({ content: after }).eq('slug', HOGSMEADE_SLUG);
if (updateErr) { console.log(`  ERR writing update: ${updateErr.message}`); process.exit(1); }

await sb.from('content_fix_log').insert({
  fixed_at: new Date().toISOString(),
  article_slug: HOGSMEADE_SLUG,
  section: 'news_articles',
  fix_type: 'stale_store_price_mislabel',
  body_before: before,
  body_after: after,
});

console.log(`  ✓ ${HOGSMEADE_SLUG} — false Toycra ₹20,990 (originally Jaiman Toys, removed 2026-05-31) corrected. Length ${before.length} → ${after.length}.`);
console.log('  Verdict word left untouched (still WAIT) — verdict-value correction is part of the pending-review batch, not this pass.');
