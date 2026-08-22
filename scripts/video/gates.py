"""
VID-P4 pre-TTS quality gates (G1-G7). ALL run before any ElevenLabs call —
TTS costs money per character; a script that fails a gate must never reach
the API. On failure the caller regenerates once, then aborts with reasons.

G7's normalize+Levenshtein-85%-threshold approach is a direct port of the
web pipeline's Gate 8 (src/lib/lint.ts::gateOpenerUniqueness) — same
algorithm, comparison window widened from "first sentence" to "first 150
chars" (see _normalize_opener) after live-testing showed a literal first-
sentence cut misses the exact template-reuse incident this gate exists to
catch.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field

import requests
from num2words import num2words

BANNED_PATTERNS = [
    r"today we'?re looking",
    r"lego has announced",
    r"\bhello\b",
    r"hey everyone",
    r"\bwelcome\b",
    r"^\s*so,",
    r"\bfollow\b",
    # "like" as bare word is normal conversational English the system prompt
    # itself requires ("told like you're telling a friend") -- verified live
    # 2026-07-05, a real generated script used "feels like"/"looks like" and
    # a naive \blike\b match failed it every time. Only the CTA-phrase sense
    # ("like and subscribe", "hit like", "like this video") is actually banned.
    r"\blike (and |, )?(subscribe|comment|follow)\b",
    r"\bhit (that |the )?like\b",
    r"\bsmash (that |the )?like\b",
    r"\blike (this|the) video\b",
    r"\blike button\b",
    r"\bsubscribe\b",
    r"\bcomment\b",
    # Added 2026-07-06 (Abhinav, explicit) -- these were added to the SYSTEM_PROMPT
    # (prompts.py) as literary/review-language bans on the same day, but never
    # mirrored into this gate. Real gap: the prompt telling the model not to use a
    # phrase doesn't guarantee compliance -- that's what a gate is for. Confirmed
    # live: the Minas Tirith video (video_posts id 15ba43f0-7847-4bdd-bfd7-c4ef2294c51d)
    # contains "it's an undeniable statement" -- the exact motivating example from
    # prompts.py's own amendment log -- and G2 still reported pass=true against the
    # old list.
    r"\bromanticism\b",
    r"\barchitectural\b",
    r"\bgrandeur\b",
    r"\btestament\b",  # also covers "a testament to"
    r"\bmagnificence\b",
    r"\bquintessential\b",
    r"\bundeniable statement\b",
    r"\bmakes a statement\b",
    r"\bcommands attention\b",
]

# TTS reads these characters aloud if present — hard-fail, don't just strip.
# *, #, and backtick are NOT in this list (see _MARKDOWN_STRIP_RE below) --
# those are Gemini markdown habits, not genuinely TTS-unsafe content, and
# get sanitized out before any gate sees the script. Emoji and brackets stay
# hard-failed: unlike stray asterisks, they're not a "formatting tic" to
# silently clean up, and hard-failing surfaces a real prompt-compliance
# problem rather than papering over it.
FORBIDDEN_CHARS_RE = re.compile(r"[\U0001F300-\U0001FAFF\U00002600-\U000027BF\[\]]")

# Markdown-only formatting characters Gemini adds despite the system prompt's
# explicit "no markdown, no asterisks" rule -- verified live 2026-07-05: 3 of
# 6 real generations this session hit this, a persistent tendency, not a
# fluke. Stripped before any gate runs (not gate leniency -- the *sanitized*
# text is what actually reaches TTS, so gates must see what TTS sees).
# Deliberately narrow: only *, _, #, and backtick. Never touches ₹,
# apostrophes, or any other legitimate punctuation.
_MARKDOWN_STRIP_RE = re.compile(r"[*_#`]+")


# Piece-count digit grouping, standardized at script-generation time (stored
# script, not just TTS) -- Gemini/Cerebras don't reliably comma-format a
# piece count it copies from the task prompt's bare "Piece count: 3458"
# (build_task_prompt() passes pieces as a bare int, so the model has no
# formatted example to imitate). Real inconsistency found across stored
# scripts: Death Star / McLaren came out comma-formatted ("9,031" / "1,675"),
# Shopping Street came out bare ("3458 pieces"). Reformatting deterministically
# here (not just fixing the prompt) guarantees consistency regardless of what
# the model actually outputs. Strips existing commas before reformatting so
# already-correct values (both grouping styles) are idempotent, not just
# newly-bare ones.
_PIECE_COUNT_FORMAT_RE = re.compile(r"\b(\d[\d,]*)\b(\s*(?:-\s?)?pieces?\b)", re.IGNORECASE)


def _format_piece_counts(script: str) -> str:
    def replace(m: re.Match) -> str:
        n = int(m.group(1).replace(",", ""))
        return f"{n:,}{m.group(2)}"

    return _PIECE_COUNT_FORMAT_RE.sub(replace, script)


def sanitize_script(raw: str) -> str:
    stripped = _MARKDOWN_STRIP_RE.sub("", raw)
    stripped = _format_piece_counts(stripped)
    return re.sub(r"[ \t]+", " ", stripped).strip()


# TTS-only transform, applied after sanitize_script but never to the stored
# script (video_posts.script, captions) -- ElevenLabs doesn't reliably speak
# the ₹ glyph or an "Rs" shorthand as "rupees", verified live 2026-07-05 (a
# real render said the literal letters "R S"). Humans read "₹26,999"
# instantly; only the audio layer needs it spelled out.
# Digit-groups only (each comma must be followed by 2-3 more digits) -- a
# bare [\d,]+ also swallows a sentence's trailing punctuation comma right
# after the number ("₹26,999, roughly" -> matched "26,999," including the
# comma that belongs to the sentence, not the number). Verified live.
_RUPEE_AMOUNT_RE = re.compile(r"₹\s*(\d{1,3}(?:,\d{2,3})*)(?:\.(\d+))?")


def normalize_currency_for_tts(script: str) -> str:
    def replace(m: re.Match) -> str:
        whole = int(m.group(1).replace(",", ""))
        words = num2words(whole, lang="en")
        if m.group(2):
            paise_words = num2words(int(m.group(2)), lang="en")
            return f"{words} rupees and {paise_words} paise"
        return f"{words} rupees"

    return _RUPEE_AMOUNT_RE.sub(replace, script)


# Sibling to normalize_currency_for_tts, identical mechanism: TTS-only
# transform, applied after sanitize_script but never to the stored script --
# ElevenLabs speaks a bare digit run like "9,031" letter-by-letter or as a
# garbled number-string rather than "nine thousand and thirty-one", the same
# class of mispronunciation the rupee fix exists to catch. Runs AFTER
# _format_piece_counts has already standardized the stored script's grouping
# (via sanitize_script), but matches both bare and comma-formatted digits
# regardless -- this function must never assume upstream formatting is
# guaranteed, only that it's what the stored script currently contains.
_PIECE_COUNT_TTS_RE = re.compile(r"\b(\d[\d,]*)\b(\s*(?:-\s?)?)(pieces?)\b", re.IGNORECASE)


def normalize_piece_count_for_tts(script: str) -> str:
    def replace(m: re.Match) -> str:
        whole = int(m.group(1).replace(",", ""))
        words = num2words(whole, lang="en")
        return f"{words}{m.group(2)}{m.group(3)}"

    return _PIECE_COUNT_TTS_RE.sub(replace, script)


# "like" deliberately excluded as a bare word here (unlike follow/subscribe/
# comment, which G2 bans unconditionally everywhere -- so re-matching them
# bare in the last sentence is harmless redundancy, not a new risk). "like"
# is different: G2 only bans specific CTA phrasings ("hit like", "like this
# video") and explicitly allows conversational "feels like"/"looks like" --
# a real, live-tested exception (see BANNED_PATTERNS comment above). A bare
# \blike\b here would flag a legitimate "feels like"/"looks like" landing in
# the punchline, contradicting that exception. Match the same CTA-specific
# like-patterns G2 uses instead of a bare word.
CTA_OR_SIGNOFF_RE = re.compile(
    r"(follow|subscribe|comment|see you|until next time|that'?s (it|all) for (today|now)"
    r"|like (and |, )?(subscribe|comment|follow)|hit (that |the )?like|smash (that |the )?like"
    r"|like (this|the) video|like button)",
    re.IGNORECASE,
)

OPENER_SIMILARITY_THRESHOLD = 0.85

# Set-number extraction: a direct port of the web pipeline's
# extractSetNumberCandidates() (src/lib/lint.ts:75), not a bare digit regex.
# A bare (?<!\d)(\d{4,6})(?!\d) would false-positive on years mentioned in
# the script ("since 2016") -- lint.ts's own YEAR_MIN/YEAR_MAX exclusion is
# there specifically because that was a real problem for the web pipeline,
# and a video script narrates just as much "this theme started in ____" as
# an article does. Reusing the same structural-context patterns (a number
# following LEGO/set, prefixed with #, in parens, or immediately before a
# capitalized word) plus the same year-range and currency-adjacency
# exclusions, rather than re-deriving a weaker version from scratch.
_YEAR_MIN, _YEAR_MAX = 1932, 2030

_EXPLICIT_RE = re.compile(r"\b(?:LEGO|set)\s+(\d{4,7})\b", re.IGNORECASE)
_HASH_RE = re.compile(r"#(\d{4,7})\b")
_PAREN_RE = re.compile(r"\((\d{4,7})\)")
_TITLE_RE = re.compile(r"\b(\d{4,7})\s+(?=[A-Z][a-z])")


def extract_set_number_candidates(script: str) -> list[str]:
    candidates: set[str] = set()
    candidates.update(_EXPLICIT_RE.findall(script))
    candidates.update(_HASH_RE.findall(script))
    candidates.update(_PAREN_RE.findall(script))
    candidates.update(_TITLE_RE.findall(script))

    out = []
    for n in candidates:
        num = int(n)
        if len(n) == 4 and _YEAR_MIN <= num <= _YEAR_MAX:
            continue  # plausible year, not a set number
        if re.search(rf"[₹$£€]\s*{re.escape(n)}\b", script):
            continue  # immediately follows a currency symbol -- a price, not a set number
        out.append(n)
    return out


@dataclass
class GateResult:
    gate: str
    passed: bool
    reason: str = ""


@dataclass
class GateReport:
    results: list[GateResult] = field(default_factory=list)
    raw_script: str = ""
    sanitized_script: str = ""

    @property
    def all_passed(self) -> bool:
        return all(r.passed for r in self.results)

    def as_dict(self) -> dict:
        d = {r.gate: {"pass": r.passed, "reason": r.reason} for r in self.results}
        # Standing metric, not a gate result: how often Gemini still tries
        # markdown despite the system prompt forbidding it, even after the
        # sanitization fix. Kept here (not a separate column) so it rides
        # along with every video_posts row for free.
        d["_sanitization"] = {
            "raw_script": self.raw_script,
            "sanitized_script": self.sanitized_script,
            "markdown_stripped": self.raw_script != self.sanitized_script,
        }
        return d


def _word_count(script: str) -> int:
    return len(script.split())


def gate_word_count(script: str) -> GateResult:
    # Widened 2026-07-05 (Abhinav, explicit) from 100-130 to 105-135 after 6
    # live Gemini generations all landed 132-165 words.
    #
    # Tightened 2026-07-06 (Abhinav, explicit) 105-135 -> 90-110, matching
    # the system prompt's own "90-110 words, no exceptions" target (added
    # same day) -- the gate had been left wider than the prompt's stated
    # target pending real evidence it was achievable; see the tracker for
    # the 5-generation distribution that confirmed it.
    n = _word_count(script)
    if 90 <= n <= 110:
        return GateResult("G1_word_count", True, f"{n} words")
    return GateResult("G1_word_count", False, f"{n} words, outside 90-110")



# System prompt hard rule: "no quotes around the script" -- the model
# occasionally wraps its entire output in a literal quote pair, which reads
# aloud fine but is a clear compliance miss with zero prior gate coverage
# (audit, 2026-07-06). Checks the whole-script wrapper only, not any quote
# character appearing mid-script (e.g. a legitimate quoted aside), which is
# why this matches start+end together rather than a bare quote-anywhere scan.
def _is_quote_wrapped(script: str) -> bool:
    s = script.strip()
    if len(s) < 2:
        return False
    for open_q, close_q in (('"', '"'), ("'", "'"), ("“", "”"), ("‘", "’")):
        if s.startswith(open_q) and s.endswith(close_q):
            return True
    return False


def gate_banned_patterns(script: str) -> GateResult:
    lower = script.lower()
    for pat in BANNED_PATTERNS:
        if re.search(pat, lower, re.IGNORECASE | re.MULTILINE):
            return GateResult("G2_banned_patterns", False, f"matched banned pattern: {pat}")
    m = FORBIDDEN_CHARS_RE.search(script)
    if m:
        return GateResult("G2_banned_patterns", False, f"TTS-unsafe character found: {m.group(0)!r}")
    if _is_quote_wrapped(script):
        return GateResult("G2_banned_patterns", False, "script is wrapped in quotes (system prompt: 'no quotes around the script')")
    return GateResult("G2_banned_patterns", True)


def gate_contains_rupee(script: str) -> GateResult:
    if "₹" in script:
        return GateResult("G3_contains_rupee", True)
    return GateResult("G3_contains_rupee", False, "no ₹ symbol found")


def gate_no_cta_ending(script: str) -> GateResult:
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", script.strip()) if s.strip()]
    if not sentences:
        return GateResult("G4_no_cta_ending", False, "empty script")
    last = sentences[-1]
    if CTA_OR_SIGNOFF_RE.search(last):
        return GateResult("G4_no_cta_ending", False, f"last sentence reads as a CTA/sign-off: {last!r}")
    return GateResult("G4_no_cta_ending", True)


_PIECE_COUNT_RE = re.compile(r"\b(\d[\d,]*)\s*(?:-|\s)?piece", re.IGNORECASE)


def gate_factuality(script: str, pieces: int | None, sets_lookup) -> GateResult:
    """sets_lookup(set_number: str) -> dict|None with at least a 'pieces' key.

    Per spec: any set number extracted via structural context (see
    extract_set_number_candidates) must exist in the catalog -- hard fail if
    not. Any piece count explicitly stated in the script text must match the
    catalog exactly (+-0), not just the task's supplied `pieces` value --
    the script could restate a piece count Gemini invented despite the
    system prompt's "invent nothing" instruction, and that's exactly the
    class of error this gate exists to catch.
    """
    numbers = extract_set_number_candidates(script)
    for num in numbers:
        row = sets_lookup(num)
        if row is None:
            return GateResult("G5_factuality", False, f"set number {num} mentioned in script does not exist in catalog")
        catalog_pieces = row.get("pieces")
        if catalog_pieces is not None:
            for stated in _PIECE_COUNT_RE.findall(script):
                stated_int = int(stated.replace(",", ""))
                if stated_int != catalog_pieces:
                    return GateResult(
                        "G5_factuality", False,
                        f"set {num}: script states {stated_int} pieces, catalog says {catalog_pieces}",
                    )
    return GateResult("G5_factuality", True)


def gate_no_first_person_build(script: str) -> GateResult:
    lower = script.lower()
    patterns = [r"\bi built\b", r"\bmy copy\b", r"\bi own\b", r"\bi bought\b", r"\bmy set\b"]
    for pat in patterns:
        if re.search(pat, lower):
            return GateResult("G6_no_first_person_build", False, f"matched: {pat}")
    return GateResult("G6_no_first_person_build", True)


# G9: zero store-name mentions, hard fail, no exceptions -- previously only
# enforced via the system prompt's ATTRIBUTION rule and manual spot-checks
# (5+ real generations this session, zero mentions observed), but no code
# gate actually existed to guarantee it. Retailer names are internal
# operational detail (store_id in video_posts) that must never leak into
# the spoken script -- this is global content, and Indian retailer names
# mean nothing to a non-Indian viewer regardless.
_STORE_NAME_RE = re.compile(r"\btoycra\b|\bmy\s*brick\s*house\b|\bmybrickhouse\b", re.IGNORECASE)


def gate_no_store_names(script: str) -> GateResult:
    m = _STORE_NAME_RE.search(script)
    if m:
        return GateResult("G9_no_store_names", False, f"store name mentioned: {m.group(0)!r}")
    return GateResult("G9_no_store_names", True)


# Added 2026-08-19 (Kakamora audit, VID-QP): G1-G9 above check structure/
# format only -- none check whether the script is actually coherent
# English. VID-QP's real published output for Kakamora (#43293) ended in
# the nonsensical, unreferenced phrase "No stranding." and passed every one
# of ITS gates; VID-P4 already has a price-plausibility gate (G8 above,
# gate_price_math) that VID-QP lacked, so this repo confirmed VID-P4 does
# NOT share that half of the gap, but DOES share this one -- no existing
# G1-G9 gate here would have caught a "No stranding."-style ending either.
def gate_coherence_llm_judge(script: str) -> GateResult:
    """LLM-as-judge: does this read as complete, coherent English -- not a
    garbled or nonsensical fragment? Model-agnostic by design: a post-hoc
    check on the FINAL script text, independent of which provider (Gemini/
    Groq/Cerebras) generated it. Uses Groq (cheapest currently-active
    provider) for a small, cheap classification call.

    Fails OPEN (pass=True with a WARNING detail) if the judge call itself
    errors -- a transient judge-API hiccup blocking ALL publishing would be
    a worse regression than occasionally missing a coherence problem,
    especially now that generation itself already has real retry/backoff
    (see engine.py's _retry_backoff_sleep()).

    2026-08-22: model swapped llama-3.3-70b-versatile -> qwen/qwen3.6-27b.
    The old model was already decommissioned on Groq (confirmed live via a
    real 404 model_not_found during the qwen rollout evidence pass) -- this
    gate had been silently fail-open on EVERY call since that deprecation,
    never actually judging anything. Not flag-gated: this is a bug fix
    restoring already-intended behavior (the gate was never meant to be a
    no-op), not new capability, and gate results here are advisory/logged
    for human review only (VID-P4 has no auto-publish path) -- a real
    judge verdict newly appearing can only add information, never block
    anything by itself. reasoning_effort='none' required for qwen -- absent
    it, qwen burns its output budget on hidden <think> reasoning and
    returns no visible verdict (confirmed empirically during this rollout)."""
    groq_key = os.environ.get("GROQ_API_KEY", "").strip()
    if not groq_key:
        return GateResult("G10_coherence", True, "SKIPPED: GROQ_API_KEY not set (fail-open, judge unavailable)")
    judge_prompt = (
        "You are a strict but fair editor reviewing a short video script that will be "
        "read aloud verbatim. Reply with exactly one line: 'COHERENT' if the script "
        "reads as complete, sensible English with no garbled, truncated, or nonsensical "
        "fragments (for example, an ending like 'No stranding.' with no clear referent "
        "to anything earlier in the script would NOT be coherent) -- or "
        "'INCOHERENT: <short reason>' if it does not.\n\nSCRIPT:\n" + script
    )
    try:
        resp = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
            json={
                "model": "qwen/qwen3.6-27b",
                "messages": [{"role": "user", "content": judge_prompt}],
                "max_tokens": 200,
                "temperature": 0.0,
                "reasoning_effort": "none",
            },
            timeout=30,
        )
        resp.raise_for_status()
        verdict = resp.json()["choices"][0]["message"]["content"].strip()
        if verdict.upper().startswith("COHERENT"):
            return GateResult("G10_coherence", True, verdict)
        return GateResult("G10_coherence", False, verdict)
    except Exception as e:
        return GateResult("G10_coherence", True, f"SKIPPED: judge call failed ({e}) -- fail-open, not blocking on judge availability")


# Added 2026-08-21 -- real incident, story #43 (video_posts id
# cc843a50-d5ee-467f-ae05-d328e2582c49): engine.py's transcribe_for_captions()
# deliberately transcribes the ACTUAL rendered TTS audio via openai-whisper
# ("base" model) rather than trusting video_posts.script, specifically to
# catch genuine TTS mispronunciation (see engine.py's caption-block comment,
# and the earlier "rupees" vs "RS" incident that motivated that design). That
# design is correct and stays -- but it means the burned-in caption can
# diverge from the script on words Whisper itself mishears, and "base" is
# whisper's cheapest/least accurate tier. Confirmed live: "For the die-hard
# Andy Weir fan" was transcribed as "...for the diehard" / "and the rear
# fan..." -- a segment-boundary split that corrupted the two-word author name
# into "rear". engine.py's transcribe_for_captions() now biases Whisper with
# an initial_prompt built from extract_caption_glossary() (this doesn't
# override a genuinely mispronounced word -- it's a soft nudge, not a hard
# vocabulary list) -- this gate is the safety net for when that bias still
# isn't enough. Deliberately does NOT attempt automatic text-correction here:
# a second layer of guessing on top of an already-uncertain ASR pass risks a
# new class of silent errors. This only flags for human review, the same as
# every other gate -- passed=False + reason land in gate_results, which a
# human already checks before ever moving a row past pending_approval (VID-P4
# has no auto-publish path).
_CAPTION_NUMERAL_RE = re.compile(r"\b[\d,]+\b")


def gate_caption_fidelity(glossary: list[str], caption_segments: list[dict], numerals: list[str] | None = None) -> GateResult:
    """G11: does the burned-in caption text (Whisper's ASR hypothesis, NOT
    the script) still contain each glossary term (or numeral), or at least
    a close, recognizable variant of it? Two failure modes for word terms,
    both flagged:
      - term missing entirely (best candidate window is a poor match --
        this is what "Andy Weir" -> "rear"/"and the" does: the real words
        aren't a garbled spelling of the name, they're different words)
      - term present only as a low-similarity variant (a genuine near-miss
        spelling, e.g. a hypothetical "Jugaad" -> "Jugad")
    Fails OPEN when there's nothing to check at all -- consistent with
    G10's fail-open-on-unavailable pattern.

    Thresholds picked and verified against real data, not guessed: 0.75
    correctly treats real exact/near-exact matches (casing/apostrophe
    noise) as present across 3 real clean stories (Messi, Tintin, Razor
    Crest -- 7 glossary terms, zero false positives); 0.35 floor correctly
    separates the real "Andy Weir" corruption (45% similarity to its best
    candidate window, "india where") from a merely-missing term with no
    plausible candidate at all.

    2026-08-22 addition: `numerals` (see engine.py's
    extract_caption_numerals()) closes a real gap the word-only version
    had -- story #48's "Porsche 911 GT3 R..." was transcribed as "...
    Porsche 9, whatever GT3R...", "911" replaced by "whatever" entirely,
    and the word-only glossary check had no way to catch it (bare numbers
    were never in its regex's scope). Numerals are checked for EXACT
    presence only (comma-stripped, so "1,313" vs "1313" formatting
    differences don't matter) -- no fuzzy fallback, unlike word terms: a
    "70% similar" digit string isn't a meaningful category the way a close
    spelling variant is. Either the number survived transcription intact,
    or it was replaced by something else entirely, same as "911" was.
    """
    if not glossary and not numerals:
        return GateResult("G11_caption_fidelity", True, "No glossary terms or numerals extracted -- nothing to check.")

    HIGH_SIM = 0.75
    LOW_SIM_FLOOR = 0.35

    caption_text = " ".join(s.get("text", "") for s in caption_segments)
    caption_norm = re.sub(r"[^\w\s]", " ", caption_text.lower())
    caption_words = caption_norm.split()
    caption_joined = " " + " ".join(caption_words) + " "

    failures = []
    checked = 0
    for term in glossary:
        term_norm = re.sub(r"[^\w\s]", " ", term.lower())
        term_norm = re.sub(r"\s+", " ", term_norm).strip()
        if not term_norm:
            continue
        checked += 1
        if f" {term_norm} " in caption_joined:
            continue  # exact (case/punctuation-insensitive) match -- cheapest path first

        term_word_count = len(term_norm.split())
        best_sim, best_window = 0.0, ""
        for i in range(len(caption_words) - term_word_count + 1):
            window = " ".join(caption_words[i:i + term_word_count])
            dist = _levenshtein(term_norm, window)
            sim = 1 - dist / max(len(term_norm), len(window), 1)
            if sim > best_sim:
                best_sim, best_window = sim, window

        if best_sim >= HIGH_SIM:
            continue  # close spelling/casing variant -- treat as present
        elif best_sim >= LOW_SIM_FLOOR:
            failures.append(f"{term!r} present only as a low-similarity variant ({best_sim * 100:.0f}% match: {best_window!r})")
        else:
            failures.append(f"{term!r} missing from captions (best candidate {best_sim * 100:.0f}% match: {best_window!r})")

    if numerals:
        caption_digit_strings = {m.group().replace(",", "") for m in _CAPTION_NUMERAL_RE.finditer(caption_text)}
        for num in numerals:
            checked += 1
            if num not in caption_digit_strings:
                failures.append(f"{num!r} (numeral) missing from captions -- not found as any digit run in the transcription")

    if failures:
        return GateResult("G11_caption_fidelity", False, "; ".join(failures))
    return GateResult("G11_caption_fidelity", True, f"All {checked} glossary term(s)/numeral(s) confirmed in captions.")


def _levenshtein(a: str, b: str) -> int:
    m, n = len(a), len(b)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(m + 1):
        dp[i][0] = i
    for j in range(n + 1):
        dp[0][j] = j
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if a[i - 1] == b[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
            else:
                dp[i][j] = 1 + min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1])
    return dp[m][n]


def _normalize_opener(script: str) -> str:
    # Deviation from the literal "first-sentence" spec, verified before
    # shipping: the motivating incident this gate exists to catch --
    # "Your wallet called. It wants to discuss the LEGO ___." -- spans TWO
    # sentences (the hook's short-sentence-after-long-sentence style, per
    # the system prompt, means a real template can straddle a period).
    # Tested literally: cutting at the first sentence boundary only keeps
    # "Your wallet called", discards "It wants to discuss the LEGO ___"
    # entirely, and the two openers above come back as a 100% match instead
    # of correctly flagging. Using the first 150 chars of the whole script
    # (unbounded by sentence breaks) instead -- this is what the original
    # web-pipeline Gate 8 actually does (src/lib/lint.ts::_normalizeOpener),
    # so "reuse Gate 8 logic" and a literal "first sentence" window turned
    # out to be in tension; reuse won given the real incident it must catch.
    s = script.strip()[:150].lower()
    s = re.sub(r"\b\d{4,6}\b", "", s)
    s = re.sub(r"\d+", "", s)
    s = re.sub(r"[^\w\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s[:55]


def gate_opener_uniqueness(script: str, recent_scripts: list[str]) -> GateResult:
    candidate = _normalize_opener(script)
    if len(candidate) < 20:
        return GateResult("G7_opener_uniqueness", True)
    for i, prior in enumerate(recent_scripts):
        existing = _normalize_opener(prior)
        if len(existing) < 20:
            continue
        max_len = max(len(candidate), len(existing))
        dist = _levenshtein(candidate, existing)
        sim = 1 - dist / max_len
        if sim >= OPENER_SIMILARITY_THRESHOLD:
            return GateResult(
                "G7_opener_uniqueness", False,
                f"{sim * 100:.0f}% similar to a recent video opener: {candidate[:40]!r}",
            )
    return GateResult("G7_opener_uniqueness", True)


# G8: price-comparison math sanity. Verified 2026-07-06 against the exact
# required bad case ("₹65,999 = six months of Spotify", 6*139=834, nowhere
# near 65999) before trusting this on real output -- also caught two REAL
# bad examples already produced this session ("two years of Spotify
# Premium" for a ₹1,04,999 set = 24*139=3336; "a full year of Netflix,
# Prime, Spotify... combined" for ₹65,999 = 12*(499+125+139)=9156), neither
# of which had been caught by any prior gate.
#
# Only checks claims using the reference-table subscriptions -- an
# unrecognized comparison (e.g. "a Goa trip") is logged, not failed, since
# we have no ground truth for it. Deliberately tolerant of intervening
# words ("a full year", "almost two years") since real generated scripts
# phrase durations that way, not just bare "six months".
#
# Grouped by family (Netflix has 3 overlapping keys, Prime has 2) --
# verified live: a naive flat substring-match dict double-counts "Netflix
# Premium, Spotify, and Prime" as netflix_premium(649) + bare
# netflix(499) + spotify(139) + prime(125) = 1412/month, not the correct
# 913/month, because "netflix" is a substring of "netflix premium" and
# both keys matched independently. Within each family, only the FIRST
# (most specific) match counts.
_SUBSCRIPTION_FAMILIES = [
    [("netflix premium", 649), ("netflix 4k", 649), ("netflix standard", 499), ("netflix", 499)],
    [("amazon prime", 125), ("prime", 125)],
    [("spotify", 139)],
]
_DURATION_NUMBER_WORDS = {
    "a": 1, "an": 1, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11,
    "twelve": 12, "dozen": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15,
    "twenty": 20,
}
_PRICE_CLAIM_RE = re.compile(
    r"\b(a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|dozen|thirteen|fourteen|fifteen|twenty|\d+)\s+"
    r"(?:full\s+|whole\s+|nearly\s+|almost\s+|roughly\s+|about\s+|good\s+)?"
    r"(month|months|year|years)\s+(?:of\s+)?"
    r"([a-zA-Z][a-zA-Z ,]*?)"
    r"(?=[.!?]|$)",
    re.IGNORECASE,
)
_PRICE_CLAIM_RATIO_LOW, _PRICE_CLAIM_RATIO_HIGH = 0.5, 1.5


def gate_price_math(script: str, price_inr: float) -> GateResult:
    for m in _PRICE_CLAIM_RE.finditer(script):
        qty_word, unit, product_phrase = m.groups()
        qty = int(qty_word) if qty_word.isdigit() else _DURATION_NUMBER_WORDS.get(qty_word.lower())
        if qty is None:
            continue
        months_mult = 12 if unit.lower().startswith("year") else 1
        low = product_phrase.lower()
        matched_total, matched_any = 0, False
        for family in _SUBSCRIPTION_FAMILIES:
            for key, monthly in family:
                if key in low:
                    matched_total += monthly
                    matched_any = True
                    break  # most specific match in this family only, no double-count
        if not matched_any:
            continue  # no reference price for this comparison -- can't verify, don't fail it
        claimed_value = qty * months_mult * matched_total
        if not (_PRICE_CLAIM_RATIO_LOW * price_inr <= claimed_value <= _PRICE_CLAIM_RATIO_HIGH * price_inr):
            return GateResult(
                "G8_price_math", False,
                f"claim {m.group(0)!r} implies ₹{claimed_value:,.0f}, but set price is ₹{price_inr:,.0f} (outside 0.5x-1.5x)",
            )
    return GateResult("G8_price_math", True)


def run_all_gates(
    raw_script: str,
    pieces: int | None,
    sets_lookup,
    recent_scripts: list[str],
    price_inr: float,
) -> GateReport:
    # Sanitize before any gate runs, not after -- the sanitized text is what
    # actually reaches TTS, so every gate (word count, banned patterns, the
    # rest) must judge the same text that will be spoken, not the raw draft.
    script = sanitize_script(raw_script)
    report = GateReport(raw_script=raw_script, sanitized_script=script)
    report.results.append(gate_word_count(script))
    report.results.append(gate_banned_patterns(script))
    report.results.append(gate_contains_rupee(script))
    report.results.append(gate_no_cta_ending(script))
    report.results.append(gate_factuality(script, pieces, sets_lookup))
    report.results.append(gate_no_first_person_build(script))
    report.results.append(gate_opener_uniqueness(script, recent_scripts))
    report.results.append(gate_price_math(script, price_inr))
    report.results.append(gate_coherence_llm_judge(script))
    report.results.append(gate_no_store_names(script))
    return report
