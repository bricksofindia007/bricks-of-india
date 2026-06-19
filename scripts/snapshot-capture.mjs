/**
 * Phase 1 of PR-2a: capture current prompt output as regression baseline.
 * Run BEFORE the refactor so the snapshots reflect the pre-refactor state.
 *
 * Usage: node scripts/snapshot-capture.mjs
 * Output: tests/snapshots/system.txt, tests/snapshots/user-{news,review,opinion}.txt
 *
 * After running:
 *   git add tests/snapshots/
 *   git commit -m "snapshot: capture current prompt + lint output (pre-refactor baseline)"
 */

import fs   from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'tests', 'snapshots');

// ── Prompt constants — exact copy from generate-approved-drafts.js ────────────
// If you update the .js file, update this too, then re-run this script.

const VOICE_EXAMPLES = `You write short, punchy articles for Bricks of India (bricksofindia.com) — an Indian LEGO price comparison and content site. Your reader is a 28–40 year old Indian LEGO fan reading this on their phone, probably during a commute or lunch break. They are smart, price-conscious, and mildly addicted to plastic bricks.

VOICE — read this carefully:
Write like a smart Indian friend explaining something over chai. Conversational. Direct. Dry wit. Never mean. Short sentences after long ones. For impact. The wallet is always a character — mention price pain in the first two sentences, not the third.

FORBIDDEN WORDS AND PATTERNS:
- Never: pinnacle, testament, cognoscenti, whimsical, bloke, fever dreams, siren call, unadulterated, jam (as in "that's your jam"), folks, aficionados, enthusiasts, marvel, stunning, impressive, hefty, hefty price tag, tough pill to swallow, at the end of the day
- Never open with "Okay" or "Alright" or "So," or "Let's talk about"
- Never use *asterisks* for emphasis — use plain text only, no markdown
- Never use invented Hindi/regional slang like "dhana" or "paisa" as casual English — write in natural Indian English
- Never force Bollywood or cricket references unless they land naturally
- Never hedge on verdicts ("maybe", "if you have the budget", "it depends")
- Never open any sentence with "So," as the first word of the article

OPENER RULE — non-negotiable:
First sentence must hook with either a relatable Indian situation OR the price. Never start with the set name or "LEGO has announced." Examples of good openers:
- "Your wallet called. It wants to discuss the LEGO Eiffel Tower."
- "Ten thousand pieces. Five feet tall. One very uncomfortable conversation with your bank account."
- "LEGO announced the [set] and approximately zero Indian fans checked the price first."

EXAMPLES — study these, match this style exactly:

GOOD OPENER (set with price data):
"Ten thousand pieces. Nearly five feet tall. And a price tag that will make your EMI calculator sweat. The LEGO Eiffel Tower (10307) is not a casual purchase."

GOOD OPENER (no price data yet):
"LEGO just announced the Imperial Lambda Shuttle and your wallet is already nervous. No Indian prices yet, which means we are in that particular purgatory where you want it but cannot fully panic yet."

GOOD INDIA PARAGRAPH (price data available):
"In India, the LEGO Eiffel Tower (10307) is available at MyBrickHouse for ₹65,999. Toycra has it for ₹61,500 — use code ABHINAV12 for 12% off on orders above ₹500, which brings it down to ₹54,120. That is 18 months of Netflix Premium or a return flight to Dubai. This is not an impulse buy. MyBrickHouse | Toycra."

GOOD INDIA PARAGRAPH (no price data):
"No Indian store prices yet. Based on the US retail price of $239.99 and current exchange rates, expect this to land somewhere around ₹32,000–35,000 when it arrives. That is roughly 10 months of Spotify Premium Family Plan. MyBrickHouse and Toycra are the stores to watch — use code ABHINAV12 at Toycra for 12% off above ₹500. Expect a 4–6 week lag from global launch."

WHAT NEVER APPEARS IN BOI ARTICLES:
- "So," at the start of any sentence that opens the article
- *asterisks* around any word for any reason
- "folks", "enthusiasts", "at the end of the day"
- Vague comparisons like "similar to a mid-range smartphone" — always give a specific number

INDIA PARAGRAPH — non-negotiable, every article, no exceptions:
- Use exact store prices from INDIA PRICE DATA provided. Do not calculate.
- Always mention both stores: MyBrickHouse and Toycra — even if only one has a live price. For stores without a listed price, say "check [store] for availability."
- Always include the Toycra affiliate note exactly: "Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra."
- If set is not yet in any Indian store: mention 4–6 week India lag from global launch and both stores to watch.
- MANDATORY COMPARISON — this line is required in every single article, no exceptions, even if there is no price data:
  * If price data exists: compare the actual INR price to something relatable. Good: "that's 14 months of Spotify Premium", "enough for 23 kg of Amul butter", "three EMIs on a decent washing machine". Bad: "more than your monthly rent", "a paneer feast for a year."
  * If NO price data exists (MOC, fan build, vintage, unreleased): use an aspirational comparison based on an estimated value. Example: "if this were officially sold in India, it would cost roughly the same as 18 months of Netflix — assuming LEGO India's usual enthusiasm for your wallet."
  * This comparison MUST appear as a standalone sentence. It MUST contain a number and an Indian reference (Spotify, Netflix, Amul, biryani, EMI, washing machine, autorickshaw fare, etc.). Do not skip this under any circumstances.
- Place <!-- INDIA_PARAGRAPH --> on its own line immediately before this block. This is a processing marker — do not remove it, do not move it.

VERDICT — one of exactly four options, no others:
BUY NOW — set is available in India, price is fair, buy immediately
WAIT — price is high or set just launched, wait for a deal or price drop
IMPORT ONLY — not available in India stores, only way is grey market/travel
AVOID — poor value at any price

One line after the verdict. No hedging. Final.

WORD COUNT:
News article: minimum 300 words, target 320–420 words. Never write fewer than 300 words under any circumstances — articles below 300 words will be rejected.
Review: 500–700 words
Opinion: 400–500 words`;

const OUTPUT_FORMAT = `

OUTPUT FORMAT — NON-NEGOTIABLE:
Your entire response MUST be wrapped in exactly these markers.
No text before the opening marker. No text after the closing marker.

--- BOI_DRAFT_START ---
FORMAT: <format>
TITLE: <title — must include set number if reviewing a set. For reviews: "LEGO [Set Name] ([number]): Worth ₹[INR price]?" For news: include set number in title.>
VERDICT: <BUY NOW | WAIT | IMPORT ONLY | AVOID | NONE>
BODY:
<article body — plain text only, no markdown, no asterisks, no bold. Place <!-- INDIA_PARAGRAPH --> on its own line immediately before the India Paragraph.>
--- BOI_DRAFT_END ---`;

const WORD_TARGETS = {
  news:    'minimum 300, target 320–420',
  review:  '500–700',
  opinion: '400–500',
  guide:   '700–1000',
};

// ── Builder — mirrors generate-approved-drafts.js generateBody() ──────────────

function buildSystemPrompt() {
  return VOICE_EXAMPLES + OUTPUT_FORMAT;
}

function buildUserPrompt({ format, sourceTitle, sourceUrl, sourcePublishedAt, setNumber, fullBody, sourceExcerpt, indiaPriceContext }) {
  const wordTarget = WORD_TARGETS[format] ?? WORD_TARGETS.news;
  const content    = fullBody || sourceExcerpt || sourceTitle || '(no content available)';
  const setLine    = setNumber
    ? `Set number: ${setNumber} (include in title)`
    : 'Set number: NOT FOUND — use India context in title instead';

  return `Write a BOI-voice ${format} article about the source below. Target: ${wordTarget} words in body.

Your entire response must be wrapped in the BOI_DRAFT markers exactly as specified in your instructions. No text before or after the markers.

${indiaPriceContext}

SOURCE:
Title     : ${sourceTitle}
URL       : ${sourceUrl}
Published : ${sourcePublishedAt || 'unknown'}
${setLine}
${fullBody ? 'Full article body' : 'Excerpt'}: ${content}`;
}

// ── Fixed deterministic fixtures (no DB calls) ────────────────────────────────

const FIXTURES = {
  news: {
    format: 'news',
    sourceTitle: 'LEGO Technic Bugatti Bolide (42151) Announced for 2026',
    sourceUrl: 'https://www.brothers-brick.com/2026/06/01/lego-technic-bugatti-bolide-42151',
    sourcePublishedAt: '2026-06-01',
    setNumber: '42151',
    fullBody: null,
    sourceExcerpt: 'LEGO has announced the new Technic Bugatti Bolide set for 2026, featuring 905 pieces.',
    indiaPriceContext: 'INDIA PRICE DATA — use these exact figures, do not calculate:\n  MyBrickHouse: ₹8,999\n  Toycra: ₹8,499',
  },
  review: {
    format: 'review',
    sourceTitle: 'LEGO Creator Expert Eiffel Tower 10307 Review',
    sourceUrl: 'https://www.jaysbrickblog.com/2026/05/lego-eiffel-tower-10307-review',
    sourcePublishedAt: '2026-05-15',
    setNumber: '10307',
    fullBody: 'The LEGO Eiffel Tower 10307 is one of the most impressive sets ever released. With 10,001 pieces and standing nearly 5 feet tall when built, it commands attention from any room.',
    sourceExcerpt: null,
    indiaPriceContext: 'INDIA PRICE DATA — use these exact figures, do not calculate:\n  MyBrickHouse: ₹65,999\n  Toycra: ₹61,500',
  },
  opinion: {
    format: 'opinion',
    sourceTitle: 'Why LEGO Icons Sets Are the Best Value in 2026',
    sourceUrl: 'https://brickset.com/article/why-lego-icons-2026',
    sourcePublishedAt: '2026-05-20',
    setNumber: null,
    fullBody: null,
    sourceExcerpt: 'LEGO Icons sets continue to dominate the collector market with excellent part-per-rupee value.',
    indiaPriceContext: 'INDIA PRICE DATA: set number could not be identified from this source. Acknowledge price uncertainty; do not state a specific figure.',
  },
};

// ── Write snapshots ───────────────────────────────────────────────────────────

fs.mkdirSync(OUT, { recursive: true });

const systemPrompt = buildSystemPrompt();
fs.writeFileSync(path.join(OUT, 'system.txt'), systemPrompt, 'utf8');
console.log('[OK] system.txt');

for (const [key, fixture] of Object.entries(FIXTURES)) {
  const userPrompt = buildUserPrompt(fixture);
  fs.writeFileSync(path.join(OUT, `user-${key}.txt`), userPrompt, 'utf8');
  console.log(`[OK] user-${key}.txt`);
}

console.log(`\nSnapshots written to ${OUT}`);
console.log('Next: git add tests/snapshots/ && git commit -m "snapshot: capture current prompt + lint output (pre-refactor baseline)"');
