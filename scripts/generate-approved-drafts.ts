/**
 * RADAR-04 (batch) — Generate article bodies for all approved pending_drafts
 * that have no draft_body yet.
 *
 * Runs on GitHub Actions (no Netlify function timeout).
 * Also safe to run locally:
 *   npx tsx --env-file=.env.local scripts/generate-approved-drafts.ts
 *   npx tsx --env-file=.env.local scripts/generate-approved-drafts.ts --limit 3
 *
 * Prompt and lint logic lives in src/lib/prompts/draft-prompt.ts and src/lib/lint.ts.
 * Generation with Gemini→Cerebras failover lives in src/lib/generate-with-failover.ts.
 * Rate: 7 s delay between Gemini calls (free tier: 10 RPM).
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { generateWithFailover, type DraftGenerationInput, type GenerationOutcome } from '../src/lib/generate-with-failover';
import { getSecret } from '../src/lib/get-secret';

// ── CLI flags ─────────────────────────────────────────────────────────────────

const LIMIT = (() => {
  const i = process.argv.indexOf('--limit');
  return i !== -1 ? parseInt(process.argv[i + 1], 10) : 50;
})();

const DRAFT_ID = (() => {
  const i = process.argv.indexOf('--id');
  return i !== -1 ? process.argv[i + 1] : null;
})();

const DELAY_MS = 7000; // 7 s between Gemini calls — stays under 10 RPM free tier

// ── Env ───────────────────────────────────────────────────────────────────────

const SUPABASE_URL    = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY     = getSecret('SUPABASE_SERVICE_ROLE_KEY');
const GEMINI_KEY      = getSecret('GEMINI_API_KEY');
const CEREBRAS_KEY    = getSecret('CEREBRAS_API_KEY');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!GEMINI_KEY) {
  console.error('Missing GEMINI_API_KEY');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// ── Generation constants ──────────────────────────────────────────────────────

const SKIP_FETCH_DOMAINS = new Set([
  'rebrickable.com', 'youtube.com', 'reddit.com', 'i.redd.it',
]);
const UA = 'BricksOfIndia-RadarBot/1.0 (+https://bricksofindia.com)';

const INDIA_STORE_PRIORITY: Record<string, number> = { mybrickhouse: 1, toycra: 2 };
const INDIA_STORE_LABELS:   Record<string, string>  = { mybrickhouse: 'MyBrickHouse', toycra: 'Toycra' };

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchFullBody(url: string): Promise<string | null> {
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
    $('main p').each((_, el: any) => { const t = $(el).text().trim(); if (t) parts.push(t); });
    const joined = parts.join(' ');
    if (joined.length >= 300) return joined.slice(0, 4000);
    return null;
  } catch { return null; }
}

export function extractSetNumber(sourceUrl: string, sourceTitle: string | null): string | null {
  const urlMatch = sourceUrl.match(/\/(?:sets?|products?)\/(\d{4,6})(?:[-/]|$)/i);
  if (urlMatch) return urlMatch[1];
  const titleStr = sourceTitle ?? '';
  const titleMatch = titleStr.match(/\b(\d{4,6})(?:-\d+)?\b/);
  return titleMatch ? titleMatch[1] : null;
}

function fmtInr(n: number): string {
  const s    = Math.round(n).toString();
  const last3 = s.slice(-3);
  const rest  = s.slice(0, -3);
  if (!rest) return last3;
  return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
}

async function fetchLiveUsdInr(): Promise<number | null> {
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(5000) });
    const d = await r.json() as { rates?: { INR?: number } };
    const rate = d?.rates?.INR;
    return (rate && rate > 75 && rate < 130) ? Math.round(rate) : null;
  } catch { return null; }
}

export async function buildIndiaPriceContext(setNumber: string | null): Promise<string> {
  if (!setNumber) return 'INDIA PRICE DATA: set number could not be identified. Acknowledge price uncertainty; do not state a specific figure.';

  const { data: sp } = await sb
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
    return `INDIA PRICE DATA: no store prices or official India MRP in our database. You MUST still include a ₹ figure in the India Paragraph — use this formula: USD retail price × 1.35 × ${rate} = estimated INR (the 1.35 factor covers import duty and retailer markup). Example: $99.99 USD → ₹${Math.round(99.99 * 1.35 * rate).toLocaleString('en-IN')} estimated. Round to nearest ₹100. Label it clearly as "estimated import price — not confirmed India retail." If the source does not mention any USD price, use IMPORT ONLY verdict and state the set is not currently available at any official India retailer.`;
  }

  return 'INDIA PRICE DATA: no price data available. Use IMPORT ONLY verdict. State the set is not currently available at any official India retailer, and omit a specific price figure.';
}

// ── Auto-publish helpers (news only) ─────────────────────────────────────────

function makeSlug(title: string): string {
  return (title || 'untitled')
    .toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')
    .replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const html = await res.text();
    return html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1]
        || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1]
        || null;
  } catch { return null; }
}

function passesAutoPublishGates(outcome: GenerationOutcome): boolean {
  const { body, verdict, wordCount } = outcome;
  if (wordCount < 300 || wordCount > 500) return false;
  if (!body.includes('<!-- INDIA_PARAGRAPH -->')) return false;
  const seg = body.slice(body.indexOf('<!-- INDIA_PARAGRAPH -->'));
  if (!/\b(MyBrickHouse|Toycra)\b/i.test(seg)) return false;
  if (!/₹[\d,]+/.test(seg)) return false;
  if (!['BUY NOW', 'WAIT', 'IMPORT ONLY', 'AVOID'].includes(verdict ?? '')) return false;
  return true;
}

async function autoPublish(draft: any, outcome: GenerationOutcome): Promise<string> {
  const cleanBody = outcome.body
    .replace(/<!--\s*INDIA_PARAGRAPH\s*-->\n?/g, '')
    .replace(/<!--\s*\/INDIAN?_PARAGRAPH\s*-->\n?/g, '')  // /INDIAN_PARAGRAPH is a known model typo
    .trim();
  let baseSlug = makeSlug(outcome.title), slug = baseSlug, attempt = 2;
  while (true) {
    const { data: ex } = await sb.from('news_articles').select('id').eq('slug', slug).maybeSingle();
    if (!ex) break;
    slug = `${baseSlug.slice(0, 57)}-${attempt++}`;
  }
  const excerpt   = cleanBody.replace(/[#*\n]+/g, ' ').trim().slice(0, 160);
  const heroImage = await fetchOgImage(draft.source_url);
  const { error } = await sb.from('news_articles').insert({
    title: outcome.title, slug, content: cleanBody, category: 'News',
    excerpt, hero_image: heroImage || null,
    published_at: new Date().toISOString(),
  });
  if (error) {
    console.error('[supabase-write] table=news_articles op=insert error:', error);
    throw error;
  }
  const { error: markErr } = await sb.from('pending_drafts').update({
    status:                   'published',
    provider:                 outcome.provider,
    requires_manual_approval: false,
    published_url:            `/news/${slug}`,
    published_at:             new Date().toISOString(),
  }).eq('id', draft.id);
  if (markErr) {
    console.error('[supabase-write] table=pending_drafts op=update(autoPublish) error:', markErr);
    // Article already inserted into news_articles — continue; draft state will be stale
  }
  return slug;
}

// ── Per-draft generation wrapper ──────────────────────────────────────────────

async function generateBodyWithFailover(draft: any): Promise<GenerationOutcome> {
  if (!draft.draft_format) throw new Error('Draft has no format — re-run RADAR-03');

  const setNumber = extractSetNumber(draft.source_url, draft.source_title ?? null);

  const [fullBody, indiaPriceContext] = await Promise.all([
    fetchFullBody(draft.source_url),
    buildIndiaPriceContext(setNumber)
      .catch(() => 'INDIA PRICE DATA: price lookup failed. Acknowledge price uncertainty; do not state a specific figure.'),
  ]);

  const input: DraftGenerationInput = {
    format:            draft.draft_format as string,
    sourceTitle:       draft.source_title as string | null,
    sourceUrl:         draft.source_url as string,
    sourcePublishedAt: draft.source_published_at as string | null,
    setNumber,
    fullBody,
    sourceExcerpt:     draft.source_excerpt as string | null,
    indiaPriceContext,
  };

  return generateWithFailover(input, sb, GEMINI_KEY!, CEREBRAS_KEY ?? undefined);
}

// ── Main (entry-point guard — skipped when imported as a module) ──────────────

const IS_MAIN = process.argv[1]?.endsWith('generate-approved-drafts.ts') ||
                process.argv[1]?.endsWith('generate-approved-drafts.js');

if (IS_MAIN) (async () => {
  const t0       = Date.now();
  const limitStr = LIMIT === Infinity ? 'all' : String(LIMIT);
  console.log(`━━ generate-approved-drafts (limit=${limitStr}) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  let q = sb
    .from('pending_drafts')
    .select('id, source_url, source_title, source_excerpt, source_published_at, draft_format, draft_title')
    .eq('status', 'approved')
    .is('draft_body', null)
    .order('created_at', { ascending: true });
  if (DRAFT_ID && DRAFT_ID.length === 36) q = q.eq('id', DRAFT_ID);
  const { data: drafts, error } = await q;

  if (error) throw error;

  // Support short prefix IDs (e.g. "93a23b18") — uuid type has no ilike operator in PG
  const matched = DRAFT_ID && DRAFT_ID.length < 36
    ? (drafts ?? []).filter(d => d.id.startsWith(DRAFT_ID))
    : (drafts ?? []);

  const queue = LIMIT === Infinity ? matched : matched.slice(0, LIMIT);
  console.log(`Approved + awaiting body: ${matched.length} total, processing ${queue.length}\n`);

  if (queue.length === 0) {
    console.log('Nothing to generate.');
    return;
  }

  // ── Insert generator_runs row ──────────────────────────────────────────────
  let runId: string | null = null;
  const trigger = process.env.GITHUB_ACTIONS === 'true'
    ? (process.env.GITHUB_EVENT_NAME ?? 'github_action')
    : 'manual';

  const { data: runRow, error: insertErr } = await sb
    .from('generator_runs')
    .insert({
      trigger,
      drafts_attempted: queue.length,
    })
    .select('id')
    .maybeSingle();

  if (insertErr) {
    console.error('[generator] generator_runs insert failed:', insertErr);
    // Continue run anyway — telemetry failure should not block draft processing
  }
  runId = runRow?.id ?? null;

  let geminiAttempted = 0, geminiOk = 0, geminiLintFailed = 0, geminiRoutedToReview = 0;
  let cerebrasAttempted = 0, cerebrasOk = 0, cerebrasLintFailed = 0, cerebrasRoutedToReview = 0;
  let deferred = 0, failed = 0;

  for (let i = 0; i < queue.length; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, DELAY_MS));

    const draft = queue[i];
    const label = (draft.draft_title || draft.source_title || draft.id).slice(0, 70);
    process.stdout.write(`[${i + 1}/${queue.length}] ${label}... `);

    try {
      const outcome = await generateBodyWithFailover(draft);

      if (outcome.format === 'news' && !outcome.requiresManualApproval && passesAutoPublishGates(outcome)) {
        const publishedSlug = await autoPublish(draft, outcome);
        geminiAttempted++;
        if (outcome.failoverUsed) { cerebrasAttempted++; cerebrasOk++; } else { geminiOk++; }
        const failoverNote = outcome.failoverUsed ? ' [CEREBRAS FAILOVER]' : '';
        console.log(`AUTO-PUBLISHED -> /news/${publishedSlug} (${outcome.wordCount}w, provider=${outcome.provider}${failoverNote})`);
      } else {
        const { error: upErr } = await sb
          .from('pending_drafts')
          .update({
            draft_title:               outcome.title,
            draft_body:                outcome.body,
            draft_verdict:             outcome.verdict,
            draft_format:              outcome.format,
            word_count:                outcome.wordCount,
            status:                    'draft',
            provider:                  outcome.provider,
            requires_manual_approval:  outcome.requiresManualApproval,
            lint_result:               outcome.lintResult ? JSON.parse(JSON.stringify(outcome.lintResult)) : null,
          })
          .eq('id', draft.id);
        if (upErr) {
          console.error('[supabase-write] table=pending_drafts op=update(manualRoute) error:', upErr);
          throw upErr;
        }

        geminiAttempted++;
        // Discriminate: genuine lint failure vs format-routed-to-review (opinion/review/guide).
        // outcome.lintResult.overallPass=true means lint passed but format requires manual review.
        // overallPass=false means lint genuinely failed gates.
        const lintActuallyFailed = outcome.lintResult && !outcome.lintResult.overallPass;
        if (outcome.failoverUsed) {
          cerebrasAttempted++;
          if (lintActuallyFailed) cerebrasLintFailed++; else cerebrasRoutedToReview++;
        } else {
          if (lintActuallyFailed) geminiLintFailed++; else geminiRoutedToReview++;
        }
        const failoverNote = outcome.failoverUsed ? ' [CEREBRAS FAILOVER]' : '';
        const manualNote   = outcome.requiresManualApproval ? ' [MANUAL REVIEW REQUIRED]' : '';
        const lintNote     = outcome.lintResult && !outcome.lintResult.overallPass ? ' [LINT WARN]' : '';
        console.log(`OK -> pending review (${outcome.wordCount}w, verdict=${outcome.verdict ?? 'none'}, provider=${outcome.provider}${failoverNote}${manualNote}${lintNote})`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);

      // Gemini retryable + Cerebras ineligible → deferred (excerpt too short)
      if (msg.includes('Cerebras not eligible')) {
        geminiAttempted++;  // Gemini was tried (retryable fail); Cerebras ineligible
        deferred++;
        console.log(`DEFERRED: ${msg.slice(0, 200)}`);
        continue;
      }

      geminiAttempted++;
      failed++;
      console.log(`FAIL: ${msg.slice(0, 200)}`);
      if (msg.includes('[429')) {
        console.log('Rate limit (429) — stopping batch to avoid quota waste.');
        break;
      }
    }
  }

  // ── Update generator_runs row ──────────────────────────────────────────────
  if (runId) {
    const providerStats = {
      gemini:   { attempted: geminiAttempted,   ok: geminiOk,   lint_failed: geminiLintFailed,   routed_to_review: geminiRoutedToReview },
      cerebras: { attempted: cerebrasAttempted, ok: cerebrasOk, lint_failed: cerebrasLintFailed, routed_to_review: cerebrasRoutedToReview },
    };
    const { error: updateErr } = await sb
      .from('generator_runs')
      .update({
        ended_at:                new Date().toISOString(),
        drafts_succeeded:        geminiOk + cerebrasOk,
        drafts_lint_failed:      geminiLintFailed + cerebrasLintFailed,
        drafts_deferred:         deferred,
        drafts_routed_to_review: geminiRoutedToReview + cerebrasRoutedToReview,
        drafts_failed:           failed,
        provider_stats:          providerStats,
      })
      .eq('id', runId);
    if (updateErr) {
      console.error('[generator] generator_runs update failed:', updateErr);
      // Telemetry failure — run completed; do not re-throw
    }
  }

  const total = geminiOk + cerebrasOk;
  const routed = geminiRoutedToReview + cerebrasRoutedToReview;
  const lintFailed = geminiLintFailed + cerebrasLintFailed;
  const dur   = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nSUMMARY: ${total} auto-published (${geminiOk} gemini, ${cerebrasOk} cerebras), ${routed} routed to review, ${lintFailed} lint failed, ${failed} failed, ${deferred} deferred of ${queue.length} — ${dur}s total`);
})().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
