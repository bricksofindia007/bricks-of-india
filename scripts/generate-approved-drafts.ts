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
 * Rate: rolling 10-calls/60s window (free tier RPM) plus a 4-6s minimum gap
 * between consecutive calls — the window alone permits bursting all 10 calls
 * in under a second, which is correct for total-volume RPM but still looks
 * like a burst/QPS spike server-side. Pacing applies at any billing tier.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { generateWithFailover, BothProvidersFailedError, type DraftGenerationInput, type GenerationOutcome } from '../src/lib/generate-with-failover';
import { getSecret } from '../src/lib/get-secret';
import { passesAutoPublishGates } from '../src/lib/auto-publish-gate';
import { publishOneDraft } from '../src/lib/publish-draft';

// ── CLI flags ─────────────────────────────────────────────────────────────────

const LIMIT = (() => {
  const i = process.argv.indexOf('--limit');
  return i !== -1 ? parseInt(process.argv[i + 1], 10) : 50;
})();

const DRAFT_ID = (() => {
  const i = process.argv.indexOf('--id');
  return i !== -1 ? process.argv[i + 1] : null;
})();

// Token-bucket rate limiter: tracks the wall-clock timestamp of each Gemini
// slot acquisition. Before each call we ensure fewer than GEMINI_RPM_LIMIT
// slots have been taken within the rolling GEMINI_WINDOW_MS window.
// This is more precise than the old fixed DELAY_MS approach: a fixed pre-call
// sleep can't account for cases where many calls fail quickly (< 1 s each),
// which could put 8-9 calls into a single 60 s window and trigger Gemini's
// rolling-window rate limit even though each individual inter-call gap was ≥ 7 s.
const GEMINI_RPM_LIMIT = 10;
const GEMINI_WINDOW_MS = 60_000;
const _geminiCallLog: number[] = [];

// Inter-request pacing (2026-07-05): the rolling-window limiter above bounds
// total calls per minute but not their spacing — it will happily let all 10
// through in under a second if the window is otherwise empty. That's correct
// for RPM accounting but still bursty enough to look like a QPS spike to
// Gemini's servers, independent of which billing tier/quota applies. Enforce
// a minimum 4-6s (randomized, not a fixed cadence) gap between consecutive
// calls on top of the window check.
const GEMINI_MIN_GAP_MS = 4_000;
const GEMINI_MAX_GAP_MS = 6_000;
let _lastGeminiCallAt = 0;

async function acquireGeminiSlot(): Promise<void> {
  while (true) {
    const now = Date.now();
    while (_geminiCallLog.length > 0 && now - _geminiCallLog[0] >= GEMINI_WINDOW_MS) {
      _geminiCallLog.shift();
    }
    if (_geminiCallLog.length >= GEMINI_RPM_LIMIT) {
      const waitMs = GEMINI_WINDOW_MS - (now - _geminiCallLog[0]) + 150;
      console.log(`  [rate-limit] ${_geminiCallLog.length}/10 slots used in last 60 s — waiting ${(waitMs / 1000).toFixed(1)} s`);
      await new Promise<void>(r => setTimeout(r, waitMs));
      continue;
    }

    const targetGap = GEMINI_MIN_GAP_MS + Math.random() * (GEMINI_MAX_GAP_MS - GEMINI_MIN_GAP_MS);
    const sinceLastCall = now - _lastGeminiCallAt;
    if (_lastGeminiCallAt > 0 && sinceLastCall < targetGap) {
      const waitMs = targetGap - sinceLastCall;
      console.log(`  [pacing] ${(sinceLastCall / 1000).toFixed(1)} s since last call — waiting ${(waitMs / 1000).toFixed(1)} s more`);
      await new Promise<void>(r => setTimeout(r, waitMs));
      continue;
    }

    _geminiCallLog.push(now);
    _lastGeminiCallAt = now;
    return;
  }
}

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

// ── Auto-publish ──────────────────────────────────────────────────────────────
// makeSlug() and the local fetchOgImage() were removed 2026-06-28 — superseded
// by generateSlug() and the full hero-image resolution chain in
// src/lib/publish-draft.ts, used via publishOneDraft() below.

// Unified 2026-06-28 (full merge with publish-drafts.mjs / actions.ts):
// autoPublish() now delegates to the shared publishOneDraft() in
// src/lib/publish-draft.ts instead of its own news-only, no-hero-fallback-
// guarantee, no-review-schema implementation. This is what actually lets
// review/opinion/guide drafts auto-publish on a clean gate pass (Abhinav,
// this session: "let review/opinion/guide auto-publish too, IF they pass
// the exact same gates as news") — passesAutoPublishGates() already checks
// outcome.lintResult.overallPass uniformly per format; this function used
// to only know how to write to news_articles regardless of format, which
// would have silently mislabeled review/opinion/guide content. Now it uses
// the same resolveTarget()/insert/hero-fallback path as every other publish
// call site, including the verdict+set_number columns for review-format
// (feeds buildReviewSchema()).
//
// The outcome's lintResult was already computed moments ago by
// generateBodyWithFailover() — constructing updated_at as "now" makes
// publishOneDraft's freshness check correctly skip a redundant live re-lint
// of something this process just linted itself.
async function autoPublish(draft: any, outcome: GenerationOutcome): Promise<{ path: string; slug: string }> {
  const publishable = {
    id:               draft.id,
    draft_title:      outcome.title,
    draft_body:       outcome.body,
    draft_verdict:    outcome.verdict,
    draft_format:     outcome.format,
    word_count:       outcome.wordCount,
    source_url:       draft.source_url,
    source_title:     draft.source_title,
    source_excerpt:   draft.source_excerpt,
    lint_result:      outcome.lintResult,
    updated_at:       new Date().toISOString(),
  };

  const { path, slug } = await publishOneDraft(publishable, sb);

  const { error: markErr } = await sb.from('pending_drafts').update({
    provider:                 outcome.provider,
    requires_manual_approval: false,
  }).eq('id', draft.id);
  if (markErr) {
    // publishOneDraft already wrote status='published' + published_url —
    // this second update only adds provider/requires_manual_approval, which
    // are specific to the generation pipeline's telemetry, not something
    // publishOneDraft's shared callers (cron, admin button) need to know.
    console.error('[supabase-write] table=pending_drafts op=update(autoPublish-provider) error:', markErr);
  }

  return { path, slug };
}

// ── Per-draft generation wrapper ──────────────────────────────────────────────

async function generateBodyWithFailover(draft: any, batchOpeners?: string[]): Promise<GenerationOutcome> {
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

  return generateWithFailover(input, sb, GEMINI_KEY!, CEREBRAS_KEY ?? undefined, batchOpeners);
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

  let geminiAttempted = 0, geminiOk = 0, geminiLintFailed = 0;
  let cerebrasAttempted = 0, cerebrasOk = 0, cerebrasLintFailed = 0;
  let deferred = 0, failed = 0, bothFailed = 0;

  // Gate 8 same-batch race fix (2026-07-02): bodies published earlier in THIS
  // run, so a later draft in the same batch can't reuse an opener the DB
  // hasn't been queried for yet (both Jul-1 "Your wallet called…" articles
  // shipped in one batch precisely this way).
  const batchOpeners: string[] = [];

  for (let i = 0; i < queue.length; i++) {
    await acquireGeminiSlot();

    const draft = queue[i];
    const label = (draft.draft_title || draft.source_title || draft.id).slice(0, 70);
    process.stdout.write(`[${i + 1}/${queue.length}] ${label}... `);

    try {
      const outcome = await generateBodyWithFailover(draft, batchOpeners);

      // Policy change 2026-06-28 (Abhinav, this session): "let review/opinion/
      // guide auto-publish too, IF they pass the exact same gates as news (no
      // extra human gate)". Previously this condition was format === 'news'
      // only — MEDIUM-13's deliberate human-gate-regardless-of-pass-fail for
      // other formats is superseded by this decision. passesAutoPublishGates()
      // already checks outcome.lintResult.overallPass uniformly per format
      // (factuality, source fidelity, word count, India paragraph, verdict —
      // see src/lib/auto-publish-gate.ts); Gate 7's hard rules (hard-rules.ts)
      // are also already format-aware on their own merits (e.g. A8 correctly
      // allows first-person build claims for review format). So removing the
      // format restriction here doesn't weaken anything — it just lets every
      // format reach the same already-rigorous gate news always had.
      if (!outcome.requiresManualApproval && passesAutoPublishGates(outcome)) {
        const { path, slug } = await autoPublish(draft, outcome);
        batchOpeners.push(outcome.body);
        geminiAttempted++;
        if (outcome.failoverUsed) { cerebrasAttempted++; cerebrasOk++; } else { geminiOk++; }
        const failoverNote = outcome.failoverUsed ? ' [CEREBRAS FAILOVER]' : '';
        console.log(`AUTO-PUBLISHED -> ${path}/${slug} (${outcome.wordCount}w, format=${outcome.format}, provider=${outcome.provider}${failoverNote})`);
      } else {
        // Reaching this branch means !(if-condition) above, which by De
        // Morgan's law is exactly: requiresManualApproval ||
        // !passesAutoPublishGates(outcome). Every reachable case here is a
        // genuine quality-gate failure — there is no remaining "format
        // requires manual review regardless of pass/fail" population now
        // that today's policy change (auto-publish extended to review/
        // opinion/guide) removed MEDIUM-13's carve-out on one side of this
        // if/else, and the reject+delete policy (also today) removed the
        // "park in status=draft forever" destination on the other side.
        // DEFERRED rows (Cerebras-ineligible + Gemini retryable) never reach
        // this branch at all — they're handled in the catch block below.
        //
        // Policy locked 2026-06-28 (Abhinav, this session): a draft that
        // completes generation but genuinely fails quality gates (factuality,
        // source fidelity, lint, or Gate 7 voice/tone) is rejected and deleted
        // outright rather than parked in pending_drafts indefinitely.
        // Rationale: a row sitting in failed_lint/draft forever provides no
        // value and was the dominant contributor to the unbounded backlog
        // growth — see HIGH-52.
        const failureReasons = [
          ...outcome.hardRules.filter(r => !r.pass).map(r => `gate7:${r.id}`),
          ...(outcome.lintResult?.warnings ?? []),
          !outcome.lintResult ? 'lint_runner_threw' : null,
        ].filter(Boolean).join('; ').slice(0, 500);

        const { error: delErr } = await sb.from('pending_drafts').delete().eq('id', draft.id);
        if (delErr) {
          console.error('[supabase-write] table=pending_drafts op=delete(rejectFailed) error:', delErr);
          throw delErr;
        }

        geminiAttempted++;
        if (outcome.failoverUsed) { cerebrasAttempted++; cerebrasLintFailed++; } else { geminiLintFailed++; }
        const failoverNote = outcome.failoverUsed ? ' [CEREBRAS FAILOVER]' : '';
        console.log(`REJECTED+DELETED (${outcome.wordCount}w, format=${outcome.format}, provider=${outcome.provider}${failoverNote}) — ${failureReasons || 'gate failure'}`);
      }
    } catch (err: unknown) {
      // Policy locked 2026-06-28 (Abhinav, this session): "what fails through
      // Gemini and Cerebras both should be put in a rejected category and
      // [then] deleted" (Abhinav clarified "recycled" was a slip for
      // "deleted" — no ambiguity). Checked via instanceof, not string-
      // matching error.message, for the same robustness reason
      // BothProvidersFailedError exists as a dedicated type — distinct from
      // DEFERRED (Cerebras never attempted, kept retrying) and from a plain
      // Gemini-non-retryable Error (also kept retrying, per Abhinav: only
      // the genuinely-both-attempted-both-failed case gets deleted).
      if (err instanceof BothProvidersFailedError) {
        geminiAttempted++;
        cerebrasAttempted++;
        bothFailed++;
        const reasonForLog = `gemini="${err.geminiMessage.slice(0, 150)}" cerebras="${err.cerebrasMessage.slice(0, 150)}"`;

        // Two-step (status update, then delete) rather than a single delete:
        // if the delete itself fails for any reason, the row is left as
        // status='rejected' with the failure reason recorded, not silently
        // unchanged with no trace — same rationale as the existing
        // reject+delete path below for genuine quality-gate failures.
        const { error: rejErr } = await sb.from('pending_drafts').update({
          status: 'rejected',
          discard_reason: `both_providers_failed: ${reasonForLog}`.slice(0, 500),
        }).eq('id', draft.id);
        if (rejErr) {
          console.error('[supabase-write] table=pending_drafts op=update(bothProvidersFailed) error:', rejErr);
        }

        const { error: delErr } = await sb.from('pending_drafts').delete().eq('id', draft.id);
        if (delErr) {
          console.error('[supabase-write] table=pending_drafts op=delete(bothProvidersFailed) error:', delErr);
          // Row stays as status='rejected' with the reason above — acceptable
          // degraded state, not silent data loss.
        } else {
          console.log(`REJECTED+DELETED (both providers failed) — ${reasonForLog}`);
        }
        continue;
      }

      const msg = err instanceof Error ? err.message : String(err);
      const statusMatch = msg.match(/\[(\d{3})/);
      const status = statusMatch ? statusMatch[1] : 'unknown';

      // Gemini retryable + Cerebras ineligible → deferred (excerpt too short)
      if (msg.includes('Cerebras not eligible')) {
        geminiAttempted++;  // Gemini was tried (retryable fail); Cerebras ineligible
        deferred++;
        console.log(`DEFERRED (status=${status}): ${msg}`);
        continue;
      }

      geminiAttempted++;
      failed++;
      console.log(`FAIL (status=${status}): ${msg}`);
      if (msg.includes('[429')) {
        console.log('Rate limit (429) — stopping batch to avoid quota waste.');
        break;
      }
    }
  }

  // ── Update generator_runs row ──────────────────────────────────────────────
  if (runId) {
    // routed_to_review removed from provider_stats and the drafts_routed_to_review
    // column omitted from this update 2026-06-28 — that outcome is now structurally
    // impossible (see the removed manual-review branch above): every generated
    // draft either auto-publishes or is rejected+deleted. The DB column itself
    // (NOT NULL DEFAULT 0) is left in place — it's part of the schema's history
    // and other tooling may reference it — but this script no longer writes a
    // fake "always zero" value into it; it simply keeps its default.
    //
    // bothFailed (both Gemini and Cerebras genuinely attempted and failed,
    // 2026-06-28 policy) is folded into drafts_failed for the DB column — it
    // is a real failure, just a more specific one with a different DB outcome
    // (rejected+deleted vs. left untouched to retry). Kept as its own field
    // in provider_stats and the console summary for visibility.
    const providerStats = {
      gemini:      { attempted: geminiAttempted,   ok: geminiOk,   lint_failed: geminiLintFailed },
      cerebras:    { attempted: cerebrasAttempted, ok: cerebrasOk, lint_failed: cerebrasLintFailed },
      both_failed: bothFailed,
    };
    const { error: updateErr } = await sb
      .from('generator_runs')
      .update({
        ended_at:                new Date().toISOString(),
        drafts_succeeded:        geminiOk + cerebrasOk,
        drafts_lint_failed:      geminiLintFailed + cerebrasLintFailed,
        drafts_deferred:         deferred,
        drafts_failed:           failed + bothFailed,
        provider_stats:          providerStats,
      })
      .eq('id', runId);
    if (updateErr) {
      console.error('[generator] generator_runs update failed:', updateErr);
      // Telemetry failure — run completed; do not re-throw
    }
  }

  const total = geminiOk + cerebrasOk;
  const lintFailed = geminiLintFailed + cerebrasLintFailed;
  const dur   = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nSUMMARY: ${total} auto-published (${geminiOk} gemini, ${cerebrasOk} cerebras), ${lintFailed} rejected+deleted (quality gates), ${bothFailed} rejected+deleted (both providers failed), ${failed} failed (retrying next run), ${deferred} deferred of ${queue.length} — ${dur}s total`);
})().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
