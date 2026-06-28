// scripts/score-voice.ts
//
// CRITICAL-4 — Gate 7 voice scorer. Implements docs/voice-scorer-rubric.md v1.0
// in full: Part A (8 deterministic hard rules) + Part B (LLM-as-judge soft scoring,
// Gemini primary / Cerebras failover, same eligibility rule as the main generator).
//
// STATUS (2026-06-28): Part A hard rules extracted to src/lib/hard-rules.ts and
// wired into generate-with-failover.ts as Gate 7 (commit 3606911). Part B soft
// score is advisory only — not a hard gate, per Step 5 sign-off. Calibration
// complete: docs/voice-scorer-calibration.md (STRONG n=49, WEAK n=1, 0 errors).

import { GeminiProvider, CerebrasProvider } from '../src/lib/providers';
import { isCerebrasEligible } from '../src/lib/source-quality';
import {
  type DraftFormat, type HardRuleResult, runHardRules,
} from '../src/lib/hard-rules';

export type { DraftFormat, HardRuleResult };
export { runHardRules };

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

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function callWithBackoff<T>(fn: () => Promise<T>, label: string, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isRateLimit = /\[429/.test(msg) || /rate.?limit/i.test(msg)
        || /\b429\b/.test(msg) || /too_many_requests/i.test(msg);
      if (!isRateLimit || attempt === maxRetries) throw err;
      const backoffMs = 15000 * Math.pow(2, attempt); // 15s, 30s, 60s
      console.log(`  [${label}] 429 hit, retry ${attempt + 1}/${maxRetries} after ${backoffMs / 1000}s`);
      await sleep(backoffMs);
    }
  }
  throw new Error('unreachable');
}

function isRetryableProviderError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  // Mirrors generate-with-failover.ts's isRetryableGeminiError (not exported from
  // that module) — kept as a 1-line regex rather than a cross-module import to
  // avoid coupling the scorer's failover decision to the generator's internals.
  return /\[429/.test(msg) || /\[5\d\d/.test(msg) || /\b429\b/.test(msg) || /too_many_requests/i.test(msg);
}

const SCORE_KEYS: ReadonlyArray<keyof VoiceScores> = [
  'voice_anchor', 'wallet_craft', 'india_paragraph_rhythm',
  'opening_hook', 'humour_engine', 'signoff_craft',
];

function parseJudgeResponse(text: string): { scores: VoiceScores; flags: string[]; rationale: string } {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '');
  const parsed = JSON.parse(cleaned);
  const s = parsed.scores ?? {};
  // Validate before clamping: null/undefined/NaN silently produce 0 via Number(n)||0,
  // making a malformed response indistinguishable from a genuine all-zero score.
  // Throw here so the caller's catch block surfaces this as judgeError instead.
  for (const k of SCORE_KEYS) {
    const raw = s[k];
    if (raw === null || raw === undefined || !isFinite(Number(raw))) {
      throw new Error(`Malformed judge response: score "${k}" = ${JSON.stringify(raw)}`);
    }
  }
  const clamp = (n: unknown) => Math.max(0, Math.min(10, Math.round(Number(n))));
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
    const geminiMaxRetries = parseInt(process.env.VOICE_GEMINI_MAX_RETRIES ?? '3', 10);
    const gemini = new GeminiProvider(geminiKey);
    const { text } = await callWithBackoff(() => gemini.call({ systemPrompt, userPrompt }), 'gemini', geminiMaxRetries);
    const { scores, flags, rationale } = parseJudgeResponse(text);
    return { scores, total: weightedTotal(scores), flags, rationale, judgeProvider: 'gemini', judgeError: null };
  } catch (geminiErr) {
    if (!isRetryableProviderError(geminiErr) || !cerebrasKey || !isCerebrasEligible({ source_excerpt: sourceExcerpt })) {
      const msg = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
      return { scores: null, total: null, flags: [], rationale: null, judgeProvider: null, judgeError: msg.slice(0, 200) };
    }
    try {
      const cerebras = new CerebrasProvider(cerebrasKey);
      const { text } = await callWithBackoff(() => cerebras.call({ systemPrompt, userPrompt }), 'cerebras');
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
