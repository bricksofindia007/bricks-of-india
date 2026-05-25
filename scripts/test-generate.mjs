#!/usr/bin/env node
// Test script — runs generateArticle logic against one approved pending_drafts row.
// Prints the first 3 paragraphs for voice review. Does NOT write to DB.
// Usage: node scripts/test-generate.mjs

import 'dotenv/config';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// ── Prompt constants (must match actions.ts exactly) ─────────────────────────

const FORMAT_ADDENDUM = {
  news: `
---
FORMAT RULES — NEWS:
• 300–400 words in BODY (hard cap 500). Count them. Stop at 400.
• Headline: present-tense verb, no clickbait ("LEGO Releases", "Price Drops", not "You Won't Believe")
• Structure: Hook → Context → India angle → Verdict line
• No sign-off. Ends on a punchy standalone sentence.`,
  review: `
---
FORMAT RULES — REVIEW:
• 500–700 words in BODY (hard cap 900). Count them. Stop at 700.
• Headline: set name + number + one punchy descriptor ("The ₹19k Question")
• Structure: Hook → Build quality → Playability → India price context → Verdict
• Close with the canonical sign-off: "...and don't let your wallet see your LEGO wishlist."`,
  opinion: `
---
FORMAT RULES — OPINION:
• 400–500 words in BODY (hard cap 700). Count them. Stop at 500.
• Headline: provocative statement or question (first person or direct address)
• Structure: Thesis → Evidence → Escalation → Collapse → Call to action
• Close with the canonical sign-off or a punchy variation.`,
};

const INDIA_PARAGRAPH_SPEC = `
---
INDIA PARAGRAPH SPEC — MANDATORY:
Place <!-- INDIA_PARAGRAPH --> on its own line immediately before this block. Write the block as normal prose.
Must contain:
(a) INR price: USD MSRP × 1.35 × current USD/INR rate. Show working.
(b) Availability: which stores (Toycra, MyBrickHouse, Jaiman) or "import only".
(c) India lag: 4–6 week delay or "no official India launch".
(d) One relatable Indian comparison (biryani plates, Spotify months, EMI, etc.).`;

const VOICE_EXAMPLES = `
---
STRUCTURAL REQUIREMENTS — NON-NEGOTIABLE:
1. WALLET IN PARAGRAPH 1. The wallet appears as a sentient character in the opening paragraph. Not paragraph 2. Not the conclusion. Paragraph 1. It is the Watson to your Clarkson Holmes.
2. INDIA PARAGRAPH. Every article must contain the <!-- INDIA_PARAGRAPH --> block. See INDIA PARAGRAPH SPEC above — INR price with working shown, store availability, 4–6 week lag, one relatable Indian comparison. This block is mandatory. A draft without it is discarded.
3. BEAT STRUCTURE. Long sentence that sets the scene with specificity. Short sentence. For impact. Then pivot. Never three long sentences building to a point — land it in one, then move.

NEVER DO THIS — VOICE KILLERS:
• NEVER direct audience address: "my friends", "folks", "let's be honest", "brace yourselves" — Clarkson is aloof, not folksy
• NEVER PR adjectives: "unbridled creativity", "plastic artistry", "plastic immortality", "passion projects", "palpable excitement", "stunning", "breathtaking"
• NEVER build across 3 sentences to a point — land it in sentence 1, then move on
• NEVER explain the setup — drop the reader into the middle of an already-moving situation
• NEVER open with: "LEGO has announced", "In a surprise move", "[Set] is a [theme] set with X pieces"

VOICE EXAMPLES — EXACT TEXT FROM BOI SCRIPTS (adapt the pattern; never copy the content):

EXAMPLE 1 — WALLET ANXIETY OPENER (target register for paragraph 1 of a review):
"Today, we are reviewing a set that I bought for my daughter… except that she doesn't know that yet, and frankly, I am not sure if she ever will either, so moving on. What happens when the small harmless LEGO car grows up and starts asking for more money?"
→ Wallet + family foil + Clarkson personification in two sentences. The wallet is present from word one.

EXAMPLE 2 — BEAT STRUCTURE (this rhythm must run through the whole article):
"Today, I will build the Taj Mahal in LEGO. This is not hubris. This is not overconfidence. This is, in fact, a significant underestimation of my abilities. The Taj Mahal took 22 years and 20,000 workers. I expect to be done by lunch.

It is now dinner. I have completed one wall."
→ Long sentence. Short ones. Then a pivot. Then a single brutal short landing. State it. Stop.

EXAMPLE 3 — INDIAN COMPARISON (use in India Paragraph and throughout — analogy must be true, not decorative):
"Buying non-LEGO replicas is like buying pani puri from a roadside stall: thrilling, but you're never quite sure what you'll get."
→ Indian-specific. Food-grounded. The comparison earns its place because it is accurate.

EXAMPLE 4 — BUILD → ESCALATE → COLLAPSE (for opinion sequences and mid-article pivots):
"I added sets to my cart. Then I waited. I let them sit there like samosas cooling on the plate. I asked myself: 'Do I really want this? Or am I just high on dopamine and Diwali lights?' More often than not, I removed them. Because impulse is the enemy of strategy."
→ Discipline narrative. Absurd specificity. Self-aware collapse. Wallet-anxiety engine at full throttle.

APPROVED WALLET VOCABULARY — weave at least one into paragraph 1:
"your wallet officially stops speaking to you"
"where adult money meets childhood happiness"
"that's a very dangerous place for your wallet"
"may the MRP gods have mercy on your wallet"
"don't let your wallet see your LEGO wishlist"
"₹6,000 for this set. It should come with a therapist and a chai delivery service."
"your wallet vs childhood happiness"`;

const ANTI_PATTERNS = `
---
ANTI-PATTERNS — DO NOT USE:
• "Hello Brickfans" / host introduction of any kind
• "Bubyee" / YouTube sign-offs — website ends "On that bombshell..." only
• Source site's framing ("today's random set", "today we're talking about")
• Asserting ungrounded facts (piece counts, themes, dates not in SOURCE)
• "my friends" / "folks" — Clarkson register is aloof, not folksy
• Do not announce what you are about to do. Just do it.`;

const OUTPUT_FORMAT = `
---
OUTPUT FORMAT — NON-NEGOTIABLE:
Your entire response MUST be wrapped in exactly these markers.
No text before the opening marker. No text after the closing marker.
If the markers are absent or malformed, the article is discarded automatically.

--- BOI_DRAFT_START ---
FORMAT: <format>
TITLE: <your title>
VERDICT: <BUY | WAIT FOR SALE | IMPORT ONLY | SKIP | NONE>

BODY:
<article body — place <!-- INDIA_PARAGRAPH --> on its own line immediately before the India Paragraph block>
--- BOI_DRAFT_END ---`;

// ── Main ──────────────────────────────────────────────────────────────────────

const { data: drafts } = await supabase
  .from('pending_drafts')
  .select('id, source_url, source_title, source_excerpt, source_published_at, draft_format')
  .eq('status', 'approved')
  .not('draft_format', 'is', null)
  .limit(3);

if (!drafts?.length) {
  console.error('No approved pending_drafts rows found.');
  process.exit(1);
}

const draft = drafts[0];
console.log(`\nUsing draft ID ${draft.id}: "${draft.source_title}"\nFormat: ${draft.draft_format}\nURL: ${draft.source_url}\n`);

const format     = draft.draft_format || 'news';
const content    = draft.source_excerpt || draft.source_title || '(no content available)';
const wordTarget = { news: '300–400', review: '500–700', opinion: '400–500' }[format] || '300–400';
const setNumber  = (draft.source_url || '').match(/\/sets\/(\d{4,5})-/)?.[1] ?? null;
const setLine    = setNumber
  ? `Set number: ${setNumber} (include in title per format rules)`
  : `Set number: NOT FOUND — use India context in title instead`;

const codexPath = join(root, 'docs/codex/BOI_Codex_v2.md');
const codex     = existsSync(codexPath) ? readFileSync(codexPath, 'utf8') : '';

const systemPrompt = VOICE_EXAMPLES + ANTI_PATTERNS + (FORMAT_ADDENDUM[format] || FORMAT_ADDENDUM.news) + INDIA_PARAGRAPH_SPEC + codex + OUTPUT_FORMAT;

const userPrompt = `Write a BOI-voice ${format} article. Target: ${wordTarget} words in body.
IMPORTANT: Use the exact --- BOI_DRAFT_START --- / --- BOI_DRAFT_END --- markers. No text outside them.

SOURCE:
Title     : ${draft.source_title}
URL       : ${draft.source_url}
Published : ${draft.source_published_at || 'unknown'}
${setLine}
Excerpt: ${content}

--- BOI_DRAFT_START ---
FORMAT: ${format}
TITLE: <your title>
VERDICT: <BUY | WAIT FOR SALE | IMPORT ONLY | SKIP | NONE>

BODY:
<article body — place <!-- INDIA_PARAGRAPH --> before the India Paragraph block>
--- BOI_DRAFT_END ---`;

const genai  = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const result = await genai
  .getGenerativeModel({ model: 'gemini-2.5-flash-lite', systemInstruction: systemPrompt })
  .generateContent({
    contents         : [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig : { temperature: 0.7, maxOutputTokens: 2000 },
  });

const rawText = result.response.text();
const si = rawText.indexOf('--- BOI_DRAFT_START ---');
const ei = rawText.indexOf('--- BOI_DRAFT_END ---');

if (si === -1 || ei === -1) {
  console.error('ERROR: Gemini response missing BOI_DRAFT markers.\n\nRaw output:\n', rawText);
  process.exit(1);
}

const inner = rawText.slice(si + '--- BOI_DRAFT_START ---'.length, ei).trim();
let inBody = false;
const bodyLines = [];

for (const line of inner.split('\n')) {
  if (!inBody) {
    if (line.startsWith('TITLE:'))   console.log('TITLE:  ', line.slice(6).trim());
    if (line.startsWith('VERDICT:')) console.log('VERDICT:', line.slice(8).trim());
    if (line.trim() === 'BODY:')     inBody = true;
  } else {
    bodyLines.push(line);
  }
}

const body = bodyLines.join('\n').trim();
const paragraphs = body.split(/\n\n+/).filter(p => p.trim() && !p.trim().startsWith('<!--'));

console.log('\n─────────────────────────────────────────────────────────────');
console.log('FIRST 3 PARAGRAPHS:');
console.log('─────────────────────────────────────────────────────────────\n');
paragraphs.slice(0, 3).forEach((p, i) => {
  console.log(`[${i + 1}] ${p.trim()}\n`);
});
const hasIndiaBlock = body.includes('<!-- INDIA_PARAGRAPH -->');
console.log('─────────────────────────────────────────────────────────────');
console.log(`Total word count: ${body.split(/\s+/).filter(Boolean).length}`);
console.log(`India Paragraph marker present: ${hasIndiaBlock ? '✓ YES' : '✗ MISSING'}`);
