'use strict';
/**
 * RADAR-04 — Pipeline drafter
 *
 * Reads pending_drafts where status='approved' AND draft_body IS NULL,
 * generates a BOI-voice article via Gemini 2.5 Flash-Lite for each,
 * writes draft_title/draft_body/draft_verdict/word_count back to the same row,
 * resets status to 'draft' so the operator can review the generated article
 * at /admin/pending before it moves to publishing.
 *
 * Rate limit: 7s between Gemini calls (~8 RPM — under the 10 RPM free-tier ceiling).
 *
 * Usage:
 *   node scripts/radar/generate-drafts.js --dry-run
 *   node scripts/radar/generate-drafts.js --limit 5
 *   node scripts/radar/generate-drafts.js --verbose
 */

require('dotenv').config({ path: '.env.local' });

const fs   = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient }       = require('@supabase/supabase-js');

// ── CLI flags ─────────────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');
const LIMIT   = (() => {
  const i = process.argv.indexOf('--limit');
  return i !== -1 ? parseInt(process.argv[i + 1], 10) : Infinity;
})();

// ── Env ───────────────────────────────────────────────────────────────────────
const GEMINI_API_KEY       = process.env.GEMINI_API_KEY;
const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!GEMINI_API_KEY)       { console.error('Missing GEMINI_API_KEY');                 process.exit(1); }
if (!SUPABASE_URL)         { console.error('Missing NEXT_PUBLIC_SUPABASE_URL');       process.exit(1); }
if (!SUPABASE_SERVICE_KEY) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY');      process.exit(1); }

const CODEX_PATH = path.join(__dirname, '../../docs/codex/BOI_Codex_v2.md');
if (!fs.existsSync(CODEX_PATH)) {
  console.error(`Codex missing at ${CODEX_PATH}`);
  process.exit(1);
}

// ── Constants ─────────────────────────────────────────────────────────────────
const MODEL_NAME       = 'gemini-2.5-flash-lite';
const RATE_LIMIT_MS    = 7000; // 7s between calls ≈ 8 RPM (free-tier ceiling: 10 RPM)

// ── Clients ───────────────────────────────────────────────────────────────────
const genai    = new GoogleGenerativeAI(GEMINI_API_KEY);
const sb       = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

// ── Prompt construction (ported from draft-articles.js) ───────────────────────

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
  or a close variant. The sign-off is a separate paragraph after the main body.
- STRUCTURE REQUIREMENT — VERDICT IN BODY: The verdict (BUY / WAIT FOR SALE /
  IMPORT ONLY / SKIP) must appear as a clear statement in the article body, not
  just in the structured metadata. Place it in the second-to-last paragraph
  (before the sign-off).`,

  review: `
---
FORMAT RULES — SET REVIEW (these override any conflicting Codex defaults):
- Length: 500–700 words in the BODY.
- Title formula: "Worth ₹[INR price] in India?" — always this exact structure.
- Opening: Start on something Indian, pivot to LEGO in 1–2 sentences. No host intro.
- Sign-off: "On that bombshell..." variants only. Never YouTube sign-offs.
- STRUCTURE REQUIREMENT — SIGN-OFF: Every article MUST end with one closing line
  that signals the piece is over. The sign-off is a separate paragraph after the main body.
- STRUCTURE REQUIREMENT — VERDICT IN BODY: The verdict (BUY / WAIT FOR SALE /
  IMPORT ONLY / SKIP) must appear as a clear statement in the article body.`,

  opinion: `
---
FORMAT RULES — OPINION PIECE (these override any conflicting Codex defaults):
- Length: 400–500 words in the BODY.
- Title: Freeform but MUST reference India or an Indian wallet/price context.
- Opening: Start on something Indian, pivot to LEGO in 1–2 sentences. No host intro.
- Sign-off: "On that bombshell..." variants only. Never YouTube sign-offs.
- STRUCTURE REQUIREMENT — SIGN-OFF: Every article MUST end with one closing line
  that signals the piece is over. The sign-off is a separate paragraph after the main body.
- STRUCTURE REQUIREMENT — VERDICT IN BODY: The verdict (BUY / WAIT FOR SALE /
  IMPORT ONLY / SKIP) must appear as a clear statement in the article body.`,
};

const INDIA_PARAGRAPH_SPEC = `
---
INDIA PARAGRAPH — MANDATORY RULES:
Every article MUST contain exactly one India Paragraph as a single consolidated block.
Place the HTML comment <!-- INDIA_PARAGRAPH --> on the line immediately before this block.
The block MUST contain ALL FOUR components in order:
  (a) INR price: USD MSRP × 1.35 × current USD/INR rate. Show working. Estimate if unknown.
  (b) Indian availability: name stores (Toycra, MyBrickHouse, Jaiman Toys) or "import only".
  (c) India lag: 4–6 week lag after global launch, or "no official India launch" if import-only.
  (d) One relatable Indian comparison: kg of mangoes, biryani plates, Spotify months, EMI, etc.`;

const GROUNDING_RULE = `
---
GROUNDING RULE:
Do not state piece counts, minifig counts, theme names, designer names, year of release,
or any verifiable factual specific unless that EXACT fact appears in the SOURCE block below.
Speculation framed as speculation is allowed. Asserting facts without grounding is not.`;

const ANTI_PATTERNS = `
---
ANTI-PATTERNS — DO NOT USE:
• "Hello Brickfans" / "welcome to Bricks of India" / any host introduction
• "Bubyee" / "see you on the next one" — YouTube-only. Website ends with "On that bombshell..."
• "Today's random set" / "today we're talking about" / source site's framing
• Asserting set facts (theme, piece count, year, designer) without grounding
• "my friends" / "folks" / "guys" — Clarkson register is aloof, not folksy
• "Yes, you read that right" / "let me be frank" / "diving into" / "let's explore"
• Do not announce what you are about to do. Just do it.`;

function buildSystemPrompt(format) {
  const codex = fs.readFileSync(CODEX_PATH, 'utf8');
  return codex + (FORMAT_ADDENDUM[format] || FORMAT_ADDENDUM.news) + INDIA_PARAGRAPH_SPEC + GROUNDING_RULE + ANTI_PATTERNS;
}

function extractSetNumber(url) {
  const m = (url || '').match(/\/sets\/(\d{4,5})-/);
  return m ? m[1] : null;
}

function buildUserPrompt(draft, format, setNumber) {
  const wordTarget = { news: '300–400', review: '500–700', opinion: '400–500' }[format] || '300–400';
  const setLine    = setNumber
    ? `Set number : ${setNumber} (extracted from URL — include in title per format rules)`
    : `Set number : NOT FOUND in URL — title should reference India context instead`;
  const excerpt    = draft.source_excerpt || draft.source_title || '(no excerpt available)';

  return `Write a BOI-voice ${format} article on the topic below. Target: ${wordTarget} words in the body.

SOURCE:
Title     : ${draft.source_title}
URL       : ${draft.source_url}
Published : ${draft.source_published_at || 'unknown'}
${setLine}
Excerpt   : ${excerpt}

Output your response using EXACTLY this structure. Nothing outside these markers.

--- BOI_DRAFT_START ---
FORMAT: ${format}
TITLE: <your title>
VERDICT: <BUY | WAIT FOR SALE | IMPORT ONLY | SKIP | NONE>

BODY:
<article body — place <!-- INDIA_PARAGRAPH --> comment on the line before the India Paragraph block>
--- BOI_DRAFT_END ---`;
}

const VALID_VERDICTS  = new Set(['BUY', 'WAIT FOR SALE', 'IMPORT ONLY', 'SKIP']);
const VERDICT_TEMPLATES = {
  'BUY':           'Verdict: BUY. The price is right and the set delivers — grab it before it retires.',
  'WAIT FOR SALE': 'Verdict: WAIT FOR SALE. Decent set, but the price needs to come down 20–30% before this makes sense.',
  'IMPORT ONLY':   'Verdict: IMPORT ONLY. Worth it if you have the patience for customs and the wallet for the markup.',
  'SKIP':          'Verdict: SKIP. Save your money for something less likely to require its own insurance policy.',
};
const SIGN_OFF_RE = /^on that bombshell|say goodbye/i;

function ensureVerdictInBody(body, verdict) {
  if (!verdict) return { body, verdictSource: 'none' };
  const bodyLower = body.toLowerCase();
  const present   = ['buy', 'wait for sale', 'import only', 'skip'].some(v => bodyLower.includes(v));
  if (present) return { body, verdictSource: 'gemini-native' };
  const template   = VERDICT_TEMPLATES[verdict];
  const paragraphs = body.split(/\n{2,}/);
  const lastPara   = paragraphs[paragraphs.length - 1] || '';
  const hasSignOff = SIGN_OFF_RE.test(lastPara.trim());
  if (hasSignOff) {
    paragraphs.splice(paragraphs.length - 1, 0, template);
    return { body: paragraphs.join('\n\n'), verdictSource: 'template-injected' };
  }
  return { body: body + '\n\n' + template, verdictSource: 'template-injected' };
}

function parseResponse(text) {
  const START = '--- BOI_DRAFT_START ---';
  const END   = '--- BOI_DRAFT_END ---';
  const si    = text.indexOf(START);
  const ei    = text.indexOf(END);
  if (si === -1 || ei === -1) throw new Error(`Missing BOI_DRAFT_START/END markers`);

  const inner   = text.slice(si + START.length, ei).trim();
  const lines   = inner.split('\n');
  let format    = '';
  let title     = '';
  let verdict   = null;
  let inBody    = false;
  const bodyLines = [];

  for (const line of lines) {
    if (!inBody) {
      if      (line.startsWith('FORMAT:'))  format  = line.slice(7).trim().toLowerCase();
      else if (line.startsWith('TITLE:'))   title   = line.slice(6).trim();
      else if (line.startsWith('VERDICT:')) {
        const raw = line.slice(8).trim();
        verdict   = VALID_VERDICTS.has(raw) ? raw : null;
      }
      else if (line.trim() === 'BODY:')     inBody  = true;
    } else {
      bodyLines.push(line);
    }
  }

  const body = bodyLines.join('\n').trim();
  if (!title || !body) throw new Error(`Missing TITLE or BODY in structured response`);
  const wordCount = body.split(/\s+/).filter(Boolean).length;
  return { format: format || 'news', title, verdict, body, wordCount };
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function fetchApproved() {
  const { data, error } = await sb
    .from('pending_drafts')
    .select('id, source_url, source_title, source_excerpt, source_published_at, draft_format')
    .eq('status', 'approved')
    .is('draft_body', null)
    .order('approved_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function updateDraft(id, patch) {
  const { error } = await sb.from('pending_drafts').update(patch).eq('id', id);
  if (error) throw error;
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  const t0   = Date.now();
  const mode = DRY_RUN ? ' [DRY-RUN]' : '';
  console.log(`━━ RADAR-04 pipeline drafter${mode} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Model        : ${MODEL_NAME}`);
  console.log(`Rate limit   : ${RATE_LIMIT_MS / 1000}s between calls`);
  console.log('');

  const rows = await fetchApproved();
  const toProcess = LIMIT === Infinity ? rows : rows.slice(0, LIMIT);
  console.log(`Approved rows with no draft_body: ${rows.length}`);
  if (toProcess.length < rows.length) console.log(`Processing: ${toProcess.length} (--limit applied)`);
  console.log('');

  if (toProcess.length === 0) {
    console.log('Nothing to draft. Approve signals at /admin/pending first.');
    console.log(`\nDRAFT SUMMARY: processed=0 succeeded=0 failed=0 duration=${((Date.now()-t0)/1000).toFixed(1)}s`);
    return;
  }

  const model = genai.getGenerativeModel({
    model             : MODEL_NAME,
    systemInstruction : '', // overridden per call below
  });

  let succeeded = 0;
  let failed    = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const draft  = toProcess[i];
    const format = draft.draft_format || 'news';
    const setNum = extractSetNumber(draft.source_url);

    console.log(`[${i+1}/${toProcess.length}] ${draft.source_title?.slice(0, 70)}`);
    if (VERBOSE) {
      console.log(`  id     : ${draft.id}`);
      console.log(`  format : ${format}`);
      console.log(`  url    : ${draft.source_url}`);
    }

    if (DRY_RUN) {
      console.log(`  [DRY-RUN] would call Gemini for format=${format}`);
      succeeded++;
      continue;
    }

    const systemPrompt = buildSystemPrompt(format);
    const userPrompt   = buildUserPrompt(draft, format, setNum);

    let parsed;
    try {
      const t1     = Date.now();
      const result = await genai
        .getGenerativeModel({ model: MODEL_NAME, systemInstruction: systemPrompt })
        .generateContent({
          contents         : [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig : { temperature: 0.7, maxOutputTokens: 2000 },
        });
      const elapsed = Date.now() - t1;
      const rawText = result.response.text();

      if (!rawText?.trim()) throw new Error('Gemini returned empty response');

      parsed = parseResponse(rawText);
      const { body: finalBody, verdictSource } = ensureVerdictInBody(parsed.body, parsed.verdict);
      parsed.body      = finalBody;
      parsed.wordCount = finalBody.split(/\s+/).filter(Boolean).length;

      console.log(`  ✓ ${elapsed}ms | format=${parsed.format} wc=${parsed.wordCount} verdict=${parsed.verdict || 'none'} verdict-src=${verdictSource}`);
      if (VERBOSE) console.log(`  title: ${parsed.title}`);

    } catch (err) {
      if (err.status === 429 || err.message?.includes('429')) {
        console.error(`  ✗ Gemini rate limit (429) — stopping. Do NOT retry immediately.`);
        failed++;
        break;
      }
      console.error(`  ✗ ${err.message}`);
      failed++;
      // Rate limit gap even on error to avoid hammering Gemini
      if (i < toProcess.length - 1) await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
      continue;
    }

    try {
      await updateDraft(draft.id, {
        draft_title   : parsed.title,
        draft_body    : parsed.body,
        draft_verdict : parsed.verdict,
        draft_format  : parsed.format || format,
        word_count    : parsed.wordCount,
        status        : 'draft', // reset to 'draft' — operator reviews generated article before publishing
      });
      succeeded++;
    } catch (dbErr) {
      console.error(`  ✗ DB update failed: ${dbErr.message}`);
      failed++;
    }

    // Rate limit gap between Gemini calls
    if (i < toProcess.length - 1) await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
  }

  const dur = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('');
  console.log(
    `DRAFT SUMMARY: processed=${toProcess.length} succeeded=${succeeded} failed=${failed} duration=${dur}s` +
    (DRY_RUN ? ' [DRY-RUN]' : '')
  );
})().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
