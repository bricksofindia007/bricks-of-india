// scripts/score-voice.ts
//
// CRITICAL-4 — Gate 7 voice scorer. Implements docs/voice-scorer-rubric.md v1.0
// in full: Part A (8 deterministic hard rules) + Part B (LLM-as-judge soft scoring,
// Gemini primary / Cerebras failover, same eligibility rule as the main generator).
//
// STATUS (2026-06-28): Part A + Part B implemented and exported. NOT wired into
// generate-approved-drafts.ts. Per rubric §Part C, calibration (Steps 1-5 — score
// the 76-article known-good corpus, score the 6 known-weak drafts, tune the
// threshold, dry-run against the approved queue, get Abhinav's sign-off) is
// explicitly "non-skippable before Gate 7 goes live." That calibration requires
// live Gemini API access this sandbox doesn't have — do not import this into the
// generator or treat it as an active gate until calibration has actually run.

import { GeminiProvider, CerebrasProvider } from '../src/lib/providers';
import { isCerebrasEligible } from '../src/lib/source-quality';

export type DraftFormat = 'news' | 'review' | 'opinion' | 'guide';

export interface HardRuleResult {
  id: string;
  pass: boolean;
  reason?: string;
}

export interface VoiceScores {
  voice_anchor: number;
  wallet_craft: number;
  india_paragraph_rhythm: number;
  opening_hook: number;
  humour_engine: number;
  signoff_craft: number;
}

export interface VoiceScoreResult {
  hardRules: HardRuleResult[];
  hardFail: boolean;
  scores: VoiceScores | null;
  total: number | null;
  flags: string[];
  rationale: string | null;
  judgeProvider: 'gemini' | 'cerebras' | null;
  judgeError: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function paragraphs(content: string): string[] {
  return content.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
}

function extractIndiaParagraph(content: string): string | null {
  const marked = content.match(/<!--\s*INDIA_PARAGRAPH\s*-->([\s\S]*?)<!--\s*\/INDIA_PARAGRAPH\s*-->/i);
  if (marked) return marked[1];
  const withRupee = paragraphs(content).find(p => p.includes('₹'));
  return withRupee ?? null;
}

// ── Part A — deterministic hard rules ─────────────────────────────────────────

// A1: Wallet Continuity — wallet (or approved synonym) must appear after paragraph 1.
// "CA" and bare "rupees" are excluded from the regex per rubric's own caveat that
// they're context-dependent (CA = chartered accountant elsewhere; "rupees" appears
// in every India paragraph regardless of voice) — including them would make this
// rule nearly impossible to fail and defeat its purpose. Flagged here, not silently
// dropped: if false negatives show up in Step 1/2 calibration, revisit.
// Widened 2026-06-28: EMI, financially, purse strings, broke the bank added after
// 10-article pilot showed approved Gemini baselines using these forms. Plural fix:
// original \bwallet\b never matched "wallets" — corrected to wallets?.
// Downgraded to WARN (was FAIL): even after widening, some approved Gemini baselines
// don't reuse wallet language post-opener — pending full 76-article corpus (Part C Step 1).
const WALLET_VOCAB = /\b(wallets?|bank balance|bank account|savings|financially devastating|EMI|financially|purse strings|broke the bank)\b/i;

export function ruleA1_walletContinuity(content: string): HardRuleResult {
  const paras = paragraphs(content);
  const afterHook = paras.slice(1).join('\n\n');
  const pass = WALLET_VOCAB.test(afterHook);
  // WARN not FAIL — downgraded pending calibration. Even the widened vocab misses
  // some approved Gemini baselines; threshold needs the full corpus (Part C Step 1).
  return { id: 'A1_wallet_continuity', pass: true, reason: pass ? undefined : 'WARN: no wallet vocabulary found after paragraph 1 (non-blocking pending calibration)' };
}

// A2: India Paragraph Must Be Prose — bullets forbidden.
// The "≥3 consecutive lines with no coordinating conjunction" rule is inherently
// fuzzy natural-language judgment; this is a best-effort deterministic
// approximation, not a precise grammatical parser. B3 (soft score) exists
// specifically to catch nuance this hard rule misses — that's by design per the
// rubric, not a gap to silently paper over.
const COORD_OPENERS = /^(and|but|so|or|yet|for|nor|because|since|while|though|although|however|meanwhile|still|plus|also|that['']?s|this)\b/i;

export function ruleA2_indiaParagraphProse(content: string): HardRuleResult {
  const block = extractIndiaParagraph(content);
  if (!block) return { id: 'A2_india_paragraph_prose', pass: true, reason: 'no India paragraph block found — not this rule\'s concern (see Gate 2)' };
  const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.some(l => /^[-*]\s/.test(l))) {
    return { id: 'A2_india_paragraph_prose', pass: false, reason: 'markdown list marker inside India paragraph block' };
  }
  // A line only counts as a "bare checklist line" if it's a complete standalone
  // sentence (ends in terminal punctuation) with no coordinating conjunction
  // tying it to the prior line. A line that's a word-wrapped mid-sentence
  // fragment (no terminal punctuation) is flowing prose, not a checklist item —
  // verified against the rubric's own known-PASS example, which word-wraps a
  // single sentence across 4 lines and must not trip this rule.
  const ENDS_SENTENCE = /[.!?…]\s*$/;
  let consecutiveBare = 0, maxBare = 0;
  for (const line of lines) {
    const isBare = ENDS_SENTENCE.test(line) && !COORD_OPENERS.test(line);
    if (isBare) { consecutiveBare++; maxBare = Math.max(maxBare, consecutiveBare); }
    else consecutiveBare = 0;
  }
  const pass = maxBare < 3;
  return { id: 'A2_india_paragraph_prose', pass, reason: pass ? undefined : `${maxBare} consecutive bare-sentence lines read as a checklist, not prose` };
}

// A3: Banned LLM Tells — zero-occurrence rule, one match anywhere = FAIL.
const BANNED_PHRASES: Array<{ phrase: string; re: RegExp }> = [
  { phrase: "it's worth noting that", re: /it['']?s worth noting that/i },
  { phrase: 'at the time of writing', re: /at the time of writing/i },
  { phrase: 'a welcome addition to', re: /a welcome addition to/i },
  { phrase: 'does not disappoint', re: /does not disappoint/i },
  { phrase: 'definitely worth considering', re: /definitely worth considering/i },
  { phrase: 'offers a good amount of', re: /offers a good amount of/i },
];
// Rule 3 ("in conclusion") has a narrow allowed exception — implemented separately.
const IN_CONCLUSION_RE = /in conclusion(.{0,15})/i;
// Rule 8 — source-paraphrase tells, regex per rubric implementation note verbatim.
const SOURCE_PARAPHRASE_RE = /(the article|this article|the blog post|the review|the video|the post)\s+(points out|notes that|explains|highlights|mentions|states|reports)/i;

export function ruleA3_bannedLlmTells(content: string): HardRuleResult {
  for (const { phrase, re } of BANNED_PHRASES) {
    if (re.test(content)) return { id: 'A3_banned_llm_tells', pass: false, reason: `banned phrase: "${phrase}"` };
  }
  const concl = content.match(IN_CONCLUSION_RE);
  if (concl && !/\.\.\.|i was/i.test(concl[1])) {
    return { id: 'A3_banned_llm_tells', pass: false, reason: 'banned phrase: "in conclusion" without the "..."/"I was" exception' };
  }
  if (SOURCE_PARAPHRASE_RE.test(content)) {
    return { id: 'A3_banned_llm_tells', pass: false, reason: 'source-paraphrase tell (rule 8): article narrates the source document instead of the story' };
  }
  return { id: 'A3_banned_llm_tells', pass: true };
}

// A4: PR-Paraphrase Paragraph 2 Detection — regexes verbatim from rubric.
const A4_PATTERNS = [
  /^(Brothers Brick|Brickset|Bricknerd|Jay['']?s Brick Blog|New Elementary|r\/lego|The Brothers Brick)\s+(reported|said|notes|stated|announced|writes|explains|highlighted|covered)/i,
  /^(The article|According to|Per the|As reported by|The report|The video|The post|The review)\b/i,
];

export function ruleA4_paragraph2Paraphrase(content: string): HardRuleResult {
  const paras = paragraphs(content);
  if (paras.length < 2) return { id: 'A4_paragraph2_paraphrase', pass: true };
  const firstSentence = (paras[1].match(/^[^.!?]*[.!?]/) ?? [paras[1]])[0];
  const fail = A4_PATTERNS.some(re => re.test(firstSentence));
  return { id: 'A4_paragraph2_paraphrase', pass: !fail, reason: fail ? 'paragraph 2 opens with a third-person source-reporting construction' : undefined };
}

// A5: Verdict Tag Structural Requirement — deferred to Gate 3, included for
// completeness per rubric ("scorer should not re-run what Gate 3 has already
// checked"). Always passes here; caller is expected to short-circuit on Gate 3
// failure before Gate 7 ever runs, per the rubric's own pipeline note ("A draft
// that fails Gate 3 never reaches Gate 7").
export function ruleA5_verdictTag(): HardRuleResult {
  return { id: 'A5_verdict_tag', pass: true, reason: 'deferred to Gate 3 — see lint.ts' };
}

// A6: Sign-Off Line Requirement.
const SIGNOFF_PATTERNS = [
  /on that bombshell/i,
  /it['']?s time to say goodbye/i,
  /i['']?ll see you on the next one/i,
  /bubyee/i,
  /don['']?t let your wallet see your lego wishlist/i,
  /keep building.{1,30}keep dreaming/i,
];

export function ruleA6_signOff(content: string, format: DraftFormat): HardRuleResult {
  const tail = content.slice(-200);
  const pass = SIGNOFF_PATTERNS.some(re => re.test(tail));
  // WARN for news, FAIL for review/opinion per rubric. This module reports hard
  // pass/fail only; caller should treat a 'news' A6 fail as non-blocking (warn)
  // and review/opinion A6 fail as blocking, per Part C's interpretation table.
  return { id: 'A6_sign_off', pass: pass || format === 'news', reason: pass ? undefined : 'no canonical BOI sign-off pattern in final 200 chars' };
}

// A7: Affiliate Discipline.
export function ruleA7_affiliateDiscipline(content: string): HardRuleResult {
  const occurrences = (content.match(/ABHINAV12/g) ?? []).length;
  if (occurrences > 2) return { id: 'A7_affiliate_discipline', pass: false, reason: `ABHINAV12 appears ${occurrences} times — over-insertion (max 2)` };
  const hasToycraPrice = /Toycra/i.test(content) && /₹/.test(content);
  if (hasToycraPrice && occurrences === 0) {
    // WARN per rubric, not FAIL — matches HIGH-49's pattern but rubric explicitly
    // grades this severity as WARN, not FAIL, unlike the over-insertion case.
    return { id: 'A7_affiliate_discipline', pass: true, reason: 'WARN: Toycra + ₹ present with 0 ABHINAV12 occurrences (HIGH-49 pattern)' };
  }
  return { id: 'A7_affiliate_discipline', pass: true };
}

// A8: No Hallucinated First-Person Build Experience in News Pieces.
const FIRST_PERSON_BUILD_RE = /\b(I built|as I assembled|when I put together|my build of|I constructed|I finished building|once I had built)\b/i;

export function ruleA8_noHallucinatedBuild(content: string, format: DraftFormat, sourceUrl: string): HardRuleResult {
  if (format === 'review') return { id: 'A8_no_hallucinated_build', pass: true, reason: 'first-person build experience expected for reviews' };
  if (/youtube\.com/i.test(sourceUrl)) return { id: 'A8_no_hallucinated_build', pass: true, reason: 'video source — first-person framing may be legitimate' };
  const fail = FIRST_PERSON_BUILD_RE.test(content);
  return { id: 'A8_no_hallucinated_build', pass: !fail, reason: fail ? 'first-person build claim in a non-review, non-video-sourced piece — likely hallucinated' : undefined };
}

export function runHardRules(content: string, format: DraftFormat, sourceUrl: string): HardRuleResult[] {
  return [
    ruleA1_walletContinuity(content),
    ruleA2_indiaParagraphProse(content),
    ruleA3_bannedLlmTells(content),
    ruleA4_paragraph2Paraphrase(content),
    ruleA5_verdictTag(),
    ruleA6_signOff(content, format),
    ruleA7_affiliateDiscipline(content),
    ruleA8_noHallucinatedBuild(content, format, sourceUrl),
  ];
}

// ── Part B — LLM-as-judge soft scoring ────────────────────────────────────────

const DIMENSION_WEIGHTS: Record<keyof VoiceScores, number> = {
  voice_anchor: 30,
  wallet_craft: 15,
  india_paragraph_rhythm: 20,
  opening_hook: 10,
  humour_engine: 10,
  signoff_craft: 15,
};

function buildJudgePrompt(content: string, format: DraftFormat): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `You are scoring a Bricks of India (BOI) article against six voice dimensions. ` +
    `BOI's voice is "Jeremy Clarkson meets Indian wallet anxiety" — dry, witty, self-deprecating, never mean. ` +
    `Score each dimension 0-10 as an integer. Respond with ONLY valid JSON, no markdown fences, no preamble, ` +
    `matching exactly: {"scores":{"voice_anchor":0,"wallet_craft":0,"india_paragraph_rhythm":0,"opening_hook":0,"humour_engine":0,"signoff_craft":0},"flags":[],"rationale":""}`;

  const userPrompt = `Article format: ${format}\n\n` +
    `--- SCORING DIMENSIONS (docs/voice-scorer-rubric.md v1.0 Part B) ---\n` +
    `voice_anchor (0-10): Does the article sustain the Clarkson-India persona hook to sign-off, or drift into generic tech-journalism/PR-summary mode? 9-10=sustained throughout, no neutral passage >1 sentence. 3-5=voice in hook/sign-off only. 0-2=no sustained BOI voice.\n` +
    `wallet_craft (0-10): Is the wallet treated as a character with opinions, or just mentioned once neutrally? 9-10=referenced 3+ times with varied register and opinions. 0-1=not mentioned or mentioned once neutrally.\n` +
    `india_paragraph_rhythm (0-10): Does the India paragraph follow flowing-prose beat structure (short declarative -> expansion -> comparison lands), or degrade to a checklist? 9-10=clear beat rhythm, all 4 components (INR price, availability, verdict, relatable comparison) in prose. 0-2=pure checklist, indistinguishable from a spec sheet.\n` +
    `opening_hook (0-10): Wallet-led, India-referencing, absurd-comparison, or Clarkson-persona opener? 9-10=distinctive BOI opener. 0-2=banned opener pattern ("LEGO has announced...", "In a surprise move...", Wikipedia-voice).\n` +
    `humour_engine (0-10): Is the Build->Escalate->Collapse pattern (or news equivalent Confidence->Subversion) present with absurd comparisons? 9-10=pattern clearly present with deadpan timing. 0-1=purely informational, no humour.\n` +
    `signoff_craft (0-10): Does the sign-off land the bombshell with the canonical BOI closing pattern (wallet reference + "on that bombshell"/"bubyee" or equivalent)? 9-10=canonical variant present. 0-2=no sign-off, ends on verdict/price only.\n\n` +
    `--- ARTICLE ---\n${content}`;

  return { systemPrompt, userPrompt };
}

function isRetryableProviderError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  // Mirrors generate-with-failover.ts's isRetryableGeminiError (not exported from
  // that module) — kept as a 1-line regex rather than a cross-module import to
  // avoid coupling the scorer's failover decision to the generator's internals.
  return /\[429/.test(msg) || /\[5\d\d/.test(msg);
}

function parseJudgeResponse(text: string): { scores: VoiceScores; flags: string[]; rationale: string } {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '');
  const parsed = JSON.parse(cleaned);
  const s = parsed.scores ?? {};
  const clamp = (n: unknown) => Math.max(0, Math.min(10, Math.round(Number(n) || 0)));
  const scores: VoiceScores = {
    voice_anchor: clamp(s.voice_anchor),
    wallet_craft: clamp(s.wallet_craft),
    india_paragraph_rhythm: clamp(s.india_paragraph_rhythm),
    opening_hook: clamp(s.opening_hook),
    humour_engine: clamp(s.humour_engine),
    signoff_craft: clamp(s.signoff_craft),
  };
  return { scores, flags: Array.isArray(parsed.flags) ? parsed.flags : [], rationale: typeof parsed.rationale === 'string' ? parsed.rationale : '' };
}

function weightedTotal(scores: VoiceScores): number {
  let total = 0;
  for (const k of Object.keys(scores) as Array<keyof VoiceScores>) {
    total += (scores[k] / 10) * DIMENSION_WEIGHTS[k];
  }
  return Math.round(total);
}

export async function scoreVoiceJudge(
  content: string,
  format: DraftFormat,
  sourceExcerpt: string | null,
  geminiKey: string,
  cerebrasKey: string | undefined,
): Promise<Pick<VoiceScoreResult, 'scores' | 'total' | 'flags' | 'rationale' | 'judgeProvider' | 'judgeError'>> {
  const { systemPrompt, userPrompt } = buildJudgePrompt(content, format);

  try {
    const gemini = new GeminiProvider(geminiKey);
    const { text } = await gemini.call({ systemPrompt, userPrompt });
    const { scores, flags, rationale } = parseJudgeResponse(text);
    return { scores, total: weightedTotal(scores), flags, rationale, judgeProvider: 'gemini', judgeError: null };
  } catch (geminiErr) {
    if (!isRetryableProviderError(geminiErr) || !cerebrasKey || !isCerebrasEligible({ source_excerpt: sourceExcerpt })) {
      const msg = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
      return { scores: null, total: null, flags: [], rationale: null, judgeProvider: null, judgeError: msg.slice(0, 200) };
    }
    try {
      const cerebras = new CerebrasProvider(cerebrasKey);
      const { text } = await cerebras.call({ systemPrompt, userPrompt });
      const { scores, flags, rationale } = parseJudgeResponse(text);
      return { scores, total: weightedTotal(scores), flags, rationale, judgeProvider: 'cerebras', judgeError: null };
    } catch (cerebrasErr) {
      const msg = cerebrasErr instanceof Error ? cerebrasErr.message : String(cerebrasErr);
      return { scores: null, total: null, flags: [], rationale: null, judgeProvider: null, judgeError: `gemini+cerebras both failed: ${msg.slice(0, 150)}` };
    }
  }
}

// ── Combined entry point ──────────────────────────────────────────────────────

export async function scoreVoice(
  content: string,
  format: DraftFormat,
  sourceUrl: string,
  sourceExcerpt: string | null,
  geminiKey: string,
  cerebrasKey: string | undefined,
): Promise<VoiceScoreResult> {
  const hardRules = runHardRules(content, format, sourceUrl);
  const hardFail = hardRules.some(r => !r.pass);

  if (hardFail) {
    return { hardRules, hardFail: true, scores: null, total: null, flags: [], rationale: null, judgeProvider: null, judgeError: null };
  }

  const judged = await scoreVoiceJudge(content, format, sourceExcerpt, geminiKey, cerebrasKey);
  return { hardRules, hardFail: false, ...judged };
}
