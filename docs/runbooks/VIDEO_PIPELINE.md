# VID-P4 — Daily Video Pipeline Runbook

Standing operating procedure for the daily sandwich-video pipeline (operator's
recorded intro + AI middle + operator's recorded outro → manual upload to
IG Reels + YT Shorts). For initial setup (deps, ffmpeg, master assets), see
`scripts/video/README.md` — this file is the day-to-day flow only.

## Daily flow

```
cd scripts/video
python engine.py --suggest
```
Prints the top 3 candidates (newest on Toycra + highest-priced on
MyBrickHouse, merged, filtered to ≥5 images and not already used), each with
a one-line reason and catalog enrichment (theme + piece count) where a set
number matched.

```
python engine.py --pick 2
```
Generates the script (Gemini primary, Cerebras failover, both paced 4-6s
apart), runs it through all 7 pre-TTS gates, regenerates once on failure and
aborts with reasons if it fails twice. On pass: calls ElevenLabs, downloads
product images, assembles intro+Ken-Burns-middle+outro, prints the total
duration (warns if over 90s — IG Reels/YT Shorts may reject or truncate),
and writes a `video_posts` row with `status='rendered'`.

Or use `--url <product_url>` instead of `--pick N` to manually override the
suggestion list with a specific product.

**Review the rendered file** in `output/YYYY-MM-DD_<slug>.mp4` before
uploading anywhere — this pipeline does not auto-post.

**Upload manually** to IG Reels and YT Shorts.

**YouTube synthetic-voice disclosure:** ☐ Before publishing to YT Shorts,
confirm the video's audio disclosure setting is checked — YouTube requires
creators to disclose AI-generated/synthetic voice content. Do this every
single time; it's easy to forget on a fast daily workflow.

**Mark it posted:**
```
python engine.py --posted <video_posts.id> ig
python engine.py --posted <video_posts.id> yt
python engine.py --posted <video_posts.id> both
```
(`ig`/`yt` set `status='posted_ig'`/`'posted_yt'`; if you post to both
platforms same day, use `both` directly rather than calling it twice —
calling `ig` then `yt` will just overwrite status to `posted_yt`, not
accumulate both.)

## Dry-running without spending

`--no-tts` skips the ElevenLabs call entirely and generates a silent
placeholder audio track (estimated duration from word count at ~150 wpm) so
you can verify script quality, gates, and assembly without spending TTS
credits. Combine with `--placeholder-anchors` if `master_assets/` doesn't
have real clips yet — it generates two solid-color 5s test videos instead of
failing outright.

```
python engine.py --pick 1 --no-tts --placeholder-anchors
```

## Lane separation vs. SOC-AUTO-01

This pipeline is a **separate lane** from the existing daily social
automation (`social-automation.yml`, SOC-AUTO-01):

| | SOC-AUTO-01 (existing) | VID-P4 (this pipeline) |
|---|---|---|
| Format | Static preview card (image + caption) | Full video (voiceover + Ken Burns + intro/outro) |
| Trigger | Automatic, scheduled | Manual, operator-run |
| Caption style | Preview/announcement tone | Review/opinion tone (Clarkson voice) |
| Posting | Automatic (IG + YT, when eligible) | Manual upload, both platforms |
| DB log | `posted_sets` | `video_posts` |

Both log independently — a set can legitimately appear in both `posted_sets`
(a preview card posted automatically) and `video_posts` (a full review video
posted manually) without either pipeline needing to know about the other.

## Troubleshooting

- **"ERROR: Both providers returned empty content"** — both Gemini and
  Cerebras failed. Check `GEMINI_SOCIAL_API_KEY` / `CEREBRAS_API_KEY` in
  `.env`, and check each provider's dashboard for quota/outage status.
- **"script failed gates twice"** — read the printed gate failures. As of
  this pipeline's first build (2026-07-05), Gemini 2.5 Flash consistently
  overshot the 110-125 word target (observed 132-165 words across 6 real
  generations, 0 in range) — expect the word-count gate to be the most
  common failure reason, and expect to need more than one `--pick` attempt
  some days. This was a real, reproducible finding during the initial
  build, not a one-off — see VID-P4-01 in `BOI_MASTER_TRACKER.md`.
- **ffmpeg not found** — see `scripts/video/README.md`'s setup section. On
  Windows, a fresh `winget install ffmpeg` needs a shell restart before
  `ffmpeg` is on PATH.
