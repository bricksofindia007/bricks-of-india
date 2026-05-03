'use strict';
/**
 * RADAR-04 drafter — standalone smoke-test script.
 *
 * Reads the first item from scripts/radar/test-fixture.xml, passes the full
 * Codex as the system prompt, calls Gemini 2.5 Flash-Lite, and writes the
 * resulting draft to pending_drafts with status='draft'.
 *
 * Run: node scripts/radar/draft-articles.js
 * Requires: GEMINI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *           in .env.local (or environment).
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

// ── Env validation ────────────────────────────────────────────────────────────
const GEMINI_API_KEY      = process.env.GEMINI_API_KEY;
const SUPABASE_URL        = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
    title      : item.title                                           || '',
    link       : item.link                                            || '',
    excerpt    : (item.contentSnippet || item.content || '').slice(0, 600),
    publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
  };
}

// ── Step 2 — Build prompts ────────────────────────────────────────────────────
function buildSystemPrompt() {
  return fs.readFileSync(CODEX_PATH, 'utf8');
}

function buildUserPrompt(item) {
  return `You are writing a BOI news article. Apply every rule in the Clarkson Codex above without exception.

SOURCE:
Title:     ${item.title}
URL:       ${item.link}
Published: ${item.publishedAt}
Excerpt:   ${item.excerpt}

TASK: Write a BOI-voice news article on this topic, 300–400 words total body.
Follow Page 15 structural slots exactly (HOOK → INTRO BLOCK → CONTEXT → MAIN → INDIA PARAGRAPH → VERDICT → CTA → SIGN-OFF).
News pieces may skip slot 3 (CONTEXT) if obvious from the headline.

REQUIRED OUTPUT FORMAT — output exactly these lines first, then the body:
TITLE: <your article title>
FORMAT: news
VERDICT: <one of: BUY | WAIT FOR SALE | IMPORT ONLY | SKIP | NONE>

BODY:
<full article body — all applicable structural slots>`;
}

// ── Step 3 — Parse Gemini response ────────────────────────────────────────────
const VALID_VERDICTS = new Set(['BUY', 'WAIT FOR SALE', 'IMPORT ONLY', 'SKIP']);

function parseResponse(text) {
  const lines     = text.split('\n');
  let title       = '';
  let format      = 'news';
  let verdict     = null;
  let inBody      = false;
  const bodyLines = [];

  for (const line of lines) {
    if (!inBody) {
      if      (line.startsWith('TITLE:'))   title  = line.slice(6).trim();
      else if (line.startsWith('FORMAT:'))  format = line.slice(7).trim().toLowerCase();
      else if (line.startsWith('VERDICT:')) {
        const raw = line.slice(8).trim();
        verdict   = VALID_VERDICTS.has(raw) ? raw : null;
      } else if (line.trim() === 'BODY:')   inBody = true;
    } else {
      bodyLines.push(line);
    }
  }

  const body = bodyLines.join('\n').trim();

  if (!title || !body) {
    throw new Error(
      `Malformed Gemini response — missing TITLE or BODY.\nRaw:\n${text}`
    );
  }

  const wordCount = body.split(/\s+/).filter(Boolean).length;
  return { title, format, verdict, body, wordCount };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('━━ RADAR-04 drafter ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Step 1
  const item = await getFirstItem();
  console.log(`\nSource title : ${item.title}`);
  console.log(`Source URL   : ${item.link}`);
  console.log(`Source date  : ${item.publishedAt}`);

  // Step 2
  const systemPrompt = buildSystemPrompt();
  const userPrompt   = buildUserPrompt(item);
  console.log(`\nCodex loaded : ${systemPrompt.length.toLocaleString()} chars`);

  // Step 3 — Gemini call
  console.log(`Calling      : ${MODEL_NAME} (temp=0.7, maxTokens=2000)...`);
  const t0    = Date.now();
  const model = genai.getGenerativeModel({
    model             : MODEL_NAME,
    systemInstruction : systemPrompt,
  });

  let result;
  try {
    result = await model.generateContent({
      contents          : [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig  : { temperature: 0.7, maxOutputTokens: 2000 },
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
    console.error('\nERROR: Gemini returned empty/malformed response.');
    console.error('Raw response object:', JSON.stringify(result.response, null, 2));
    process.exit(1);
  }

  // Step 4 — parse
  let parsed;
  try {
    parsed = parseResponse(rawText);
  } catch (parseErr) {
    console.error('\nERROR:', parseErr.message);
    process.exit(1);
  }

  console.log(`\nGemini done  : ${elapsed}ms`);
  console.log(`Draft title  : ${parsed.title}`);
  console.log(`Word count   : ${parsed.wordCount}`);
  console.log(`Verdict      : ${parsed.verdict || 'none'}`);
  console.log(`\n── DRAFT BODY ──────────────────────────────────────────────────\n`);
  console.log(parsed.body);
  console.log(`\n── END DRAFT ───────────────────────────────────────────────────`);

  // Step 5 — Supabase insert
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
      draft_format        : parsed.format,
      word_count          : parsed.wordCount,
      status              : 'draft',
    })
    .select()
    .single();

  if (error) {
    console.error('\nERROR: Supabase insert failed.');
    console.error('Message :', error.message);
    console.error('Code    :', error.code);
    if (error.details)  console.error('Details :', error.details);
    if (error.hint)     console.error('Hint    :', error.hint);
    if (error.code === '42P01' || error.code === 'PGRST205')
      console.error('\n→ Table "pending_drafts" not found in schema cache.');
      console.error('  1. Confirm migration was applied: supabase/migrations/20260503000000_pending_drafts.sql');
      console.error('  2. Reload PostgREST cache: Supabase Dashboard → API → Reload schema cache');
    process.exit(1);
  }

  console.log('\n✓ OK — draft written to pending_drafts');
  console.log(`  id         : ${data.id}`);
  console.log(`  title      : ${data.draft_title}`);
  console.log(`  word_count : ${data.word_count}`);
  console.log(`  verdict    : ${data.draft_verdict || 'none'}`);
  console.log(`  status     : ${data.status}`);
  console.log(`  created_at : ${data.created_at}`);
}

main().catch(err => {
  console.error('\nFATAL:', err.message);
  process.exit(1);
});
