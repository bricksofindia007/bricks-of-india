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
MODEL_NAME = 'gemini-2.5-flash-lite'

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
                    system_instruction=SYSTEM_PROMPT,
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
