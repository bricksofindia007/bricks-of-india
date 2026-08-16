"""
quiet_panic_script_gen.py -- shared script-generation function for the Quiet
Panic format (briefs/VID-QP-02.md section 2, never built until now --
video-generate-quiet-panic.yml's own comments record that every prior
segment script, including RB20's and WALL-E's, was hand-authored).

One function, two callers: generate_quiet_panic_video.py (fresh candidates,
revision_context=None) and rework_quiet_panic.py (revision mode, feeding
back a rejected script + the operator's rejection_reason). Deliberately NOT
duplicated per caller -- unlike the publish_quiet_panic.py isolation
precedent (which isolates Quiet Panic's *publish* side, talking to IG/
YouTube, from VID-P4's), this module lives entirely on Quiet Panic's own
generation side, where the single render pipeline is meant to be shared
within the format, not re-copied. See operator decision 2026-07-31.

Standalone from engine.py/publish.py all the same -- mirrors engine.py's
generate_script() provider-fallback convention (Gemini primary, Cerebras
failover) without importing it; Quiet Panic's prompt, persona rules, and
output contract (structured JSON segments, not prose) are entirely
different from VID-P4's.
"""

import json
import os
import random
import re
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).parent
load_dotenv(BASE_DIR / '.env')


def get_secret(name: str, default: str = '') -> str:
    """Duplicated from secrets_util.py, same as every other script in this
    directory -- kept local so this file has zero imports from anywhere
    else in scripts/video/ other than its own callers importing *it*."""
    return os.environ.get(name, default).lstrip('﻿').strip()


GEMINI_SOCIAL_API_KEY = get_secret('GEMINI_SOCIAL_API_KEY')
CEREBRAS_API_KEY = get_secret('CEREBRAS_API_KEY')

CODEX_PATH = BASE_DIR.parent.parent / 'docs' / 'codex' / 'BOI_Codex_v2.md'

# Same rate-limiter shape as engine.py's _gemini_pace() -- duplicated
# constant/logic, not imported, per this format's standing isolation
# precedent from engine.py/publish.py.
GEMINI_MIN_GAP_S = 4.0
GEMINI_MAX_GAP_S = 6.0
_last_gemini_call_at = 0.0


def _gemini_pace() -> None:
    global _last_gemini_call_at
    target_gap = random.uniform(GEMINI_MIN_GAP_S, GEMINI_MAX_GAP_S)
    since_last = time.time() - _last_gemini_call_at
    if _last_gemini_call_at > 0 and since_last < target_gap:
        time.sleep(target_gap - since_last)
    _last_gemini_call_at = time.time()


# ---------------------------------------------------------------------------
# Persona rules -- distilled from briefs/VID-QP-01.md sections 2-3 (locked
# decisions only; the brief's own narrative/history around each decision is
# left out of the prompt). Kept as a module constant, not re-read from the
# brief file at runtime, so a prompt change is a reviewable code diff.
#
# WORD_CEILING_DERIVATION (2026-07-31): the 26-42 word range in the brief
# was never checked against real measured TTS/SFX/bumper durations -- a
# first fresh-mode test on Rapunzel's Castle (43297) at that range
# measured 72.50s total against the 40.5-60.5s gate band (12s over).
# Re-derive this number from scratch if intro_final.mp3/outro_final.mp3
# or the SFX library ever change:
#
#   gate ceiling                          60.50s   (55s target x 1.10)
#   - fixed bumpers (intro 8.17 + outro 13.89)  22.06s
#   = body budget                          38.44s
#   worst case: 3 voice-on / 5 voice-off segments (rule allows 3-4 voice-on;
#   fewer voice-on = more voice-off segments = less remaining voice budget)
#   worst-case SFX-native floor per voice-off segment, across the current
#   library (bag_tear 3.00, brick_pour 4.48, brick_snap_body 1.10,
#   sorting_rummage 4.00, separator_pry 2.48, soft_whoosh 2.00) = 4.48s
#   (brick_pour) -- voice-off segment duration is max(sfx_native,
#   reading_floor), and the SFX native length is the binding term for
#   any caption under ~67 characters at this format's terse style.
#   worst-case total voice-off floor: 5 x 4.48s               = 22.40s
#   remaining voice-time budget: 38.44 - 22.40                = 16.04s
#   convert to words at the SLOWER punchy rate (0.95s/word, the
#   conservative choice -- using the faster 0.65s/word rate here would
#   understate real delivery time): 16.04 / 0.95 = 16.88, rounded down
#   for safety margin -> 16 WORDS MAX total across all voice:true segments.
#
# PER_SEGMENT_WORD_CAP derivation (2026-07-31, added after a fresh-mode
# test on Ariel's Royal Wedding Boat (43299) blew the 16-word total by
# putting 16 words in ONE segment alone (total came out to 54) -- the
# total cap alone doesn't stop a single segment from eating the whole
# budget by itself):
#   Empirical evidence from the two passing recalibration tests
#   (Rapunzel's Castle, Spider-Man vs. Hulk): the price-token segment was
#   the longest voice segment in BOTH, at exactly 7 words each ("Nine
#   thousand nine hundred ninety nine rupees." / "Seven thousand four
#   hundred ninety nine rupees.") -- a realistic 4-digit INR price + a
#   comparison clause + "rupees" needs that much room. Every other
#   segment (opener/mid/verdict) in both passing scripts ran 2-6 words,
#   comfortably under that.
#   PER_SEGMENT_WORD_CAP = 7: gives the price segment its full realistic
#   room while stopping any OTHER single segment from growing past what
#   the price segment itself needs (which is exactly Ariel's boat's
#   failure mode -- its opener alone hit 16 words). This is a SECONDARY
#   guard, not a replacement for TOTAL_WORD_CAP=16: 7 words x up to 4
#   voice segments = 28, which is above 16, so the total cap remains the
#   binding constraint in the normal case -- the per-segment cap exists
#   specifically to catch the single-segment-blowout failure mode the
#   total cap alone missed.
# ---------------------------------------------------------------------------

TOTAL_WORD_CAP = 16
PER_SEGMENT_WORD_CAP = 7

# ---------------------------------------------------------------------------
# CAPTION LENGTH BUDGET (added 2026-08-16 -- closes the "reading-floor
# duration gap" found 2026-08-01, see BOI_MASTER_TRACKER.md's VID-QP
# Backlog entry). TOTAL_WORD_CAP/PER_SEGMENT_WORD_CAP above only see
# voice:true segments; a voice:false segment's real duration is
# max(sfx_native_duration, reading_floor) where reading_floor scales with
# CAPTION TEXT LENGTH, not word count on a voice-word budget. Once
# captions started being written with "full wit and specificity" (the
# 2026-07-31 persona rule) instead of kept minimal, reading_floor could
# exceed the SFX-native floor these caps were originally derived against
# -- confirmed live: a Spider-Man vs. Hulk generation passed both the
# word-budget and banned-construction gates cleanly, but real measured
# duration came in 2.02s over the 60.5s ceiling, entirely from long
# voice-off captions. The post-render gate_duration in
# generate_quiet_panic_video.py still catches this correctly (nothing
# broken ships), but it costs a full TTS render to find out -- this check
# catches it before any ElevenLabs call, same philosophy as
# check_word_budget() above. Confirmed hitting ~1/3 of recent generate
# runs (2/6 gate_duration results 2026-07-30 to 2026-08-14) before this
# fix.
#
# Mirrors generate_quiet_panic_video.py's own formula exactly (same
# READING_SPEED_CPS, same max(sfx_native, reading_floor) shape, same live
# ffprobe measurement of bumpers/SFX rather than a hardcoded duration --
# a hardcoded duration is exactly the failure mode a parallel 2026-08-16
# investigation found and fixed elsewhere, in technical-hygiene.mjs's
# IG-token-expiry check; not repeating it here). Voice:true segments'
# contribution is estimated at the SLOWER 0.95s/word punchy rate (see
# WORD_CEILING_DERIVATION above) -- the conservative choice, since this
# check runs before TTS and can't yet know the real per-segment rate.
# ---------------------------------------------------------------------------
READING_SPEED_CPS = 15.0          # chars/sec, matches generate_quiet_panic_video.py
VOICE_WORD_RATE_CONSERVATIVE = 0.95  # s/word, punchy-fragment rate (upper bound)
DURATION_TARGET_MAX = 55.0        # matches generate_quiet_panic_video.py
DURATION_TOLERANCE = 0.10         # matches generate_quiet_panic_video.py
DURATION_CEILING = DURATION_TARGET_MAX * (1 + DURATION_TOLERANCE)  # 60.5s

SFX_LIBRARY_DIR = BASE_DIR.parent.parent / 'assets' / 'sfx' / 'library'
BUMPERS_DIR = BASE_DIR.parent.parent / 'assets' / 'bumpers'
INTRO_BUMPER = BUMPERS_DIR / 'intro_final.mp3'
OUTRO_BUMPER = BUMPERS_DIR / 'outro_final.mp3'


def _ffprobe_duration(path: Path) -> float:
    """Local duplicate of generate_quiet_panic_video.py's ffprobe_duration()
    -- kept local per this file's own zero-cross-import convention (see
    module docstring). Live-measured, never hardcoded: bumpers and SFX
    files do get replaced (e.g. intro_final.mp3's v2 swap, 2026-07-30),
    and a stale constant here would silently drift from what actually
    renders, same failure mode this fix exists to close elsewhere."""
    import subprocess
    result = subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
         '-of', 'default=noprint_wrappers=1:nokey=1', str(path)],
        capture_output=True, text=True, check=True,
    )
    return float(result.stdout.strip())


def check_caption_length_budget(segments: list) -> dict:
    """Pre-TTS validation, zero ElevenLabs cost. Estimates total assembled
    duration (bumpers + voice:true segments at the conservative word rate
    + voice:false segments at max(sfx_native, reading_floor)) and flags
    scripts already projected over DURATION_CEILING before any TTS call
    is made. This is an ESTIMATE, not a replacement for the post-render
    gate_duration in generate_quiet_panic_video.py -- voice:true segments'
    real TTS duration can still vary from the conservative estimate used
    here, so a script can pass this check and still fail the real gate
    (rarer, since this deliberately over-estimates voice:true time). It
    cannot happen the other way: this check is strictly more conservative
    than the real render, so it will never falsely block a script that
    would have passed."""
    intro_duration = _ffprobe_duration(INTRO_BUMPER)
    outro_duration = _ffprobe_duration(OUTRO_BUMPER)

    voice_word_total = sum(
        len(seg['text'].split()) for seg in segments if seg.get('voice', True)
    )
    voice_estimate = voice_word_total * VOICE_WORD_RATE_CONSERVATIVE

    voiceless_detail = []
    voiceless_total = 0.0
    for i, seg in enumerate(segments):
        if seg.get('voice', True):
            continue
        sfx_tag = seg.get('sfx_tag')
        sfx_path = SFX_LIBRARY_DIR / f'{sfx_tag}.mp3'
        sfx_native = _ffprobe_duration(sfx_path) if sfx_path.exists() else 0.0
        reading_floor = len(seg['text']) / READING_SPEED_CPS
        seg_duration = max(sfx_native, reading_floor)
        voiceless_total += seg_duration
        if reading_floor > sfx_native:
            voiceless_detail.append(
                f'segment {i} caption ({len(seg["text"])} chars) reads at {reading_floor:.1f}s, '
                f'over its {sfx_tag} SFX native {sfx_native:.1f}s'
            )

    estimated_total = intro_duration + outro_duration + voice_estimate + voiceless_total
    over_by = estimated_total - DURATION_CEILING

    if over_by <= 0:
        return {
            'pass': True,
            'detail': f'estimated {estimated_total:.1f}s (ceiling {DURATION_CEILING:.1f}s) -- OK',
            'estimated_total': estimated_total,
        }
    detail = f'estimated {estimated_total:.1f}s exceeds the {DURATION_CEILING:.1f}s ceiling by {over_by:.1f}s'
    if voiceless_detail:
        detail += '; ' + '; '.join(voiceless_detail)
    return {'pass': False, 'detail': detail, 'estimated_total': estimated_total}


PERSONA_RULES = """
PERSONA: "The Overly Serious Whisperer" -- series banner "The Quiet Panic".

Core rule: grandiosity of DELIVERY, not vocabulary. Simple, common
Indian-English/Hinglish words only -- no words that need a dictionary
(nothing like "hubris", "quintessential", "juxtaposition", "paradigm",
"grandiloquent"). The joke is museum-tour gravitas applied to a toy, at
whisper volume, using words everyone already knows.

Three script-writing rules:
1. Never break whisper for the punchline -- tone stays constant, the words
   do the work.
2. Treat an ordinary toy purchase like a monumental, weighty decision,
   every time.
3. Price is a punchline PROP for comparison, never a financial verdict.

VERDICT RULE (hard gate, never a real judgment call): always resolves to
"Verdict: buy it." (that exact phrase, verbatim, unmodified), followed by
an absurd, ideally set-specific reason. Try a themed pun first; if nothing
strong and set-specific comes to mind, fall back to one of:
- "Your weekends are overrated anyway."
- "Retirement is a myth invented by people who don't collect LEGO."
- "Financial advisors are just wallets with trust issues."
- "Diwali bonus exists for exactly this kind of regret."
- "Some questions don't need answers."

PRICE-TIER COMPARISON BANK -- pick the device matching the set's actual
price, proportionality matters (a comparison true at one price tier reads
as nonsense at another):
- Low (~Rs.1,000-4,000): a single small everyday spend -- one Swiggy
  order, one movie ticket, one coffee-shop visit.
- Mid (~Rs.5,000-15,000): a recurring monthly cost -- a full month of
  Swiggy, a month's phone EMI.
- High (~Rs.15,000-40,000): a trip or significant one-off -- a Goa round
  trip, a flight.
- Very high (Rs.40,000+): life-event scale -- a shagun envelope, a
  wedding-season expense.

OPENING-LINE VARIETY: "This is not a [object]." is one available device,
NOT the default opener every time. Vary the opening structure across
scripts -- some open on the price, some on a piece-count fact, some on a
direct comparison, some on the "this is not a X" device only when it
genuinely fits (e.g. a flagship set where the grandiosity lands hardest).

OPENER QUALITY (added 2026-08-01 -- "Epic clash." as an opener for a
vs.-fight set is a flat restatement of the premise, not a joke): a generic
single-clause opener that just states what the set literally is is NOT
the signature move -- it's describing the box, not doing the format's
actual joke. Every opener should attempt the core device instead: an
ordinary object measured against something absurdly OVERSIZED or
CONSEQUENTIAL. Same scale-jump as the reference scripts' openers -- RB20's
"Two hundred fifty one pieces. This is a Formula One team's marketing
budget... on your coffee table" (a toy vs. an entire team's budget) or
WALL-E's "Two robots. One wasteland. Zero people asking if you're single"
(an absurd escalation from robot to your love life), not a restatement
like "Two robots fighting." If the opening line doesn't reach for that
oversized comparison, it isn't doing the joke yet -- vary the STRUCTURE
per OPENING-LINE VARIETY above, but never drop the scale-jump itself.

CONCRETE-DETAIL RULE (added 2026-07-31 -- generic phrasing keeps slipping
in): every line, voice:true or voice:false, must anchor in something
CONCRETE and SPECIFIC -- a real comparison, a real cultural reference, a
real physical detail about the set. Do NOT reach for abstract inspirational
or stock-marketing phrasing. Banned-style constructions (illustrative, not
exhaustive -- if a line could be pasted onto a completely different set
unchanged, it's too generic): "a monument to [X]", "reaching for your
dreams", "assembling the [character]", "a testament to [X]", "a symbol of
[X]", "an ode to [X]", anything of the shape "[abstract noun] of [abstract
noun]". Compare: "Assembling the incredible Hulk" (generic, could describe
any Hulk set) vs. "Two hundred fifty one pieces. This is a Formula One
team's marketing budget... on your coffee table" (specific -- exact piece
count, a real-world comparison anchored to THIS set's actual theme). Every
line should read like it was written for this exact set, not a template
with the set name dropped in.

SEGMENT-COUNT / WORD-BUDGET RULE (calibrated from real render data --
telegraphic word-compression was tried and rejected, it broke delivery
cadence and read as choppy rather than deadpan; do NOT compress wording to
hit a duration target):
- Total 8 segments in the script.
- Exactly 3-4 of them carry voice (voice:true): the opening hook, one
  strong mid-script beat, optionally one more, and the closer (always
  "Verdict: buy it." plus its reason). Write these at FULL, natural,
  uncompressed wording -- never shortened for pacing.
- The remaining segments are voice:false -- no spoken line for TTS, the
  segment's audio is entirely its sfx_tag cue. Still give each a "text"
  string (this becomes the burned-in caption, at full original wording --
  captions aren't TTS-bound, so they don't need to shrink either).
- WORD CAPS BELOW APPLY ONLY TO voice:true SEGMENTS (clarified 2026-07-31
  -- this was ambiguous before and nearby caps were bleeding into caption
  quality). voice:false captions have no WORD-count constraint -- their
  timing comes from the SFX asset's native length / reading-speed floor,
  never from word count. Write voice:false captions with the SAME wit,
  specificity, and full joke-carrying weight as voice:true lines -- do
  not write them shorter or blander just because they sit next to a
  capped segment. A caption is not a placeholder; it's read on-screen and
  needs to land on its own.
  CAPTION LENGTH (added 2026-08-16 -- closed a real gap where long
  voice:false captions alone pushed real renders over the duration
  ceiling): a caption read at ~15 characters/second must not run
  noticeably longer than its sfx_tag's own native length, or its reading
  time becomes the actual binding duration instead of the SFX cue --
  quietly inflating total runtime even though every voice:true word cap
  passed. Keep voice:false captions to roughly 60-70 characters or fewer
  as a safe default (most cues in the library run 2-4.5s native, which is
  the room that buys); if pairing with brick_snap_short (0.7s) or
  brick_snap_body (1.1s), keep that specific caption noticeably shorter
  still. This is a guideline for you to self-check against, not something
  you can compute exactly -- the pipeline verifies the real number after
  you write it and will send back specific feedback if it's over.
- HARD WORD CEILING, voice:true segments only (recalibrated 2026-07-31
  against real measured TTS/SFX durations -- a first test on Rapunzel's
  Castle (43297) at the old 26-42 word range measured 72.50s total, 12s
  over the 60.5s ceiling, because that range never accounted for fixed
  bumper overhead or voice-off SFX floor time): total word count across
  ALL voice:true segments combined must be 16 WORDS OR FEWER (aim for
  10-16). See the WORD_CEILING_DERIVATION comment above PERSONA_RULES in
  this file for the full math if this ever needs re-deriving (e.g. after
  a bumper or SFX library change).
- PER-SEGMENT CAP, voice:true segments only (added 2026-07-31 after a
  script put 16 words -- the ENTIRE total budget -- into a single opener
  segment): no individual voice:true segment may exceed 7 WORDS. The
  price-token segment realistically needs close to this (a 4-digit INR
  price + "rupees" runs 5-7 words) -- every other voice:true segment
  should be noticeably shorter than that, not equal to it. This is a
  secondary check alongside the 16-word total, not a replacement for it.
- Pacing budget for voice:true segments only: flowing declarative
  sentences run about 0.65s/word when spoken by the TTS voice; short,
  punchy, ellipsis-heavy fragments (lines with "..." or comma pauses) run
  slower, about 0.95s/word. The 16-word ceiling above already assumes the
  slower 0.95s/word rate throughout as a safety margin, so a script using
  more flowing phrasing will typically render with room to spare, not
  just barely inside the band.
- target_duration in the output is a planning estimate only, not
  authoritative -- actual timing comes from measured TTS/SFX duration
  downstream. Still fill it in as your best estimate.

SFX TAGS -- every segment needs one; valid values: bag_tear, brick_snap,
brick_pour, sorting_rummage, separator_pry, soft_whoosh. Pick the cue that
matches that segment's beat (e.g. brick_snap for an assembly-effort joke,
brick_pour for a piece-count reveal, bag_tear for an opening/unboxing
beat).

PRICE TOKEN (hard gate downstream): the script must include the exact
verified price spoken out as English number words, ending in "rupees",
matching EXACTLY the phrase given to you in the candidate data below --
do not round, estimate, or restate it differently.
""".strip()


# Few-shot reference scripts -- the 3 originally operator-approved tone
# examples from briefs/VID-QP-01.md section 12, plus RB20 and WALL-E's
# real operator-approved final scripts (quiet_panic_posts rows d6531082
# and 443b9159, fetched and confirmed live 2026-07-31, not re-derived from
# a draft/test json). Kept as a fixed module constant -- these are curated
# few-shot anchors, not something meant to drift as new videos get
# approved; update this list deliberately, by hand, if the operator wants
# a fresher example set.
REFERENCE_SCRIPTS = [
    ('WhatsApp Group set (original brief example)',
     'This is not a LEGO set. This is a family WhatsApp group waiting to '
     'happen. Two thousand two hundred pieces. Sharma ji\'s son doesn\'t '
     'have this many achievements. Six thousand nine hundred rupees. '
     'That\'s one full month of Swiggy. Gone. Verdict: buy it. Swiggy can '
     'wait. This cannot.'),
    ('Concorde set (original brief example)',
     'The real Concorde flew faster than sound. This one flies straight '
     'into your credit card statement. Thirty four thousand nine hundred '
     'rupees. That\'s a Goa trip. Round trip. With snacks. The real '
     'Concorde retired in 2003. This one isn\'t going anywhere. Verdict: '
     'buy it. Some flights you only get once.'),
    ('9000-piece set (original brief example)',
     'Nine thousand pieces. This is not a set. This is a relationship. '
     'No-cost EMI available. Emphasis on \'no cost.\' Emotionally, this '
     'will cost everything. Your mother will ask why you bought this. You '
     'will not have an answer. Verdict: buy it. Some questions don\'t '
     'need answers.'),
    ('Oracle Red Bull Racing RB20 (77243) -- real approved+posted script, '
     'quiet_panic_posts d6531082',
     'Two hundred fifty one pieces. This is a Formula One team\'s '
     'marketing budget... on your coffee table. Red Bull\'s real pit crew '
     'changes all four tyres in under two seconds. You will take twenty '
     'minutes. And call it engineering. Two thousand nine hundred ninety '
     'nine rupees. One Swiggy order. No guilt. Verdict: buy it. The real '
     'RB20 needs a garage. This needs a shelf... and no self-control.'),
    ('WALL-E and EVE (43279) -- real operator-approved script, '
     'quiet_panic_posts 443b9159',
     'Two robots. One wasteland. Zero people asking if you\'re single. '
     'Eight hundred eleven pieces. WALL-E waited seven hundred years '
     'alone. You get one weekend... also alone. Seven thousand seven '
     'hundred forty nine rupees. That\'s one month\'s phone EMI... for a '
     'robot who found love before you did. Verdict: buy it. The real '
     'WALL-E waited seven hundred years for love. Your shelf just needs a '
     'corner.'),
]


# ---------------------------------------------------------------------------
# Deterministic number -> words, matching the exact vocabulary/shape
# generate_quiet_panic_video.py's gate_price_token/extract_spoken_rupee_
# amounts parser understands (ones/tens/hundred/thousand only, no "and",
# no lakh/crore) -- giving the model this exact string to reproduce
# verbatim, rather than trusting it to convert the number correctly on its
# own, removes the single most likely cause of a price-token gate failure.
# ---------------------------------------------------------------------------

_ONES_WORDS = {
    1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six',
    7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten', 11: 'eleven',
    12: 'twelve', 13: 'thirteen', 14: 'fourteen', 15: 'fifteen',
    16: 'sixteen', 17: 'seventeen', 18: 'eighteen', 19: 'nineteen',
}
_TENS_WORDS = {
    20: 'twenty', 30: 'thirty', 40: 'forty', 50: 'fifty', 60: 'sixty',
    70: 'seventy', 80: 'eighty', 90: 'ninety',
}


def _two_digit_words(n: int) -> str:
    if n == 0:
        return ''
    if n < 20:
        return _ONES_WORDS[n]
    tens, ones = divmod(n, 10)
    tens_word = _TENS_WORDS[tens * 10]
    return f'{tens_word} {_ONES_WORDS[ones]}' if ones else tens_word


def _three_digit_words(n: int) -> str:
    hundreds, rem = divmod(n, 100)
    parts = []
    if hundreds:
        parts.append(f'{_ONES_WORDS[hundreds]} hundred')
    if rem:
        parts.append(_two_digit_words(rem))
    return ' '.join(parts)


def price_to_words(price_inr) -> str:
    """int/float rupee amount -> spoken English words, e.g. 2999 ->
    'two thousand nine hundred ninety nine'. Caller appends 'rupees'."""
    n = int(round(price_inr))
    if n == 0:
        return 'zero'
    thousands, rem = divmod(n, 1000)
    parts = []
    if thousands:
        parts.append(f'{_three_digit_words(thousands)} thousand')
    if rem:
        parts.append(_three_digit_words(rem))
    return ' '.join(parts)


# ---------------------------------------------------------------------------
# Prompt assembly
# ---------------------------------------------------------------------------

def _load_codex() -> str:
    if not CODEX_PATH.exists():
        raise FileNotFoundError(f'BOI_Codex_v2.md not found at {CODEX_PATH}')
    return CODEX_PATH.read_text(encoding='utf-8')


SYSTEM_PROMPT_TEMPLATE = """You are the script-writing engine for Bricks of India's "Quiet Panic" \
short-video format on Instagram Reels / YouTube Shorts.

Below is BOI_Codex_v2.md, the site's full brand-voice document (the \
Clarkson-style persona used across the main written content) -- read it \
for tone/rhythm/banned-construction grounding. The Quiet Panic format is a \
DISTINCT persona layered on top of it, described in PERSONA RULES below; \
where the two conflict, PERSONA RULES below wins for this task.

=== BOI_Codex_v2.md (brand voice DNA, base layer) ===
{codex}
=== end BOI_Codex_v2.md ===

=== PERSONA RULES (Quiet Panic format, this task's binding spec) ===
{persona_rules}
=== end PERSONA RULES ===

=== REFERENCE SCRIPTS (operator-approved tone, few-shot examples) ===
{references}
=== end REFERENCE SCRIPTS ===

OUTPUT CONTRACT -- respond with ONLY a strict JSON array, no prose, no \
markdown code fence, no explanation before or after. Each element:
{{"text": "...", "target_duration": 2.5, "voice": true, "sfx_tag": "brick_snap"}}
"voice" is a boolean (true/false per the segment-count rule above). \
"sfx_tag" must be one of the six valid tags listed above. Exactly 8 \
segments total, 3-4 with voice:true (following the rule above), the last \
voice:true segment being the verdict line."""


def _build_reference_block() -> str:
    blocks = []
    for label, text in REFERENCE_SCRIPTS:
        blocks.append(f'[{label}]\n{text}')
    return '\n\n'.join(blocks)


def _build_task_prompt(candidate: dict, revision_context: dict = None) -> str:
    price_inr = candidate['price_inr']
    price_words = price_to_words(price_inr)
    price_phrase = f'{price_words} rupees'

    lines = [
        'CANDIDATE DATA:',
        f'- Set name: {candidate["set_title"]}',
        f'- Set number: {candidate.get("set_number", "unknown")}',
        f'- Verified price: Rs.{price_inr:,} -- spell this EXACTLY as: '
        f'"{price_phrase}"',
        f'- Piece count: {candidate.get("pieces", "unknown")}',
        f'- Theme: {candidate.get("theme", "unknown")}',
    ]

    if revision_context:
        lines += [
            '',
            'REVISION MODE -- this is not a fresh script. The script below '
            'was already generated for this exact set and was REJECTED by '
            'the operator for a specific reason. Produce a REVISED version '
            'that directly and specifically addresses that reason. Keep '
            'everything the reason does NOT complain about -- same overall '
            'structure and jokes where unaffected. Do not write an '
            'unrelated fresh take on the set; this is a targeted edit, not '
            'a rewrite from scratch.',
            '',
            f'PREVIOUS SCRIPT (rejected):\n"{revision_context["original_script"]}"',
            '',
            f'OPERATOR\'S REJECTION REASON:\n"{revision_context["rejection_reason"]}"',
            '',
            'Output the FULL revised segment JSON array (all 8 segments, '
            'not just the ones you changed).',
        ]
    else:
        lines += ['', 'Write a fresh script for this set.']

    return '\n'.join(lines)


def _extract_json_array(text: str) -> list:
    text = text.strip()
    # Strip a ```json ... ``` or ``` ... ``` fence if the model added one
    # despite the no-markdown instruction.
    fence_match = re.match(r'^```(?:json)?\s*(.*?)\s*```$', text, re.DOTALL)
    if fence_match:
        text = fence_match.group(1).strip()
    start = text.find('[')
    end = text.rfind(']')
    if start == -1 or end == -1 or end < start:
        raise ValueError(f'No JSON array found in model output: {text[:300]!r}')
    return json.loads(text[start:end + 1])


def _validate_segments(segments: list) -> None:
    if not isinstance(segments, list) or not segments:
        raise ValueError('Script-gen output is not a non-empty JSON array.')
    for i, seg in enumerate(segments):
        if not isinstance(seg, dict) or 'text' not in seg:
            raise ValueError(f'Segment {i} missing required "text" field: {seg!r}')
        if not seg.get('voice', True) and not seg.get('sfx_tag'):
            raise ValueError(f'Segment {i} has voice:false but no sfx_tag: {seg!r}')


class PreTTSValidationError(Exception):
    """Base class for any pre-TTS rejection -- same binary gate-and-reject
    philosophy as every post-render gate in generate_quiet_panic_video.py,
    just executed before any ElevenLabs call instead of after, at zero
    cost either way. Callers should NOT insert a quiet_panic_posts row for
    any subclass of this (video_path is NOT NULL and no render has
    happened yet) -- mirrors the existing precedent in process_candidate()
    for other pre-render failures (e.g. "No images resolved for set..."
    also just raises, no DB row).

    Carries the segments that failed validation (added 2026-08-03 after
    Ariel's Royal Wedding Boat (43299) missed the word cap on all 5/5
    retry attempts in one run, 17-22 words each): MAX_SCRIPT_GEN_ATTEMPTS
    previously just called generate_quiet_panic_script() again with the
    exact same fresh-mode prompt on every retry, so the model had zero
    information about what it got wrong -- 5 independent draws from the
    same distribution, not 5 corrective attempts. Exposing the failed
    segments here lets the caller feed the specific failure back as a
    revision_context on the next attempt (same mechanism already used for
    operator-rejected reworks), turning a blind retry loop into a
    self-correcting one."""
    def __init__(self, message: str, segments: list = None, budget: dict = None):
        super().__init__(message)
        self.segments = segments
        # Full check_word_budget() dict (total_words, segment_words),
        # not just the summary string -- so a caller building corrective
        # feedback can cite exact numbers (segment index, its word count,
        # exactly how many words over) instead of trusting the model to
        # re-derive those from a text-only description of its own
        # overshoot (added 2026-08-03: a first attempt at feeding just
        # the string detail back plateaued at 18-19 words across all 5
        # retries on Ariel's Royal Wedding Boat (43299) -- "cut some
        # words" without exact counts wasn't specific enough to close a
        # 2-3 word gap).
        self.budget = budget


class WordBudgetExceededError(PreTTSValidationError):
    """Raised by check_word_budget() via generate_quiet_panic_script()."""


class CaptionLengthExceededError(PreTTSValidationError):
    """Raised by check_caption_length_budget() via generate_quiet_panic_script()
    -- added 2026-08-16, closes the reading-floor duration gap (see the
    CAPTION LENGTH BUDGET comment block above)."""


class VerdictReasonMissingError(PreTTSValidationError):
    """Raised by check_verdict_reason() via generate_quiet_panic_script()
    -- added 2026-08-01 after a fresh generation shipped a bare "Verdict:
    buy it." with no reason following it. The VERDICT RULE in
    PERSONA_RULES already instructed a reason to always follow, but a
    prompt instruction alone proved unreliable (this is exactly the kind
    of thing this pipeline's whole gate philosophy exists to catch, not
    trust to the model): a real code-level check, not a persona-only
    fix."""


def check_word_budget(segments: list) -> dict:
    """Pre-TTS validation, zero ElevenLabs cost either way. Mirrors the
    {'pass', 'detail'} gate-dict shape used throughout generate_quiet_
    panic_video.py's post-render gates -- same philosophy, just against
    word counts instead of measured audio, and executed earlier. See the
    TOTAL_WORD_CAP / PER_SEGMENT_WORD_CAP derivation comments above
    PERSONA_RULES for the math."""
    segment_words = [
        (i, len(seg['text'].split()))
        for i, seg in enumerate(segments)
        if seg.get('voice', True)
    ]
    total_words = sum(wc for _, wc in segment_words)
    over_cap = [(i, wc) for i, wc in segment_words if wc > PER_SEGMENT_WORD_CAP]

    problems = []
    if total_words > TOTAL_WORD_CAP:
        problems.append(f'total voice-word count {total_words} exceeds the {TOTAL_WORD_CAP}-word cap')
    if over_cap:
        detail = ', '.join(f'segment {i} ({wc}w)' for i, wc in over_cap)
        problems.append(f'per-segment cap ({PER_SEGMENT_WORD_CAP}w) exceeded: {detail}')

    return {
        'pass': not problems,
        'detail': '; '.join(problems) if problems else (
            f'total {total_words}w (cap {TOTAL_WORD_CAP}), all voice segments <= {PER_SEGMENT_WORD_CAP}w'
        ),
        'total_words': total_words,
        'segment_words': segment_words,
    }


# Generic single-word non-reasons -- a bare "Obviously." or "Yes." after
# "Verdict: buy it." is trivially close to no reason at all, same failure
# mode as having nothing there, just padded with one throwaway word. A
# single REAL word (e.g. Spider-Man's approved "Fight.") is fine -- this
# list exists to catch filler, not to force a minimum word count.
VERDICT_REASON_FILLER_WORDS = {
    'obviously', 'definitely', 'clearly', 'duh', 'yes', 'sure', 'done',
    'literally', 'seriously', 'totally', 'basically', 'naturally',
}

_VERDICT_PHRASE_RE = re.compile(r'verdict:\s*buy it\.?', re.IGNORECASE)


def check_verdict_reason(segments: list) -> dict:
    """Pre-TTS validation, zero ElevenLabs cost either way -- see
    VerdictReasonMissingError. Finds the voice:true segment containing
    the required "Verdict: buy it." phrase and checks there is real text
    after it in the SAME segment: either more than one word, or exactly
    one word that isn't on the generic-filler list above. Also included
    in generate_quiet_panic_video.py's run_all_gates() (imported from
    here to avoid a circular import -- that file already imports FROM
    this module) so every render's gate_results carries this check too,
    not just the pre-TTS path."""
    for i, seg in enumerate(segments):
        if not seg.get('voice', True):
            continue
        match = _VERDICT_PHRASE_RE.search(seg['text'])
        if not match:
            continue
        remainder = seg['text'][match.end():].strip(' .!?')
        words = remainder.split()
        if len(words) == 0:
            return {'pass': False, 'detail': f'segment {i} is "Verdict: buy it." with no reason following it at all'}
        if len(words) == 1 and words[0].lower().strip('.,!?') in VERDICT_REASON_FILLER_WORDS:
            return {'pass': False, 'detail': f'segment {i}\'s verdict reason is just filler ({remainder!r}), not a real reason'}
        return {'pass': True, 'detail': f'segment {i} verdict reason: {remainder!r}'}
    return {'pass': False, 'detail': 'no voice:true segment contains "Verdict: buy it."'}


# ---------------------------------------------------------------------------
# Provider calls -- same fallback convention as engine.py's generate_script
# (Gemini gemini-2.5-flash primary, Cerebras gpt-oss-120b failover), not
# imported from it.
# ---------------------------------------------------------------------------

def _call_gemini(system_prompt: str, task_prompt: str) -> str:
    if not GEMINI_SOCIAL_API_KEY:
        raise RuntimeError('GEMINI_SOCIAL_API_KEY not set.')
    _gemini_pace()
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=GEMINI_SOCIAL_API_KEY)
    resp = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=task_prompt,
        config=types.GenerateContentConfig(system_instruction=system_prompt),
    )
    if not resp.text or not resp.text.strip():
        raise RuntimeError('Gemini returned empty text.')
    return resp.text.strip()


def _call_cerebras(system_prompt: str, task_prompt: str) -> str:
    if not CEREBRAS_API_KEY:
        raise RuntimeError('CEREBRAS_API_KEY not set.')
    from cerebras.cloud.sdk import Cerebras
    client = Cerebras(api_key=CEREBRAS_API_KEY)
    resp = client.chat.completions.create(
        model='gpt-oss-120b',
        messages=[
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': task_prompt},
        ],
    )
    content = resp.choices[0].message.content
    if not content or not content.strip():
        raise RuntimeError('Cerebras returned empty content.')
    return content.strip()


def generate_quiet_panic_script(candidate: dict, revision_context: dict = None) -> list:
    """candidate: {'set_number', 'set_title', 'price_inr', 'pieces', 'theme'}.
    revision_context (optional): {'original_script', 'rejection_reason'} --
    when present, the prompt instructs a targeted revision instead of a
    fresh take. Returns a list of segment dicts (text/target_duration/
    voice/sfx_tag), same shape generate_quiet_panic_video.py's
    process_candidate() already expects for a hand-authored candidate."""
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
        codex=_load_codex(),
        persona_rules=PERSONA_RULES,
        references=_build_reference_block(),
    )
    task_prompt = _build_task_prompt(candidate, revision_context)

    raw_text = None
    try:
        raw_text = _call_gemini(system_prompt, task_prompt)
    except Exception as e:
        print(f'WARN: Gemini script-gen failed ({e}), falling back to Cerebras.', file=sys.stderr)

    if raw_text is None:
        raw_text = _call_cerebras(system_prompt, task_prompt)

    segments = _extract_json_array(raw_text)
    _validate_segments(segments)

    budget_check = check_word_budget(segments)
    if not budget_check['pass']:
        raise WordBudgetExceededError(budget_check['detail'], segments=segments, budget=budget_check)

    caption_check = check_caption_length_budget(segments)
    if not caption_check['pass']:
        # NOT passing budget=caption_check here: _build_word_cap_feedback()
        # in generate_quiet_panic_video.py assumes a truthy `budget` means
        # WordBudgetExceededError's specific {'total_words', 'segment_words'}
        # shape and would KeyError on this check's differently-shaped dict.
        # Falls back to the generic string-detail retry message instead,
        # which already cites the specific over-budget segment(s) -- see
        # check_caption_length_budget()'s docstring. If retries plateau the
        # way the word-budget ones once did (2026-08-03), give this its own
        # code-computed feedback branch the same way that was fixed.
        raise CaptionLengthExceededError(caption_check['detail'], segments=segments)

    verdict_check = check_verdict_reason(segments)
    if not verdict_check['pass']:
        raise VerdictReasonMissingError(verdict_check['detail'], segments=segments)

    return segments


# ---------------------------------------------------------------------------
# CLI -- standalone script-gen-only test entry point (no render, no DB
# writes). Used for operator review before either the fresh-mode generate
# workflow or the rework poller runs unattended.
# ---------------------------------------------------------------------------

def main():
    import argparse
    parser = argparse.ArgumentParser(description='Quiet Panic script-gen, standalone (no render, no DB writes).')
    parser.add_argument('--set-number', required=True)
    parser.add_argument('--set-title', required=True)
    parser.add_argument('--price-inr', type=float, required=True)
    parser.add_argument('--pieces', type=int, default=None)
    parser.add_argument('--theme', type=str, default=None)
    parser.add_argument('--original-script', type=str, default=None, help='If set with --rejection-reason, runs in revision mode.')
    parser.add_argument('--rejection-reason', type=str, default=None)
    args = parser.parse_args()

    candidate = {
        'set_number': args.set_number,
        'set_title': args.set_title,
        'price_inr': args.price_inr,
        'pieces': args.pieces,
        'theme': args.theme,
    }
    revision_context = None
    if args.original_script and args.rejection_reason:
        revision_context = {'original_script': args.original_script, 'rejection_reason': args.rejection_reason}

    segments = generate_quiet_panic_script(candidate, revision_context=revision_context)
    print(json.dumps(segments, indent=2))


if __name__ == '__main__':
    main()
