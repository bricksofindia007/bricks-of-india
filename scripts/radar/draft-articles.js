'use strict';
/**
 * RADAR-04 drafter v2 — DEFECT-005 prompt iteration.
 *
 * Changes from v1 (each annotated to its DEFECT-005 finding):
 *   F7  — heuristic format classification before any Gemini call
 *   F1,F2,F6,F7 — format-specific system prompt addendum (word count, title
 *                 formula, opener/sign-off rules per format)
 *   F1,F2,F4 — anti-pattern list appended last in system prompt (recency effect)
 *   F3  — India Paragraph explicit 4-component template + <!-- INDIA_PARAGRAPH -->
 *   F5  — grounding rule (speculation-framed, not blanket silence)
 *   F6  — set number extracted from Brickset URL /sets\/(\d{4,5})-/ (not title regex)
 *   F3,F6 — BOI_DRAFT_START/END structured output + WORD_COUNT field; updated parser
 *
 * Run: node scripts/radar/draft-articles.js --label=day3-v2-attempt-1
 *  or: ITERATION_LABEL=day3-v2-attempt-1 node scripts/radar/draft-articles.js
 */

require('dotenv').config({ path: '.env.local' });

const fs   = require('fs');
const path = require('path');
const RSSParser              = require('rss-parser');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient }       = require('@supabase/supabase-js');

// ── Paths ─────────────────────────────────────────────────────────────────────
const FIXTURE_PATH = path.join(__dirname, 'test-fixture.xml');
const CODEX_PATH   = path.join(__dirname, '../../docs/codex/BOI_Codex_v2.md');

// ── Env + CLI ─────────────────────────────────────────────────────────────────
const GEMINI_API_KEY       = process.env.GEMINI_API_KEY;
const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Iteration label — explicit on every invocation. --label=<value> or ITERATION_LABEL env var.
const labelArg       = process.argv.find(a => a.startsWith('--label='));
const ITERATION_LABEL = labelArg
  ? labelArg.slice(8)
  : (process.env.ITERATION_LABEL || 'untagged');

if (!GEMINI_API_KEY)
  throw new Error('GEMINI_API_KEY is not set — add it to .env.local');
if (!SUPABASE_URL)
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
if (!SUPABASE_SERVICE_KEY)
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
if (!fs.existsSync(CODEX_PATH))
  throw new Error(`Codex file missing at ${CODEX_PATH} — critical dependency`);
if (!fs.existsSync(FIXTURE_PATH))
  throw new Error(`RSS fixture missing at ${FIXTURE_PATH} — run RADAR-04-PREP first`);

// ── Constants ─────────────────────────────────────────────────────────────────
const MODEL_NAME = 'gemini-2.5-flash-lite';

// ── Clients ───────────────────────────────────────────────────────────────────
const genai    = new GoogleGenerativeAI(GEMINI_API_KEY);
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Step 1 — Parse RSS fixture ────────────────────────────────────────────────
async function getFirstItem() {
  const parser = new RSSParser();
  const xml    = fs.readFileSync(FIXTURE_PATH, 'utf8');
  const feed   = await parser.parseString(xml);
  if (!feed.items || feed.items.length === 0)
    throw new Error('RSS fixture contains no items');
  const item = feed.items[0];
  return {
    title      : item.title || '',
    link       : item.link  || '',
    excerpt    : (item.contentSnippet || item.content || '').slice(0, 600),
    publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
  };
}

// ── Step 2 — Heuristic format classification (F7) ─────────────────────────────
// Cheap and deterministic. Gemini classifier deferred to a later iteration if
// heuristic proves insufficient on real feed diversity.
function classifyFormat(item) {
  const haystack = (item.title + ' ' + item.excerpt).toLowerCase();
  if (/\breview\b|hands.?on/.test(haystack))              return 'review';
  if (/\bopinion\b|should you|is it worth/.test(haystack)) return 'opinion';
  return 'news';
}

// ── Step 3 — Set number extraction from URL (F6) ──────────────────────────────
// Brickset set-page URLs contain /sets/NNNNN-N/ — deterministic, no false
// positives on years or prices. Article URLs (e.g. /article/131589) won't match.
function extractSetNumber(link) {
  const m = link.match(/\/sets\/(\d{4,5})-/);
  return m ? m[1] : null;
}

// ── Step 4 — System prompt construction (F1, F2, F3, F4, F5) ─────────────────
// Built as: Codex (full) + format addendum + India Paragraph spec +
//           grounding rule + anti-pattern list (last = recency effect).

const FORMAT_ADDENDUM = {
  news: `
---
FORMAT RULES — NEWS ARTICLE (these override any conflicting Codex defaults):
- Length: 300–400 words in the BODY. Count carefully.
- Title: MUST include the set number (if provided above) and the word "India".
  Example formula: "LEGO [SET_NUMBER] [Set Name] in India: [angle in BOI voice]"
  If no set number was provided, include India context prominently instead.
- Opening: Start on something Indian (wallet pain, EMI, chai, traffic, cricket,
  Bollywood). Pivot to the LEGO topic in the next 1–2 sentences. Then proceed.
  Do NOT open with any host introduction. Do NOT say "Hello Brickfans."
  Do NOT say "welcome to Bricks of India."
- Sign-off: End with a variation of "On that bombshell..." ONLY.
  Never "Bubyee." Never "I'll see you on the next one." Never "Until next time."
- STRUCTURE REQUIREMENT — SIGN-OFF: Every article MUST end with one closing line
  that signals the piece is over. Use "On that bombshell, it's time to say goodbye."
  or a close variant. Do not end on a descriptive sentence about the topic. The
  sign-off is a separate paragraph after the main body. This is non-negotiable —
  articles without sign-offs will fail review.
- STRUCTURE REQUIREMENT — VERDICT IN BODY: The verdict (BUY / WAIT FOR SALE /
  IMPORT ONLY / SKIP) must appear as a clear statement in the article body, not
  just in the structured metadata. Place it in the second-to-last paragraph
  (before the sign-off). Examples: "Verdict: SKIP. Save your money for something
  less likely to require its own insurance policy." or "Verdict: IMPORT ONLY.
  Worth it if you have the patience for customs and the wallet for the markup."
  The verdict statement must explicitly use one of the four verdict words.`,

  review: `
---
FORMAT RULES — SET REVIEW (these override any conflicting Codex defaults):
- Length: 500–700 words in the BODY.
- Title formula: "Worth ₹[INR price] in India?" — always this exact structure.
- Opening: Start on something Indian, pivot to LEGO in 1–2 sentences. No host intro.
- Sign-off: "On that bombshell..." variants only. Never YouTube sign-offs.
- STRUCTURE REQUIREMENT — SIGN-OFF: Every article MUST end with one closing line
  that signals the piece is over. Use "On that bombshell, it's time to say goodbye."
  or a close variant. Do not end on a descriptive sentence about the topic. The
  sign-off is a separate paragraph after the main body. This is non-negotiable —
  articles without sign-offs will fail review.
- STRUCTURE REQUIREMENT — VERDICT IN BODY: The verdict (BUY / WAIT FOR SALE /
  IMPORT ONLY / SKIP) must appear as a clear statement in the article body, not
  just in the structured metadata. Place it in the second-to-last paragraph
  (before the sign-off). The verdict statement must explicitly use one of the
  four verdict words.`,

  opinion: `
---
FORMAT RULES — OPINION PIECE (these override any conflicting Codex defaults):
- Length: 400–500 words in the BODY.
- Title: Freeform but MUST reference India or an Indian wallet/price context.
- Opening: Start on something Indian, pivot to LEGO in 1–2 sentences. No host intro.
- Sign-off: "On that bombshell..." variants only. Never YouTube sign-offs.
- STRUCTURE REQUIREMENT — SIGN-OFF: Every article MUST end with one closing line
  that signals the piece is over. Use "On that bombshell, it's time to say goodbye."
  or a close variant. Do not end on a descriptive sentence about the topic. The
  sign-off is a separate paragraph after the main body. This is non-negotiable —
  articles without sign-offs will fail review.
- STRUCTURE REQUIREMENT — VERDICT IN BODY: The verdict (BUY / WAIT FOR SALE /
  IMPORT ONLY / SKIP) must appear as a clear statement in the article body, not
  just in the structured metadata. Place it in the second-to-last paragraph
  (before the sign-off). The verdict statement must explicitly use one of the
  four verdict words.`,
};

const INDIA_PARAGRAPH_SPEC = `
---
INDIA PARAGRAPH — MANDATORY RULES:
Every article MUST contain exactly one India Paragraph. It is a single consolidated
block — do NOT scatter its components across multiple paragraphs.

Place the HTML comment <!-- INDIA_PARAGRAPH --> on the line immediately before this block.

The block MUST contain ALL FOUR components, in this order:
  (a) INR price: state the calculation — USD MSRP × 1.35 × current USD/INR rate.
      Show your working. If MSRP is unknown, estimate from context and say so.
  (b) Indian availability: name which stores stock it (Toycra, MyBrickHouse,
      Jaiman Toys), OR state "import only via BrickLink/eBay" if none do.
  (c) India lag: note the 4–6 week lag after global launch, OR "no official
      India launch" for import-only sets.
  (d) One relatable Indian comparison: convert the price to something tangible —
      kg of mangoes, plates of biryani, months of Spotify Premium, EMI
      instalments, sleeper train tickets, etc.`;

const GROUNDING_RULE = `
---
GROUNDING RULE:
Do not state piece counts, minifig counts, theme names, designer names, year of release,
or any verifiable factual specific unless that EXACT fact appears in the SOURCE block below.
If you find yourself wanting to write "458 pieces" or "designed by X," STOP and write around it.
"Hundreds of pieces, going by the look of it" is fine. "458 pieces" is not.
Speculation framed as speculation is allowed: "looks like late-90s Adventurers" is fine.
Asserting "released in 1999" is not, unless 1999 is in the SOURCE.`;

// Anti-patterns appended LAST for recency effect — LLMs weight recent instructions heavily.
const ANTI_PATTERNS = `
---
ANTI-PATTERNS — DO NOT USE ANY OF THESE IN A WEBSITE ARTICLE:
• "Hello Brickfans" / "welcome to Bricks of India" / any host introduction
  → This is a website article, not a YouTube video. There is no host intro.
• "Bubyee" / "see you on the next one" / "I'll see you on the next one" / "until next time"
  → YouTube-only sign-offs. Website articles end with "On that bombshell..." only.
• "Today's random set" / "today we're talking about" / any phrase that mirrors the
  source site's editorial framing → Write as if BOI originated the story.
• "lets gooooo" / "let's gooooooo" as an opener
  → YouTube opener only. Website articles open on an Indian hook.
• Asserting set facts (theme, piece count, year, designer) without grounding
  → See grounding rule above. Speculate with framing; never assert without evidence.

AVOID THESE REGISTER DRIFTS (the SHAPE of these, not just exact phrases):
• "my friends" / "folks" / "guys" / any inclusive address
  → Clarkson register is aloof, not folksy. You are not addressing a crowd.
• "Yes, you read that right" / "you heard me"
  → Podcaster filler. Cut it. Let the number land on its own.
• "Let's be brutally honest" / "let me be frank"
  → Announcing honesty instead of being honest. Just be honest.
• "diving into" / "let's explore" / "annals of history"
  → Stock journalism phrases. Find the specific, vivid version.
• "today we're talking about"
  → YouTube preamble. You are already talking about it.
• Do not announce what you are about to do. Just do it.`;

function buildSystemPrompt(format) {
  const codex = fs.readFileSync(CODEX_PATH, 'utf8');
  return (
    codex
    + FORMAT_ADDENDUM[format]
    + INDIA_PARAGRAPH_SPEC
    + GROUNDING_RULE
    + ANTI_PATTERNS
  );
}

// ── Step 5 — User prompt construction (F5, F6) ───────────────────────────────
function buildUserPrompt(item, format, setNumber) {
  const setLine    = setNumber
    ? `Set number : ${setNumber} (extracted from URL — include in title per format rules)`
    : `Set number : NOT FOUND in URL — title should reference India context instead`;
  const wordTarget = { news: '300–400', review: '500–700', opinion: '400–500' }[format];

  return `Write a BOI-voice ${format} article on the topic below. Target: ${wordTarget} words in the body.

SOURCE:
Title     : ${item.title}
URL       : ${item.link}
Published : ${item.publishedAt}
${setLine}
Excerpt   : ${item.excerpt}

Output your response using EXACTLY this structure. Nothing outside these markers.

--- BOI_DRAFT_START ---
FORMAT: ${format}
TITLE: <your title>
VERDICT: <BUY | WAIT FOR SALE | IMPORT ONLY | SKIP | NONE>

BODY:
<article body — place <!-- INDIA_PARAGRAPH --> comment on the line before the India Paragraph block>
--- BOI_DRAFT_END ---`;
}

// ── Step 6a — Verdict-in-body templates (deterministic backstop) ─────────────
// If Gemini omits the verdict from the body, inject it before the sign-off.
const VERDICT_TEMPLATES = {
  'BUY':           'Verdict: BUY. The price is right and the set delivers — grab it before it retires.',
  'WAIT FOR SALE': 'Verdict: WAIT FOR SALE. Decent set, but the price needs to come down 20-30% before this makes sense.',
  'IMPORT ONLY':   'Verdict: IMPORT ONLY. Worth it if you have the patience for customs and the wallet for the markup.',
  'SKIP':          'Verdict: SKIP. Save your money for something less likely to require its own insurance policy.',
};

const SIGN_OFF_RE = /^on that bombshell|say goodbye/i;

function ensureVerdictInBody(body, verdict) {
  if (!verdict) return { body, verdictSource: 'none (no verdict)' };

  // Check if any verdict word already appears in the body
  const bodyLower = body.toLowerCase();
  const present   = ['buy', 'wait for sale', 'import only', 'skip'].some(v => bodyLower.includes(v));
  if (present) return { body, verdictSource: 'gemini-native' };

  // Not present — inject template before sign-off, or append if no sign-off found
  const template  = VERDICT_TEMPLATES[verdict];
  const paragraphs = body.split(/\n{2,}/);
  const lastPara   = paragraphs[paragraphs.length - 1] || '';
  const hasSignOff = SIGN_OFF_RE.test(lastPara.trim());

  let newBody;
  if (hasSignOff) {
    paragraphs.splice(paragraphs.length - 1, 0, template);
    newBody = paragraphs.join('\n\n');
  } else {
    newBody = body + '\n\n' + template;
  }
  return { body: newBody, verdictSource: 'template-injected' };
}

// ── Step 6 — Parse structured response ───────────────────────────────────────
const VALID_VERDICTS = new Set(['BUY', 'WAIT FOR SALE', 'IMPORT ONLY', 'SKIP']);

function parseResponse(text) {
  const START = '--- BOI_DRAFT_START ---';
  const END   = '--- BOI_DRAFT_END ---';
  const si    = text.indexOf(START);
  const ei    = text.indexOf(END);

  if (si === -1 || ei === -1) {
    throw new Error(
      `Malformed response — missing BOI_DRAFT_START/END markers.\nRaw:\n${text}`
    );
  }

  const inner = text.slice(si + START.length, ei).trim();
  const lines = inner.split('\n');

  let format    = '';
  let title     = '';
  let verdict   = null;
  let modelWC   = 0;
  let inBody    = false;
  const bodyLines = [];

  for (const line of lines) {
    if (!inBody) {
      if      (line.startsWith('FORMAT:'))     format  = line.slice(7).trim().toLowerCase();
      else if (line.startsWith('TITLE:'))      title   = line.slice(6).trim();
      else if (line.startsWith('VERDICT:')) {
        const raw = line.slice(8).trim();
        verdict   = VALID_VERDICTS.has(raw) ? raw : null;
      }
      else if (line.trim() === 'BODY:')        inBody  = true;
    } else {
      bodyLines.push(line);
    }
  }

  const body = bodyLines.join('\n').trim();
  if (!title || !body) {
    throw new Error(
      `Malformed response — missing TITLE or BODY.\nInner block:\n${inner}`
    );
  }

  const computedWC = body.split(/\s+/).filter(Boolean).length;
  return { format, title, verdict, modelWordCount: modelWC, computedWordCount: computedWC, body };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('━━ RADAR-04 drafter v2 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Iteration    : ${ITERATION_LABEL}`);

  // Step 1
  const item = await getFirstItem();
  console.log(`\nSource title : ${item.title}`);
  console.log(`Source URL   : ${item.link}`);
  console.log(`Source date  : ${item.publishedAt}`);

  // Step 2 — format classification (F7)
  const format = classifyFormat(item);
  console.log(`\nFormat class : ${format} (heuristic)`);

  // Step 3 — set number (F6)
  const setNumber = extractSetNumber(item.link);
  if (setNumber) {
    console.log(`Set number   : ${setNumber} (from URL)`);
  } else {
    console.log(`Set number   : NOT FOUND — no /sets/NNNNN- pattern in URL`);
    console.log(`               Warning: title will use India context, not set number`);
  }

  // Step 4 — build prompts
  const systemPrompt = buildSystemPrompt(format);
  const userPrompt   = buildUserPrompt(item, format, setNumber);
  console.log(`\nSystem prompt: ${systemPrompt.length.toLocaleString()} chars`);
  console.log(`               (Codex + ${format} addendum + India spec + grounding + anti-patterns)`);

  // Step 5 — Gemini call
  console.log(`Calling      : ${MODEL_NAME} (temp=0.7, maxTokens=2000)...`);
  const t0    = Date.now();
  const model = genai.getGenerativeModel({
    model             : MODEL_NAME,
    systemInstruction : systemPrompt,
  });

  let result;
  try {
    result = await model.generateContent({
      contents         : [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig : { temperature: 0.7, maxOutputTokens: 2000 },
    });
  } catch (err) {
    if (err.status === 429 || (err.message && err.message.includes('429'))) {
      console.error('\nERROR: Gemini rate limit (429). Hard ceiling — do NOT retry.');
      process.exit(1);
    }
    throw err;
  }

  const elapsed = Date.now() - t0;
  const rawText = result.response.text();

  if (!rawText || rawText.trim().length === 0) {
    console.error('\nERROR: Gemini returned empty response.');
    console.error('Raw:', JSON.stringify(result.response, null, 2));
    process.exit(1);
  }

  // Step 6 — parse
  let parsed;
  try {
    parsed = parseResponse(rawText);
  } catch (parseErr) {
    console.error('\nERROR:', parseErr.message);
    process.exit(1);
  }

  // Step 6a — verdict-in-body enforcement (deterministic backstop)
  const { body: finalBody, verdictSource } = ensureVerdictInBody(parsed.body, parsed.verdict);
  parsed.body = finalBody;
  parsed.computedWordCount = finalBody.split(/\s+/).filter(Boolean).length;

  // Surface full output
  console.log(`\nGemini done  : ${elapsed}ms`);
  console.log(`Draft title  : ${parsed.title}`);
  console.log(`Verdict      : ${parsed.verdict || 'none'}`);
  console.log(`Verdict-body : ${verdictSource}`);
  console.log(`Word count   : ${parsed.computedWordCount} (computed)`);

  const rawBlock = rawText.slice(rawText.indexOf('--- BOI_DRAFT_START ---'));
  console.log(`\n── RAW STRUCTURED OUTPUT ───────────────────────────────────────\n`);
  console.log(rawBlock);
  console.log(`── END RAW ─────────────────────────────────────────────────────`);

  console.log(`\n── DRAFT BODY ──────────────────────────────────────────────────\n`);
  console.log(parsed.body);
  console.log(`\n── END DRAFT ───────────────────────────────────────────────────`);

  // Step 7 — Supabase insert (new row per iteration — no upsert)
  console.log('\nInserting into pending_drafts...');
  const { data, error } = await supabase
    .from('pending_drafts')
    .insert({
      source_url          : item.link,
      source_title        : item.title,
      source_excerpt      : item.excerpt,
      source_published_at : item.publishedAt,
      draft_title         : parsed.title,
      draft_body          : parsed.body,
      draft_verdict       : parsed.verdict,
      draft_format        : parsed.format || format,
      word_count          : parsed.computedWordCount,
      status              : 'draft',
      iteration_label     : ITERATION_LABEL,
    })
    .select()
    .single();

  if (error) {
    console.error('\nERROR: Supabase insert failed.');
    console.error('Message :', error.message);
    console.error('Code    :', error.code);
    if (error.details) console.error('Details :', error.details);
    if (error.hint)    console.error('Hint    :', error.hint);
    process.exit(1);
  }

  console.log('\n✓ OK — draft written to pending_drafts');
  console.log(`  id              : ${data.id}`);
  console.log(`  iteration_label : ${data.iteration_label}`);
  console.log(`  title           : ${data.draft_title}`);
  console.log(`  word_count      : ${data.word_count}`);
  console.log(`  verdict         : ${data.draft_verdict || 'none'}`);
  console.log(`  status          : ${data.status}`);
  console.log(`  created_at      : ${data.created_at}`);
}

main().catch(err => {
  console.error('\nFATAL:', err.message);
  process.exit(1);
});
