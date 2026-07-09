/**
 * Rewrites the 13 duplicate "Your wallet [breathed a sigh of relief /
 * called / is probably recovering]..." openers found in the reviews table
 * spot-check (2026-07-09) -- same root cause/pattern as the news_articles
 * opener cleanup (MEDIUM-45), applied here for the first time since this
 * table was never included in that pass. Confirmed live: 13 of 18 reviews
 * open with a variant of this cliche; 3 are near-word-for-word identical
 * pairs (Arcade Machine <-> Unicorn Castle, AT-RT Attack <-> Rontu, Olaf's
 * Picnic <-> Revenge of the Sith, the latter also matching Beach House at
 * the CQS check's 100% threshold).
 *
 * Splits each article's content on its first paragraph break (first \n\n)
 * programmatically -- rewriting only that first paragraph and leaving
 * every subsequent paragraph verbatim, rather than hand-retyping the old
 * paragraph as a literal match (curly-quote/em-dash transcription risk).
 * New openers are unique per-article, reference something specific and
 * true about that set (piece count, build mechanism, licence, scale),
 * verified against each other for no shared distinctive phrase before
 * writing.
 *
 * Run: node --env-file=.env.local scripts/fix-reviews-duplicate-openers-2026-07-09.mjs
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

const NEW_OPENERS = {
  'lego-acclamator-class-assault-ship-75404-worth-5449':
    "LEGO Star Wars sets rarely earn the word \"utilitarian,\" but the Acclamator-Class Assault Ship (75404) manages it — grey, blocky, and about as glamorous as a school bus. Which is sort of the point.",

  'lego-arcade-machine-40805-worth-4549':
    "LEGO has built a working crank-operated arcade cabinet out of plastic bricks, and the 80s-kid in me is obligated to take that personally. The LEGO Arcade Machine (40805) swaps three printed \"games\" via a hand crank — the question is whether the novelty survives contact with the price tag.",

  'lego-at-rt-attack-75444-worth-4999':
    "Not every Star Wars set needs to cost as much as a used scooter. The LEGO AT-RT Attack (75444) is refreshingly modest in scale — a Clone Wars walker and a small squad, nothing that requires a second mortgage to enjoy.",

  'lego-beach-house-with-seals-42699-worth-4999':
    "LEGO Friends has quietly been building out an entire zoo of moulded animal figures, and the seals in this beach house (42699) are the latest recruits. The question is whether ₹4,999 buys enough beach house to go with them.",

  'lego-christmas-table-decoration-40743-worth-4549':
    "Every December, LEGO releases a small seasonal centrepiece for the dining table, and every December someone asks whether a few festive bricks are really worth the asking price. This year's entrant is the Christmas Table Decoration (40743), and the honest answer is: it depends how much you love the ritual.",

  'lego-custom-police-car-garage-60457-worth-5449':
    "LEGO's pitch for the Custom Police Car Garage (60457) is customisation — swap the spoiler, the headlights, the stickers, make the cruiser your own. In practice, it's closer to changing hubcaps on a toy car than the deep creative build the name promises.",

  'lego-deluxe-brick-box-10914-worth-5449':
    "This one isn't for you, and that's fine. The LEGO Deluxe Brick Box (10914) is 790 pieces of pure DUPLO — no minifigures, no mechanisms, just a storage tub of basic bricks for the smallest builders in the house.",

  'lego-elsas-ice-castle-snow-ride-adventure-43281-worth-4999':
    "Frozen sets follow a predictable rhythm at this point: new Elsa product announced, fandom excitement builds, Indian pricing arrives and cools things down a notch. The Ice Castle & Snow Ride Adventure (43281) follows that exact rhythm.",

  'lego-gabbys-brick-built-cat-friends-11215-worth-5499':
    "Four brick-built cats from a preschool show, no minifigures, no vehicle, no epic scale — the LEGO Gabby's Brick-Built Cat Friends (11215) is about as low-stakes as LEGO gets. Which makes the ₹5,499 price tag a little harder to explain.",

  'lego-olaf-and-brunis-picnic-fun-43287-worth-4999':
    "A snowman and a fire salamander have a picnic. That's the entire premise of the LEGO Olaf and Bruni's Picnic Fun set — 170 pieces built almost entirely around two Frozen II characters and the licence fee that comes with them.",

  'lego-revenge-of-the-sith-heroes-villains-40796-worth-5449':
    "Revenge of the Sith turns 20 this year, and LEGO's answer is a five-minifigure display piece rather than a proper set — Anakin, Obi-Wan, Padmé, Grievous, and Vader on a nameplated stand, commemorating the anniversary more than building anything substantial.",

  'lego-rontu-the-master-dragon-71842-worth-4999':
    "Ninjago has built entire dragons the size of coffee tables before, so Rontu the Master Dragon (71842) landing at a modest 672 pieces feels almost restrained by comparison — a play-first dragon for the younger end of the fandom, not a display centrepiece.",

  'lego-unicorn-castle-31175-worth-4549':
    "A castle, a rainbow unicorn, or a treehouse — the Creator 3-in-1 Unicorn Castle (31175) gives you three builds from one box, all leaning hard into pink, purple, and glitter. The three-in-one format is usually great value; the question here is whether 494 pieces is enough to spread across all three.",
};

const slugs = Object.keys(NEW_OPENERS);
console.log(`Rewriting ${slugs.length} openers...\n`);

const { data: rows, error: fetchErr } = await sb.from('reviews').select('slug, content, verdict').in('slug', slugs);
if (fetchErr) { console.error('fetch failed:', fetchErr.message); process.exit(1); }
if (rows.length !== slugs.length) {
  console.error(`ABORT: expected ${slugs.length} rows, found ${rows.length}. Missing: ${slugs.filter(s => !rows.some(r => r.slug === s)).join(', ')}`);
  process.exit(1);
}

let updated = 0;
for (const row of rows) {
  const breakIdx = row.content.indexOf('\n\n');
  if (breakIdx === -1) { console.error(`  SKIP ${row.slug}: no paragraph break found`); continue; }

  const oldOpener = row.content.slice(0, breakIdx);
  const rest = row.content.slice(breakIdx);
  const newOpener = NEW_OPENERS[row.slug];
  const after = newOpener + rest;

  const ratio = after.length / row.content.length;
  if (ratio < 0.7 || ratio > 1.5) {
    console.error(`  ABORT ${row.slug}: length changed ${Math.round((1 - ratio) * 100)}% (${row.content.length} -> ${after.length}) -- outside safety window.`);
    continue;
  }
  if (!/Verdict:\s*(BUY NOW|WAIT|IMPORT ONLY|AVOID)/i.test(after)) {
    console.error(`  ABORT ${row.slug}: verdict marker missing after edit.`);
    continue;
  }

  const { error: updateErr } = await sb.from('reviews').update({ content: after }).eq('slug', row.slug);
  if (updateErr) { console.error(`  ERR ${row.slug}: ${updateErr.message}`); continue; }

  await sb.from('content_fix_log').insert({
    fixed_at: new Date().toISOString(),
    article_slug: row.slug,
    section: 'reviews',
    fix_type: 'duplicate_opener_rewrite',
    body_before: row.content,
    body_after: after,
  });

  updated++;
  console.log(`  OK ${row.slug}`);
  console.log(`     old: "${oldOpener.slice(0, 70)}..."`);
  console.log(`     new: "${newOpener.slice(0, 70)}..."`);
}

console.log(`\nDone. ${updated}/${slugs.length} openers rewritten.`);
