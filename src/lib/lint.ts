// WEB-01 lint gates — run before every publish.
// Non-throwing: returns LintResult with overallPass + per-gate details.
// actions.ts catches !overallPass and throws to preserve the existing publish flow.
// Gate 5 (factuality) and Gate 6 (sourceFidelity) require a Supabase client.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const WORD_COUNT_TARGETS: Record<string, { pass: [number, number]; fail: [number, number] }> = {
  news    : { pass: [270,  440], fail: [225,  500] },  // target 300–400
  review  : { pass: [450,  770], fail: [375,  875] },  // target 500–700
  opinion : { pass: [360,  550], fail: [300,  625] },  // target 400–500
  guide   : { pass: [630, 1100], fail: [525, 1250] },  // target 700–1000
};

export const VALID_VERDICTS = new Set(['BUY NOW', 'WAIT', 'IMPORT ONLY', 'AVOID']);

export const INDIA_COMPARISON_RE = /\b(biryani|chai|EMI|Spotify|Netflix|petrol|samosa|litre|liter|movie.?ticket|PVR|butter.?chicken|Swiggy|Zomato|iPhone|months? of|weeks? of|auto.?rickshaw|mango)\b/i;
export const INDIA_STORE_RE      = /\b(Toycra|MyBrickHouse|Amazon|Flipkart|import.?only)\b/i;

// Numbers that are years — excluded from set-number candidates
const YEAR_MIN = 1932;
const YEAR_MAX = 2030;

export type LintGateResult = {
  pass: boolean;
  severity: 'ok' | 'warn' | 'fail';
  reason?: string;
};

export type SourceContext = {
  source_url: string;
  source_title: string | null;
  source_excerpt: string | null;
};

export type LintResult = {
  overallPass: boolean;
  warnings: string[];
  gates: {
    wordCount:        LintGateResult;
    indiaParagraph:   LintGateResult;
    verdict:          LintGateResult | null;
    factuality:       LintGateResult | null;
    sourceFidelity:   LintGateResult | null;
    openerUniqueness: LintGateResult | null;
  };
};

export type LintInput = {
  format: string;
  body: string;
  word_count?: number | null;
  verdict?: string | null;
  source?: SourceContext;   // required for sourceFidelity gate; optional for backward compat
};

export type LintOptions = {
  skipHeroImage?: boolean;   // reserved — hero image gate lives in publishOneDraft
  skipFactuality?: boolean;  // skip Gates 5 + 6; use when testing voice/structure only
  supabase?: SupabaseClient; // pass existing client to avoid creating a second one
  batchOpeners?: string[];   // Gate 8: raw bodies of drafts already accepted EARLIER IN THIS
                             // SAME RUN. The DB query only sees rows already inserted, so two
                             // drafts linted in one batch before either is written can share an
                             // opener and both pass (same-batch race, found in 2026-07-02 audit).
                             // Callers looping over a batch should push each accepted body here.
};

// ── Set reference extraction ──────────────────────────────────────────────────

// LEGO theme names — skip as stand-alone roots, but keep if followed by a specific product name
const THEME_NAME_RE = /^(Ideas?|City|Star Wars|Architecture|Friends|Technic|Creator|Disney|Marvel|Harry Potter|Speed Champions|Ninjago|Minecraft|Duplo|Jurassic|Batman|Avengers|Icons|Classic)\b/;

// Extract 4–7 digit numbers that appear in LEGO set-reference context.
// Excludes: 4-digit years (1932–2030), numbers immediately after currency symbols.
export function extractSetNumberCandidates(body: string): string[] {
  const candidates = new Set<string>();

  const explicitRe = /\b(?:LEGO|set)\s+(\d{4,7})\b/gi;
  let m: RegExpExecArray | null;
  while ((m = explicitRe.exec(body)) !== null) candidates.add(m[1]);

  const hashRe = /#(\d{4,7})\b/g;
  while ((m = hashRe.exec(body)) !== null) candidates.add(m[1]);

  const titleRe = /\b(\d{4,7})\s+(?=[A-Z][a-z])/g;
  while ((m = titleRe.exec(body)) !== null) candidates.add(m[1]);

  const parenRe = /\((\d{4,7})\)/g;
  while ((m = parenRe.exec(body)) !== null) candidates.add(m[1]);

  return Array.from(candidates).filter(n => {
    const num = parseInt(n, 10);
    if (n.length === 4 && num >= YEAR_MIN && num <= YEAR_MAX) return false;
    const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`[₹$£€]\\s*${escaped}\\b`).test(body)) return false;
    return true;
  });
}

// Extract "LEGO [ProperNoun phrase]" candidates (product names, not bare theme names).
export function extractSetNameCandidates(body: string): string[] {
  const candidates = new Set<string>();
  const legoNameRe = /\bLEGO\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z'-]+){1,4})\b/g;
  let m: RegExpExecArray | null;
  while ((m = legoNameRe.exec(body)) !== null) {
    const phrase = m[1].trim();
    if (THEME_NAME_RE.test(phrase)) {
      const stripped = phrase.replace(THEME_NAME_RE, '').trim();
      if (stripped && stripped !== phrase) candidates.add(stripped);
    } else {
      candidates.add(phrase);
    }
  }
  return Array.from(candidates);
}

// ── Gate 8: opener uniqueness ─────────────────────────────────────────────────
// Detects LLM template recurrence: when the model reuses the same opener
// sentence with only the product name swapped (e.g. "Your wallet called. It
// wants to discuss the LEGO [X]." across 4 articles). Per-gate checks pass
// because they evaluate each article in isolation — this gate compares against
// the last 30 published rows to catch cross-article template fingerprinting.
//
// Normalization: lowercase → strip set numbers → strip all digits → strip
// punctuation → collapse whitespace → take first 55 chars. Product names are
// long enough that they push content outside the 55-char window, leaving only
// the shared template prefix for comparison. Levenshtein similarity >= 85%
// against any recent article's normalized opener is a hard gate failure.

function _levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

function _normalizeOpener(body: string): string {
  return (body.split(/\n\n/)[0] ?? body)
    .slice(0, 150)
    .toLowerCase()
    .replace(/\b\d{4,6}\b/g, '')   // strip set numbers first
    .replace(/\d+/g, '')            // strip remaining digits
    .replace(/[^\w\s]/g, ' ')       // strip punctuation
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 55);
}

export const OPENER_SIMILARITY_THRESHOLD = 0.85;

export async function gateOpenerUniqueness(
  body: string,
  sb: SupabaseClient,
  batchOpeners?: string[],
): Promise<LintGateResult> {
  const candidate = _normalizeOpener(body);
  if (candidate.length < 20) return { pass: true, severity: 'ok' };

  const compare = (existingRaw: string, origin: string): LintGateResult | null => {
    const existing = _normalizeOpener(existingRaw ?? '');
    if (existing.length < 20) return null;
    const maxLen = Math.max(candidate.length, existing.length);
    const dist = _levenshtein(candidate, existing);
    const sim = 1 - dist / maxLen;
    if (sim >= OPENER_SIMILARITY_THRESHOLD) {
      return {
        pass: false,
        severity: 'fail',
        reason: `opener template reuse detected (${(sim * 100).toFixed(0)}% similar to ${origin}): "${candidate.slice(0, 40)}…"`,
      };
    }
    return null;
  };

  // Same-batch comparison FIRST — no DB round trip, and it closes the race
  // where two drafts in one run are both linted before either is inserted.
  for (const prior of batchOpeners ?? []) {
    const hit = compare(prior, 'a draft accepted earlier in this run');
    if (hit) return hit;
  }

  try {
    const [newsRes, blogRes] = await Promise.all([
      sb.from('news_articles').select('content').order('created_at', { ascending: false }).limit(30),
      sb.from('blog_posts').select('content').order('created_at', { ascending: false }).limit(30),
    ]);

    // A query error is infrastructure failure, not "no duplicates". Do not
    // hard-fail the draft on infra (that would block publishing on a flaky
    // read), but do NOT silently pass either — surface a warn so the gate
    // state is visible in lint_result telemetry. (Was: bare catch → pass:ok,
    // i.e. fully fail-open and invisible. 2026-07-02 audit item.)
    if (newsRes.error || blogRes.error) {
      const msg = newsRes.error?.message ?? blogRes.error?.message ?? 'unknown';
      return { pass: true, severity: 'warn', reason: `gate 8 corpus query failed — duplicate check DEGRADED to batch-only: ${msg}` };
    }

    const rows: string[] = [
      ...((newsRes.data ?? []).map((r: { content: string }) => r.content)),
      ...((blogRes.data ?? []).map((r: { content: string }) => r.content)),
    ];

    for (const row of rows) {
      const hit = compare(row, 'recent published article');
      if (hit) return hit;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { pass: true, severity: 'warn', reason: `gate 8 threw — duplicate check DEGRADED to batch-only: ${msg}` };
  }

  return { pass: true, severity: 'ok' };
}

// ── Gate 5: factuality ────────────────────────────────────────────────────────

export async function gateFactuality(
  body: string,
  sb: SupabaseClient,
  warnings: string[],
): Promise<LintGateResult> {
  const numberCandidates = extractSetNumberCandidates(body);
  const nameCandidates   = extractSetNameCandidates(body);

  if (numberCandidates.length === 0 && nameCandidates.length === 0) {
    return { pass: true, severity: 'ok' };
  }

  const unrecognized: string[] = [];

  // Check set numbers — single batched IN query
  if (numberCandidates.length > 0) {
    const { data, error } = await sb
      .from('sets')
      .select('set_number')
      .in('set_number', numberCandidates);
    if (error) {
      const msg = `factuality: sets table query failed: ${error.message}`;
      warnings.push(msg);
      return { pass: false, severity: 'fail', reason: msg };
    }
    const found = new Set((data ?? []).map((r: { set_number: string }) => r.set_number));
    for (const n of numberCandidates) {
      if (!found.has(n)) unrecognized.push(`#${n}`);
    }
  }

  // Check set names — Phase 7b AND-match approach:
  // First try direct substring, then require ALL significant words in the SAME set name.
  // Prevents "Mumbai Skyline Architecture" passing because individual words exist in real sets.
  for (const name of nameCandidates) {
    // Direct substring match against any set name (catches exact and prefix cases)
    const { data: directMatch } = await sb
      .from('sets')
      .select('name')
      .ilike('name', `%${name}%`)
      .limit(1);
    if (directMatch && directMatch.length > 0) continue;

    // No direct match: require ALL significant words (>2 chars, uppercase-initial)
    // to appear in the SAME candidate set name.
    const words = name
      .split(/\s+/)
      .filter(w => w.length > 2 && /^[A-Z]/.test(w));

    if (words.length === 0) {
      unrecognized.push(`"${name}"`);
      continue;
    }

    // Narrow candidates using the most distinctive (longest) word
    const distinctive = words.slice().sort((a, b) => b.length - a.length)[0];
    const { data: narrowed } = await sb
      .from('sets')
      .select('name')
      .ilike('name', `%${distinctive}%`)
      .limit(200);

    // AND-check: does any narrowed candidate contain ALL significant words?
    const lowercased = words.map(w => w.toLowerCase());
    const matched = (narrowed ?? []).some((c: { name: string }) => {
      const lcName = c.name.toLowerCase();
      return lowercased.every(w => lcName.includes(w));
    });

    if (!matched) unrecognized.push(`"${name}"`);
  }

  if (unrecognized.length > 0) {
    const msg = `unrecognized LEGO references: ${unrecognized.join(', ')}`;
    warnings.push(msg);
    return { pass: false, severity: 'fail', reason: msg };
  }

  return { pass: true, severity: 'ok' };
}

// ── Gate 6: source fidelity (LOW-confidence sources only) ────────────────────

// Extracts the <!-- INDIA_PARAGRAPH --> ... <!-- /INDIA_PARAGRAPH --> block from body.
// Returns the India block content and the body with that block removed.
// If no closing marker exists, bodyWithoutIndia === body (graceful — gate still works
// because set extractors don't fire on Indian prices/stores).
function extractIndiaParagraph(body: string): { content: string; bodyWithoutIndia: string } {
  const startMarker = '<!-- INDIA_PARAGRAPH -->';
  const endMarker   = '<!-- /INDIA_PARAGRAPH -->';
  const startIdx    = body.indexOf(startMarker);
  const endIdx      = body.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return { content: '', bodyWithoutIndia: body };
  }
  return {
    content:           body.slice(startIdx + startMarker.length, endIdx),
    bodyWithoutIndia:  body.slice(0, startIdx) + body.slice(endIdx + endMarker.length),
  };
}

// A source is LOW confidence when the excerpt is short or missing, or the source is YouTube.
function sourceConfidence(source: SourceContext): 'high' | 'low' {
  const excerpt = source.source_excerpt ?? '';
  if (excerpt.length < 200) return 'low';
  const url = source.source_url.toLowerCase();
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'low';
  return 'high';
}

async function gateSourceFidelity(
  body: string,
  source: SourceContext,
  warnings: string[],
): Promise<LintGateResult> {
  // Gate only activates for LOW-confidence sources
  if (sourceConfidence(source) === 'high') return { pass: true, severity: 'ok' };

  // Exclude the India Paragraph block (prices/stores are allowed to be inferred)
  const { bodyWithoutIndia } = extractIndiaParagraph(body);

  const setNumbers = extractSetNumberCandidates(bodyWithoutIndia);
  const setNames   = extractSetNameCandidates(bodyWithoutIndia);

  if (setNumbers.length === 0 && setNames.length === 0) {
    return { pass: true, severity: 'ok' };
  }

  // Build trusted source text from title + excerpt + URL
  const sourceText = [
    source.source_title ?? '',
    source.source_excerpt ?? '',
    source.source_url,
  ].join(' ').toLowerCase();

  const ungrounded: string[] = [];

  for (const n of setNumbers) {
    if (!sourceText.includes(n)) ungrounded.push(`#${n} (not in source)`);
  }

  for (const name of setNames) {
    if (!sourceText.includes(name.toLowerCase())) {
      ungrounded.push(`"${name}" (not in source)`);
    }
  }

  if (ungrounded.length > 0) {
    const msg = `source fidelity (LOW confidence source): ungrounded specifics: ${ungrounded.join(', ')}`;
    warnings.push(msg);
    return { pass: false, severity: 'fail', reason: msg };
  }

  return { pass: true, severity: 'ok' };
}

// ── Main lint function ────────────────────────────────────────────────────────

export async function lintDraft(draft: LintInput, options: LintOptions = {}): Promise<LintResult> {
  const body      = draft.body || '';
  const format    = draft.format || 'news';
  const wordCount = draft.word_count ?? body.split(/\s+/).filter(Boolean).length;
  const warnings: string[] = [];
  let overallPass = true;

  // Gate 1: Word count
  const targets      = WORD_COUNT_TARGETS[format] ?? WORD_COUNT_TARGETS.news;
  const [pMin, pMax] = targets.pass;
  const [fMin, fMax] = targets.fail;

  let wordCountGate: LintGateResult;
  if (wordCount < fMin || wordCount > fMax) {
    wordCountGate = { pass: false, severity: 'fail', reason: `${wordCount} words — hard limit ${fMin}–${fMax} for '${format}'` };
    overallPass = false;
  } else if (wordCount < pMin || wordCount > pMax) {
    wordCountGate = { pass: false, severity: 'warn', reason: `${wordCount} words — outside target ${pMin}–${pMax} for '${format}'` };
    warnings.push(`[Gate 1 WARN] Word count ${wordCount} outside target ${pMin}–${pMax} for '${format}'.`);
  } else {
    wordCountGate = { pass: true, severity: 'ok' };
  }

  // Gate 2: India paragraph
  // isCommunity (null verdict) mirrors the carve-out previously local to
  // publish-drafts.mjs — community/MOC content may legitimately have no
  // price or Indian comparison. Store mention stays a hard fail either way.
  const isCommunity = draft.verdict === null;
  const markerIdx = body.indexOf('<!-- INDIA_PARAGRAPH -->');
  let indiaParagraphGate: LintGateResult;
  if (markerIdx === -1) {
    indiaParagraphGate = { pass: false, severity: 'fail', reason: '<!-- INDIA_PARAGRAPH --> marker missing' };
    overallPass = false;
  } else {
    const indiaSeg = body.slice(markerIdx);
    if (!/₹[\d,]+/.test(indiaSeg)) {
      if (isCommunity) {
        indiaParagraphGate = { pass: false, severity: 'warn', reason: 'No ₹ price found in India paragraph (community content)' };
        warnings.push('[Gate 2 WARN] No INR price in India Paragraph (community content)');
      } else {
        indiaParagraphGate = { pass: false, severity: 'fail', reason: 'No ₹ price found in India paragraph' };
        overallPass = false;
      }
    } else if (!INDIA_STORE_RE.test(indiaSeg)) {
      indiaParagraphGate = { pass: false, severity: 'fail', reason: 'No store mention (Toycra / MyBrickHouse / Amazon / Flipkart / import-only)' };
      overallPass = false;
    } else if (!INDIA_COMPARISON_RE.test(indiaSeg)) {
      if (isCommunity) {
        indiaParagraphGate = { pass: false, severity: 'warn', reason: 'No relatable Indian comparison (community content)' };
        warnings.push('[Gate 2 WARN] No Indian comparison in India Paragraph (community content)');
      } else {
        indiaParagraphGate = { pass: false, severity: 'fail', reason: 'No relatable Indian comparison (biryani, EMI, Spotify, etc.)' };
        overallPass = false;
      }
    } else {
      indiaParagraphGate = { pass: true, severity: 'ok' };
    }
  }

  // Gate 3: Verdict (non-news only)
  let verdictGate: LintGateResult | null = null;
  if (format !== 'news') {
    if (isCommunity) {
      verdictGate = { pass: true, severity: 'warn', reason: 'community/informational content — no verdict expected' };
      warnings.push('[Gate 3 WARN] No verdict — publishing as community/informational content');
    } else {
      const v = (draft.verdict || '').trim().toUpperCase();
      if (!VALID_VERDICTS.has(v)) {
        verdictGate = { pass: false, severity: 'fail', reason: `Invalid verdict: '${draft.verdict ?? 'none'}'` };
        overallPass = false;
      } else {
        verdictGate = { pass: true, severity: 'ok' };
      }
    }
  }

  // Gates 5 + 6: Factuality and source fidelity
  let factualityGate: LintGateResult | null       = null;
  let sourceFidelityGate: LintGateResult | null   = null;
  let openerUniquenessGate: LintGateResult | null = null;

  if (!options.skipFactuality) {
    // Gate 6: Source fidelity — pure text comparison, no DB needed
    if (draft.source) {
      sourceFidelityGate = await gateSourceFidelity(body, draft.source, warnings);
      if (!sourceFidelityGate.pass) overallPass = false;
    }

    // Gate 5: Factuality — requires Supabase (checks set numbers/names against DB)
    let sb: SupabaseClient | null = options.supabase ?? null;
    if (!sb) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (url && key) sb = createClient(url, key, { auth: { persistSession: false } });
    }
    if (sb) {
      factualityGate = await gateFactuality(body, sb, warnings);
      if (!factualityGate.pass) overallPass = false;

      // Gate 8: Opener uniqueness — hard fail if opener template reused across
      // recent articles (catches "Your wallet called. It wants to discuss…" family).
      openerUniquenessGate = await gateOpenerUniqueness(body, sb, options.batchOpeners);
      if (!openerUniquenessGate.pass) overallPass = false;
    }
  }

  return {
    overallPass,
    warnings,
    gates: {
      wordCount:        wordCountGate,
      indiaParagraph:   indiaParagraphGate,
      verdict:          verdictGate,
      factuality:       factualityGate,
      sourceFidelity:   sourceFidelityGate,
      openerUniqueness: openerUniquenessGate,
    },
  };
}
