# BOI "Quiet Panic" — Phase 2b: Pipeline Build Brief

**Depends on:** `briefs/VID-QP-01.md` (persona, voice, SFX library, bumpers — all locked)
**Status:** Not yet executed. This file documents the build; it does not run anything on its own. Fire separately via "Read and execute briefs/VID-QP-02.md" when ready.
**Standing rule carried over from the rest of this project:** stop and report on any unknown or schema mismatch below — do not guess column names, enum values, or existing pipeline behavior. Verify against live `information_schema` / actual code, not assumptions in this doc.

---

## 0. Design note carried over from the bumper build (important)

During Phase 2a, assumed durations for the intro/outro were wrong by roughly 2x — Mira Whisper's actual pacing didn't match the target written in the brief. The lesson applies directly here: **segment JSON's `duration` field is a planning estimate for the script-gen LLM, not authoritative.** Actual assembly timing must be derived from the *measured* length of each generated TTS clip, not the number the LLM guessed. Build the pipeline so image swaps, SFX timing, and captions sync off real output duration per segment, with the JSON's duration field used only as a soft target the LLM aims for when pacing the script.

## 1. Candidate selection

Query `sets` for candidates meeting all of:
- MRP verified (not one of the audit's unverified-estimate-flagged rows) — **confirm actual column/flag name in the live schema first**, do not assume `mrp_verified` or any other name until checked.
- Has image assets already fetched via ASSET-01/02.
- (Optional, later refinement) some comedic-fit heuristic — for now, default to operator manually selecting candidate sets for the first several videos rather than building an automatic scoring function. Automate this only once there's a pattern to automate from.

## 2. Script generation

- LLM: Gemini primary, Cerebras failover — same convention as the rest of the content pipeline.
- Prompt = BOI_Codex_v2.md + Quiet Panic persona rules (`briefs/VID-QP-01.md` sections 2–3) + set data (name, number, verified INR price, piece count, theme) + the 3 operator-approved reference scripts as few-shot examples (already in section 12 of that brief).
- Output: strict JSON array, no prose wrapper:
```json
[
  {"text": "...", "target_duration": 2.5, "sfx_tag": "brick_snap", "image_ref": "..."},
  ...
]
```
- Verdict line: attempt a themed pun first, fall back to the generic bank (section 2 of VID-QP-01.md) if confidence is low. Hard-enforced: must always resolve to "buy it" — never let generation drift into an actual judgment call.

## 3. Gates (lighter than the 9-gate review pipeline)

- Duration check: sum of *measured* segment durations + bumpers, within the 45–55s target (±10%) — checked after TTS generation, not before, per the design note in section 0.
- Price-token exact match: the number in the script string-matches the DB's verified value exactly.
- Verdict gate: "buy it" line present, structurally unmodified.
- SFX-tag validity: every tag resolves to a real file in `/assets/sfx/library/` (bag_tear, brick_snap, brick_pour, sorting_rummage, separator_pry, soft_whoosh).
- Banned-construction check: reuse the existing Codex banned-word/construction list.
- Vocabulary-complexity gate (NEW): flag words above a simple complexity threshold not on an allowlist — start with a small manually curated banned-words list (words like "hubris" that don't fit the "simple, common, Indian-English" rule) rather than a full readability-score system. Refine once there's real failure data to learn from.

Failed gate → route to `content_rejections` / pending-review, same pattern as the existing pipeline. No silent discards.

## 4. TTS generation

- Per segment: ElevenLabs `eleven_flash_v2_5` (speed matters for daily-ish generation, unlike the one-time bumpers), voice `thNHFcPYszCz6ZPG6mUp` (Mira Whisper), key `ELEVENLABS_API_KEY_ASMR`.
- Measure actual output duration per clip immediately after generation — this measured value drives everything downstream (section 0).

## 5. Assembly (moviepy)

- Sequence: `intro_final.mp3` (+ matching visual) → segment 1 (image + voice + SFX) → segment 2 → ... → verdict segment → `outro_final.mp3`.
- Images: slow Ken Burns zoom/pan per segment, sourced via `image_ref` from the existing ASSET pipeline.
- SFX: mixed in at tagged points within each segment's audio track.
- Captions: burned in, distinct style (lighter weight/italic) from the main review pipeline's captions, timed against *measured* segment durations, not the JSON's target values.

## 6. Audio QC gate (new standing gate)

- Loudness normalization via ffmpeg `loudnorm`, target ~-14 LUFS integrated, true-peak ceiling ~-1dB.
- EQ lift, 4–8kHz range, on the SFX layer only — not the voice track.
- Light de-esser on the whisper voice track only.
- Applied automatically at final render, not a manual step.

## 7. Database / publish

**Superseded 2026-07-29 (operator decision, isolation-first):** the `content_type`-on-`video_posts` approach below was investigated (finding: the column doesn't exist yet, so it would've needed a migration regardless of free-text-vs-enum) but was **not built**. Operator instead requested further isolation — copy the model, not the infrastructure:

- **`quiet_panic_posts`** — new table, fully independent of `video_posts` (own schema, own `status` CHECK constraint, own RLS, own `sequence_number` ordering trigger). Migration: `supabase/migrations/20260729000000_quiet_panic_posts.sql`.
- **`scripts/video/publish_quiet_panic.py`** — standalone poll-and-publish script. Imports nothing from `engine.py` or `publish.py`; the IG Reels / YouTube Shorts upload logic (container-create → poll → publish → fetch-back-verify for IG; channel-identity-guard → upload → fetch-back-verify for YT) is duplicated as its own functions in this file, not shared. Own daily cap (1/day), own IST-day-bounds check, against `quiet_panic_posts` only — no shared counter/state with VID-P4's poller.
- **One shared data dependency, not a code import**: `IG_ACCESS_TOKEN` / `IG_USER_ID` / `YOUTUBE_CLIENT_SECRETS` env vars — reused as-is, since there is only one Bricks of India IG Business account / YouTube channel regardless of which pipeline posts to it. `IG_ACCESS_TOKEN` stays fresh via the existing `ig-token-refresh.yml` workflow; nothing in the new script re-implements that refresh cycle.
- **`.github/workflows/video-publish-poller-quiet-panic.yml`** — new, separate workflow, hourly at `:17` (`17 * * * *`), deliberately not aligned to VID-P4's `*/15 * * * *`.
- **`quiet-panic-assets`** — separate Supabase Storage bucket (`public: True`, same `create_bucket` pattern as `social-assets` in `social-automation/db.py:40`), **not** a shared-bucket-with-prefix as first attempted. Reason for the reversal: uploads go through the `SUPABASE_SERVICE_ROLE_KEY` client, and `service_role` bypasses RLS entirely on every table including `storage.objects` — there is no way to scope a service-role key to a single prefix. Sharing `social-assets` under a `quiet-panic-video/` prefix would therefore have given this script full read/write/delete on all of VID-P4's stored videos too, defeating the isolation goal. Full bucket separation was the only way to actually achieve it. Verified live: test upload to `quiet-panic-assets` succeeded, its `get_public_url()` link returned a real `HTTP 200` on direct fetch (byte-identical content), and `social-assets`' object listing showed zero new objects from the test — confirmed isolated in both directions.
- Manual approval invariant unchanged: new rows start `pending_approval`; only chat Claude sets `status='approved'`, same as VID-P4 — just against `quiet_panic_posts` instead of `video_posts`.
- **Not yet built in this pass** (infra-only slice; script-gen/assembly from sections 1-6 still pending): no notification wiring (VID-P4's `notifier.py` was not duplicated — not requested); no captions/story-badge OCR guards (no equivalent concept defined yet for this format); no evening publish-window restriction (only the daily cap was requested).

## 8. Tracker/runbook updates

Add a `VID-QP` section to `BOI_MASTER_TRACKER.md`, mirroring VID-P4's existing structure: status, current phase, locked decisions (voice ID, API key variable name, SFX/bumper file paths), cadence (3x/week Quiet Panic, 1x/week Guess the Sound — deferred, 3x/week Pure Loop — deferred), and the standing dependency on MRP-audit-verified sets only.

## Explicit stop conditions

- Sets table's verified-MRP flag: name/schema doesn't match what's assumed → stop, report actual schema.
- `video_posts.content_type`: fixed enum requiring migration → stop, report, don't alter without confirmation.
- Publish Poller: any content-type-specific logic found → stop, report before modifying.

Do not proceed past any of the above without operator confirmation, same standing rule as the rest of this project.
