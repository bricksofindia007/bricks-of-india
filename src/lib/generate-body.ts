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

const VOICE_EXAMPLES = `You write for Bricks of India, an Indian LEGO blog. Your readers are Indian LEGO fans who want honest, fun, easy-to-read articles. Write like a smart friend explaining something over chai — casual, witty, direct.

NEVER use: UK slang, literary prose, magazine language, words like pinnacle / testament / cognoscenti / whimsical / bloke / fever dreams / siren call / unadulterated.

ALWAYS: mention wallet or price pain early, write in simple Indian English, include the India Paragraph (use exact store prices from the INDIA PRICE DATA provided — do not calculate), end with a verdict (BUY / WAIT FOR SALE / IMPORT ONLY / SKIP).

India Paragraph format: place <!-- INDIA_PARAGRAPH --> on its own line before it. State the INR price from each store using the exact figures in INDIA PRICE DATA. Mention 4–6 week India lag if the set is not yet available. Give one relatable Indian price comparison (chai / paneer butter masala / months of Spotify / autorickshaw rides).

Word count: 300–400 words for news, 500–700 for review, 400–500 for opinion.`;

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

const VERDICT_TEMPLATES: Record<string, string> = {
  'BUY':           'Verdict: BUY. The price is right — grab it.',
  'WAIT FOR SALE': 'Verdict: WAIT FOR SALE. Decent set, but wait for a discount.',
  'IMPORT ONLY':   'Verdict: IMPORT ONLY. Worth it if you can handle the customs markup.',
  'SKIP':          'Verdict: SKIP. Save your money for something better.',
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
  const wordTarget = ({ news: '300–400', review: '500–700', opinion: '400–500' } as Record<string, string>)[format] || '300–400';
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
VERDICT: <BUY | WAIT FOR SALE | IMPORT ONLY | SKIP | NONE>

BODY:
<article body — place <!-- INDIA_PARAGRAPH --> on its own line before the India Paragraph block>
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
        verdict = ['BUY', 'WAIT FOR SALE', 'IMPORT ONLY', 'SKIP'].includes(v) ? v : null;
      }
      if (line.trim() === 'BODY:') inBody = true;
    } else { bodyLines.push(line); }
  }

  let body = bodyLines.join('\n').trim();
  if (!title || !body) throw new Error('Gemini response missing TITLE or BODY');

  if (verdict && !['buy', 'wait for sale', 'import only', 'skip'].some(v => body.toLowerCase().includes(v))) {
    body += '\n\n' + (VERDICT_TEMPLATES[verdict] ?? '');
  }

  return { title, body, verdict, format, wordCount: body.split(/\s+/).filter(Boolean).length };
}
