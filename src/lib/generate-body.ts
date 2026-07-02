/**
 * Shared article generation logic — no Next.js imports.
 * Used by: src/app/admin/pending/actions.ts (Server Action context)
 * Mirrored by: scripts/generate-approved-drafts.ts (Node.js / GHA context)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildSystemPrompt,
  buildUserPrompt,
  parseDraftResponse,
  MODEL_CONFIG,
} from './prompts/draft-prompt';

// ── Constants ─────────────────────────────────────────────────────────────────

const SKIP_FETCH_DOMAINS = new Set([
  'rebrickable.com', 'youtube.com', 'reddit.com', 'i.redd.it',
]);
const UA = 'BricksOfIndia-RadarBot/1.0 (+https://bricksofindia.com)';

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
  if (!setNumber) return 'INDIA PRICE DATA: set number could not be identified. Acknowledge price uncertainty; do not state a specific figure.';

  const { data: sp } = await supabase
    .from('store_prices')
    .select('store_id, price_inr, in_stock')
    .eq('set_id', setNumber);

  const INDIA_STORE_PRIORITY: Record<string, number> = { mybrickhouse: 1, toycra: 2 };
  const INDIA_STORE_LABELS:   Record<string, string>  = { mybrickhouse: 'MyBrickHouse', toycra: 'Toycra' };

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
    return `INDIA PRICE DATA: Estimated India price ₹${fmtInr(Number(setRow.lego_mrp_inr))} (converted from US retail; no live store prices, no confirmed India MRP). Present this as an estimate — "expect around ₹X" — NEVER as the official MRP. Mention Toycra / MyBrickHouse may list it within 4–6 weeks.`;
  }

  const rate = await fetchLiveUsdInr();
  if (rate) {
    return `INDIA PRICE DATA: no store prices or official India MRP in our database. You MUST still include a ₹ figure in the India Paragraph — use this formula: USD retail price × 1.35 × ${rate} = estimated INR (the 1.35 factor covers import duty and retailer markup). Example: $99.99 USD → ₹${Math.round(99.99 * 1.35 * rate).toLocaleString('en-IN')} estimated. Round to nearest ₹100. Label it clearly as "estimated import price — not confirmed India retail." If the source does not mention any USD price, use IMPORT ONLY verdict and state the set is not currently available at any official India retailer.`;
  }

  return 'INDIA PRICE DATA: no price data available. Use IMPORT ONLY verdict. State the set is not currently available at any official India retailer, and omit a specific price figure.';
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

  const systemPrompt = buildSystemPrompt();
  const userPrompt   = buildUserPrompt({
    format,
    sourceTitle:       draft.source_title,
    sourceUrl:         draft.source_url,
    sourcePublishedAt: draft.source_published_at,
    setNumber,
    fullBody,
    sourceExcerpt:     draft.source_excerpt,
    indiaPriceContext,
  });

  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genai  = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const result = await genai
    .getGenerativeModel({ model: MODEL_CONFIG.model, systemInstruction: systemPrompt })
    .generateContent({
      contents         : [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig : { temperature: MODEL_CONFIG.temperature, maxOutputTokens: MODEL_CONFIG.maxOutputTokens },
    });

  return parseDraftResponse(result.response.text(), format);
}
