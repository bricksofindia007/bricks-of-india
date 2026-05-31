'use strict';
/**
 * RADAR-04 (batch) — Generate article bodies for all approved pending_drafts
 * that have no draft_body yet.
 *
 * Runs on GitHub Actions (no Netlify function timeout).
 * Also safe to run locally:
 *   node --env-file=.env.local scripts/generate-approved-drafts.js
 *   node --env-file=.env.local scripts/generate-approved-drafts.js --limit 3
 *
 * Generation logic mirrors src/lib/generate-body.ts — keep in sync when editing.
 * Rate: 7 s delay between Gemini calls (free tier: 10 RPM).
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// ── CLI flags ─────────────────────────────────────────────────────────────────

const LIMIT = (() => {
  const i = process.argv.indexOf('--limit');
  return i !== -1 ? parseInt(process.argv[i + 1], 10) : Infinity;
})();

const DRAFT_ID = (() => {
  const i = process.argv.indexOf('--id');
  return i !== -1 ? process.argv[i + 1] : null;
})();

const DELAY_MS = 7000; // 7 s between Gemini calls — stays under 10 RPM free tier

// ── Env ───────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_KEY   = process.env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!GEMINI_KEY) {
  console.error('Missing GEMINI_API_KEY');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// ── Generation constants (mirrors src/lib/generate-body.ts) ──────────────────

const SKIP_FETCH_DOMAINS = new Set([
  'rebrickable.com', 'youtube.com', 'reddit.com', 'i.redd.it',
]);
const UA = 'BricksOfIndia-RadarBot/1.0 (+https://bricksofindia.com)';

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
News article: 300–400 words
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

const VERDICT_TEMPLATES = {
  'BUY NOW':     'Verdict: BUY NOW. The price is right — grab it.',
  'WAIT':        'Verdict: WAIT. Good set, but the price will drop.',
  'IMPORT ONLY': 'Verdict: IMPORT ONLY. Not in Indian stores — grey market or wait.',
  'AVOID':       'Verdict: AVOID. Save your money for something better.',
};

const INDIA_STORE_PRIORITY = { mybrickhouse: 1, toycra: 2 };
const INDIA_STORE_LABELS   = { mybrickhouse: 'MyBrickHouse', toycra: 'Toycra' };

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchFullBody(url) {
  let hostname;
  try { hostname = new URL(url).hostname.replace(/^www\./, ''); }
  catch { return null; }
  if (SKIP_FETCH_DOMAINS.has(hostname)) return null;

  try {
    const { load } = await import('cheerio');
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'text/html' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = load(html);

    $('nav, header, footer, aside, script, style, iframe, figure').remove();
    $('.sidebar, .widget-area, .widget, #sidebar, .advertisement, .ads').remove();
    $('[class*="share-"], [class*="-share"], [class*="social-"], [class*="related-"], ' +
      '[class*="comment-"], [class*="-comments"], .commentlist, .sharedaddy').remove();

    const SELECTORS = ['article', '.post-content', '.entry-content', '.article-body', '.layout-grid-content'];
    for (const sel of SELECTORS) {
      const text = $(sel).first().text().replace(/\s+/g, ' ').trim();
      if (text.length >= 300) return text.slice(0, 4000);
    }
    const parts = [];
    $('main p').each((_, el) => { const t = $(el).text().trim(); if (t) parts.push(t); });
    const joined = parts.join(' ');
    if (joined.length >= 300) return joined.slice(0, 4000);
    return null;
  } catch { return null; }
}

function extractSetNumber(sourceUrl, sourceTitle) {
  const urlMatch = sourceUrl.match(/\/(?:sets?|products?)\/(\d{4,6})(?:[-\/]|$)/i);
  if (urlMatch) return urlMatch[1];
  const titleStr = sourceTitle ?? '';
  const titleMatch = titleStr.match(/\b(\d{4,6})(?:-\d+)?\b/);
  return titleMatch ? titleMatch[1] : null;
}

function fmtInr(n) {
  const s = Math.round(n).toString();
  const last3 = s.slice(-3);
  const rest  = s.slice(0, -3);
  if (!rest) return last3;
  return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
}

async function fetchLiveUsdInr() {
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(5000) });
    const d = await r.json();
    const rate = d?.rates?.INR;
    return (rate && rate > 75 && rate < 130) ? Math.round(rate) : null;
  } catch { return null; }
}

async function buildIndiaPriceContext(setNumber) {
  if (!setNumber) return 'INDIA PRICE DATA: set number could not be identified. Acknowledge price uncertainty; do not state a specific figure.';

  const { data: sp } = await sb
    .from('store_prices')
    .select('store_id, price_inr, in_stock')
    .eq('set_id', setNumber);

  const priced = (sp ?? [])
    .sort((a, b) => (INDIA_STORE_PRIORITY[a.store_id] ?? 9) - (INDIA_STORE_PRIORITY[b.store_id] ?? 9));

  if (priced.length > 0) {
    const lines = priced.map(p => {
      const label = INDIA_STORE_LABELS[p.store_id] ?? p.store_id;
      const stock = p.in_stock ? '' : ' (may be out of stock)';
      return `  ${label}: ₹${fmtInr(Number(p.price_inr))}${stock}`;
    });
    return `INDIA PRICE DATA — use these exact figures, do not calculate:\n${lines.join('\n')}`;
  }

  const { data: setRow } = await sb
    .from('sets')
    .select('lego_mrp_inr')
    .eq('set_number', setNumber)
    .maybeSingle();
  if (setRow?.lego_mrp_inr) {
    return `INDIA PRICE DATA: Official LEGO India MRP ₹${fmtInr(Number(setRow.lego_mrp_inr))} (no live store prices). Use this figure. Mention Toycra / MyBrickHouse may list it within 4–6 weeks.`;
  }

  const rate = await fetchLiveUsdInr();
  if (rate) {
    return `INDIA PRICE DATA: no store prices in database. If the source mentions a USD price, multiply by ${rate} for a rough INR estimate. Label it "estimated import price" — not a confirmed retail price.`;
  }

  return 'INDIA PRICE DATA: no price data available. Acknowledge price uncertainty; do not state a specific figure.';
}

async function generateBody(draft) {
  if (!draft.draft_format) throw new Error('Draft has no format — re-run RADAR-03');

  const format    = draft.draft_format;
  const setNumber = extractSetNumber(draft.source_url, draft.source_title ?? null);

  const [fullBody, indiaPriceContext] = await Promise.all([
    fetchFullBody(draft.source_url),
    buildIndiaPriceContext(setNumber)
      .catch(() => 'INDIA PRICE DATA: price lookup failed. Acknowledge price uncertainty; do not state a specific figure.'),
  ]);

  const content    = fullBody || draft.source_excerpt || draft.source_title || '(no content available)';
  const wordTarget = { news: '300–400', review: '500–700', opinion: '400–500', guide: '700–1000' }[format] || '300–400';
  const setLine    = setNumber
    ? `Set number: ${setNumber} (include in title)`
    : 'Set number: NOT FOUND — use India context in title instead';

  const systemPrompt = VOICE_EXAMPLES + OUTPUT_FORMAT;
  const userPrompt   = `Write a BOI-voice ${format} article about the source below. Target: ${wordTarget} words in body.

Your entire response must be wrapped in the BOI_DRAFT markers exactly as specified in your instructions. No text before or after the markers.

${indiaPriceContext}

SOURCE:
Title     : ${draft.source_title}
URL       : ${draft.source_url}
Published : ${draft.source_published_at || 'unknown'}
${setLine}
${fullBody ? 'Full article body' : 'Excerpt'}: ${content}`;

  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genai  = new GoogleGenerativeAI(GEMINI_KEY);
  const result = await genai
    .getGenerativeModel({ model: 'gemini-2.5-flash-lite', systemInstruction: systemPrompt })
    .generateContent({
      contents         : [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig : { temperature: 0.7, maxOutputTokens: 2000 },
    });

  const rawText = result.response.text();
  if (!rawText?.trim()) throw new Error('Gemini returned empty response');

  const si = rawText.indexOf('--- BOI_DRAFT_START ---');
  const ei = rawText.indexOf('--- BOI_DRAFT_END ---');
  if (si === -1 || ei === -1) throw new Error('Gemini response missing BOI_DRAFT markers');

  const inner = rawText.slice(si + '--- BOI_DRAFT_START ---'.length, ei).trim();
  let title = '', verdict = null, inBody = false;
  const bodyLines = [];

  for (const line of inner.split('\n')) {
    if (!inBody) {
      if (line.startsWith('TITLE:'))   title   = line.slice(6).trim();
      if (line.startsWith('VERDICT:')) {
        const v = line.slice(8).trim();
        verdict = ['BUY NOW', 'WAIT', 'IMPORT ONLY', 'AVOID'].includes(v) ? v : null;
      }
      if (line.trim() === 'BODY:') inBody = true;
    } else { bodyLines.push(line); }
  }

  let body = bodyLines.join('\n').trim();
  if (!title || !body) throw new Error('Gemini response missing TITLE or BODY');

  // Append verdict line if not already present (check for "verdict:" prefix, not the word itself)
  if (verdict && !body.toLowerCase().includes('verdict:')) {
    body += '\n\n' + (VERDICT_TEMPLATES[verdict] ?? '');
  }

  return { title, body, verdict, format, wordCount: body.split(/\s+/).filter(Boolean).length };
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  const t0 = Date.now();
  const limitStr = LIMIT === Infinity ? 'all' : String(LIMIT);
  console.log(`━━ generate-approved-drafts (limit=${limitStr}) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  let q = sb
    .from('pending_drafts')
    .select('id, source_url, source_title, source_excerpt, source_published_at, draft_format, draft_title')
    .eq('status', 'approved')
    .is('draft_body', null)
    .order('created_at', { ascending: true });
  if (DRAFT_ID) q = q.eq('id', DRAFT_ID);
  const { data: drafts, error } = await q;

  if (error) throw error;

  const queue = LIMIT === Infinity ? (drafts ?? []) : (drafts ?? []).slice(0, LIMIT);
  console.log(`Approved + awaiting body: ${(drafts ?? []).length} total, processing ${queue.length}\n`);

  if (queue.length === 0) {
    console.log('Nothing to generate.');
    return;
  }

  let ok = 0, failed = 0;

  for (let i = 0; i < queue.length; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, DELAY_MS));

    const draft = queue[i];
    const label = (draft.draft_title || draft.source_title || draft.id).slice(0, 70);
    process.stdout.write(`[${i + 1}/${queue.length}] ${label}… `);

    try {
      const result = await generateBody(draft);

      const { error: upErr } = await sb
        .from('pending_drafts')
        .update({
          draft_title  : result.title,
          draft_body   : result.body,
          draft_verdict: result.verdict,
          draft_format : result.format,
          word_count   : result.wordCount,
          status       : 'draft',
        })
        .eq('id', draft.id);

      if (upErr) throw upErr;

      ok++;
      console.log(`OK (${result.wordCount}w, verdict=${result.verdict ?? 'none'})`);
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : (err?.message ?? JSON.stringify(err));
      console.log(`FAIL: ${String(msg).slice(0, 200)}`);
      if (msg.includes('[429')) {
        console.log('Rate limit (429) — stopping batch to avoid quota waste.');
        break;
      }
    }
  }

  const dur = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nSUMMARY: ${ok} ok, ${failed} failed of ${queue.length} processed — ${dur}s total`);
})().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
