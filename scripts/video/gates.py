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

import re
from dataclasses import dataclass, field

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
]

# TTS reads these characters aloud if present — hard-fail, don't just strip.
FORBIDDEN_CHARS_RE = re.compile(r"[\U0001F300-\U0001FAFF\U00002600-\U000027BF*#\[\]]")

CTA_OR_SIGNOFF_RE = re.compile(
    r"(follow|like|subscribe|comment|see you|until next time|that'?s (it|all) for (today|now))",
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

    @property
    def all_passed(self) -> bool:
        return all(r.passed for r in self.results)

    def as_dict(self) -> dict:
        return {r.gate: {"pass": r.passed, "reason": r.reason} for r in self.results}


def _word_count(script: str) -> int:
    return len(script.split())


def gate_word_count(script: str) -> GateResult:
    n = _word_count(script)
    if 100 <= n <= 130:
        return GateResult("G1_word_count", True, f"{n} words")
    return GateResult("G1_word_count", False, f"{n} words, outside 100-130")


def gate_banned_patterns(script: str) -> GateResult:
    lower = script.lower()
    for pat in BANNED_PATTERNS:
        if re.search(pat, lower, re.IGNORECASE | re.MULTILINE):
            return GateResult("G2_banned_patterns", False, f"matched banned pattern: {pat}")
    m = FORBIDDEN_CHARS_RE.search(script)
    if m:
        return GateResult("G2_banned_patterns", False, f"TTS-unsafe character found: {m.group(0)!r}")
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


def run_all_gates(
    script: str,
    pieces: int | None,
    sets_lookup,
    recent_scripts: list[str],
) -> GateReport:
    report = GateReport()
    report.results.append(gate_word_count(script))
    report.results.append(gate_banned_patterns(script))
    report.results.append(gate_contains_rupee(script))
    report.results.append(gate_no_cta_ending(script))
    report.results.append(gate_factuality(script, pieces, sets_lookup))
    report.results.append(gate_no_first_person_build(script))
    report.results.append(gate_opener_uniqueness(script, recent_scripts))
    return report
