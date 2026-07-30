# BOI "Quiet Panic" Format Brief — v1

**Status:** Planning spec, ready for phased execution. Not a single-shot build — Phase 1 must complete and be reviewed by operator before Phase 2 starts.
**Suggested repo path:** `briefs/VID-QP-01.md`
**Voice (locked):** Mira Whisper — ASMR & English whisper. Voice ID `thNHFcPYszCz6ZPG6mUp`. Selected 2026-07-29 from a 3-candidate test batch (Viraj, Mira Whisper, Julian) — chosen for landing the deadpan punchline without breaking whisper delivery. Use `ELEVENLABS_API_KEY_ASMR` for all TTS calls under this format.
**Owner decisions still open:** MRP audit completion status per set (blocks which sets can enter the candidate pool — see section 5).

---

## 1. What this is

A new, lower-frequency video track sitting alongside VID-P4's daily review pipeline — comedic, SFX/whisper-led, zero building footage required. Three formats, one persona, one shared production pipeline.

## 2. Persona

**Name:** The Overly Serious Whisperer
**Series banner:** The Quiet Panic

Core rule: grandiosity of delivery, not vocabulary. Simple, common Indian-English/Hinglish words and references only — no words like "hubris" that need a dictionary. The joke is museum-tour gravitas applied to a toy, at ASMR volume, using words everyone already knows.

Three script-writing rules (score generated scripts against these):
1. Never break whisper for the punchline — the tone stays constant, the words do the work.
2. Ordinary object treated like a monumental decision, every time.
3. Price is a punchline prop for comparison (Swiggy month, Goa trip, EMI, shagun money), not a financial verdict — this is why the verdict rule below is safe to keep absurd.

**Verdict rule:** Always resolves to "buy it," followed by an absurd, ideally set-specific reason. Themed pun attempted first; generic fallback pool used if themed attempt scores low confidence. This is a hard gate, not a suggestion — the model must never drift into an actual judgment call (ties to the site's real verdict system needing to stay clearly separate from a parody format).

Generic fallback bank:
- "Your weekends are overrated anyway."
- "Retirement is a myth invented by people who don't collect LEGO."
- "Financial advisors are just wallets with trust issues."
- "Diwali bonus exists for exactly this kind of regret."
- "Some questions don't need answers."

### Price-tier reference bank (locked 2026-07-29)

Rule 3 above ("price is a punchline prop for comparison") needs a proportionality check — a comparison that's true at one price point reads as nonsense at another. The script-gen prompt must select the comparison from the tier matching the set's actual verified price (`sets.lego_mrp_inr`), not whichever comparison sounds best in isolation.

| Tier | Price band | Comparison device | Example |
|---|---|---|---|
| **Low** | ~₹1,000–4,000 | A single small everyday spend | one Swiggy order, one movie ticket, one coffee-shop visit |
| **Mid** | ~₹5,000–15,000 | A recurring monthly cost | a full month of Swiggy, a month's phone EMI |
| **High** | ~₹15,000–40,000 | A trip or significant one-off | a Goa round trip, a flight |
| **Very high** | ₹40,000+ | Life-event scale | a shagun envelope, a wedding-season expense |

Swiggy is a valid device at **both** Low (single order) and Mid (full month) tiers — both are proportionally correct at their respective price points, they are not interchangeable at the same price. Canonical Mid-tier example (from the reference scripts, section 12 below): the WhatsApp-group script's "one full month of Swiggy. Gone." at ₹6,900 (Mid tier). A Low-tier set (e.g. ~₹3,000) referencing "a month of Swiggy" would overstate the price; a Very-high-tier set referencing "one Swiggy order" would understate it into incoherence — both are gate failures, not stylistic choices.

### Opening-line variety (locked 2026-07-29)

"This is not a [object]." must not be the default opener — it's one available device, not the format's signature move. Vary opening structure across scripts: some can open on the price, some on a piece-count fact, some on a direct comparison, some on the "this is not a X" device when it genuinely fits the set (e.g. a flagship where the grandiosity lands hardest) — but never as the default every time.

## 3. Three formats, three jobs

| Format | Job | Voice | Length target | Cadence |
|---|---|---|---|---|
| **The Quiet Panic** (flagship) | Builds subscribers, recognizable persona | Full script, always-buy verdict | 45–55s incl. bumpers | 3x/week, both platforms |
| **Guess the Sound** | Drives comments/shares via reveal mechanic | Minimal script, same verdict sign-off at the end | 20–30s | 1x/week, weekend slot |
| **Pure Loop** | Feeds algorithm volume, cheapest to produce | No voice, ambient SFX only | 45–90s | 3x/week, Instagram-only |

Hard ceiling for all three: stay well under the 3-minute Shorts/Reels classification limit. Both platforms' discovery algorithms stop pushing content to non-followers past 3 minutes — for a comedic, subscriber-growth format, staying short is a discovery requirement, not just a pacing preference. Revised note (2026-07-29): Mira's whisper pacing runs slower than initially assumed — the two fixed taglines alone take ~12-13s to deliver naturally, so Quiet Panic's target moved from 30-45s to 45-55s to reflect that honestly rather than forcing an unnatural speed-up. Still comfortably inside the well-performing 45-60s band, nowhere near the 3-minute discovery cliff.

**Revised note (2026-07-30) — word-count budget, calibrated against real RB20 render data:** the RB20 test script's 6 voice-on segments measured 73 words / 52.338s TTS output, an aggregate rate of **0.717s/word** — driven by the gate-fixed real bumper duration (intro 7.2s + outro 13.89s = 21.09s measured) exposing that the body had ballooned to 56.4s against a 24-34s body budget (45-55s total minus bumpers), because segments were written to a vibe-based duration guess with no word-count ceiling. Per-segment rate is not flat: flowing declarative sentences ran 0.59-0.68s/word (4 of 6 segments), while short punchy/ellipsis-heavy fragments ("Verdict: buy it.", the Swiggy-comparison line) ran 0.96s/word — pauses from "..." and commas inflate effective per-word time even with fewer words. Use **0.65s/word for flowing sentences, 0.95s/word for punchy/ellipsis fragments** (0.72s/word blended, if a single constant is needed) as the working rate, not the ~0.5s/word a naive "normal speech" assumption would suggest.

**Hard word-count budget (script-gen prompt must enforce this, not just aim for it):** body budget is ~24-34s (45-55s target minus ~21s fixed bumpers). Voice-off/SFX-primary beats (bag_tear ≈3.0s, brick_snap_body ≈1.1s — fixed asset lengths, not word-driven) and the fixed "Verdict: buy it." line (≈2.9s at the punchy rate, non-negotiable text) take a combined ~7s off that budget regardless of script content. The remaining ~17-27s of flowing voice-on lines, at 0.65s/word, gives a **word budget of roughly 26-42 words total** across the non-fixed voice-on segments (≈30-46 words including the fixed 3-word verdict line) — down from the ~73-word draft that actually rendered. **Per-segment budget = target_duration ÷ rate for that segment's style** (flowing vs. punchy) — write to that number as a cap, don't estimate a duration from a vibe and hope the word count happens to fit.

## 4. Standard opens/closes — constant assets, generated once

Do NOT regenerate these per video via TTS. Generate each once (2-3 takes, pick best), store as static clips, splice at assembly stage.

- **Intro — FINAL: `intro_final.mp3`** (7.2s). *(soft whisper, dramatic pause)* "Bricks of India... presents." *(SFX: brick_snap_short.mp3, trimmed)* *(soft whisper, softer)* "Where every brick tells a story." Generated on `eleven_flash_v2_5`.
- **Outro — FINAL: `outro_final.mp3`** (renamed from `outro_take6.mp3`). *(soft whisper)* "Like it. Share it. Follow Bricks of India. Where everything is awesome, except financial advice." Generated on `eleven_multilingual_v2`, not `eleven_flash_v2_5` — flash-tier repeatedly stuttered on this exact phrasing ("Like it. Share it." repeating at the start) across every take; multilingual_v2 rendered it cleanly on the first attempt. Since this is a one-time asset, generation speed was irrelevant — stability was the right thing to prioritize. **Note for Phase 2b:** per-video script TTS should stay on `eleven_flash_v2_5` (matches VID-P4 convention, speed matters for daily generation) — this model choice is specific to one-time bumper assets only, not a pipeline-wide change.

Both files are locked as the permanent spliced-in bumpers for every video in this format.

Applies to all three formats for brand consistency. Duration budgets above are inclusive of these bumpers.

## 5. Source of truth: images vs. pricing

- **Images:** LEGO.com renders via existing ASSET-01 (Brickset + Rebrickable API, Tier 1) / ASSET-02 (manual click-save, Tier 2) pipeline. No new scraper. Reuse as-is.
- **Pricing:** `sets.lego_mrp_inr` in Supabase — **only for sets flagged as audited/verified**, never the ~2,770 unverified-estimate sets from the ongoing MRP audit. No live scraping of MyBrickHouse/Toycra at render time (fragile, unnecessary — the corrected DB column is the shared source of truth for both website and video). **This format cannot go live for a given set until that set's MRP is confirmed audited.**

## 6. Script contract

Script generation (Gemini/Cerebras, same models as VID-P4) outputs structured JSON, not prose:

```json
[
  {"text": "...", "start_time": 0.0, "duration": 2.5, "sfx_tag": "brick_snap", "image_ref": "..."},
  ...
]
```

This timestamp contract drives voice, SFX, image swap, and caption sync at the moviepy assembly stage — everything assembles against it rather than being hand-timed.

## 7. SFX library — pre-generate once, reuse forever

Generate via ElevenLabs SFX endpoint (same API key VID-P4 already uses for TTS) as a one-time batch, store in `/assets/sfx/library/`:

| Cue | Prompt |
|---|---|
| Bag tear | Close-up crisp, sharp tearing open of a thin plastic toy polybag, crinkling acoustic rustle, stereo studio quality |
| Brick snap | Very sharp, loud tactile snap click sound of two hard ABS plastic building bricks locking together, close mic |
| Brick pour | Cascading rain sound of hundreds of small loose plastic LEGO bricks dumping out onto a smooth wood table surface |
| Sorting/rummage | Slow, gentle rustling and stirring through a tray filled with small plastic toy pieces, dry clicky friction |
| Separator pry | Popping snap leverage sound as a plastic separator unlatches a tight plastic tile, sharp acoustic decay |
| Soft whoosh (transition) | Subtle, smooth air-swoosh transition sound, soft and short, no harshness |

Do not call the SFX API per video — this is the single biggest reliability lever available (one API call ever vs. one per video, zero quality drift, faster renders).

## 8. Voice — LOCKED (confirmed 2026-07-29, after vocabulary re-test)

**Voice:** Mira Whisper — ASMR & English whisper. **Voice ID:** `thNHFcPYszCz6ZPG6mUp`
**API key:** `ELEVENLABS_API_KEY_ASMR` (scoped: Text to Speech, Sound Effects, Voices — separate from VID-P4's production key)

Initial pick from the generic test line, re-confirmed against a line loaded with the format's actual vocabulary ("Sharma ji," "Swiggy," rupee figures) after operator flagged accent/diction concerns on the first pass. Julian (`Myap7vX7L9ipoJVdyOVZ`) tested clean on diction but read as distinctly American — disqualifying against a script built on Indian cultural references. Both Julian and Viraj should be removed from the ElevenLabs account's voice slots now that Mira is final.

SFX library (6/6 generated) at `bricks-of-india/assets/sfx/library/`: bag_tear.mp3, brick_snap.mp3, brick_pour.mp3, sorting_rummage.mp3, separator_pry.mp3, soft_whoosh.mp3.

All future TTS/SFX calls for this format use `ELEVENLABS_API_KEY_ASMR` and voice ID `thNHFcPYszCz6ZPG6mUp` as defaults — no further voice testing needed.

## 9. Assembly & audio QC gate (new standing gate, mirrors existing quality gates)

- Loudness normalization via ffmpeg `loudnorm`, target ~-14 LUFS integrated, true-peak ceiling ~-1dB — don't let the platform normalize unevenly for you.
- EQ lift in 4–8kHz range on the SFX layer only (not voice) for phone-speaker "pop."
- Light de-esser on the whisper voice track (whisper delivery pushes sibilant energy).
- Manual phone-speaker listen test before publish — not just headphones.
- Burned-in captions, distinct style (lighter weight/italic) from the main review format's captions, timed off the segment JSON. Captions carry the full joke text so it survives muted viewing.

## 10. Gates (lighter than the 9-gate review pipeline — no factual claims beyond price)

- Duration match vs. target
- Price-token exact match against DB value (catches hallucinated figures)
- Verdict gate: "buy it" line present and unmodified
- SFX-tag validity: every tag resolves to a real library file
- Banned-construction check (shared list with main Codex)
- Audio QC gate (section 9)

## 11. Approval

Manual chat-approval only, same invariant as the main pipeline — regardless of whatever autonomy decision is made for VID-P4's review format. This track is unproven and higher brand-visibility if a joke misfires; keep a human gate here even after the core format goes autonomous.

## 12. Phased rollout

1. **Phase 1 — DONE:** SFX library complete. Mira Whisper confirmed as final voice, re-tested against actual script vocabulary.
2. **Phase 2a — DONE:** Bumpers locked (`intro_final.mp3`, `outro_final.mp3` — see section 4).
3. **Phase 2b — next:** Wire script-gen template, segment JSON contract, gates, assembly, audio QC, DB/publish wiring.
4. **Phase 3:** Launch Quiet Panic only, 3x/week, manual approval. Hold Guess the Sound / Pure Loop until Quiet Panic has a couple weeks of real engagement data. If the 3x/week manual-approval load turns out to be heavy, this is a safe number to dial back — nothing else in the pipeline depends on it staying at 3x.
5. **Phase 4:** Revisit cadence and consider adding the other two formats, evidence-based.

---

*Reference scripts (operator-approved tone, use as few-shot examples in the script-gen prompt):*

> "This is not a LEGO set. This is a family WhatsApp group waiting to happen." ... "Two thousand two hundred pieces. Sharma ji's son doesn't have this many achievements." ... "Six thousand nine hundred rupees. That's one full month of Swiggy. Gone." ... "Verdict: buy it. Swiggy can wait. This cannot."

> "The real Concorde flew faster than sound. This one flies straight into your credit card statement." ... "Thirty four thousand nine hundred rupees. That's a Goa trip. Round trip. With snacks." ... "The real Concorde retired in 2003. This one isn't going anywhere. Verdict: buy it. Some flights you only get once."

> "Nine thousand pieces. This is not a set. This is a relationship." ... "No-cost EMI available. Emphasis on 'no cost.' Emotionally, this will cost everything." ... "Your mother will ask why you bought this. You will not have an answer. Verdict: buy it. Some questions don't need answers."
