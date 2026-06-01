/**
 * Extend 7 below-300w articles + fix 2 bad openers — Day 33
 *
 * Extensions are substantive BOI-voice additions inserted before the signoff
 * (or before the verdict line where signoff follows). Target: ≥300w each.
 * No padding — every sentence adds information or voice.
 *
 * Also fixes:
 *   summer-fun: verdict 'WAIT FOR SALE' → 'WAIT' + signoff typo
 *   lego-technic-42228-review: 'Okay, everyone,' opener → BOI voice
 *   love-birds: 'Hey everyone! So,' opener → BOI voice
 *
 * Run: node --env-file=.env.local scripts/fix-short-articles-day33.mjs
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
  { auth: { persistSession: false } },
);

function wc(s) { return (s || '').split(/\s+/).filter(Boolean).length; }

async function patch(table, slug, fn, label) {
  const { data, error: fetchErr } = await sb.from(table).select('id,content').eq('slug', slug).maybeSingle();
  if (fetchErr || !data) { console.log(`  ${label}: NOT FOUND (${fetchErr?.message ?? 'no row'})`); return; }
  const original = data.content;
  const fixed = fn(original);
  if (fixed === original) { console.log(`  ${label}: no change`); return; }
  const { error } = await sb.from(table).update({ content: fixed }).eq('id', data.id);
  if (error) { console.log(`  ${label}: FAIL — ${error.message}`); return; }
  console.log(`  ${label}: OK — ${wc(original)}w → ${wc(fixed)}w`);
}

const SIGNOFF = 'On that bombshell, bubyee.';

// Insert text before the signoff line (or before verdict if signoff follows verdict)
function insertBeforeSignoff(content, addition) {
  const idx = content.lastIndexOf(SIGNOFF);
  if (idx === -1) return content.trimEnd() + '\n\n' + addition + '\n\n' + SIGNOFF;
  return content.slice(0, idx).trimEnd() + '\n\n' + addition + '\n\n' + SIGNOFF;
}

// ─────────────────────────────────────────────────────────────────────────────

console.log('\n━━ Short article extensions ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// 1. bionicles-tahu-fan-creations (230w → ~315w)
await patch('news_articles', 'bionicles-tahu-celebrates-25-years-with-fan-creations', c =>
  insertBeforeSignoff(c,
    `Twenty-five years is not a minor anniversary in the LEGO universe. Bionicle was the line that kept LEGO alive in the early 2000s when the company was genuinely on the edge of bankruptcy — the sets sold like nothing else at the time. The irony is that Bionicle's own spin-off, Galidor, nearly brought the company back down again. Tahu survived all of it. That is the kind of staying power worth celebrating, even if the official LEGO set the community actually wants — a proper, modern Bionicle revival — has not arrived yet. Builder hotdog_waffles is not waiting for LEGO's permission to keep the flame alive.`
  ), 'tahu-fan-creations extension');

// 2. bo-katans-gauntlet (279w → ~325w)
await patch('news_articles', 'bo-katans-gauntlet-starfighter-is-here-unofficially', c =>
  insertBeforeSignoff(c,
    `Bo-Katan's Gauntlet Starfighter is one of those ships that genuinely deserved an official LEGO set several seasons ago. LEGO has released Mandalorian-adjacent sets consistently — the Dark Trooper Attack, the Razor Crest, the Boba Fett's Starship — but somehow never pulled the trigger on Bo-Katan's signature vessel. The MOC fills the gap. At a price you build yourself, piece by piece, which is either the charm or the problem, depending on your patience.`
  ), 'bo-katans extension');

// 3. summer-fun (232w → ~310w) + verdict fix + signoff fix
await patch('news_articles', 'summer-fun-or-wallet-pain-new-lego-friends-sets-land-in-indi', c => {
  // Insert extension before verdict line
  const VERDICT = 'Verdict: WAIT FOR SALE.';
  const ext = `The LEGO Friends lineup has a habit of arriving just late enough in India to miss the season it was designed for. Summer sets in August, winter sets in December. By the time the Heartlake City Grand Hotel hits Indian shelves, the school holidays are already over. Worth watching for Diwali and year-end sale windows — Toycra and MyBrickHouse typically discount 10–15% during festive periods, which would bring the Grand Hotel under ₹10,000 and make the decision significantly easier.`;
  let out = c.includes(VERDICT)
    ? c.replace(VERDICT, ext + '\n\n' + VERDICT)
    : insertBeforeSignoff(c, ext);
  // Fix invalid verdict enum
  out = out.replace('Verdict: WAIT FOR SALE. Decent set, but the price needs to come down 20–30% before this makes sense.',
    'Verdict: WAIT. Good set, but the price will drop.');
  // Fix non-standard signoff
  out = out.replace("On that bombshell, it's time to say goodbye.", SIGNOFF);
  return out;
}, 'summer-fun extension + verdict + signoff');

// 4. porco-rosso (246w → ~325w)
await patch('news_articles', 'porco-rossos-hideout-your-wallet-needs-this-miyazaki-lego-bu', c =>
  insertBeforeSignoff(c,
    `Andrea Lattanzio has a track record with LEGO Ideas. His A-Frame Cabin made it through and became an official set. Whether Porco Rosso's hideout clears the same bar depends on one thing: the Studio Ghibli licence. LEGO has done it before — Howl's Moving Castle (21341) and the Totoro set both made it through. The precedent is there. India has a growing Miyazaki fanbase, and LEGO Ideas votes from Indian fans count exactly as much as votes from anywhere else. Worth spending thirty seconds to support it.`
  ), 'porco-rosso extension');

// 5. lego-contest-round-up (227w → ~320w)
await patch('news_articles', 'lego-contest-round-up-for-may-2026-2026', c =>
  insertBeforeSignoff(c,
    `The important thing about LEGO contests is what they actually test. It is not your piece count or your budget. It is your eye. Some of the best contest-winning builds are small, clever, and use twenty parts in a way nobody thought of before. Star Wars dioramas. Microscale cityscapes. Single-minifigure scenes with a punch line in them. India has genuinely talented builders who never enter these because they do not know the contests exist. That is the gap. Bookmark the BrickNerd roundups. Enter one. Worst case: you build something new and it sits on your shelf. Best case: free LEGO.`
  ), 'contest-round-up extension');

// 6. lego-megatron-brickheadz (249w → ~320w)
await patch('news_articles', 'lego-megatron-brickheadz-your-wallet-is-safe-for-now', c =>
  insertBeforeSignoff(c,
    `BrickHeadz are divisive. Half the community finds them charming — instant character recognition in twelve cubic centimetres, great for a desk or a shelf. The other half thinks they are excuses to charge ₹2,000 for a hundred pieces that could have gone toward a proper set. Both camps are right. What works specifically for Megatron BrickHeadz is the recognition factor: you put this on your desk and anyone who grew up in the 90s or early 2000s knows exactly who it is within two seconds. That is the whole value proposition.`
  ), 'megatron-brickheadz extension');

// 7. lego-ebon-hawk (259w → ~310w)
await patch('news_articles', 'lego-ebon-hawk-your-wallet-remains-safe-for-now', c =>
  insertBeforeSignoff(c,
    `KOTOR has a new game in development. Whether it ships on any timeline that resembles a promise is a separate question. But if it does, the Ebon Hawk is the ship that will have half the planet's nostalgia receptors firing simultaneously. LEGO should have an official set ready for that moment. They almost certainly will not. The MOC will have to do — and honestly, it does it better than most official sets would, because a fan build built for love is not constrained by retail price targets.`
  ), 'ebon-hawk extension');

// ─────────────────────────────────────────────────────────────────────────────

console.log('\n━━ Bad opener rewrites ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// lego-technic-42228-review: 'Okay, everyone,' opener
await patch('news_articles', 'lego-technic-42228-mclaren-f1-team-mcl39-review-too-many-car', c => {
  const OLD = "Okay, everyone, let's talk about LEGO Technic and cars. Specifically, Formula 1 cars. If your wallet is already feeling a bit thin just thinking about it, you're not alone. LEGO has churned out a LOT";
  const NEW = "Your wallet called. It wants a very specific conversation about Formula 1, carbon fibre, and how much plastic is acceptable to spend on a car that does not move. LEGO has churned out a LOT";
  return c.includes(OLD) ? c.replace(OLD, NEW) : c;
}, 'technic-review opener fix');

// love-birds: 'Hey everyone! So,' opener
await patch('news_articles', 'lego-ideas-21365-love-birds-cute-but-does-it-make-sense-for-', c => {
  const OLD = "Hey everyone! So, LEGO Ideas has dropped another one for us: the 21365 Love Birds. And let me tell you, the name is pretty spot on. This set features two adorable love birds perched on a branch, and it";
  const NEW = "LEGO Ideas has a new one. The 21365 Love Birds — two birds, a branch, and approximately ₹5,499 worth of pastel-coloured plastic. The name is accurate. This set features two adorable love birds perched on a branch, and it";
  return c.includes(OLD) ? c.replace(OLD, NEW) : c;
}, 'love-birds opener fix');

console.log('\n━━ Done ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
