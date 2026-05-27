/**
 * Shared article generation logic — no Next.js imports.
 * Used by: src/app/admin/pending/actions.ts (Server Action context)
 * Mirrored by: scripts/generate-approved-drafts.js (Node.js / GHA context)
 *
 * When editing generation logic, update the JS script to match.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ── Constants ─────────────────────────────────────────────────────────────────

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

OPENER RULE — non-negotiable:
First sentence must hook with either a relatable Indian situation OR the price. Never start with the set name or "LEGO has announced." Examples of good openers:
- "Your wallet called. It wants to discuss the LEGO Eiffel Tower."
- "Ten thousand pieces. Five feet tall. One very uncomfortable conversation with your bank account."
- "LEGO announced the [set] and approximately zero Indian fans checked the price first."

INDIA PARAGRAPH — non-negotiable, every article:
- Use exact store prices from INDIA PRICE DATA provided. Do not calculate.
- Price hierarchy: MyBrickHouse first, Toycra second, Jaiman Toys third.
- Include Toycra affiliate note exactly: "Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra."
- If set is not yet in Indian stores: mention 4–6 week India lag from global launch.
- One relatable Indian price comparison — must be specific and numeric. Good examples: "that's 14 months of Spotify Premium", "enough for 23kg of Amul butter", "three EMIs on a decent washing machine". Bad examples: "more than your monthly rent for many", "a paneer feast for a year."
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

const VERDICT_TEMPLATES: Record<string, string> = {
  'BUY NOW':      'Verdict: BUY NOW. The price is right — grab it.',
  'WAIT':         'Verdict: WAIT. Good set, but the price will drop.',
  'IMPORT ONLY':  'Verdict: IMPORT ONLY. Not in Indian stores — grey market or wait.',
  'AVOID':        'Verdict: AVOID. Save your money for something better.',
};

const INDIA_STORE_PRIORITY: Record<string, number> = { mybrickhouse: 1, toycra: 2, jaiman: 3 };
const INDIA_STORE_LABELS:   Record<string, string>  = { mybrickhouse: 'MyBrickHouse', toycra: 'Toycra', jaiman: 'Jaiman Toys' };

// ── Types ─────────────────────────────────────────────────────────────────────

export type DraftInput = {
  source_url: string;
  source_title: string | null;
  source_excerpt: string | null;
  source_published_at: string | null;
  draft_format: string | null;
};

export type GenerationResult = {
  title: string;
  body: string;
  verdict: string | null;
  format: string;
  wordCount: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

export async function fetchFullBody(url: string): Promise<string | null> {
  let hostname: string;
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
    const parts: string[] = [];
    $('main p').each((_, el) => { const t = $(el).text().trim(); if (t) parts.push(t); });
    const joined = parts.join(' ');
    if (joined.length >= 300) return joined.slice(0, 4000);
    return null;
  } catch { return null; }
}

export function extractSetNumber(sourceUrl: string, sourceTitle: string | null): string | null {
  const urlMatch = sourceUrl.match(/\/(?:sets?|products?)\/(\d{4,6})(?:[-\/]|$)/i);
  if (urlMatch) return urlMatch[1];
  const titleStr = sourceTitle ?? '';
  const titleMatch = titleStr.match(/\b(\d{4,6})(?:-\d+)?\b/);
  return titleMatch ? titleMatch[1] : null;
}

function fmtInr(n: number): string {
  const s = Math.round(n).toString();
  const last3 = s.slice(-3);
  const rest  = s.slice(0, -3);
  if (!rest) return last3;
  return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
}

async function fetchLiveUsdInr(): Promise<number | null> {
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(5000) });
    const d = await r.json();
    const rate = d?.rates?.INR;
    return (rate && rate > 75 && rate < 130) ? Math.round(rate) : null;
  } catch { return null; }
}

export async function buildIndiaPriceContext(
  supabase: SupabaseClient,
  setNumber: string | null,
): Promise<string> {
  if (!setNumber) return 'INDIA PRICE DATA: set number could not be identified from this source. Acknowledge price uncertainty; do not state a specific figure.';

  const { data: sp } = await supabase
    .from('store_prices')
    .select('store_id, price_inr, in_stock')
    .eq('set_id', setNumber);

  const priced = (sp ?? [])
    .sort((a: any, b: any) => (INDIA_STORE_PRIORITY[a.store_id] ?? 9) - (INDIA_STORE_PRIORITY[b.store_id] ?? 9));

  if (priced.length > 0) {
    const lines = priced.map((p: any) => {
      const label = INDIA_STORE_LABELS[p.store_id] ?? p.store_id;
      const stock = p.in_stock ? '' : ' (may be out of stock)';
      return `  ${label}: ₹${fmtInr(Number(p.price_inr))}${stock}`;
    });
    return `INDIA PRICE DATA — use these exact figures, do not calculate:\n${lines.join('\n')}`;
  }

  const { data: setRow } = await supabase
    .from('sets')
    .select('lego_mrp_inr')
    .eq('set_number', setNumber)
    .maybeSingle();
  if (setRow?.lego_mrp_inr) {
    return `INDIA PRICE DATA: Official LEGO India MRP ₹${fmtInr(Number(setRow.lego_mrp_inr))} (no live store prices in our database). Use this figure. Mention stores (Toycra / MyBrickHouse / Jaiman) may list it within 4–6 weeks of global launch.`;
  }

  const rate = await fetchLiveUsdInr();
  if (rate) {
    return `INDIA PRICE DATA: no store prices in our database. If the source mentions a USD price, multiply by ${rate} to get a rough INR estimate. Label it explicitly as "estimated import price" — never present it as a confirmed retail price.`;
  }

  return 'INDIA PRICE DATA: no price data available for this set. Acknowledge price uncertainty; do not state a specific figure.';
}

// ── Core generation ───────────────────────────────────────────────────────────

export async function generateBody(
  supabase: SupabaseClient,
  draft: DraftInput,
): Promise<GenerationResult> {
  if (draft.draft_format === null) throw new Error('Draft has no format — re-run RADAR-03');

  const format    = draft.draft_format || 'news';
  const setNumber = extractSetNumber(draft.source_url, draft.source_title ?? null);

  const [fullBody, indiaPriceContext] = await Promise.all([
    fetchFullBody(draft.source_url),
    buildIndiaPriceContext(supabase, setNumber)
      .catch(() => 'INDIA PRICE DATA: price lookup failed. Acknowledge price uncertainty; do not state a specific figure.'),
  ]);

  const content    = fullBody || draft.source_excerpt || draft.source_title || '(no content available)';
  const wordTarget = ({ news: '300–400', review: '500–700', opinion: '400–500', guide: '700–1000' } as Record<string, string>)[format] || '300–400';
  const setLine    = setNumber
    ? `Set number: ${setNumber} (include in title)`
    : 'Set number: NOT FOUND — use India context in title instead';

  const systemPrompt = VOICE_EXAMPLES + OUTPUT_FORMAT;
  const userPrompt   = `Write a BOI-voice ${format} article. Target: ${wordTarget} words in body. Use the exact --- BOI_DRAFT_START --- / --- BOI_DRAFT_END --- markers.

${indiaPriceContext}

SOURCE:
Title     : ${draft.source_title}
URL       : ${draft.source_url}
Published : ${draft.source_published_at || 'unknown'}
${setLine}
${fullBody ? 'Full article body' : 'Excerpt'}: ${content}

--- BOI_DRAFT_START ---
FORMAT: ${format}
TITLE: <your title>
VERDICT: <BUY NOW | WAIT | IMPORT ONLY | AVOID | NONE>
BODY:
<article body — plain text only, no markdown, no asterisks, no bold. Place <!-- INDIA_PARAGRAPH --> on its own line before the India Paragraph.>
--- BOI_DRAFT_END ---`;

  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genai  = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
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
  let title = '', verdict: string | null = null, inBody = false;
  const bodyLines: string[] = [];

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

  if (verdict && !['buy now', 'wait', 'import only', 'avoid'].some(v => body.toLowerCase().includes(v))) {
    body += '\n\n' + (VERDICT_TEMPLATES[verdict] ?? '');
  }

  return { title, body, verdict, format, wordCount: body.split(/\s+/).filter(Boolean).length };
}
