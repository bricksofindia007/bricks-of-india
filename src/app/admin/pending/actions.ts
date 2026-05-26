'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

export async function login(formData: FormData) {
  const pw = (formData.get('password') as string) ?? '';
  const correct = process.env.ADMIN_PASSWORD;
  if (!correct) throw new Error('ADMIN_PASSWORD env var not set');
  if (pw === correct) {
    cookies().set('boi_admin', pw, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 8,
      path: '/admin',
      sameSite: 'strict',
    });
  }
  redirect('/admin/pending');
}

export async function logout() {
  cookies().delete('boi_admin');
  redirect('/admin/pending');
}

export async function approveDraft(formData: FormData) {
  const id         = formData.get('id') as string;
  const redirectTo = (formData.get('redirectTo') as string) || '/admin/pending';
  const supabase   = createServerClient();
  await supabase
    .from('pending_drafts')
    .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: 'admin' })
    .eq('id', id);
  redirect(redirectTo);
}

export async function rejectDraft(formData: FormData) {
  const id         = formData.get('id') as string;
  const redirectTo = (formData.get('redirectTo') as string) || '/admin/pending';
  const supabase   = createServerClient();
  await supabase
    .from('pending_drafts')
    .update({ status: 'rejected' })
    .eq('id', id);
  redirect(redirectTo);
}

export async function approveAll(formData: FormData) {
  const format     = (formData.get('format') as string) || null;
  const domain     = (formData.get('domain') as string) || null;
  const redirectTo = (formData.get('redirectTo') as string) || '/admin/pending';
  const supabase   = createServerClient();

  let q = supabase
    .from('pending_drafts')
    .select('id')
    .eq('status', 'draft')
    .is('iteration_label', null);

  if (format) q = q.eq('draft_format', format);
  if (domain) q = q.ilike('source_url', `%${domain}%`);

  const { data } = await q;
  const ids = (data ?? []).map((r: any) => r.id);

  for (let i = 0; i < ids.length; i += 100) {
    await supabase
      .from('pending_drafts')
      .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: 'admin' })
      .in('id', ids.slice(i, i + 100));
  }

  redirect(redirectTo);
}

// ── Generate Article (on-demand, single draft) ────────────────────────────────

const SKIP_FETCH_DOMAINS = new Set(['rebrickable.com', 'youtube.com', 'reddit.com', 'i.redd.it']);
const UA = 'BricksOfIndia-RadarBot/1.0 (+https://bricksofindia.com)';

async function fetchFullBody(url: string): Promise<string | null> {
  let hostname: string;
  try { hostname = new URL(url).hostname.replace(/^www\./, ''); }
  catch { return null; }
  if (SKIP_FETCH_DOMAINS.has(hostname)) return null;

  try {
    // Dynamic import — cheerio is a devDep, import only at runtime
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
    // Paragraph fallback
    const parts: string[] = [];
    $('main p').each((_, el) => { const t = $(el).text().trim(); if (t) parts.push(t); });
    const joined = parts.join(' ');
    if (joined.length >= 300) return joined.slice(0, 4000);
    return null;
  } catch { return null; }
}

const FORMAT_ADDENDUM: Record<string, string> = {
  news: `
---
FORMAT RULES — NEWS ARTICLE:
- Length: 300–400 words in BODY. Title MUST include set number (if available) + "India".
- Opening: Start on something Indian (wallet pain, chai, EMI, traffic). Pivot to LEGO in 1–2 sentences.
- No host introduction. No "Hello Brickfans."
- Sign-off: "On that bombshell..." variants only. Never "Bubyee."
- VERDICT IN BODY: BUY / WAIT FOR SALE / IMPORT ONLY / SKIP — as explicit statement before sign-off.`,
  review: `
---
FORMAT RULES — SET REVIEW:
- Length: 500–700 words in BODY. Title formula: "Worth ₹[INR price] in India?"
- Opening: Indian hook, pivot to LEGO. No host intro.
- Sign-off: "On that bombshell..." only.
- VERDICT IN BODY: explicit statement before sign-off.`,
  opinion: `
---
FORMAT RULES — OPINION PIECE:
- Length: 400–500 words in BODY. Title MUST reference India/wallet/price context.
- Opening: Indian hook, pivot to LEGO. No host intro.
- Sign-off: "On that bombshell..." only.
- VERDICT IN BODY: explicit statement before sign-off.`,
};

const INDIA_PARAGRAPH_SPEC = `
---
INDIA PARAGRAPH — MANDATORY (single consolidated block):
Place <!-- INDIA_PARAGRAPH --> on its own line immediately before this block. Write the block as normal prose.
Must contain:
(a) INR price: use exact store prices from INDIA PRICE DATA when provided. If absent, multiply USD MSRP × current USD/INR rate (no additional multiplier). Label as estimate if computed.
(b) Availability: which stores (Toycra, MyBrickHouse, Jaiman) or "import only".
(c) India lag: 4–6 week delay or "no official India launch".
(d) One relatable Indian comparison (biryani plates, Spotify months, EMI, etc.).`;

// VOICE_EXAMPLES: simple system prompt — casual Indian English, no exemplar.
const VOICE_EXAMPLES = `You write for Bricks of India, an Indian LEGO blog. Your readers are Indian LEGO fans who want honest, fun, easy-to-read articles. Write like a smart friend explaining something over chai — casual, witty, direct.

NEVER use: UK slang, literary prose, magazine language, words like pinnacle / testament / cognoscenti / whimsical / bloke / fever dreams / siren call / unadulterated.

ALWAYS: mention wallet or price pain early, write in simple Indian English, include the India Paragraph (use exact store prices from the INDIA PRICE DATA provided — do not calculate), end with a verdict (BUY / WAIT FOR SALE / IMPORT ONLY / SKIP).

India Paragraph format: place <!-- INDIA_PARAGRAPH --> on its own line before it. State the INR price from each store using the exact figures in INDIA PRICE DATA. Mention 4–6 week India lag if the set is not yet available. Give one relatable Indian price comparison (chai / paneer butter masala / months of Spotify / autorickshaw rides).

Word count: 300–400 words for news, 500–700 for review, 400–500 for opinion.`;


const ANTI_PATTERNS = `
---
ANTI-PATTERNS — DO NOT USE:
• "Hello Brickfans" / host introduction of any kind
• "Bubyee" / YouTube sign-offs — website ends "On that bombshell..." only
• Source site's framing ("today's random set", "today we're talking about")
• Asserting ungrounded facts (piece counts, themes, dates not in SOURCE)
• "my friends" / "folks" — Clarkson register is aloof, not folksy
• Do not announce what you are about to do. Just do it.`;

// OUTPUT_FORMAT is always the final item in systemPrompt — isolated from voice content
// so the structural requirement is never buried under style guidance.
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

// ── Core generation helper (shared by single and batch flows) ────────────────

type DraftInput = {
  source_url: string;
  source_title: string | null;
  source_excerpt: string | null;
  source_published_at: string | null;
  draft_format: string | null;
};

type GenerationResult = {
  title: string;
  body: string;
  verdict: string | null;
  format: string;
  wordCount: number;
};

async function generateBody(
  supabase: ReturnType<typeof createServerClient>,
  draft: DraftInput,
): Promise<GenerationResult> {
  if (draft.draft_format === null) throw new Error('Draft has no format — re-run RADAR-03');

  const format    = (draft.draft_format as string) || 'news';
  const setNumber = extractSetNumber(draft.source_url, draft.source_title ?? null);

  const [fullBody, indiaPriceContext] = await Promise.all([
    fetchFullBody(draft.source_url),
    buildIndiaPriceContext(supabase, setNumber)
      .catch(() => 'INDIA PRICE DATA: price lookup failed. Acknowledge price uncertainty; do not state a specific figure.'),
  ]);

  const content    = fullBody || draft.source_excerpt || draft.source_title || '(no content available)';
  const wordTarget = { news: '300–400', review: '500–700', opinion: '400–500' }[format] || '300–400';
  const setLine    = setNumber
    ? `Set number: ${setNumber} (include in title)`
    : 'Set number: NOT FOUND — use India context in title instead';

  const systemPrompt = VOICE_EXAMPLES + OUTPUT_FORMAT;

  const userPrompt = `Write a BOI-voice ${format} article. Target: ${wordTarget} words in body. Use the exact --- BOI_DRAFT_START --- / --- BOI_DRAFT_END --- markers.

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
        verdict = ['BUY','WAIT FOR SALE','IMPORT ONLY','SKIP'].includes(v) ? v : null;
      }
      if (line.trim() === 'BODY:') inBody = true;
    } else { bodyLines.push(line); }
  }

  let body = bodyLines.join('\n').trim();
  if (!title || !body) throw new Error('Gemini response missing TITLE or BODY');

  const VERDICT_TEMPLATES: Record<string, string> = {
    'BUY':           'Verdict: BUY. The price is right — grab it.',
    'WAIT FOR SALE': 'Verdict: WAIT FOR SALE. Decent set, but wait for a discount.',
    'IMPORT ONLY':   'Verdict: IMPORT ONLY. Worth it if you can handle the customs markup.',
    'SKIP':          'Verdict: SKIP. Save your money for something better.',
  };
  if (verdict && !['buy','wait for sale','import only','skip'].some(v => body.toLowerCase().includes(v))) {
    body += '\n\n' + VERDICT_TEMPLATES[verdict];
  }

  return { title, body, verdict, format, wordCount: body.split(/\s+/).filter(Boolean).length };
}

// ── Generate Article (single draft, operator-initiated) ───────────────────────

export async function generateArticle(formData: FormData) {
  const id         = formData.get('id') as string;
  const redirectTo = (formData.get('redirectTo') as string) || '/admin/pending?status=approved';
  try {
    const supabase = createServerClient();

    const { data: draft, error } = await supabase
      .from('pending_drafts')
      .select('id, source_url, source_title, source_excerpt, source_published_at, draft_format')
      .eq('id', id)
      .single();

    if (error || !draft) throw new Error(`Draft not found: ${error?.message}`);

    const { title, body, verdict, format, wordCount } = await generateBody(supabase, draft);

    await supabase
      .from('pending_drafts')
      .update({ draft_title: title, draft_body: body, draft_verdict: verdict, draft_format: format, word_count: wordCount, status: 'draft' })
      .eq('id', id);

    revalidatePath('/admin/pending');
    redirect(redirectTo);
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_REDIRECT')) throw err;
    console.error('GEN FATAL:', err);
    const msg = err instanceof Error ? err.message : String(err);
    const sep = redirectTo.includes('?') ? '&' : '?';
    redirect(`${redirectTo}${sep}genError=${encodeURIComponent(msg)}&genDraftId=${encodeURIComponent(id)}`);
  }
}

// ── Generate one draft for batch — called from client, returns result ─────────
// Each invocation is a separate server request; the 7s inter-call delay
// lives in the client component, so no function timeout risk.

export async function generateOneForBatch(
  id: string,
): Promise<{ ok: true; title: string } | { ok: false; error: string }> {
  const pw = cookies().get('boi_admin')?.value;
  if (!pw || pw !== process.env.ADMIN_PASSWORD) return { ok: false, error: 'Unauthorized' };

  const supabase = createServerClient();
  const { data: draft, error } = await supabase
    .from('pending_drafts')
    .select('id, source_url, source_title, source_excerpt, source_published_at, draft_format')
    .eq('id', id)
    .single();

  if (error || !draft) return { ok: false, error: `Draft not found: ${error?.message}` };

  try {
    const { title, body, verdict, format, wordCount } = await generateBody(supabase, draft);
    await supabase
      .from('pending_drafts')
      .update({ draft_title: title, draft_body: body, draft_verdict: verdict, draft_format: format, word_count: wordCount, status: 'draft' })
      .eq('id', id);
    return { ok: true, title };
  } catch (err: any) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Publish helpers ───────────────────────────────────────────────────────────

function generateSlug(title: string): string {
  return (title || 'untitled')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function resolveTarget(format: string): { table: string; path: string; category: string } {
  if (format === 'opinion') return { table: 'blog_posts',    path: '/blog', category: 'Opinion' };
  if (format === 'review')  return { table: 'news_articles', path: '/news', category: 'Review'  };
  return                           { table: 'news_articles', path: '/news', category: 'News'    };
}

async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const { load } = await import('cheerio');
    const $ = load(html);
    const og = $('meta[property="og:image"]').attr('content') ||
               $('meta[property="twitter:image"]').attr('content');
    return (og && og.startsWith('http')) ? og : null;
  } catch { return null; }
}

// Extract a LEGO set number from a source URL or title.
// URL pattern covers Brickset, Rebrickable, LEGO shop paths like /products/12345 or /sets/12345-1/.
// Title regex catches "Set 12345", "12345-1", or a bare 4-6 digit number.
function extractSetNumber(sourceUrl: string, sourceTitle: string | null): string | null {
  const urlMatch = sourceUrl.match(/\/(?:sets?|products?)\/(\d{4,6})(?:[-\/]|$)/i);
  if (urlMatch) return urlMatch[1];
  const titleStr = sourceTitle ?? '';
  const titleMatch = titleStr.match(/\b(\d{4,6})(?:-\d+)?\b/);
  return titleMatch ? titleMatch[1] : null;
}

const INDIA_STORE_PRIORITY: Record<string, number> = { mybrickhouse: 1, toycra: 2, jaiman: 3 };
const INDIA_STORE_LABELS: Record<string, string>   = { mybrickhouse: 'MyBrickHouse', toycra: 'Toycra', jaiman: 'Jaiman Toys' };

function fmtInr(n: number): string {
  const s = Math.round(n).toString();
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
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

// Build the India price context string to inject into the Gemini userPrompt.
// Priority: live store_prices → lego_mrp_inr → live-rate estimate → unknown.
async function buildIndiaPriceContext(
  supabase: ReturnType<typeof import('@/lib/supabase').createServerClient>,
  setNumber: string | null,
): Promise<string> {
  if (!setNumber) return 'INDIA PRICE DATA: set number could not be identified from this source. Acknowledge price uncertainty; do not state a specific figure.';

  // 1. Live store prices
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

  // 2. LEGO India MRP from sets table
  const { data: setRow } = await supabase
    .from('sets')
    .select('lego_mrp_inr')
    .eq('set_number', setNumber)
    .maybeSingle();
  if (setRow?.lego_mrp_inr) {
    return `INDIA PRICE DATA: Official LEGO India MRP ₹${fmtInr(Number(setRow.lego_mrp_inr))} (no live store prices in our database). Use this figure. Mention stores (Toycra / MyBrickHouse / Jaiman) may list it within 4–6 weeks of global launch.`;
  }

  // 3. Live rate estimate (no store or MRP data)
  const rate = await fetchLiveUsdInr();
  if (rate) {
    return `INDIA PRICE DATA: no store prices in our database. If the source mentions a USD price, multiply by ${rate} to get a rough INR estimate. Label it explicitly as "estimated import price" — never present it as a confirmed retail price.`;
  }

  return 'INDIA PRICE DATA: no price data available for this set. Acknowledge price uncertainty; do not state a specific figure.';
}

// ── WEB-01 lint gates ────────────────────────────────────────────────────────

// pass: ±10% of format target bounds — PASS zone (auto-merge eligible)
// fail: ±25% of format target bounds — hard FAIL beyond this (WARN between pass and fail)
const WORD_COUNT_TARGETS: Record<string, { pass: [number, number]; fail: [number, number] }> = {
  news    : { pass: [270, 440],  fail: [225, 500]  },  // target 300–400
  review  : { pass: [450, 770],  fail: [375, 875]  },  // target 500–700
  opinion : { pass: [360, 550],  fail: [300, 625]  },  // target 400–500
};
const VALID_VERDICTS = new Set(['BUY', 'WAIT FOR SALE', 'IMPORT ONLY', 'SKIP']);

// Comparison terms drawn from INDIA_PARAGRAPH_SPEC examples — broad intentionally.
const INDIA_COMPARISON_RE = /\b(biryani|chai|EMI|Spotify|Netflix|petrol|samosa|litre|liter|movie.?ticket|PVR|butter.?chicken|Swiggy|Zomato|iPhone|months? of|weeks? of|auto.?rickshaw)\b/i;
const INDIA_STORE_RE      = /\b(Toycra|MyBrickHouse|Jaiman|import.?only)\b/i;

function lintDraft(draft: {
  draft_body: string | null;
  draft_verdict: string | null;
  draft_format: string | null;
  word_count: number | null;
}): { warnings: string[] } {
  const body      = draft.draft_body || '';
  const format    = draft.draft_format || 'news';
  const wordCount = draft.word_count ?? body.split(/\s+/).filter(Boolean).length;
  const warnings: string[] = [];

  // Gate 1 — Word count: 3-state (PASS / WARN / FAIL)
  const targets        = WORD_COUNT_TARGETS[format] ?? WORD_COUNT_TARGETS.news;
  const [pMin, pMax]   = targets.pass;
  const [fMin, fMax]   = targets.fail;
  if (wordCount < fMin || wordCount > fMax) {
    throw new Error(
      `[Gate 1 FAIL] Word count ${wordCount} exceeds hard limit ${fMin}–${fMax} for '${format}'. Regenerate or heavily edit.`
    );
  }
  if (wordCount < pMin || wordCount > pMax) {
    warnings.push(`[Gate 1 WARN] Word count ${wordCount} outside target ${pMin}–${pMax} for '${format}'.`);
  }

  // Gate 2 — India Paragraph: all 4 components required in the block after the marker
  const markerIdx = body.indexOf('<!-- INDIA_PARAGRAPH -->');
  if (markerIdx === -1) {
    throw new Error('[Gate 2 FAIL] <!-- INDIA_PARAGRAPH --> marker missing. Regenerate the article.');
  }
  const indiaSeg = body.slice(markerIdx);
  if (!/₹[\d,]+/.test(indiaSeg)) {
    throw new Error('[Gate 2 FAIL] No INR price (₹NNN) found in India Paragraph. Regenerate or edit.');
  }
  if (!INDIA_STORE_RE.test(indiaSeg)) {
    throw new Error('[Gate 2 FAIL] No availability statement (Toycra / MyBrickHouse / Jaiman / "import only") found in India Paragraph.');
  }
  if (!INDIA_COMPARISON_RE.test(indiaSeg)) {
    throw new Error('[Gate 2 FAIL] No relatable Indian comparison found in India Paragraph (expected: biryani, EMI, Spotify months, petrol, etc.).');
  }

  // Gate 3 — Verdict enum: enforced for all formats (Codex: no article publishes without a verdict)
  const v = (draft.draft_verdict || '').trim().toUpperCase();
  if (!VALID_VERDICTS.has(v)) {
    throw new Error(
      `[Gate 3 FAIL] Verdict '${draft.draft_verdict || 'none'}' is not in [BUY, WAIT FOR SALE, IMPORT ONLY, SKIP]. Set a valid verdict before publishing.`
    );
  }

  // Gate 4 (hero image HTTP 200) runs in publishDraft() after fetchOgImage() — see below.

  return { warnings };
}

// Sends a lint-failure alert to the operator. Never throws — lint error must propagate unmasked.
async function sendLintAlert(draftTitle: string, gateMessage: string): Promise<void> {
  try {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from:    'Bricks of India <abhinav@bricksofindia.com>',
      to:      'abhinav@bricksofindia.com',
      subject: `[BOI Lint FAIL] ${draftTitle.slice(0, 60)}`,
      text: [
        'A draft failed lint gates and was NOT published.',
        '',
        `Draft:  ${draftTitle}`,
        `Error:  ${gateMessage}`,
        '',
        'Fix the draft in /admin/pending and try publishing again.',
        'https://bricksofindia.com/admin/pending',
      ].join('\n'),
    });
  } catch (mailErr: any) {
    console.error('[sendLintAlert] email failed:', mailErr?.message);
  }
}

export async function publishDraft(formData: FormData) {
  const id         = formData.get('id') as string;
  const redirectTo = (formData.get('redirectTo') as string) || '/admin/pending?status=approved';
  const supabase   = createServerClient();

  const { data: draft, error: fetchErr } = await supabase
    .from('pending_drafts')
    .select('id, draft_title, draft_body, draft_verdict, draft_format, word_count, source_url, source_title')
    .eq('id', id)
    .single();

  if (fetchErr || !draft) throw new Error(`Draft not found: ${fetchErr?.message}`);
  if (!draft.draft_body)  throw new Error('Draft has no generated body — click Generate Article first');

  // WEB-01: lint gates 1–3 (sync) — throws on FAIL, returns WARN strings
  let lintWarnings: string[] = [];
  try {
    ({ warnings: lintWarnings } = lintDraft(draft));
  } catch (lintErr: any) {
    await sendLintAlert(draft.draft_title || draft.source_title || 'Untitled', lintErr.message);
    throw lintErr;
  }
  if (lintWarnings.length > 0) console.warn('[publishDraft lint]', lintWarnings.join(' | '));

  const format   = draft.draft_format || 'news';
  const { table, path, category } = resolveTarget(format);
  const title    = draft.draft_title || draft.source_title || 'Untitled';
  const baseSlug = generateSlug(title);

  let slug = baseSlug, attempt = 2;
  while (true) {
    const { data: existing } = await supabase.from(table).select('id').eq('slug', slug).maybeSingle();
    if (!existing) break;
    slug = `${baseSlug.slice(0, 57)}-${attempt++}`;
  }

  // Fetch OG image from source — 5s timeout, fall back to null gracefully
  let heroImage = await fetchOgImage(draft.source_url);
  console.log(`[publish] source_url=${draft.source_url} og_image_found=${!!heroImage} image_url=${heroImage?.slice(0, 80) ?? 'none'}`);

  // Gate 4 — verify hero image URL returns HTTP 200 (fetchOgImage extracts the URL but does
  // not verify the image itself). Network errors are WARN-only; a bad status is a hard FAIL.
  if (heroImage) {
    try {
      const imgRes = await fetch(heroImage, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
      if (!imgRes.ok) {
        const gate4Err = new Error(`[Gate 4 FAIL] Hero image URL returned HTTP ${imgRes.status} — source may have a broken OG image.`);
        await sendLintAlert(draft.draft_title || draft.source_title || 'Untitled', gate4Err.message);
        throw gate4Err;
      }
    } catch (err: any) {
      if (err.message?.startsWith('[Gate 4 FAIL]')) throw err;
      // Network error (timeout, DNS failure) — WARN only, proceed without blocking publish
      console.warn(`[Gate 4 WARN] Could not verify hero image (${err.message}) — proceeding.`);
    }
  }

  // Dedup guard — if this exact image URL is already used in the target table, try a
  // Rebrickable set image as fallback before dropping to null.
  if (heroImage) {
    const { data: imgConflict } = await supabase.from(table).select('id').eq('hero_image', heroImage).maybeSingle();
    if (imgConflict) {
      console.warn(`[publish] hero image already used in ${table} — attempting Rebrickable fallback`);
      heroImage = null;

      const setNum = extractSetNumber(draft.source_url, draft.source_title ?? null);
      if (setNum) {
        const { data: setRow } = await supabase
          .from('sets')
          .select('image_url')
          .eq('set_number', setNum)
          .maybeSingle();
        const candidate = setRow?.image_url ?? null;
        if (candidate) {
          // Ensure this fallback image isn't already used either
          const { data: fallbackConflict } = await supabase
            .from(table)
            .select('id')
            .eq('hero_image', candidate)
            .maybeSingle();
          if (!fallbackConflict) {
            // HEAD-verify the fallback URL before accepting it
            try {
              const fbRes = await fetch(candidate, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
              if (fbRes.ok) {
                heroImage = candidate;
                console.log(`[publish] Rebrickable fallback accepted: ${candidate.slice(0, 80)}`);
              } else {
                console.warn(`[publish] Rebrickable fallback returned HTTP ${fbRes.status} — dropping to null`);
              }
            } catch {
              console.warn('[publish] Rebrickable fallback HEAD check timed out — dropping to null');
            }
          } else {
            console.warn('[publish] Rebrickable fallback image also already in use — dropping to null');
          }
        } else {
          console.warn(`[publish] No sets.image_url found for set ${setNum} — dropping to null`);
        }
      } else {
        console.warn('[publish] Could not extract set number from source — dropping to null');
      }
    }
  }

  // Strip <!-- INDIA_PARAGRAPH --> structural marker — present in new drafts, no-op on old ones
  const cleanBody = draft.draft_body.replace(/<!--\s*INDIA_PARAGRAPH\s*-->\n?/g, '');

  const excerpt = cleanBody.replace(/#{1,6}\s/g, '').replace(/\*+([^*]+)\*+/g, '$1').replace(/\s+/g, ' ').trim().slice(0, 160);
  const now = new Date().toISOString();

  const { error: insertErr } = await supabase.from(table).insert({
    title, slug, content: cleanBody, category, excerpt,
    published_at: now, seo_title: title, seo_description: excerpt,
    ...(heroImage ? { hero_image: heroImage } : {}),
  });
  if (insertErr) throw new Error(`Publish failed (${table}): ${insertErr.message}`);

  await supabase.from('pending_drafts').update({ status: 'published', published_url: `${path}/${slug}` }).eq('id', id);

  revalidatePath(path);
  redirect(redirectTo);
}
