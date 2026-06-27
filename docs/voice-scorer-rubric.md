# BOI Voice Scorer Rubric — v1.0

**Gate:** CRITICAL-4 (Gate 7 in lint pipeline)
**Status:** CALIBRATION PENDING — not live. Run Part C calibration plan before enabling.
**Sources:** `docs/codex/BOI_Codex_v2.md` · corpus analysis of 76 published articles · 6 known-weak drafts (5 Cerebras pilot `docs/cerebras-pilot-report.md` + Ebon Hawk smoke-test output `docs/retractions.md`)
**On fail:** Draft → `status='failed_lint'`, email alert, surfaces in `/admin/pending`. Auto-drafter does NOT retry.

---

## Part A — Deterministic Hard Rules

Eight heuristic/regex checks. Run before the LLM judge. Any FAIL here = Gate 7 FAIL regardless of Part B score. Each rule is mapped to a specific failure pattern observed in the known-weak corpus.

### A1: Wallet Continuity

**Rule:** The wallet (or an approved synonym) must appear at least once after paragraph 1.

**Approved wallet vocabulary (Codex Page 11):** wallet · bank balance · bank account · savings · CA (in financial-anxiety context) · EMI · "financially devastating" · "rupees" when used in a price-anxiety sentence

**Implementation:** Split content on double-newline. Paragraph 0 = hook. Check paragraphs 1..N for any wallet-vocabulary token.

**Failure pattern caught:** Ebon Hawk — "Your wallet called; it's already nervous" in paragraph 0, then wallet absent through four paragraphs until buried in the India paragraph bullet list.

**Severity:** FAIL

---

### A2: India Paragraph Must Be Prose — Bullets Forbidden

**Rule:** The block between `<!-- INDIA_PARAGRAPH -->` and `<!-- /INDIA_PARAGRAPH -->` (or, if markers absent, the paragraph containing `₹`) must be flowing prose. It must not consist primarily of newline-separated bare sentences reading as a list.

**FAIL conditions:**
- ≥ 3 consecutive lines inside the India paragraph block with no coordinating conjunction connecting them to the prior line (reads as a list even without bullet markers)
- Any line inside the India block beginning with a markdown list marker (`-` or `*`)

**PASS condition:** Block contains ≥ 2 sentences joined by transitional language or a beat rhythm following Codex Pattern A, B, or C.

**Failure pattern caught:** All 6 known-weak drafts. The single most consistent Cerebras failure across the entire observed corpus.

**Known-FAIL example (Ebon Hawk):**
```
Estimated import price: around ₹30,000–₹40,000.
Check MyBrickHouse and Toycra for availability.
Expect a 4–6 week lag after any global launch.
If this were officially sold in India, it would cost...
```

**Known-PASS example (Codex Pattern A):**
```
₹2,999 in India. Available at Toycra with coupon code ABHINAV12 for 12% off.
A big Bricks of India thumbs up — this isn't just a Speed Champions set, it's
the first time LEGO has printed Ferrari logos directly on the rims. That's
roughly the price of three biryanis at a half-decent place, except those
biryanis don't appreciate in value or sit on your shelf for the next decade.
```

**Severity:** FAIL

---

### A3: Banned LLM Tells

**Rule:** Content must not contain any of the 8 phrases below. Zero-occurrence rule — one match anywhere = FAIL.

| # | Banned phrase | Why banned |
|---|---|---|
| 1 | `it's worth noting that` | LLM hedge boilerplate |
| 2 | `at the time of writing` | LLM temporal hedge |
| 3 | `in conclusion` (except when followed by `...` or `I was`) | LLM closing boilerplate — allowed only as ironic Clarkson device ("In conclusion... I was right. Briefly.") |
| 4 | `a welcome addition to` | Corporate PR filler (Codex Page 17 banned list) |
| 5 | `does not disappoint` | Corporate PR filler (Codex Page 17 banned list) |
| 6 | `definitely worth considering` | Hedge with no opinion (Codex Page 17 banned list) |
| 7 | `offers a good amount of` | Enumeration-mode voice break |
| 8 | `the article points out` / `the article notes` / `the review explains` / `the post highlights` | Source-paraphrase tells — article must narrate the story, not narrate the source document |

**Implementation note — rule 8 regex:** `(the article|this article|the blog post|the review|the video|the post)\s+(points out|notes that|explains|highlights|mentions|states|reports)` (case-insensitive)

**Implementation note — rule 3 exception:** Allow `in conclusion` only if the next 15 characters contain `...` or `I was`.

**Failure patterns caught:** Rule 8 caught Ebon Hawk paragraph 2 ("The article points out that…"). Rules 4/5/6 caught Horse Stable body (397ae761). Rule 3 catches the generic LLM closing paragraph.

**Severity:** FAIL

---

### A4: PR-Paraphrase Paragraph 2 Detection

**Rule:** Paragraph 2 must not open with a third-person reporting construction naming the source.

**FAIL patterns (regex applied to first sentence of paragraph 2):**

```
^(Brothers Brick|Brickset|Bricknerd|Jay[''']?s Brick Blog|New Elementary|r\/lego|The Brothers Brick)\s+(reported|said|notes|stated|announced|writes|explains|highlighted|covered)
^(The article|According to|Per the|As reported by|The report|The video|The post|The review)\b
```

**Failure pattern caught:** Ebon Hawk paragraph 2 — "Brothers Brick reported that the iconic Ebon Hawk, the player's home base in the classic KOTOR games…" — pure source summary, zero BOI voice, immediately after a passing hook.

**Why paragraph 2 specifically:** The hook (paragraph 1) is almost always BOI-voice. The voice break consistently occurs at paragraph 2 in all 6 observed Cerebras failures. Paragraphs 3–N may continue in paraphrase mode; paragraph 2 is the diagnostic tell.

**Severity:** FAIL

---

### A5: Verdict Tag Structural Requirement

**Rule:** Articles of `draft_format = 'review'` must contain exactly one verdict from the approved set: `BUY`, `WAIT FOR SALE`, `IMPORT ONLY`, `SKIP`.

**Implementation:** Gate 3 already enforces this. Gate 7 defers to Gate 3's result. This rule included for completeness — scorer should not re-run what Gate 3 has already checked.

**For news pieces:** Verdict optional. If no verdict tag present in a news piece, skip this check.

**Severity:** FAIL (deferred to Gate 3 result)

---

### A6: Sign-Off Line Requirement

**Rule:** Article must end with a sign-off matching at least one canonical BOI closing pattern.

**Detection:** Check the final 200 characters of article content for any of:

| Pattern | Regex |
|---|---|
| Bombshell closing | `on that bombshell` |
| Goodbye | `it['']?s time to say goodbye` |
| See you | `I['']?ll see you on the next one` |
| Bubyee | `bubyee` (case-insensitive) |
| Wallet wishlist | `don['']?t let your wallet see your lego wishlist` |
| Keep building | `keep building.{1,30}keep dreaming` |

**Failure pattern caught:** Ebon Hawk ends on "Verdict: IMPORT ONLY. Not in Indian stores — grey market or wait." — no sign-off, no bombshell.

**Severity:** WARN for `draft_format = 'news'`. FAIL for `draft_format = 'review'` and `draft_format = 'opinion'`.

---

### A7: Affiliate Discipline

**Rule (over-insertion):** `ABHINAV12` must appear ≤ 2 times in full article content. (Codex Page 18: "Never use the affiliate code more than twice in a single piece. Beyond that it reads as a sales pitch.")

**Rule (missing code):** For news pieces where `content` contains both `Toycra` and `₹` (set is in stock at Toycra with a price), `ABHINAV12` must appear ≥ 1 time.

**Failure patterns caught:**
- Over-insertion: LLM tendency to repeat the code in every paragraph
- Missing code: HIGH-49 pattern (article mentions Toycra without affiliate code, costing reader the 12% discount and BOI the affiliate commission)

**Severity:** FAIL on > 2 occurrences. WARN on 0 occurrences when Toycra + ₹ both present.

---

### A8: No Hallucinated First-Person Build Experience in News Pieces

**Rule:** In `draft_format = 'news'` articles sourced from non-video URLs (no `youtube.com` in `source_url`), content must not contain first-person build experience claims.

**FAIL patterns:**
```
\b(I built|as I assembled|when I put together|my build of|I constructed|I finished building|once I had built)\b
```

**Why:** News pieces are written from source articles, not from first-hand builds. First-person build language in news pieces is a hallucination — the model is inventing an experience the author did not have. Exception: `draft_format = 'review'` where first-person build experience is expected and required.

**Severity:** FAIL

---

## Part B — LLM-as-Judge Soft Scoring

The judge receives the article content and scores 6 dimensions. Scores are integers 0–10 per dimension; weighted total = 0–100.

**Judge model:** Gemini 2.5 Flash-Lite primary, Cerebras gpt-oss-120b failover (`isCerebrasEligible()` applies — excerpt.length ≥ 200 chars on the article content).

**Prompt construction:** Judge receives (1) the article, (2) the 6 scoring dimensions below, (3) two known-good calibration examples (one news: `star-wars-lego-will-bankrupt-you` opening; one review: `certified-store-india-charges-too-much` opening), (4) the Ebon Hawk article as a known-weak example with per-dimension target scores annotated.

**Output format:**
```json
{
  "scores": {
    "voice_anchor": 0,
    "wallet_craft": 0,
    "india_paragraph_rhythm": 0,
    "opening_hook": 0,
    "humour_engine": 0,
    "signoff_craft": 0
  },
  "total": 0,
  "flags": [],
  "rationale": ""
}
```

**Scorer module:** `scripts/score-voice.ts`. Export: `scoreVoice(content: string, format: DraftFormat): Promise<VoiceScoreResult>`. Called from `generate-approved-drafts.ts` after Gates 1–6 pass.

---

### B1: Voice Anchor — Weight 30

Does the article sustain the Clarkson-India persona throughout, or does it drift into generic tech-journalism / PR-summary mode?

| Score | Description |
|---|---|
| 9–10 | Clarkson inflection present hook to sign-off. Wallet treated as character. Opinions stated with conviction. Absurd comparisons present. No neutral passage > 1 sentence. |
| 6–8 | Voice present in majority of piece. Drifts in 1–2 paragraphs — acceptable for longer reviews where some technical description is unavoidable. |
| 3–5 | Voice in hook and sign-off only. Body reads as generic tech-journalism with Indian price information appended. |
| 0–2 | No sustained BOI voice. Could be any LEGO news site. |

**Ebon Hawk calibration target: 4** — hook is BOI, paragraphs 2–5 are Brothers Brick summary, India paragraph is a checklist.

---

### B2: Wallet Craft — Weight 15

Is the wallet treated as a character with opinions and feelings, or just mentioned once as a price-anxiety reference?

| Score | Description |
|---|---|
| 9–10 | Wallet referenced ≥ 3 times with varied register. Has opinions ("your wallet will forgive you"). Present at multiple structural points: hook, body, India paragraph, sign-off. |
| 5–8 | Wallet mentioned 2–3 times, at least once mid-article, with some characterisation. |
| 2–4 | Wallet mentioned only in hook or India paragraph. No character treatment. |
| 0–1 | Wallet not mentioned, or mentioned once as a neutral price reference. |

**Calibration anchor (known-good):** "don't let your wallet see your LEGO wishlist" sign-off + wallet referenced 3+ times mid-article → 9–10.
**Ebon Hawk calibration target: 2** — wallet only in paragraph 1.

---

### B3: India Paragraph Rhythm — Weight 20

Does the India paragraph follow Codex Pattern A, B, or C — flowing prose with beat structure — or does it degrade to a checklist?

| Score | Description |
|---|---|
| 9–10 | Clear Pattern A/B/C structure. All four required components (INR price, availability, verdict prose, relatable comparison) in flowing prose. Beat rhythm present: short declarative → expansion → comparison lands. |
| 6–8 | Prose, all four components present, but rhythm is flat — reads like a form filled out, not a beat sequence. |
| 3–5 | Mixed prose and list structure. Some components delivered as bare unconnected sentences. India paragraph passes A2 structurally (no markdown bullets) but lacks cadence. |
| 0–2 | Pure checklist. Components present but unconnected. Indistinguishable from a spec sheet. |

**Note:** A2 (hard rule) catches egregious bullet-list cases as FAIL. B3 scores the quality gradient for pieces that pass A2 structurally but still lack prose rhythm.

**Ebon Hawk calibration target: 2** — four-item bare-sentence list, no transitions, no beat.

---

### B4: Opening Hook — Weight 10

Does the opening hook follow a BOI hook pattern (wallet-led, India-referencing, absurd-comparison, or Clarkson-persona opener) or does it use a banned opener?

| Score | Description |
|---|---|
| 9–10 | Distinctive BOI opener. Wallet, India context, or persona in first sentence. Clear pivot to topic. No banned phrases. |
| 6–8 | Decent hook with some BOI flavour but not a standout opening. |
| 3–5 | Hook present but generic — no wallet, no India, no Clarkson inflection. |
| 0–2 | Banned opener pattern: "LEGO has announced…", "In a surprise move…", "Today we're looking at…", Wikipedia-voice. |

**Calibration anchors:**
| Opening | Score |
|---|---|
| "I do not collect Star Wars LEGO. My wallet has never once called to thank me, but I can tell it wants to." | 10 |
| "Welcome. You've arrived at a good place, even if your bank account is about to enter a complicated period." | 9 |
| "Your wallet called; it's already nervous about the Ebon Hawk MOC…" | 7 (wallet-led but passive — no Clarkson conviction) |
| "The world of LEGO building is full of builders who find a theme and stick with it." | 3 |
| "LEGO has announced the 21066 New York City Architecture set." | 0 |

---

### B5: Humour Engine — Weight 10

Is the Build→Escalate→Collapse pattern (or its news equivalent: Confidence→Subversion) present? Are absurd comparisons deployed?

| Score | Description |
|---|---|
| 9–10 | Pattern clearly present. At least one absurd comparison. At least one moment of stated confidence undercut. Deadpan timing visible in sentence structure. |
| 5–8 | Some comedic moments but pattern incomplete. Absurd comparison present but no escalation/collapse sequence. |
| 2–4 | Humour attempted but falls flat. Single forced analogy that doesn't land. No escalation structure. |
| 0–1 | Purely informational. No humour. No Clarkson inflection anywhere in the body. |

**Format calibration:** Short news pieces (270–350w) may legitimately score 5–7 — the Humour Engine has less room to operate than in flagship reviews. Adjust Part C threshold separately by format if needed.

---

### B6: Sign-Off Craft — Weight 15

Does the sign-off land the bombshell? Does it use the canonical BOI closing pattern with voice and wallet reference?

| Score | Description |
|---|---|
| 9–10 | Canonical sign-off variant present. Wallet reference in sign-off. "On that bombshell" or equivalent. "Bubyee" or equivalent. Leaves reader with conviction. |
| 6–8 | Sign-off present and BOI-flavoured but not canonical formula. Missing one element (no wallet, or no bombshell, but has Bubyee). |
| 3–5 | Generic sign-off with some BOI flavour ("Keep building!") — not the canonical pattern. |
| 0–2 | No sign-off, or article ends on verdict/price information without any closing. |

**Calibration anchors:**
| Sign-off | Score |
|---|---|
| "Until next time — keep building, keep dreaming, keep laughing, and don't let your wallet see your LEGO wishlist. And on that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee." | 10 |
| "And on that bombshell, it's time to say goodbye." | 7 |
| "Keep building!" | 3 |
| "Verdict: IMPORT ONLY. Not in Indian stores — grey market or wait." (Ebon Hawk) | 1 |

---

## Part C — Scoring Threshold and Calibration

### Working Threshold

**80 / 100** — starting point only. Actual live threshold is determined by calibration run (Steps 1–5 below). Do not go live with 80 as a fixed number.

**Calibration adjustment rule:**
- If known-good cluster lower bound ≥ 80: keep threshold at 80
- If known-good cluster lower bound < 80: lower threshold to (lower bound of known-good) − 2
- If known-weak cluster upper bound ≥ 80: raise threshold to (upper bound of known-weak) + 2

**Quality bias:** On score distribution overlap, raise the threshold. False rejections preferred over false acceptances — per operator directive. Credibility > quantity.

### Calibration Plan (non-skippable before Gate 7 goes live)

**Step 1 — Score known-good corpus (76 published articles)**

Target: ≥ 90% score ≥ working threshold. If < 90% pass: threshold is too high OR Part B weights are miscalibrated → review weights before proceeding.

Known-good corpus: all `news_articles` and `blog_posts` rows with `published_at IS NOT NULL`.

**Step 2 — Score known-weak corpus (6 drafts)**

| Draft ID | Format | Source | Expected result |
|---|---|---|---|
| 93a23b18 | news | Brickset — NYC Architecture | FAIL (India paragraph bullets, 443w WARN) |
| 397ae761 | review | Brickset — Horse Stable 42688 | WARN/FAIL (body drifts to product description, India paragraph bullets) |
| babc160d | news | Brothers Brick — Volvo FH | WARN (best of pilot set, but India paragraph bullets) |
| 76476d96 | news | YouTube — LEGO Leaks | FAIL (source-paraphrase body, no mid-article wallet) |
| 84dc3c23 | news | YouTube — May 2 reveals | FAIL (hallucinated "Summer Catalog", source fidelity FAIL) |
| Ebon Hawk | news | Brothers Brick — KOTOR MOC | FAIL (all three voice failures, no sign-off) |

Target: ≥ 4 of 6 score below working threshold. 84dc3c23 is the strongest negative anchor — should fail on A3 rule 8 + B1 + B3 independently.

**Step 3 — Tune threshold**

Set threshold to lower bound of known-good cluster. Verify no known-weak draft scores above it. If any do, raise threshold to their score + 2. Document final threshold and full score distribution in `docs/voice-scorer-calibration.md`.

**Step 4 — Dry-run against 165-pending-approved queue**

Run scorer on all `status='approved'` drafts in `pending_drafts`. Report: N pass / N fail (soft) / N fail (hard). If fail rate > 50%: threshold may be too aggressive → review Part B weights against queue composition before going live.

**Step 5 — Operator sign-off**

Abhinav reviews dry-run report. Signs off on threshold. Gate 7 flips live.

### Score Interpretation Table

| Part A result | Part B total | Gate 7 output | Pipeline action |
|---|---|---|---|
| Any A1–A8 FAIL | (any) | HARD FAIL | `failed_lint` → email alert → `/admin/pending` |
| All pass | ≥ threshold | PASS | Auto-publish eligible (Gates 1–6 still apply) |
| All pass | threshold − 10 to threshold − 1 | WARN | `requires_manual_approval = true` → human review |
| All pass | < threshold − 10 | SOFT FAIL | `failed_lint` → email alert → `/admin/pending` |

### Implementation Notes

- Gate 7 runs after Gates 1–6 pass. A draft that fails Gate 3 (no verdict) never reaches Gate 7.
- LLM judge call adds ~2–5s latency. Acceptable at current volume (≤ 20 drafts/day).
- Cost: 1 Gemini call per draft. At 20 drafts/day = 600 calls/month, well within Gemini Flash-Lite free-tier limits.
- Scorer module path: `scripts/score-voice.ts`
- Export signature: `scoreVoice(content: string, format: DraftFormat): Promise<VoiceScoreResult>`
- Integration point in `generate-approved-drafts.ts`: after Gates 1–6, before `INSERT INTO news_articles`
