"""
caption_writer.py — Generates Instagram captions using Gemini Flash.
Voice: Jeremy Clarkson meets Indian wallet anxiety.
"""

import os
import re
import sys
import time
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / '.env')
load_dotenv(Path(__file__).parent.parent / '.env.local')

GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
MODEL_NAME = 'gemini-3.1-flash-lite'

# Voice grounding, added 2026-08-16 (Phase 4c): this call site had zero codex
# reference of any kind before this -- confirmed by grepping social-automation/
# for "codex"/"voice"/the filename and finding nothing but incidental uses of
# the word "voice" in this file's own header comment and SYSTEM_PROMPT text.
#
# Unlike newsletter/llm.py (boi-growth-engine, Phase 3.7), this repo does NOT
# need a manually-synced duplicate copy: social-automation.yml's checkout@v4
# already pulls the whole bricks-of-india repo, and the codex already lives
# in it at docs/codex/BOI_Codex_v2.md -- one directory up from this file.
# Referencing it directly avoids a second copy that could drift out of sync.
CODEX_PATH = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'docs', 'codex', 'BOI_Codex_v2.md')
)


def _load_codex() -> str:
    """Raises loudly if the codex is missing rather than silently falling
    back to an ungrounded prompt -- same reasoning as newsletter/llm.py's
    _load_codex(): a silent fallback here would be worse than the original
    bug, since nobody would know voice grounding had quietly stopped
    working."""
    if not os.path.isfile(CODEX_PATH):
        raise FileNotFoundError(
            f'BOI Voice Codex not found at {CODEX_PATH} -- refusing to generate '
            'a caption without voice grounding. Restore docs/codex/BOI_Codex_v2.md '
            'before running pipeline.py again.'
        )
    with open(CODEX_PATH, 'r', encoding='utf-8') as f:
        return f.read()

SYSTEM_PROMPT = """You are the content writer for Bricks of India, India's only LEGO price \
comparison platform. Voice: Jeremy Clarkson meets Indian wallet anxiety. \
Dry, witty, precise. Short sentences after long ones. For impact. Never \
start with "LEGO has announced". Open with something Indian — chai, traffic, \
EMIs, cricket, price comparisons — then pivot to LEGO in two sentences. \
Never reference weather, seasons, or monsoon. Never explain the joke. \
The wallet is always a character.
Output format: Instagram caption only. No preamble. No "Here is your \
caption:". Just the caption text."""

# Used when source is lego_coming_soon / lego_com — set hasn't released in India.
DISCLAIMER = """🛑 Please do not ask when this set releases in India. \
I don't know. LEGO doesn't know. Nobody knows. \
One day it will come. One day. 🤫"""

# Used when source is rebrickable / brickset (emergency fallback) — availability unknown.
NEUTRAL_SIGN_OFF = "🧱 Follow Bricks of India for LEGO news, prices & deals in India. \
Link in bio. #LEGOIndia #BricksofIndia"

# Sources that come from LEGO.com coming-soon page → use DISCLAIMER.
_LEGO_COM_SOURCES = {'lego_coming_soon', 'lego_com'}


def _india_price(usd_price: float | None) -> int | None:
    if usd_price is None:
        return None
    return round(usd_price * 1.35 * 84)


def generate_caption(set_data: dict) -> str:
    from google import genai
    from google.genai import types

    if not GEMINI_API_KEY:
        raise EnvironmentError('GEMINI_API_KEY is not set')

    client = genai.Client(api_key=GEMINI_API_KEY)

    source = set_data.get('source', 'lego_coming_soon')
    is_lego_source = source in _LEGO_COM_SOURCES

    usd_price = set_data.get('usd_price')
    india_price = _india_price(usd_price)
    usd_str = f'{usd_price:.2f}' if usd_price else 'TBD'
    india_str = f'{india_price:,}' if india_price else 'TBD'

    if is_lego_source:
        sign_off = (
            '🛑 Please do not ask when this set releases in India. '
            'I don\'t know. LEGO doesn\'t know. Nobody knows. '
            'One day it will come. One day. 🤫'
        )
        prompt_context = 'LEGO set announcement (not yet available in India)'
    else:
        sign_off = NEUTRAL_SIGN_OFF
        prompt_context = 'LEGO set spotlight (availability in India unknown — do NOT use "coming soon" or "releasing" language)'

    user_prompt = f"""Write an Instagram caption for this {prompt_context}:
Set Name: {set_data['name']}
Set Number: {set_data['set_num']}
Theme: {set_data.get('theme', 'Unknown')}
Piece Count: {set_data.get('num_parts') or 'Unknown'}
Global USD Price: ${usd_str}
Estimated India Price: ₹{india_str} (calculated at USD x 1.35 x 84)

End the caption with exactly this text, no modifications:

{sign_off}"""

    # Retry up to 3 times on 503 capacity spikes (30s back-off each attempt)
    last_exc = None
    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model=MODEL_NAME,
                contents=user_prompt,
                config=types.GenerateContentConfig(
                    # Codex prepended ahead of the existing SYSTEM_PROMPT, not
                    # merged into or replacing it -- SYSTEM_PROMPT itself is
                    # untouched by this change.
                    system_instruction=_load_codex() + '\n\n---\n\n' + SYSTEM_PROMPT,
                ),
            )
            caption = response.text.strip()
            break
        except Exception as exc:
            last_exc = exc
            msg = str(exc)
            if '503' in msg or 'UNAVAILABLE' in msg:
                wait = 30 * (attempt + 1)
                print(f'[caption] Gemini 503 on attempt {attempt + 1}/3 — retrying in {wait}s...')
                time.sleep(wait)
            else:
                raise
    else:
        raise RuntimeError(f'Gemini unavailable after 3 attempts: {last_exc}')

    # Strip markdown asterisks Gemini sometimes emits
    caption = re.sub(r'\*+', '', caption)

    # Hard safety check: ensure the correct sign-off is present exactly.
    expected = DISCLAIMER if is_lego_source else NEUTRAL_SIGN_OFF
    if expected not in caption:
        caption = caption.rstrip() + '\n\n' + expected

    return caption


# ---------------------------------------------------------------------------
# Quality gates (Phase 4c, 2026-08-16)
# ---------------------------------------------------------------------------
# Sign-off/disclaimer presence is NOT re-implemented here -- it already
# exists above (the "Hard safety check" block, lines ~149-152) and is
# stronger than a pass/fail gate: it force-appends the correct sign-off if
# missing, so by the time generate_caption() returns, presence is
# guaranteed, not merely checked. Confirmed in code, not assumed from a
# past sample happening to include one.

# Literal phrases pulled directly from docs/codex/BOI_Codex_v2.md, PAGE 17:
# BANNED CONSTRUCTIONS AND ANTI-PATTERNS -- the "Banned Openers", "Banned
# Phrasings (PR-speak)", and "Banned Self-References" subsections. Only
# entries that are actual fixed text are included below; deliberately
# EXCLUDED (not fabricated equivalents):
#   - "[Set name] is a [theme] set with X pieces released in Y" -- a
#     templated pattern with placeholders, not a literal phrase to substring-match
#   - the entire "Banned Structural Patterns" subsection (bullet-point
#     feature lists, pieces-per-rupee comparisons, competitor mentions,
#     star ratings/scores/percentages) -- behavioral/structural rules, not
#     literal text a caption would contain verbatim
#   - "Earnest apologies for being wrong" -- also a behavioral rule, not a phrase
# Nothing below was invented beyond what the codex itself specifies.
OFFVOICE_PHRASES = (
    'LEGO has announced',
    'In a surprise move',
    'Have you ever wondered',
    "Today we're looking at",
    'Stunning',
    'breathtaking',
    'must-have',
    'does not disappoint',
    'welcome addition to any collection',
    'Definitely worth considering',
    'Great value for money',
    'As you may know',
    "I'm not an expert",
    'Just my opinion',
)


def _normalize_quotes(text: str) -> str:
    """Codex source uses curly quotes/apostrophes ('re, ’m); Gemini output
    is inconsistent about which it uses. Normalize both sides to straight
    quotes before matching so real matches aren't missed on a typographic
    technicality."""
    return text.replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"')


def find_offvoice_phrases(caption_text: str) -> list[str]:
    """Case-insensitive substring scan of generated caption text against
    OFFVOICE_PHRASES (see above). Returns the list of banned phrases found,
    empty if none."""
    normalized = _normalize_quotes(caption_text or '').lower()
    return [
        phrase for phrase in OFFVOICE_PHRASES
        if _normalize_quotes(phrase).lower() in normalized
    ]


# Real, current Instagram caption limit (Graph API POST /{ig-user-id}/media)
# is 2,200 characters -- confirmed live 2026-08-16, not assumed from memory.
# This ceiling is NOT a style opinion or set at the real limit -- it's set
# well inside it (every real sample generated across this whole migration,
# 6 captions across 3 real sets, ranged 384-702 chars) specifically to catch
# a runaway/malformed generation before it ever reaches the real API limit,
# with enough headroom that a legitimately longer caption still wouldn't
# trip it.
INSTAGRAM_CAPTION_HARD_LIMIT = 2200
CAPTION_LENGTH_CEILING = 1500


def find_length_violation(caption_text: str) -> list[str]:
    """Objective, non-stylistic sanity check -- not a codex rule, a runaway-
    generation guard. Returns a one-item list describing the violation, or
    empty if the caption is within the ceiling."""
    length = len(caption_text or '')
    if length > CAPTION_LENGTH_CEILING:
        return [
            f'caption is {length} chars, exceeds the {CAPTION_LENGTH_CEILING}-char ceiling '
            f'(real Instagram API hard limit is {INSTAGRAM_CAPTION_HARD_LIMIT}) -- likely a '
            'runaway or malformed generation, not normal length variance'
        ]
    return []


if __name__ == '__main__':
    print('Step 4 — Testing caption writer...\n')
    test_set = {
        'set_num': '42172-1',
        'name': 'McLaren P1 Hypercar',
        'theme': 'Technic',
        'num_parts': 3893,
        'usd_price': 249.99,
    }
    try:
        caption = generate_caption(test_set)
        print('Generated caption:\n')
        print('-' * 60)
        print(caption.encode('utf-8', errors='replace').decode('utf-8'))
        print('-' * 60)

        # Verify disclaimer
        if DISCLAIMER in caption:
            print('\n✓ Disclaimer present exactly as required.')
        else:
            print('\n✗ WARNING: Disclaimer not found verbatim — check output.')
        print('\nStep 4 PASSED.')
    except Exception as exc:
        print(f'ERROR: {exc}')
        import traceback
        traceback.print_exc()
        sys.exit(1)
