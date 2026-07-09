/**
 * Fixes lego-10326-natural-history-museum-review, found by the new
 * verdict_drift CQS check (2026-07-09): verdict column said WAIT but body
 * had no "Verdict: X" marker at all, and the body's own pricing was stale --
 * it cited a "Jaiman" price (store removed 2026-05-31) as the real baseline,
 * with the article's actual retailer prices reading "Toycra: ₹26,990 ...
 * Toycra: ₹34,999" (same store name written twice at different prices --
 * the ₹26,990 figure was Jaiman's, left mislabeled as Toycra after removal).
 *
 * Real current data (store_prices, confirmed live): MyBrickHouse ₹31,999,
 * Toycra ₹34,999. Toycra's real MRP (mrp_verified=true, this session's MRP
 * audit) is also ₹34,999 -- Toycra sells at exactly MRP, MyBrickHouse sells
 * BELOW MRP. Verdict flips WAIT -> BUY NOW; rewrites every paragraph that
 * referenced the stale 3-store/Jaiman framing, and adds the missing verdict
 * marker.
 *
 * Run: node --env-file=.env.local scripts/fix-natural-history-museum-verdict-drift-2026-07-09.mjs
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

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const SLUG = 'lego-10326-natural-history-museum-review';

const { data: row, error: fetchErr } = await sb.from('reviews').select('content, verdict').eq('slug', SLUG).single();
if (fetchErr || !row) { console.error('fetch failed:', fetchErr?.message ?? 'not found'); process.exit(1); }

const before = row.content;

const EDITS = [
  [
    "Every few months, something happens in Indian LEGO retail that makes me want to sit down and have a quiet word with whoever is responsible for pricing decisions. Three Indian stores currently stock the LEGO Icons Natural History Museum. Toycra: ₹26,990. MyBrickHouse: ₹31,999. Toycra: ₹34,999. The spread between cheapest and most expensive is ₹8,009. That number should be in your head before we discuss anything else about this set.",
    "Two Indian stores currently stock the LEGO Icons Natural History Museum. MyBrickHouse: ₹31,999. Toycra: ₹34,999. The spread between the two is ₹3,000 — and unusually, the cheaper of the two is priced below the set's own MRP. That's worth knowing before we discuss anything else about this set.",
  ],
  [
    "The Natural History Museum (10326) is a 4,015-piece Modular Buildings entry. It is beautiful. It is not worth ₹34,999 right now, and I will not pretend otherwise.",
    "The Natural History Museum (10326) is a 4,015-piece Modular Buildings entry. It is beautiful, and — unusually for this column — it is actually fairly priced right now.",
  ],
  [
    "Toycra: ₹26,990. MyBrickHouse: ₹31,999. Toycra: ₹34,999. Import duty does not apply — this set is officially stocked in India. MyBrickHouse is ₹5,009 above Jaiman; Toycra is ₹8,009 above Jaiman — roughly 30% premium on an already large number. In Indian terms: ₹8,009 is 14 plates of butter chicken, three months of a mid-range EMI on something that actually appreciates in value, or a perfectly good return train ticket to somewhere worth going. The issue is purely retailer margin, and retailer margin is not your problem to solve with your money.",
    "MyBrickHouse: ₹31,999. Toycra: ₹34,999. Import duty does not apply — this set is officially stocked in India. Toycra's ₹34,999 is the confirmed official MRP; MyBrickHouse is pricing it ₹3,000 below MRP — the rare case where retailer margin works in your favour rather than against it. In Indian terms: ₹3,000 is about 5 plates of butter chicken for two, or a solid saving without needing to wait for a sale.",
  ],
  [
    "At Jaiman's ₹26,990 — ₹6.72 per piece, 4,015 pieces of excellent Victorian architecture — the verdict changes completely: buy without hesitation. If you need to buy from MyBrickHouse or Toycra, wait for a sale. Both run periodic discounts on the Modular range. Modular Buildings sets do not disappear from shelves overnight. The patience required is modest. ₹8,009 is not a trivial sum in any accounting system that takes LEGO prices seriously, and this one does.",
    "At MyBrickHouse's ₹31,999 — ₹7.97 per piece for 4,015 pieces of excellent Victorian architecture, already below the official MRP — the verdict is simple: buy without hesitation. There's no reason to wait for a sale when the standing price is already under MRP.",
  ],
  [
    // Old text has no verdict marker (there wasn't one); new text adds it --
    // this substitution both fixes the stale prose and adds the missing
    // marker in one shot.
    "4,015 pieces of Victorian architecture executed with real conviction. A set that earns a BUY at Jaiman's ₹26,990 and a firm WAIT FOR SALE at ₹31,999–₹34,999. The premium at MyBrickHouse and Toycra benefits the retailer and no one else. Set a price alert. Check back monthly. When a sale brings either store closer to ₹26,990 — and it will — buy it immediately. On that bombshell, your wallet has enough sense to wait even when you don't.",
    "4,015 pieces of Victorian architecture executed with real conviction. A set that earns a BUY at MyBrickHouse's ₹31,999 — already below MRP, no sale required. On that bombshell, your wallet can relax for once.\n\nVerdict: BUY NOW. The price is right — grab it.",
  ],
];

let after = before;
for (const [oldText, newText] of EDITS) {
  if (!after.includes(oldText)) {
    console.error('ABORT: expected text not found verbatim:\n', oldText.slice(0, 100));
    process.exit(1);
  }
  after = after.replace(oldText, newText);
}

const ratio = after.length / before.length;
if (ratio < 0.7 || ratio > 1.3) {
  console.error(`ABORT: body length changed by ${Math.round((1 - ratio) * 100)}% (${before.length} -> ${after.length}) -- outside safety window.`);
  process.exit(1);
}

if (!after.includes('Verdict: BUY NOW')) {
  console.error('ABORT: verdict marker not present after edit.');
  process.exit(1);
}

const { error: updateErr } = await sb.from('reviews').update({ content: after, verdict: 'BUY NOW' }).eq('slug', SLUG);
if (updateErr) { console.error('update failed:', updateErr.message); process.exit(1); }

await sb.from('content_fix_log').insert({
  fixed_at: new Date().toISOString(),
  article_slug: SLUG,
  section: 'reviews',
  fix_type: 'verdict_drift_stale_jaiman_price',
  body_before: before,
  body_after: after,
});

console.log(`Fixed ${SLUG}: verdict WAIT -> BUY NOW, stale Jaiman references removed, real MyBrickHouse/Toycra prices restated, verdict marker added. Length ${before.length} -> ${after.length}.`);
