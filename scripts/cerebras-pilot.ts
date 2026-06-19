/**
 * Cerebras pilot — 5 drafts generated via Cerebras Llama 3.3 70B using canonical BOI prompts.
 * No DB writes. No Resend alerts. No production side effects.
 *
 * Prerequisites:
 *   1. Visit https://cloud.cerebras.ai, sign up, create API key (free, no credit card)
 *   2. Add to .env.local: CEREBRAS_API_KEY=csk-...
 *   3. Run: npx tsx --env-file=.env.local scripts/cerebras-pilot.ts
 *
 * Output: docs/cerebras-pilot-report.md
 * Expected runtime: 30–90s (5 articles × ~5–15s Cerebras latency)
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  buildSystemPrompt,
  buildUserPrompt,
  parseDraftResponse,
  MODEL_CONFIG,
  type DraftFormat,
} from '../src/lib/prompts/draft-prompt';
import { lintDraft, type LintResult, type LintGateResult } from '../src/lib/lint';
import { buildIndiaPriceContext } from './generate-approved-drafts';
import { extractSetNumber } from '../src/lib/generate-body';

// ── Env guards ────────────────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} not set — add to .env.local and run with node --env-file=.env.local`);
  return v;
}

const CEREBRAS_API_KEY = requireEnv('CEREBRAS_API_KEY');
const SUPABASE_URL     = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const SUPABASE_KEY     = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

// ── Locked pilot set (partial UUIDs from B9 + B10 evidence) ──────────────────

const PILOT_IDS = [
  { id: '93a23b18', kind: 'apples-to-apples' as const },
  { id: '397ae761', kind: 'apples-to-apples' as const },
  { id: 'babc160d', kind: 'apples-to-apples' as const },
  { id: '76476d96', kind: 'stress-test-youtube' as const },
  { id: '84dc3c23', kind: 'stress-test-youtube' as const },
];

const CEREBRAS_URL   = 'https://api.cerebras.ai/v1/chat/completions';
const CEREBRAS_MODEL = 'gpt-oss-120b';

// ── Cerebras call with single 429 retry ───────────────────────────────────────

type CallOk  = { ok: true;  raw: string; latencyMs: number; tokensIn?: number; tokensOut?: number };
type CallFail = { ok: false; error: string };
type CallResult = CallOk | CallFail;

async function callCerebras(systemPrompt: string, userPrompt: string): Promise<CallResult> {
  const start   = Date.now();
  const payload = {
    model: CEREBRAS_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt   },
    ],
    temperature: MODEL_CONFIG.temperature,
    max_tokens:  8192,  // reasoning model needs headroom for chain-of-thought; 2000 truncates
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(CEREBRAS_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${CEREBRAS_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(120_000),
      });
      if (res.status === 429) {
        if (attempt === 0) {
          console.warn('[cerebras] 429 — backing off 10s before single retry');
          await new Promise(r => setTimeout(r, 10_000));
          continue;
        }
        return { ok: false, error: `429 after retry: ${(await res.text().catch(() => '')).slice(0, 300)}` };
      }
      if (!res.ok) {
        return { ok: false, error: `HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}` };
      }
      const json = await res.json() as {
        choices: { message: { content: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      return {
        ok: true,
        raw: json.choices[0]?.message?.content ?? '',
        latencyMs: Date.now() - start,
        tokensIn:  json.usage?.prompt_tokens,
        tokensOut: json.usage?.completion_tokens,
      };
    } catch (err) {
      if (attempt === 1) return { ok: false, error: (err as Error).message };
    }
  }
  return { ok: false, error: 'unreachable' };
}

// ── Per-draft result types ────────────────────────────────────────────────────

type CerebrasParsed = {
  ok: true; raw: string; parseOk: true;
  title: string; body: string; wordCount: number; verdict: string | null;
  latencyMs: number; lint: LintResult;
};
type CerebrasParseError = {
  ok: true; raw: string; parseOk: false; parseError: string; latencyMs: number;
};
type CerebrasCallError = { ok: false; error: string };
type CerebrasResult = CerebrasParsed | CerebrasParseError | CerebrasCallError;

type PerDraftResult = {
  id: string;
  kind: 'apples-to-apples' | 'stress-test-youtube';
  format: DraftFormat;
  sourceTitle: string;
  sourceUrl: string;
  // Gemini baseline (stored in pending_drafts at generation time)
  geminiTitle: string;
  geminiBody: string;
  geminiWordCount: number;
  geminiVerdict: string | null;
  cerebras: CerebrasResult;
};

// ── Core pilot run per draft ──────────────────────────────────────────────────

async function runOne(p: typeof PILOT_IDS[number]): Promise<PerDraftResult> {
  // Fetch by UUID prefix — cast workaround: load published rows, match client-side
  const { data: rows, error: draftErr } = await supabase
    .from('pending_drafts')
    .select('id, source_url, source_title, source_excerpt, source_published_at, draft_format, draft_title, draft_body, draft_verdict, word_count')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(200);

  const draft = (rows ?? []).find(r => r.id.startsWith(p.id));
  if (draftErr || !draft) throw new Error(`Cannot load draft ${p.id}: ${draftErr?.message ?? 'no published row matching prefix'}`);

  const format    = (draft.draft_format as DraftFormat) || 'news';
  const setNumber = extractSetNumber(draft.source_url, draft.source_title ?? null);

  // Build prompts using canonical modules — identical to what Gemini saw
  const indiaPriceContext = await buildIndiaPriceContext(setNumber);
  const systemPrompt = buildSystemPrompt();
  const userPrompt   = buildUserPrompt({
    format,
    sourceTitle:       draft.source_title,
    sourceUrl:         draft.source_url,
    sourcePublishedAt: draft.source_published_at,
    setNumber,
    fullBody:          null,                     // pilot: no scraping — use excerpt only
    sourceExcerpt:     draft.source_excerpt,
    indiaPriceContext,
  });

  const call = await callCerebras(systemPrompt, userPrompt);
  if (!call.ok) {
    return {
      id: p.id, kind: p.kind, format,
      sourceTitle:    draft.source_title ?? '(unknown)',
      sourceUrl:      draft.source_url,
      geminiTitle:    draft.draft_title ?? '(none)',
      geminiBody:     draft.draft_body  ?? '',
      geminiWordCount: draft.word_count ?? 0,
      geminiVerdict:   draft.draft_verdict ?? null,
      cerebras: { ok: false, error: call.error },
    };
  }

  // Parse
  let parsed;
  try {
    parsed = parseDraftResponse(call.raw);
  } catch (err) {
    return {
      id: p.id, kind: p.kind, format,
      sourceTitle:    draft.source_title ?? '(unknown)',
      sourceUrl:      draft.source_url,
      geminiTitle:    draft.draft_title ?? '(none)',
      geminiBody:     draft.draft_body  ?? '',
      geminiWordCount: draft.word_count ?? 0,
      geminiVerdict:   draft.draft_verdict ?? null,
      cerebras: { ok: true, raw: call.raw, parseOk: false, parseError: (err as Error).message, latencyMs: call.latencyMs },
    };
  }

  // Lint including factuality + source fidelity — pilot validates hallucination resistance
  const wordCount = parsed.body.trim().split(/\s+/).filter(Boolean).length;
  const lint = await lintDraft(
    {
      format:     parsed.format,
      body:       parsed.body,
      word_count: wordCount,
      verdict:    parsed.verdict,
      source: {
        source_url:     draft.source_url,
        source_title:   draft.source_title ?? null,
        source_excerpt: draft.source_excerpt ?? null,
      },
    },
    { skipHeroImage: true, supabase },
  );

  return {
    id: p.id, kind: p.kind, format,
    sourceTitle:    draft.source_title ?? '(unknown)',
    sourceUrl:      draft.source_url,
    geminiTitle:    draft.draft_title  ?? '(none)',
    geminiBody:     draft.draft_body   ?? '',
    geminiWordCount: draft.word_count  ?? 0,
    geminiVerdict:   draft.draft_verdict ?? null,
    cerebras: {
      ok: true, raw: call.raw, parseOk: true,
      title: parsed.title, body: parsed.body, wordCount,
      verdict: parsed.verdict, latencyMs: call.latencyMs, lint,
    },
  };
}

// ── Report rendering ──────────────────────────────────────────────────────────

function pct(n: number, d: number): string {
  return d === 0 ? '—' : `${Math.round((n / d) * 100)}%`;
}

function gateMark(g: LintGateResult | null): string {
  if (!g) return 'n/a';
  if (g.severity === 'ok') return 'PASS';
  if (g.severity === 'warn') return `WARN: ${g.reason ?? ''}`;
  return `FAIL: ${g.reason ?? ''}`;
}

function renderReport(results: PerDraftResult[]): string {
  const isParsedPass = (r: PerDraftResult): r is PerDraftResult & { cerebras: CerebrasParsed } =>
    r.cerebras.ok && (r.cerebras as any).parseOk && (r.cerebras as CerebrasParsed).lint.overallPass;

  const passing  = results.filter(isParsedPass);
  const a2a      = results.filter(r => r.kind === 'apples-to-apples');
  const stress   = results.filter(r => r.kind === 'stress-test-youtube');
  const a2aPass  = a2a.filter(isParsedPass);
  const stressPass = stress.filter(isParsedPass);

  const lines: string[] = [];
  lines.push(`# Cerebras pilot report`);
  lines.push(``);
  lines.push(`**Model:** ${CEREBRAS_MODEL} @ temp ${MODEL_CONFIG.temperature}`);
  lines.push(`**Run:** ${new Date().toISOString()}`);
  lines.push(``);
  lines.push(`## Summary`);
  lines.push(``);
  lines.push(`| Cohort | Pass | Total | Rate |`);
  lines.push(`|---|---|---|---|`);
  lines.push(`| Apples-to-apples (non-YT) | ${a2aPass.length} | ${a2a.length} | ${pct(a2aPass.length, a2a.length)} |`);
  lines.push(`| Stress test (YT, knowledge-poor) | ${stressPass.length} | ${stress.length} | ${pct(stressPass.length, stress.length)} |`);
  lines.push(`| **Overall** | **${passing.length}** | **${results.length}** | **${pct(passing.length, results.length)}** |`);
  lines.push(``);
  lines.push(`### Pilot pass criteria`);
  lines.push(`- Apples-to-apples: **>=3/3 lint pass** required -> currently ${a2aPass.length}/${a2a.length}`);
  lines.push(`- Stress test: **>=1/2 lint pass** acceptable -> currently ${stressPass.length}/${stress.length}`);
  lines.push(`- Manual voice read: pending your review of each Cerebras body below`);
  lines.push(``);

  for (const r of results) {
    lines.push(`---`);
    lines.push(``);
    lines.push(`## ${r.id} — ${r.format} — ${r.kind}`);
    lines.push(``);
    lines.push(`**Source:** [${r.sourceTitle}](${r.sourceUrl})`);
    lines.push(``);

    const c = r.cerebras;
    if (!c.ok) {
      lines.push(`### FAIL — Cerebras call failed`);
      lines.push(``);
      lines.push(`\`\`\`\n${c.error}\n\`\`\``);
      lines.push(``);
      continue;
    }
    if (!c.parseOk) {
      lines.push(`### FAIL — Parse failed`);
      lines.push(``);
      lines.push(`**Latency:** ${c.latencyMs}ms`);
      lines.push(`**Parse error:** ${c.parseError}`);
      lines.push(``);
      lines.push(`**Raw response (first 1500 chars):**`);
      lines.push(`\`\`\`\n${c.raw.slice(0, 1500)}\n\`\`\``);
      lines.push(``);
      continue;
    }

    lines.push(`**Latency:** ${c.latencyMs}ms  **Lint:** ${c.lint.overallPass ? 'PASS' : 'FAIL'}`);
    lines.push(``);
    lines.push(`### Lint gates`);
    lines.push(`| Gate | Result |`);
    lines.push(`|---|---|`);
    lines.push(`| Word count (${c.wordCount} words) | ${gateMark(c.lint.gates.wordCount)} |`);
    lines.push(`| India paragraph | ${gateMark(c.lint.gates.indiaParagraph)} |`);
    lines.push(`| Verdict | ${gateMark(c.lint.gates.verdict)} |`);
    lines.push(`| Factuality | ${gateMark(c.lint.gates.factuality)} |`);
    lines.push(`| Source fidelity | ${gateMark(c.lint.gates.sourceFidelity)} |`);
    lines.push(``);
    lines.push(`### Side-by-side`);
    lines.push(``);
    lines.push(`| | Gemini (baseline) | Cerebras (pilot) |`);
    lines.push(`|---|---|---|`);
    lines.push(`| Title | ${r.geminiTitle} | ${c.title} |`);
    lines.push(`| Word count | ${r.geminiWordCount} | ${c.wordCount} |`);
    lines.push(`| Verdict | ${r.geminiVerdict ?? '—'} | ${c.verdict ?? '—'} |`);
    lines.push(``);
    lines.push(`#### Gemini body (baseline)`);
    lines.push(``);
    lines.push(r.geminiBody);
    lines.push(``);
    lines.push(`#### Cerebras body (pilot)`);
    lines.push(``);
    lines.push(c.body);
    lines.push(``);
    lines.push(`**Manual voice read — your sign-off:** [ ] PASS  [ ] FAIL`);
    lines.push(``);
  }

  return lines.join('\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Starting Cerebras pilot — ${PILOT_IDS.length} drafts`);

  const results: PerDraftResult[] = [];
  for (const p of PILOT_IDS) {
    console.log(`  -> ${p.id} (${p.kind})...`);
    try {
      const r = await runOne(p);
      results.push(r);
      const c = r.cerebras;
      if (!c.ok)       console.log(`     FAIL: ${c.error}`);
      else if (!c.parseOk) console.log(`     WARN: parse failed — ${c.parseError}`);
      else             console.log(`     ${c.lint.overallPass ? 'PASS' : 'FAIL'} ${c.wordCount}w ${c.latencyMs}ms`);
    } catch (err) {
      console.error(`     ERROR: ${(err as Error).message}`);
    }
  }

  const report  = renderReport(results);
  const outPath = path.join(process.cwd(), 'docs', 'cerebras-pilot-report.md');
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, report, 'utf8');
  console.log(`\nReport written to ${outPath}`);
}

main().catch(err => {
  console.error('Pilot failed:', err);
  process.exit(1);
});
