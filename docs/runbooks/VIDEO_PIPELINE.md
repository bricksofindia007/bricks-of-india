# VID-P4 — Daily Video Pipeline Runbook

Standing operating procedure for the daily sandwich-video pipeline (operator's
recorded intro + AI middle + operator's recorded outro → manual upload to
IG Reels + YT Shorts). For initial setup (deps, ffmpeg, master assets), see
`scripts/video/README.md` — this file is the day-to-day flow only.

## Current operating mode (2026-07-07 — read this before assuming auto-publish)

**Supervised approval continues indefinitely as the default — minimum 2-week trial from 2026-07-06.** Daily generation (`video-generate-daily.yml`, 6:00 AM IST) runs in the cloud automatically and leaves each result in `status='pending_approval'`. The operator reviews via email/chat and explicitly approves each one; the Publish Poller (`video-publish-poller.yml`, active, every 15 minutes, `*/15 * * * *`) then publishes — **only during a fixed evening window, not "shortly after approval whenever that happens."**

**Publish condition (`engine.py`'s `--poll-and-publish`): nothing posted yet today (IST) AND current IST time ≥ 19:30.** Root cause of the 2026-07-06 double-publish (Minas Tirith + N-1 Starfighter, same day) was that no day-cap existed anywhere in the code at all — not broken, missing entirely; see `BOI_MASTER_TRACKER.md`'s 2026-07-07 entry for the full investigation. First fix (`27ca9da`) added the day-cap alone (`already_published_today_ist()`); refined same day (`ef90736`, operator-directed) to the fixed 19:30 IST window. The poller's 15-minute tick frequency is deliberately unchanged (not collapsed to a single once-a-day cron) — a missed 19:30 tick is recovered at 19:45/20:00/etc. the same evening rather than skipping the whole day, since GitHub Actions schedule triggers are not exact (confirmed live: a real tick landed 2.5 hours behind its nominal cadence during this session).

**Queue draining, one row per evening, ordered by `story_number` (explicit, tested — not `created_at`):** if multiple rows are `approved` at once, only the lowest-`story_number` row publishes on a given evening; the rest stay `approved`, untouched, and drain on subsequent evenings. As of 2026-07-07, Death Star (#3), McLaren (#4), and Shopping Street (#5) are all `approved`, expected to publish on 3 consecutive evenings starting tonight.

**Gate-check note:** `publish.py::assert_all_gates_passed()` treats any `gate_results` key starting with `_` as metadata, not a gate (generalized 2026-07-07 after a second metadata key, `_post_hoc_correction`, was misread as a failed gate and auto-blocked a row with a real Resend skip-notification email). If you add a new metadata annotation to `gate_results` via a direct Supabase write, prefix its key with `_` or it will be misread as a failed gate.

**Full autonomy (gate-pass-only publishing, no human approval) is a DEFERRED decision, not a scheduled cutover.** Target review date ~2026-07-20 (see `VID-P4-AUTOMATION-REVIEW` in `BOI_MASTER_TRACKER.md` §Pending). Nothing in the code will auto-enable this on that date or any other — it requires an explicit operator decision plus a deliberate code change. Verified 2026-07-06: no path in `scripts/video/` or in the `video_posts` table (triggers/functions) ever writes `status='approved'` except an external, explicit `UPDATE`. If you are a future Claude Code session reading this file, do not assume auto-publish is live, and do not remove the approval gate without operator instruction.

**Note on the rest of this runbook:** the sections below (manual `--suggest`/`--pick`/manual-upload flow) describe the pipeline's state *before* the 2026-07-06 cloud pivot (Stage 2 cloud generation, Stage 3 chat-based approval, the Publish Poller). They're still accurate for local ad-hoc runs (e.g. re-testing a candidate), but the *daily* operational flow is now the cloud one described above, not the manual upload steps below. This section has not been fully rewritten to match — flagged, not fixed, as a separate scope item.

## Daily flow

```
cd scripts/video
python engine.py --suggest
```
Prints the top 3 candidates (highest-priced on MyBrickHouse — the sole
source as of 2026-07-06, Toycra dropped per operator directive), filtered
to ≥5 images and not already used, each with a one-line reason and catalog
enrichment (theme + piece count) where a set number matched.

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
