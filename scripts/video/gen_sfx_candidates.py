"""
One-off SFX candidate generator -- ElevenLabs Sound Effects endpoint, same
API key as the rest of the Quiet Panic format (ELEVENLABS_API_KEY_ASMR).
Generates "car being built" continuous construction-texture candidates
(for a longer voice-off beat) into assets/sfx/candidates/ -- NOT the
permanent assets/sfx/library/. Operator listens and picks before either
gets promoted.
"""

import sys
from pathlib import Path

VIDEO_DIR = Path(r'C:\Users\bharg\bricks-of-india\scripts\video')
sys.path.insert(0, str(VIDEO_DIR))

import generate_quiet_panic_video as qp  # noqa: E402
from elevenlabs.client import ElevenLabs  # noqa: E402

OUT_DIR = Path(r'C:\Users\bharg\bricks-of-india\assets\sfx\candidates')
OUT_DIR.mkdir(parents=True, exist_ok=True)

CANDIDATES = [
    (
        'car_build_texture_v1.mp3',
        'Rapid successive plastic brick snap clicks, continuous rhythmic '
        'construction assembly texture, satisfying tactile detail, 6-8 seconds',
    ),
    (
        'car_build_texture_v2.mp3',
        'Hands quickly assembling small plastic toy bricks, overlapping '
        'irregular snap clicks and light plastic clatter, organic uneven '
        'rhythm, tactile close mic, 6-8 seconds',
    ),
]


def main():
    client = ElevenLabs(api_key=qp.ELEVENLABS_API_KEY_ASMR)
    for filename, prompt in CANDIDATES:
        out_path = OUT_DIR / filename
        print(f'Generating {filename} ...')
        audio = client.text_to_sound_effects.convert(text=prompt, duration_seconds=7.0)
        with open(out_path, 'wb') as f:
            for chunk in audio:
                f.write(chunk)
        duration = qp.ffprobe_duration(out_path)
        print(f'  -> {out_path} ({duration:.2f}s) -- prompt: "{prompt}"')


if __name__ == '__main__':
    main()
