# VID-P4 — Daily Video Pipeline Runbook

Standing operating procedure for the daily sandwich-video pipeline (operator's
recorded intro + AI middle + operator's recorded outro → manual upload to
IG Reels + YT Shorts). For initial setup (deps, ffmpeg, master assets), see
`scripts/video/README.md` — this file is the day-to-day flow only.

## Operator-Facing Workflow (read this first — the plain-language version of everything below)

Every morning at 6:00 AM IST, a new candidate video is generated automatically in the cloud, with no action needed from the operator; when it's ready — usually a few minutes later, though the pipeline hasn't logged real steady-state timing yet — an email arrives containing the story number, the set's name, a link to watch the video, and a few still frames from it, which is the same information the operator would otherwise have to ask for and look up in Supabase by hand. Reviewing means opening that email, watching the video at the link, and deciding one of three things: approve it, in which case it publishes automatically to Instagram and YouTube on the next evening (around 7:30 PM IST) that nothing else has already gone out that day — one video per day, oldest story first, so approving several at once just queues them across consecutive evenings rather than posting them all together; reject it with a reason, in which case nothing else happens automatically that day — the row is kept as a permanent record, the set is excluded from being suggested again, and the next candidate simply comes from the following morning's normal generation, with no same-day retry, because a quiet extra day costs nothing and a repeated mistake does — but a reject is a recoverable decision, not a final one: it sits in a review queue, a reminder email surfaces it roughly every two weeks if it's still unresolved, and it can be explicitly cleared to make that same set eligible again, or explicitly locked out for good; or ask for a revision, which isn't a separate button but a conversation — describing what needs to change lets the pipeline either patch the same video in place (when it's a mechanical fix like the audio, captions, or badge) or generate a fresh one to look at instead (when the script or content itself needs to change), with the original discarded once the replacement is approved.

**Added 2026-07-26: rejections now get investigated and routed automatically, not just filed for manual review.** The moment a rejection reason is recorded, it's read for keywords and sorted into a rough category (pricing, piece count, set details, voice quality, or other) — no AI call, just simple word-matching, since this only needs to be roughly right, not perfect. If the category suggests the set's own stored catalog data might be wrong (pricing, piece count, or set details), the set is automatically flagged in the existing MRP-audit queue so it surfaces there instead of the fact sitting fixed only inside the rejection record — but **flagging is as far as automation goes**: nothing about the price (or any other catalog fact) is ever corrected automatically. That step still requires an actual human — the operator or chat/terminal Claude — to look up the real number from a live retailer listing and confirm it, exactly as happened with story #16's MRP fix. Once a rejected set is cleared for regeneration after a real fix like that, it also jumps to the front of the next morning's candidate queue instead of just becoming eligible again alongside everything else — the point being that a set that was wrong yesterday for a reason that's now actually fixed shouldn't have to wait its turn behind fresh candidates.

## Current operating mode (2026-07-07 — read this before assuming auto-publish)

**Supervised approval continues indefinitely as the default — minimum 2-week trial from 2026-07-06.** Daily generation (`video-generate-daily.yml`, 6:00 AM IST) runs in the cloud automatically and leaves each result in `status='pending_approval'`. The operator reviews via email/chat and explicitly approves each one; the Publish Poller (`video-publish-poller.yml`, active, every 15 minutes, `*/15 * * * *`) then publishes — **only during a fixed evening window, not "shortly after approval whenever that happens."**

**Publish condition (`engine.py`'s `--poll-and-publish`): nothing posted yet today (IST) AND current IST time ≥ 19:30.** Root cause of the 2026-07-06 double-publish (Minas Tirith + N-1 Starfighter, same day) was that no day-cap existed anywhere in the code at all — not broken, missing entirely; see `BOI_MASTER_TRACKER.md`'s 2026-07-07 entry for the full investigation. First fix (`27ca9da`) added the day-cap alone (`already_published_today_ist()`); refined same day (`ef90736`, operator-directed) to the fixed 19:30 IST window. The poller's 15-minute tick frequency is deliberately unchanged (not collapsed to a single once-a-day cron) — a missed 19:30 tick is recovered at 19:45/20:00/etc. the same evening rather than skipping the whole day, since GitHub Actions schedule triggers are not exact (confirmed live: a real tick landed 2.5 hours behind its nominal cadence during this session).

**Queue draining, one row per evening, ordered by `story_number` (explicit, tested — not `created_at`):** if multiple rows are `approved` at once, only the lowest-`story_number` row publishes on a given evening; the rest stay `approved`, untouched, and drain on subsequent evenings. As of 2026-07-07, Death Star (#3), McLaren (#4), and Shopping Street (#5) are all `approved`, expected to publish on 3 consecutive evenings starting tonight.

**Gate-check note:** `publish.py::assert_all_gates_passed()` treats any `gate_results` key starting with `_` as metadata, not a gate (generalized 2026-07-07 after a second metadata key, `_post_hoc_correction`, was misread as a failed gate and auto-blocked a row with a real Resend skip-notification email). If you add a new metadata annotation to `gate_results` via a direct Supabase write, prefix its key with `_` or it will be misread as a failed gate.

**"Ready for review" notification (added 2026-07-07):** `notifier.send_ready_for_review_notification()` fires at the end of every `--cloud-generate` run, right after a row lands in `status='pending_approval'` — same Resend path as the publish/skip notifications. Contains story number, set title, `storage_url`, and `qc_frame_urls`: the same three things the operator was previously pulling from Supabase manually on request. First real end-to-end confirmation (actual email arrival, working links) is pending tomorrow's real 6 AM candidate — not yet verified against a live run as of this entry.

**Generation-to-ready timing (added 2026-07-07):** each `--cloud-generate` run now stores `gate_results._timing` (`generation_started_at`, `pending_approval_at`, `duration_seconds`) — measured from this script's own process start, not the true cron-fire instant (GitHub Actions runner provisioning + dependency install happens before Python's first line runs, and schedule triggers themselves can lag their nominal time — confirmed live this session, one tick landed 2.5 hours late). **No duration number is reliable yet** — today's dev-session timings don't reflect steady-state cloud operation. Treat the first two real measured values (tomorrow's run and the one after) as the first trustworthy data points, not any number from this session.

**Discard policy — deliberate non-behavior for regeneration, but now reversible for eligibility (updated 2026-07-07):** setting a row's `status='discarded'` still triggers **no automatic regeneration** of any kind — no same-day retry, no replacement candidate. The row stays in `video_posts` untouched as a permanent audit record. Confirmed by exhaustive grep across `scripts/video/` and every `.github/workflows/*.yml`: no code path anywhere reads or reacts to `status='discarded'` beyond `reject_video_post()` (see below). Rationale (operator, explicit): auto-regenerating on reject risks silent repeated API spend if a set is rejected for a reason that will just recur; this project's priority order is credibility first, speed last, and one quiet day of delay costs nothing real.

What changed 2026-07-07: a set's *eligibility* to be suggested again is no longer a permanent side effect of the old row existing — it's now governed by `content_rejections`, and is reversible.

**`content_rejections` table (migration `20260707140000`); single write-path via `reject_video_post()` RPC (migration `20260726120000`, replacing the old trigger):** the original design used a Postgres trigger (`video_posts_discard_trigger`) that fired automatically on any transition into `status='discarded'`, inserting a row with `rejection_reason` left NULL (not in its insert list) — the actual reason was then added via a *second*, separate insert (chat Claude's manual write). Confirmed live 2026-07-26 on story #16 (set 71837): this produced two rows for the same rejection, one null-reason (from the trigger), one with the real reason — the null one had to be manually deleted. **Fix:** the trigger is gone; rejecting a row is now **one call**, `SELECT reject_video_post(p_video_id, p_reason)`, which does the status update, the classified insert, and the MRP re-verification flag (see below) all in one transaction. There is no other supported way to reject a row — a raw `UPDATE video_posts SET status='discarded'` no longer creates any `content_rejections` record at all. `reject_video_post()` refuses a second call against an already-discarded row (raises rather than silently duplicating), so calling it twice by mistake fails loudly instead of recreating the original bug in a new form.

`reject_video_post()` does **not** fire for `status='publish_blocked'` — that is the separate, automated gate-failure-at-publish-time path (`assert_all_gates_passed`/`assert_captions_present`/`assert_story_badge_present` raising inside `--poll-and-publish`), a system-detected condition rather than an operator rejection, and is deliberately **not** tracked in this table. Flagging this distinction explicitly rather than assuming the two are the same case.

**Root-cause classification (`rejection_category`, migration `20260726120000`):** every rejection reason is classified into `pricing` / `piece_count` / `set_details` / `voice_quality` / `other` by simple keyword matching (`classify_rejection_reason()`, plain SQL regex, no LLM call — a coarse routing signal doesn't need one). Checked in a fixed priority order since a real reason can mention more than one thing (story #16's own reason, "Set details and pricing are wrong. Rework needed.", matches both pricing and set_details keywords — pricing wins by being checked first).

**Auto-verification routing (same migration):** for `rejection_category IN ('pricing', 'piece_count', 'set_details')`, the corresponding `sets` row is automatically flagged in the existing MRP-audit queue (`sets.mrp_verified = false`, `sets.mrp_review_reason = 'operator_flagged_incorrect'`) — but **only if `mrp_verified` was previously `true`**. A row already `false` (e.g. `mrp_review_reason='unverified_estimate'` or `'cmf_box_ambiguity'`) is left completely untouched, since it's already correctly queued and this must not clobber a more specific existing reason. **This never touches the price (or any other catalog fact) itself** — it only makes the set surface in the queue that already exists for the MRP audit; the actual correction still requires a live retailer lookup by a human or chat/terminal Claude, exactly like story #16's real fix (MyBrickHouse checked live, ₹22,500 estimate corrected to the real ₹25,499 MRP).

**Priority requeue (`regeneration_priority`/`requeued_at`, same migration):** a `content_rejections` row defaults to `regeneration_priority=true`; combined with `review_status='cleared_for_regeneration'`, `engine.py`'s `get_candidates()` treats it as a forced pick — built directly regardless of where it'd otherwise rank by price (a cleared set might not be anywhere near the top of the price-sorted pool), and placed ahead of every normal candidate in the returned list, tagged `[PRIORITY REGEN]` in `--suggest` output together with the original rejection reason for context. Once the set is actually regenerated (a new `video_posts` row inserted for that `set_number`, via `insert_video_post()`), the same row's `regeneration_priority` flips to `false` and `requeued_at` is stamped, so it stops being force-picked on subsequent days. Verified live 2026-07-26 against the real, still-open story #16 row: it was the #1 `--suggest` result, ahead of two genuinely fresh candidates priced higher than it (₹27,999 and ₹45,799 vs. its ₹25,499) that would have outranked it under the old price-based ranking alone.

**The priority-clear step is now DB-enforced, not application logic (migration `20260726150000`).** Confirmed live 2026-07-26 that nothing in the database itself ever flipped `regeneration_priority` back off — that step lived purely inside `engine.py`, meaning a manual regen, a different code path, or a future refactor could silently skip it and leave a stale priority flag re-promoting an already-regenerated set forever. Per the schema-of-record principle, this is the same "logic living in two uncoordinated places" shape as the `video_posts_discard_trigger`/manual-insert duplicate-row bug fixed in `20260726120000` — so it gets the same treatment: an `AFTER INSERT ON video_posts` trigger (`video_posts_clear_priority_trigger` → `clear_regeneration_priority_on_requeue()`) now clears the matching `content_rejections` row (`regeneration_priority=false`, `requeued_at=now()`) as soon as any new `video_posts` row lands for that `set_number`, scoped to `review_status='cleared_for_regeneration' AND regeneration_priority=true` so it's a zero-row no-op for every ordinary insert. `engine.py`'s own clear logic, if any, is left untouched — this is a backstop, not a replacement; a redundant second `UPDATE` against already-`false` rows is harmless. Verified live: a synthetic requeue flips the row correctly (`regeneration_priority=false`, `requeued_at` stamped); an ordinary insert with no matching row is a true no-op; story #16 (set 71837) remains untouched (`regeneration_priority=true`, `requeued_at=null`) since no new `video_posts` row has been created for it yet.

**Exclusion semantics (`engine.already_used()`, rewritten 2026-07-07):** a set/product stays excluded from future daily candidates if (a) it has ever been published, or has any other non-`discarded` `video_posts` row (`pending_approval`, `approved`, `rendered`, `publish_blocked` — still "in flight," must not be duplicated), **or** (b) it has a `content_rejections` row with `review_status` in `pending` or `permanently_excluded`. It becomes eligible again only once that row's `review_status` is flipped to `cleared_for_regeneration` (a direct Supabase write, same out-of-band pattern as setting `status='approved'`/`'discarded'` — no CLI command for this yet). Verified live: a set with a `pending` rejection is excluded; flipping to `cleared_for_regeneration` makes it eligible again; flipping to `permanently_excluded` keeps it excluded.

**Biweekly review reminder (`engine.check_and_send_rejection_reminder()`, `.github/workflows/video-rejection-reminder.yml`):** runs on a plain weekly cron (`0 3 * * 1`, Monday 03:00 UTC — cron can't cleanly express "every 14 days," so this doesn't try to) and self-gates on a durably-stored `content_rejection_reminders.last_reminder_sent_at`: sends (and only then updates that timestamp) if **both** ≥14 days have passed since the last reminder **and** at least one `content_rejections` row is still `review_status='pending'`. Silent no-op otherwise — most weekly ticks are expected to do nothing. Email lists every pending row's set number, title, rejection date, and reason. Verified explicitly (not just cron syntax eyeballed): the 14-day check tested against 10-day/13d23h/exactly-14-day/20-day-overdue cases: correctly withholds under 14 days, correctly fires at and past the threshold; confirmed live against the real table that it stays silent (and does not reset the timer) with zero pending rows, and does send (and does update the timestamp) once a pending row exists.

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
