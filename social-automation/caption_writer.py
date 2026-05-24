"""
caption_writer.py — Generates Instagram captions using Gemini Flash.
Voice: Jeremy Clarkson meets Indian wallet anxiety.
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / '.env')
load_dotenv(Path(__file__).parent.parent / '.env.local')

GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
MODEL_NAME = 'gemini-2.5-flash-lite'

SYSTEM_PROMPT = """You are the content writer for Bricks of India, India's only LEGO price \
comparison platform. Voice: Jeremy Clarkson meets Indian wallet anxiety. \
Dry, witty, precise. Short sentences after long ones. For impact. Never \
start with "LEGO has announced". Open with something Indian (chai, traffic, \
EMIs, cricket) then pivot to LEGO in two sentences. Never explain the joke. \
The wallet is always a character.
Output format: Instagram caption only. No preamble. No "Here is your \
caption:". Just the caption text."""

DISCLAIMER = """🛑 Please do not ask when this set releases in India. \
I don't know. LEGO doesn't know. Nobody knows. \
One day it will come. One day. 🤫"""


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

    usd_price = set_data.get('usd_price')
    india_price = _india_price(usd_price)
    usd_str = f'{usd_price:.2f}' if usd_price else 'TBD'
    india_str = f'{india_price:,}' if india_price else 'TBD'

    user_prompt = f"""Write an Instagram caption for this LEGO set announcement:
Set Name: {set_data['name']}
Set Number: {set_data['set_num']}
Theme: {set_data.get('theme', 'Unknown')}
Piece Count: {set_data.get('num_parts', 'Unknown')}
Global USD Price: ${usd_str}
Estimated India Price: ₹{india_str} (calculated at USD x 1.35 x 84)

End the caption with exactly this text, no modifications:

🛑 Please do not ask when this set releases in India. \
I don't know. LEGO doesn't know. Nobody knows. \
One day it will come. One day. 🤫"""

    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=user_prompt,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
        ),
    )
    caption = response.text.strip()

    # Hard safety check: ensure disclaimer is present exactly
    if DISCLAIMER not in caption:
        caption = caption.rstrip() + '\n\n' + DISCLAIMER

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
