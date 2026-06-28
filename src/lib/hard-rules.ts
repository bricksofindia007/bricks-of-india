// Part A deterministic hard rules from docs/voice-scorer-rubric.md v1.0.
// Extracted here from scripts/score-voice.ts so generate-with-failover.ts
// can import them without crossing the src/scripts boundary.

export type DraftFormat = 'news' | 'review' | 'opinion' | 'guide';

export interface HardRuleResult {
  id: string;
  pass: boolean;
  reason?: string;
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

// ── A1: Wallet Continuity ─────────────────────────────────────────────────────
// WARN-only — downgraded from FAIL pending full-corpus calibration.
// Widened 2026-06-28: EMI, financially, purse strings, broke the bank.
const WALLET_VOCAB = /\b(wallets?|bank balance|bank account|savings|financially devastating|EMI|financially|purse strings|broke the bank)\b/i;

export function ruleA1_walletContinuity(content: string): HardRuleResult {
  const paras = paragraphs(content);
  const afterHook = paras.slice(1).join('\n\n');
  const pass = WALLET_VOCAB.test(afterHook);
  return { id: 'A1_wallet_continuity', pass: true, reason: pass ? undefined : 'WARN: no wallet vocabulary found after paragraph 1 (non-blocking pending calibration)' };
}

// ── A2: India Paragraph Must Be Prose ────────────────────────────────────────
// ≥3 consecutive bare-sentence lines = checklist, not prose. Hard FAIL.
const COORD_OPENERS = /^(and|but|so|or|yet|for|nor|because|since|while|though|although|however|meanwhile|still|plus|also|that['']?s|this)\b/i;

export function ruleA2_indiaParagraphProse(content: string): HardRuleResult {
  const block = extractIndiaParagraph(content);
  if (!block) return { id: 'A2_india_paragraph_prose', pass: true, reason: "no India paragraph block found — not this rule's concern (see Gate 2)" };
  const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.some(l => /^[-*]\s/.test(l))) {
    return { id: 'A2_india_paragraph_prose', pass: false, reason: 'markdown list marker inside India paragraph block' };
  }
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

// ── A3: Banned LLM Tells ──────────────────────────────────────────────────────
const BANNED_PHRASES: Array<{ phrase: string; re: RegExp }> = [
  { phrase: "it's worth noting that", re: /it['']?s worth noting that/i },
  { phrase: 'at the time of writing', re: /at the time of writing/i },
  { phrase: 'a welcome addition to', re: /a welcome addition to/i },
  { phrase: 'does not disappoint', re: /does not disappoint/i },
  { phrase: 'definitely worth considering', re: /definitely worth considering/i },
  { phrase: 'offers a good amount of', re: /offers a good amount of/i },
];
const IN_CONCLUSION_RE = /in conclusion(.{0,15})/i;
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

// ── A4: PR-Paraphrase Paragraph 2 ────────────────────────────────────────────
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

// ── A5: Verdict Tag ───────────────────────────────────────────────────────────
// Deferred to Gate 3. Always passes here.
export function ruleA5_verdictTag(): HardRuleResult {
  return { id: 'A5_verdict_tag', pass: true, reason: 'deferred to Gate 3 — see lint.ts' };
}

// ── A6: Sign-Off Line ─────────────────────────────────────────────────────────
// Hard FAIL for review/opinion; WARN (pass) for news.
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
  return { id: 'A6_sign_off', pass: pass || format === 'news', reason: pass ? undefined : 'no canonical BOI sign-off pattern in final 200 chars' };
}

// ── A7: Affiliate Discipline ──────────────────────────────────────────────────
export function ruleA7_affiliateDiscipline(content: string): HardRuleResult {
  const occurrences = (content.match(/ABHINAV12/g) ?? []).length;
  if (occurrences > 2) return { id: 'A7_affiliate_discipline', pass: false, reason: `ABHINAV12 appears ${occurrences} times — over-insertion (max 2)` };
  const hasToycraPrice = /Toycra/i.test(content) && /₹/.test(content);
  if (hasToycraPrice && occurrences === 0) {
    return { id: 'A7_affiliate_discipline', pass: true, reason: 'WARN: Toycra + ₹ present with 0 ABHINAV12 occurrences (HIGH-49 pattern)' };
  }
  return { id: 'A7_affiliate_discipline', pass: true };
}

// ── A8: No Hallucinated First-Person Build ────────────────────────────────────
const FIRST_PERSON_BUILD_RE = /\b(I built|as I assembled|when I put together|my build of|I constructed|I finished building|once I had built)\b/i;

export function ruleA8_noHallucinatedBuild(content: string, format: DraftFormat, sourceUrl: string): HardRuleResult {
  if (format === 'review') return { id: 'A8_no_hallucinated_build', pass: true, reason: 'first-person build experience expected for reviews' };
  if (/youtube\.com/i.test(sourceUrl)) return { id: 'A8_no_hallucinated_build', pass: true, reason: 'video source — first-person framing may be legitimate' };
  const fail = FIRST_PERSON_BUILD_RE.test(content);
  return { id: 'A8_no_hallucinated_build', pass: !fail, reason: fail ? 'first-person build claim in a non-review, non-video-sourced piece — likely hallucinated' : undefined };
}

// ── runHardRules ──────────────────────────────────────────────────────────────
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
