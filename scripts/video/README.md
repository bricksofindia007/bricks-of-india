# VID-P4 — Daily Video Pipeline

Sandwich video generator: operator's recorded intro clip + AI middle (Ken
Burns over product images + Gemini script read by an ElevenLabs voice clone)
+ operator's recorded outro. Daily, manual upload to IG Reels + YT Shorts.

For the day-to-day operating flow (suggest → pick → render → upload → mark
posted), see `docs/runbooks/VIDEO_PIPELINE.md`. This file is setup only.

## Setup

1. **Python deps:**
   ```
   cd scripts/video
   pip install -r requirements.txt
   ```

2. **ffmpeg (Windows):**
   ```powershell
   winget install ffmpeg
   ```
   Restart your shell, then verify:
   ```
   ffmpeg -version
   ```
   moviepy shells out to `ffmpeg`/`ffprobe` for encoding and duration
   probing — the pipeline will fail immediately without it on PATH.

3. **Environment:** copy `.env.example` to `.env` and fill in real keys.
   `.env` is gitignored — never commit it. All keys load via `python-dotenv`;
   nothing is ever hardcoded in source.

4. **Master assets:** drop the operator's two recorded clips into
   `master_assets/`:
   - `master_assets/intro_hook.mp4`
   - `master_assets/outro_signoff.mp4`

   `master_assets/*.mp4` is gitignored — these are the operator's actual
   face/voice recordings, not repo content.

## Directory layout

```
scripts/video/
  engine.py           # candidate selector, TTS, assembly, CLI entry point
  prompts.py          # the Codex-derived video voice system prompt
  gates.py            # pre-TTS quality gates (G1-G7)
  master_assets/      # operator's intro/outro clips (gitignored *.mp4)
  temp_download/      # scratch product images, cleared per run (gitignored)
  output/             # rendered videos (gitignored)
  requirements.txt
  .env.example
  .gitignore
```

## Dependency note

`moviepy` is pinned to `<2.0` deliberately. This pipeline's code uses the
1.x `moviepy.editor` API (`from moviepy.editor import ...`); moviepy 2.0
removed that module entirely in favor of importing directly from `moviepy`.
Do not upgrade past 1.x without rewriting the imports and re-verifying every
call site — it's a breaking API change, not a routine bump.
