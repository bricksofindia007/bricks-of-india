/**
 * CRITICAL-4 Part C — Voice scorer calibration (Steps 1–4).
 *
 * Step 1: Score KNOWN_STRONG corpus (≥50 published Gemini articles from DB).
 * Step 2: Score KNOWN_WEAK corpus (5 Cerebras pilot bodies + 1 Ebon Hawk placeholder).
 * Step 3: Print score distributions + suggested threshold.
 * Step 4: Write docs/voice-scorer-calibration.md.
 * Step 5: Abhinav reads output and signs off (not this script's job).
 *
 * Run:
 *   npx tsx --env-file=.env.local scripts/calibrate-voice-scorer.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { getSecret } from '../src/lib/get-secret';
import { scoreVoice, runHardRules, type VoiceScoreResult } from './score-voice';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY   = getSecret('SUPABASE_SERVICE_ROLE_KEY')!;
const GEMINI_KEY    = getSecret('GEMINI_API_KEY')!;
const CEREBRAS_KEY  = getSecret('CEREBRAS_API_KEY');
const DELAY_MS      = 8000; // 7.5 calls/min — under Gemini 10 RPM; burst 429s handled by backoff in scoreVoiceJudge

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// ── KNOWN_WEAK — Cerebras pilot bodies (docs/cerebras-pilot-report.md) ────────
// These are the 5 Cerebras-generated bodies from the June 19 pilot, plus a
// placeholder for the Ebon Hawk Cerebras body (auto-published and subsequently
// deleted; draft_body was null in pending_drafts id 65938a12; smoke-test run
// log 28256415673 shows only metadata, not body text — slot left for manual fill).

const KNOWN_WEAK: Array<{ label: string; body: string; format: 'news' | 'review' }> = [
  {
    label: '93a23b18 — NYC Architecture (Cerebras)',
    format: 'news',
    body: `Your wallet just got a postcard from Manhattan and it's demanding ₹14,999. That's enough to make even a seasoned brick‑collector pause for a breath. LEGO's Architecture line is about to add its own slice of the skyline with set 21066 New York – The Big Apple, and the numbers are already doing the heavy lifting.

The official press release rolls out the basics: 1,465 pieces, rated for ages 18+, and a retail tag of $139.99 (≈ ₹14,999 in India). The build mirrors the sleek silhouette of the Paris – City of Love set (21064) but swaps the Eiffel Tower for the Statue of Liberty, the Empire State Building, and other iconic silhouettes that define the city that never sleeps. It's a collectable aimed squarely at adults who love architecture, travel, or simply the idea of holding a miniature Manhattan on a coffee table.

Global availability kicks off on LEGO.com on 1 June, which means the Indian market will see a short lag. Brick‑fans in India should keep an eye on two main retailers. MyBrickHouse has already posted a price of ₹14,999, though the stock status is currently uncertain. Toycra hasn't listed a price yet, but they'll likely follow suit once the global launch is confirmed. As always, the Toycra affiliate code is handy: use ABHINAV12 for 12 % off on orders above ₹500.

From a practical standpoint, the set sits in a familiar price band for Architecture releases, but the piece count is on the higher side for the line. Expect a moderate build time—roughly a weekend if you're treating it like a weekend project rather than a marathon. The design intent is clear: a sleek, modern representation rather than a brick‑by‑brick replica of every borough. That means the set will look good on a shelf, but it won't replace a city‑scale model if you're after that level of detail.

If you're already budgeting for the next LEGO purchase, consider the timing. The set lands in June globally, so Indian stores will likely start shipping in late June or early July. By then, the initial excitement may have settled, and retailers could offer early‑bird discounts. Until then, keep the set on your watchlist, compare prices, and maybe set a reminder for when the first deals appear.

<!-- INDIA_PARAGRAPH -->
At ₹14,999 (may be out of stock).
MyBrickHouse lists it for ₹14,999 — check MyBrickHouse for availability. Toycra is also expected; use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.
Expect a 4–6 week lag from the global launch on 1 June.
That's about 12 months of Spotify Premium.
<!-- /INDIA_PARAGRAPH -->

Verdict: WAIT. Good set, but the price will drop.`,
  },
  {
    label: '397ae761 — Horse Stable Review (Cerebras)',
    format: 'review',
    body: `Your wallet just whispered, "Brace yourself for another Friends set," and the price tag it's eyeing is ₹8,499. That's the kind of number that makes you pause at the checkout but also wonder if you can squeeze a few extra rides into the weekend.

The LEGO Horse Stable and Riding Academy (42688) is the newest entry in the ever‑repeating summer wave of Friends. If you've been following the line, you'll recognise the pattern: two waves a year, bright pink bricks, and at least one set that brings horses into the mix. This set promises exactly that – a stable, a riding arena, and the colourful vibe the Friends theme is known for. No surprise there, but the question is whether the execution lives up to the hype.

From the teaser images, the set looks like a tidy, kid‑friendly stable with a modest number of bricks. The colour palette is unmistakably Friends – lots of pink, teal, and a splash of sunny yellow. The horses themselves are built in that stylised LEGO fashion, which always feels a touch whimsical but never veers into the uncanny. The design appears to be geared toward younger builders, with larger, easy‑to‑handle pieces and a straightforward building sequence. That makes it a solid candidate for a weekend project for kids aged six to ten, or for anyone who wants a quick, satisfying build without a massive instruction scroll.

One of the strengths of this set is its playability. The stable doors open, the riding arena can be arranged in a couple of ways, and the horses can be swapped between the stalls. The set also includes a few minifigures that fit the Friends aesthetic – a rider, a trainer, and a couple of friends to cheer on the equestrian action. While the exact minifig count isn't disclosed in the review, the Friends line traditionally includes three to four characters per set, so expectations should be modest.

If you're a collector, the set adds a niche piece to the Friends portfolio: a horse‑centric theme that hasn't been explored in depth before. It's not a massive flagship model, but it fills a gap for those who want a tidy, animal‑focused addition without breaking the bank. The piece count, while not announced, is likely in the lower‑mid range, meaning the set won't dominate your display shelf but can sit comfortably alongside larger Friends builds.

The price point of ₹8,499 is strikingly low for a LEGO set that includes a stable, riding arena, and minifigures. For context, many mid‑range LEGO sets hover around ₹10,000‑₹15,000, so this one feels like a bargain. The affordability makes it an easy impulse buy for parents looking to add variety to their child's collection, or for adult fans who want a small, nostalgic build without committing a big chunk of cash.

From a build perspective, the set promises a quick assembly that can be completed in under an hour, which is ideal for a rainy afternoon or a quick play‑session. The instructions are expected to be clear and colourful, matching the Friends brand's reputation for kid‑friendly guidance. The set also serves as a gateway for younger builders to get comfortable with LEGO mechanics before moving on to more complex models.

In short, the LEGO Horse Stable and Riding Academy delivers what it promises: a bright, horse‑filled Friends set that is easy to build, fun to play with, and gentle on the wallet. The combination of low price, modest size, and the charm of the Friends theme makes it a solid addition to any LEGO household. If you've been waiting for a horse‑themed Friends set, this is the moment to click "add to cart" before the stock runs out.

<!-- INDIA_PARAGRAPH -->
At ₹8,499, that's about 10 months of Spotify Premium.
MyBrickHouse lists the set for ₹8,499.
Toycra also lists it for ₹8,499.
Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.
<!-- /INDIA_PARAGRAPH -->

Verdict: BUY NOW. The price is right — grab it.`,
  },
  {
    label: 'babc160d — Volvo FH Machine-moving (Cerebras)',
    format: 'news',
    body: `Your wallet just heard the roar of a Volvo FH and it's already sweating. The idea of a minifig‑scale haulier hauling massive machinery is enough to make any brick‑lover pause and check the bank balance.

Ralph Savelsberg of The Brothers Brick (TBB) is back at it. Known for his meticulous truck builds, he's taken on a brand‑new challenge: a Volvo FH model, painted in the livery of British haulier Rawcliffe & Sons. The blog post, titled "Machine‑moving machine", shows a sleek, dark‑blue cab with realistic headlights, a massive sleeper cabin, and a set of detachable trailers that can carry everything from cranes to cargo containers.

What makes this build stand out isn't just the paint scheme. Savelsberg has engineered the truck to be fully functional in minifig scale – the trailer hooks lock into place, the doors open, and the cab can be driven across a custom‑built loading dock. The level of detail rivals many official LEGO Technic sets, and the parts list reads like a wish‑list for any serious Technic collector.

Fans are already speculating whether this could be a sign of an upcoming official Volvo set. LEGO has released a few hauler models in the past, but nothing quite this big. Until an official announcement lands, the only way to get your hands on a similar build is to source the parts yourself or wait for a third‑party kit to appear on the market.

For Indian LEGO fans, the lack of an official set means you'll have to look at importing the pieces or building the model from scratch. The price tag is still a mystery – TBB didn't disclose any cost, and no Indian retailer has listed a price. Expect the usual import‑only scenario: you'll need to piece together the bricks, possibly from MyBrickHouse's spare‑parts catalog, or wait for a niche vendor to release a kit.

The build also highlights a growing trend: fan‑made Technic creations are pushing the boundaries of what LEGO can do in the real‑world vehicle space. Whether you're a collector, a builder, or just someone who enjoys a good truck, Savelsberg's Volvo FH is worth a look. It's a reminder that the line between fan imagination and official LEGO can be thinner than a minifig's antenna.

<!-- INDIA_PARAGRAPH -->
Estimated import price: around ₹30,000–35,000. Check MyBrickHouse for availability. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. Expect a 4–6 week lag from global launch. If this were officially sold in India, it would cost roughly the same as 18 months of Netflix — assuming LEGO India's usual enthusiasm for your wallet.
<!-- /INDIA_PARAGRAPH -->

Verdict: IMPORT ONLY. Not in Indian stores — grey market or wait.`,
  },
  {
    label: '76476d96 — LEGO Leaks YouTube stress-test (Cerebras)',
    format: 'news',
    body: `Your wallet just heard a whisper about fresh LEGO leaks and it's already sweating. A new YouTube compilation dropped on May 19, and it's packed with quick flashes of upcoming Ideas builds, a few Pokémon silhouettes, some DC hero gear, and a couple of Architecture skyline sketches. Nothing concrete, just the usual tease‑and‑run that leak videos love to serve.

The video runs a tight 3‑minute montage, switching between glossy renders and a handful of close‑ups that barely reveal a brick pattern. The host (the channel that posted the clip) points to a bright yellow brick that could belong to a new Pokémon set, then flips to a dark‑green silhouette that might be a DC villain's lair. There's also a sweeping shot of a skyline that looks like it could be a future Architecture entry – perhaps a cityscape or a landmark, but the camera never lingers long enough to read any set number.

What's useful here is the thematic spread. LEGO's Ideas line has been pushing fan‑designed models into the mainstream, and the leak hints at another fan‑voted project, though the specifics remain hidden behind a blur. Pokémon fans will recognise the iconic Pokéball shape, but until LEGO confirms a part number, it stays in the realm of hopeful speculation. DC lovers get a quick glimpse of a caped figure, but again, no identifiable markings. Architecture enthusiasts can only guess whether we're looking at a new world‑heritage site or a modern skyscraper.

The usual leak‑to‑reality conversion applies: roughly half of these teasers never become official sets, and the ones that do often look very different from the early renders. Still, the variety suggests LEGO is keeping its pipeline busy across multiple licenses, which is good news for collectors who like to hop between genres.

Keep your expectations in check, and treat this video as a mood board rather than a definitive announcement. When the official reveal arrives, we'll have the numbers, the pricing, and the exact themes to break down. Until then, the best you can do is enjoy the speculation and maybe start a wishlist for the ideas you think might finally make the cut.

<!-- INDIA_PARAGRAPH -->
Based on typical LEGO retail pricing and current exchange rates, a leaked set could land somewhere around ₹30,000–35,000 when it arrives in India.
MyBrickHouse and Toycra are the stores to watch; check MyBrickHouse for availability and use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.
Expect a 4–6 week lag after the global launch before it appears locally.
That would be about 11 months of Netflix Premium.
<!-- /INDIA_PARAGRAPH -->

Verdict: WAIT. Good set, but the price will drop.`,
  },
  {
    label: '84dc3c23 — May 2 reveals YouTube stress-test (Cerebras, LINT FAIL)',
    format: 'news',
    body: `Your wallet just heard the May 2 reveal and is already asking for a loan. The teaser rolls out city streets, Creator builds, and a Chinese Festival, and your bank account is bracing for impact. The LEGO May 2 reveals part 1 video dropped on the official LEGO YouTube channel, and it's a rapid‑fire walk‑through of what the company is lining up for the next few months.

In under three minutes the presenter flips through a cityscape that looks like a downtown boulevard, a Creator 3‑in‑1 build that promises modular flexibility, and a festive Chinese New Year set that glitters with lanterns. The clip also teases a new train line, a pirate ship with a twist, a van that could double as a mobile café, and a coaster that looks ready for a theme‑park splash.

None of those builds come with a set number, piece count, or retail price. The video is deliberately vague – just enough to get the community buzzing. That means we have to treat it like any other leak: exciting, but not a guarantee. LEGO often shows concepts that never make it past the concept stage, and when they do, the final product can look very different from the early render.

What we can glean is that LEGO is pushing three distinct directions. The city theme suggests more urban modular sets, likely aimed at older builders who want realistic streetscapes. The Creator hints at the continued push for versatile builds that can be re‑imagined. And the Chinese Festival piece is a clear nod to the growing Asian market, where cultural celebrations are becoming a staple in the product line.

For Indian fans, the lack of concrete numbers means you can't price‑check yet. Keep an eye on official LEGO announcements and the upcoming LEGO Summer Catalog for the exact details. In the meantime, if you're itching for a new set, the current lineup still has plenty to keep you busy while you wait for the official release dates.

<!-- INDIA_PARAGRAPH -->
No Indian store prices yet. Based on typical LEGO pricing, expect these upcoming releases to land somewhere around ₹30,000–35,000 each when they arrive.
That is roughly 12 months of Spotify Premium.
MyBrickHouse and Toycra are the stores to watch — use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.
Expect a 4–6 week lag from global launch.
<!-- /INDIA_PARAGRAPH -->

Verdict: WAIT. Good set, but the price will drop.`,
  },
  {
    // Ebon Hawk Cerebras body (smoke-test run 28256415673) — UNAVAILABLE.
    // auto-publish path skipped saving draft_body to pending_drafts (id 65938a12).
    // Article was subsequently deleted from the live site (status=rejected).
    // Run log 28256415673 shows only metadata: wordCount=429 verdict=IMPORT ONLY.
    // FILL IN THIS BODY MANUALLY before running calibration, or remove this entry.
    label: 'Ebon Hawk — Cerebras smoke-test (BODY UNAVAILABLE — fill in manually)',
    format: 'news',
    body: 'PLACEHOLDER — paste the Ebon Hawk Cerebras body here before running',
  },
];

// ── Fetch KNOWN_STRONG from published news_articles ───────────────────────────

async function fetchKnownStrong(limit = 60): Promise<Array<{ label: string; body: string; format: 'news' }>> {
  const PAGE = 1000;
  const results: Array<{ label: string; body: string; format: 'news' }> = [];
  for (let offset = 0; results.length < limit; offset += PAGE) {
    const { data, error } = await sb
      .from('news_articles')
      .select('slug, title, content')
      .not('content', 'is', null)
      .order('published_at', { ascending: false })
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const row of data) {
      if (results.length >= limit) break;
      const body = (row.content as string).trim();
      // Skip very short articles (stubs/errors)
      if (body.length < 400) continue;
      results.push({ label: row.slug as string, body, format: 'news' });
    }
    if (data.length < PAGE) break;
  }
  return results;
}

// ── Run a single article through the scorer ───────────────────────────────────

interface CalibrationEntry {
  label: string;
  cohort: 'strong' | 'weak';
  hardRulesPass: boolean;
  hardFailRules: string[];
  total: number | null;
  scores: Record<string, number> | null;
  flags: string[];
  judgeProvider: string | null;
  judgeError: string | null;
}

async function scoreOne(
  label: string,
  body: string,
  format: 'news' | 'review',
  cohort: 'strong' | 'weak',
): Promise<CalibrationEntry> {
  const result: VoiceScoreResult = await scoreVoice(
    body,
    format,
    'https://bricksofindia.com',  // source URL stub — A8 doesn't apply to calibration
    body.slice(0, 500),           // source excerpt stub for Cerebras eligibility
    GEMINI_KEY,
    CEREBRAS_KEY,
  );
  return {
    label,
    cohort,
    hardRulesPass: !result.hardFail,
    hardFailRules: result.hardRules.filter(r => !r.pass).map(r => `${r.id}: ${r.reason ?? 'FAIL'}`),
    total: result.total,
    scores: result.scores as Record<string, number> | null,
    flags: result.flags,
    judgeProvider: result.judgeProvider,
    judgeError: result.judgeError,
  };
}

// ── Statistics helpers ────────────────────────────────────────────────────────

function stats(values: number[]): { mean: number; p10: number; p25: number; p50: number; p75: number; p90: number; min: number; max: number } {
  if (values.length === 0) return { mean: 0, p10: 0, p25: 0, p50: 0, p75: 0, p90: 0, min: 0, max: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const pct = (p: number) => sorted[Math.min(Math.floor(sorted.length * p / 100), sorted.length - 1)];
  const mean = Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length);
  return { mean, p10: pct(10), p25: pct(25), p50: pct(50), p75: pct(75), p90: pct(90), min: sorted[0], max: sorted[sorted.length - 1] };
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  console.log('━━ CRITICAL-4 Part C — Voice scorer calibration ━━━━━━━━━━━━━━━━━━━━━━━');
  if (!GEMINI_KEY) { console.error('Missing GEMINI_API_KEY'); process.exit(1); }
  if (!SUPABASE_URL || !SERVICE_KEY) { console.error('Missing Supabase credentials'); process.exit(1); }

  // Warn if Ebon Hawk placeholder is still unfilled
  const ebonHawk = KNOWN_WEAK.find(w => w.body.startsWith('PLACEHOLDER'));
  if (ebonHawk) console.warn('\nWARN: Ebon Hawk body is still a placeholder — scoring 5 weak articles, not 6.\n');

  const weakToScore = KNOWN_WEAK.filter(w => !w.body.startsWith('PLACEHOLDER'));

  console.log('Step 1: Fetching KNOWN_STRONG from DB...');
  const strong = await fetchKnownStrong(60);
  console.log(`  Fetched ${strong.length} published articles.\n`);

  const results: CalibrationEntry[] = [];

  console.log('Step 2a: Scoring KNOWN_STRONG...');
  for (let i = 0; i < strong.length; i++) {
    const s = strong[i];
    process.stdout.write(`  [${i + 1}/${strong.length}] ${s.label.slice(0, 60)}... `);
    const entry = await scoreOne(s.label, s.body, s.format, 'strong');
    console.log(`total=${entry.total ?? 'ERR'} provider=${entry.judgeProvider ?? 'none'}`);
    results.push(entry);
    if (i < strong.length - 1) await new Promise(r => setTimeout(r, DELAY_MS));
  }

  console.log('\nStep 2b: Scoring KNOWN_WEAK...');
  for (let i = 0; i < weakToScore.length; i++) {
    const w = weakToScore[i];
    process.stdout.write(`  [${i + 1}/${weakToScore.length}] ${w.label.slice(0, 60)}... `);
    const entry = await scoreOne(w.label, w.body, w.format, 'weak');
    console.log(`total=${entry.total ?? 'ERR'} provider=${entry.judgeProvider ?? 'none'}`);
    results.push(entry);
    if (i < weakToScore.length - 1) await new Promise(r => setTimeout(r, DELAY_MS));
  }

  // ── Step 3: Analysis ────────────────────────────────────────────────────────

  const strongScored = results.filter(r => r.cohort === 'strong' && r.total !== null).map(r => r.total!);
  const weakScored   = results.filter(r => r.cohort === 'weak'   && r.total !== null).map(r => r.total!);

  const strongStats = stats(strongScored);
  const weakStats   = stats(weakScored);

  // Suggested threshold: midpoint between weak p75 and strong p25
  const suggestedThreshold = weakStats.p75 !== null && strongStats.p25 !== null
    ? Math.round((weakStats.p75 + strongStats.p25) / 2)
    : null;

  console.log('\n━━ SCORE DISTRIBUTIONS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`STRONG (n=${strongScored.length}): min=${strongStats.min} p10=${strongStats.p10} p25=${strongStats.p25} median=${strongStats.p50} p75=${strongStats.p75} p90=${strongStats.p90} max=${strongStats.max} mean=${strongStats.mean}`);
  console.log(`WEAK   (n=${weakScored.length}): min=${weakStats.min} p10=${weakStats.p10} p25=${weakStats.p25} median=${weakStats.p50} p75=${weakStats.p75} p90=${weakStats.p90} max=${weakStats.max} mean=${weakStats.mean}`);
  if (suggestedThreshold !== null) console.log(`Suggested threshold (weak‑p75 + strong‑p25) / 2 = ${suggestedThreshold}`);

  // Hard-rule failure rates
  const strongHardFail = results.filter(r => r.cohort === 'strong' && !r.hardRulesPass).length;
  const weakHardFail   = results.filter(r => r.cohort === 'weak'   && !r.hardRulesPass).length;
  console.log(`\nHard-rule failures: STRONG ${strongHardFail}/${results.filter(r => r.cohort === 'strong').length}, WEAK ${weakHardFail}/${results.filter(r => r.cohort === 'weak').length}`);

  // ── Step 4: Write calibration report ────────────────────────────────────────

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const lines: string[] = [
    '# Voice Scorer Calibration Report',
    '',
    `**Run:** ${now} UTC`,
    `**KNOWN_STRONG:** ${strongScored.length} articles scored (${results.filter(r => r.cohort === 'strong').length} attempted)`,
    `**KNOWN_WEAK:** ${weakScored.length} articles scored (${results.filter(r => r.cohort === 'weak').length} attempted)`,
    '',
    '## Score distributions',
    '',
    '| Cohort | n | min | p10 | p25 | median | p75 | p90 | max | mean |',
    '|---|---|---|---|---|---|---|---|---|---|',
    `| STRONG | ${strongScored.length} | ${strongStats.min} | ${strongStats.p10} | ${strongStats.p25} | ${strongStats.p50} | ${strongStats.p75} | ${strongStats.p90} | ${strongStats.max} | ${strongStats.mean} |`,
    `| WEAK   | ${weakScored.length} | ${weakStats.min} | ${weakStats.p10} | ${weakStats.p25} | ${weakStats.p50} | ${weakStats.p75} | ${weakStats.p90} | ${weakStats.max} | ${weakStats.mean} |`,
    '',
    suggestedThreshold !== null ? `**Suggested Gate 7 threshold:** ${suggestedThreshold} (midpoint of weak‑p75 and strong‑p25)` : '_Threshold cannot be computed — check scoring errors below._',
    '',
    '## Hard-rule failures',
    '',
    `| Cohort | Hard-fail count | Total |`,
    `|---|---|---|`,
    `| STRONG | ${strongHardFail} | ${results.filter(r => r.cohort === 'strong').length} |`,
    `| WEAK | ${weakHardFail} | ${results.filter(r => r.cohort === 'weak').length} |`,
    '',
    '## Per-article results',
    '',
    '| Cohort | Label | Hard pass | Total | v_anchor | wallet | india_para | hook | humour | signoff | Judge | Error |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|',
  ];

  for (const r of results) {
    const s = r.scores;
    const cols = [
      r.cohort,
      r.label.slice(0, 55),
      r.hardRulesPass ? 'Y' : `N (${r.hardFailRules.join('; ').slice(0, 60)})`,
      r.total ?? '-',
      s?.voice_anchor ?? '-',
      s?.wallet_craft ?? '-',
      s?.india_paragraph_rhythm ?? '-',
      s?.opening_hook ?? '-',
      s?.humour_engine ?? '-',
      s?.signoff_craft ?? '-',
      r.judgeProvider ?? '-',
      (r.judgeError ?? '').slice(0, 50) || '-',
    ];
    lines.push(`| ${cols.join(' | ')} |`);
  }

  lines.push('', '## Scoring errors', '');
  const errors = results.filter(r => r.judgeError);
  if (errors.length === 0) {
    lines.push('None.');
  } else {
    for (const e of errors) {
      lines.push(`- **${e.label}**: ${e.judgeError}`);
    }
  }

  lines.push('', '## Step 5 — Sign-off', '', '_Abhinav: review the distributions above. If the suggested threshold looks right, update `score-voice.ts` with `GATE7_THRESHOLD = <n>` and wire into `generate-with-failover.ts`. Mark CRITICAL-4 closed in the tracker._', '');

  const outPath = path.join(process.cwd(), 'docs', 'voice-scorer-calibration.md');
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log(`\nStep 4 complete → ${outPath}`);
  console.log('Step 5: Abhinav reads the report and signs off.\n');
})().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
