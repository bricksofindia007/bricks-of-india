# Session Summary — May 24–25, 2026 (Day 24–25)

**Session dates:** 2026-05-24 (work) + 2026-05-25 (docs/audit completion)  
**Context:** Continuation of prior session — critical fixes to social automation pipeline + YouTube Shorts text overlays + live pipeline run + full system audit

---

## What was accomplished

### 1. Critical fixes implemented (all 5)

**FIX 1 — LEGO.com headers:** Updated `scraper.py` `_lego_headers()` with Chrome-like User-Agent, Referer, Connection, Upgrade-Insecure-Requests headers + 3-retry logic with 2s delay. LEGO.com still 403s (Cloudflare), but headers are correct for when it unblocks.

**FIX 2 — India availability cross-check:** Added `is_available_in_india(set_num)` to `db.py`. Queries `store_prices` table directly using bare set number (e.g. `'76342'`) — discovered that `store_prices.set_id` is a bare number string, NOT a UUID FK. Integrated into `scraper.get_new_set()` candidate loop — any set with an existing `store_prices` row is skipped. Fails open (returns False on any exception).

**FIX 3 — Source-aware captions:** `caption_writer.py` now branches on `set_data['source']`:
- `lego_coming_soon` / `lego_com` → DISCLAIMER footer ("🛑 Please do not ask when this set releases in India...")
- `rebrickable` / `brickset` → NEUTRAL_SIGN_OFF ("🧱 Follow Bricks of India for LEGO news...")

**FIX 4 (reversed) + YouTube Shorts restored:** Initially removed YouTube Shorts entirely. User reversed this decision — YouTube Shorts were restored to `publisher.py` with `post_youtube_shorts()` (local file upload via YouTube Data API v3).

**FIX 5 — Rebrickable/Brickset source tags:** All sets from `rebrickable_get_sets()` tagged `source='rebrickable'`, from `brickset_get_sets()` tagged `source='brickset'`, from `lego_com_coming_soon()` tagged `source='lego_coming_soon'`. Source tag propagates through `get_new_set()` merge and drives both caption logic and video overlays.

---

### 2. YouTube Shorts text overlays

**Spec:** On-screen text so viewers can read set info without relying on caption text.

**Implementation** (`media_processor.py`):
- `_make_shorts_text_overlay(W, H, set_data, is_stats)` — returns RGBA numpy array (1080×1920)
- Product slides (1–9): Set name (65px white, top), info line (`#F7A800` saffron, below name), theme (34px white, y=1700). All text in blurred background zones (y<420 above product image).
- Stats slide (10): "COMING SOON / TO INDIA 🇮🇳" or "NEW AT / BRICKSOFINDIA.COM" at y=1540 (navy area below card). Source-aware: lego_coming_soon → "COMING SOON", rebrickable/brickset → "NEW AT / BRICKSOFINDIA.COM".
- Compositing: RGBA alpha blend per-frame inside Ken Burns closure — `(f * (1-a) + ov[:,:,:3] * a).astype(uint8)`. Zero pixels in product image zone (y 420–1500) — verified via pixel zone analysis.

---

### 3. Instagram carousel FINISHED polling fix

**Issue:** IG carousel published immediately after parent container creation → error 9007 "Media ID is not available."

**Fix** (`publisher.py`): Added poll loop between parent creation and publish — same pattern as existing Reels flow. Poll every 5s, max 18 attempts (90s timeout). Logs status_code on each attempt.

---

### 4. Ubuntu 22.04 package fix

**Issue:** `libgl1-mesa-glx` not found on GitHub Actions Ubuntu 22.04 runner.

**Fix** (`.github/workflows/social-automation.yml`): `libgl1-mesa-glx` → `libgl1` (renamed in Ubuntu 22.04).

---

### 5. Three live pipeline runs

| Row | Set | Date | India check | Platforms |
|-----|-----|------|-------------|-----------|
| 1 | 11377-1 Minas Tirith | 2026-05-24 13:10 UTC | — (pre-fix) | IG Feed ✅ IG Reels ✅ YouTube ✅ |
| 2 | 76342-1 Daily Bugle | 2026-05-24 17:58 UTC | Added | IG Feed ✅ IG Reels ✅ YouTube ✅ |
| 3 | 75641-1 Dr. Hiriluk's Hideout | 2026-05-25 02:57 UTC | 4 sets skipped | IG Feed ✅ IG Reels ✅ YouTube ✅ |

Run 3 (75641-1) was the first run with India check fully active — filtered: 75441-1, 31385-1, 76343-1, 31376-1.

---

### 6. Test suite created

`test_fixes.py` — 5 tests covering all critical fixes. All checks pass as of session end:
- Test 1: LEGO.com scraper (no crash)
- Test 2: India check (Daily Bugle detected as in-India, fake set returns False)
- Test 3: Caption disclaimer logic (correct sign-off per source)
- Test 4: YouTube Shorts wiring (publisher, media_processor, pipeline references, overlay zone checks)
- Test 5: Fallback source tags (Rebrickable, Brickset, lego_com tagging)

---

## System health check (2026-05-25)

| Metric | Value | Status |
|--------|-------|--------|
| posted_sets rows | 3 | ✅ |
| store_prices rows | 1,955 | ✅ |
| price_snapshots total | 20,820 (~23 days) | ✅ |
| raw_signals total | 7,403 | ✅ |
| raw_signals latest | 2026-05-24T18:39 UTC | ✅ |
| pending_drafts (draft) | 308 | ⚠️ None published since Day 14 |
| pending_drafts (approved) | 9 | — needs operator publish |
| pending_drafts (published) | 4 | — |
| BOI Social Automation last run | Success (02:50 UTC today) | ✅ |
| radar-pipeline last run | Success (02:35 UTC today) | ✅ |
| Scrape Store Prices last run | Success (May 24 19:18 UTC) | ✅ |
| Netlify deploys | All green | ✅ |

**Note on 02:40 UTC failures:** Two BOI Social Automation runs failed at 02:40 and 02:41 UTC with `libgl1-mesa-glx` package error — these were manual test triggers BEFORE the libgl1 fix was pushed to main. The Scrape Store Prices workflow was NOT involved. The successful run at 02:50 used the fixed workflow and posted 75641-1.

---

## Commits this session

| Hash | Message |
|------|---------|
| `fbdc6cc` | fix: multi-layer defense — India check, source-aware captions, remove YouTube |
| `1e761b2` | feat: YouTube Shorts with on-screen text overlays |
| `8114884` | fix: replace libgl1-mesa-glx with libgl1 for Ubuntu 22.04 runner |
| `c630083` | fix: poll carousel container before publish to avoid IG error 9007 |

---

## Carry-overs to next session

| Priority | Item |
|----------|------|
| P1 | Visit `/admin/pending` — approve + generate + publish ≥3 news articles (16 days stale) |
| P1 | Investigate Scrape Store Prices failure (2026-05-25 02:40 UTC) |
| P1 | Build WEB-05 `/guides` + WEB-06 `/community` routes (Fan CoLab critical path — due June 7) |
| P2 | LAB-06 `/lab/deals` frontend (1 session — backend already live) |
| P2 | IG System User Token — permanent non-expiring token (current expires ~2026-07-23) |
| P3 | RADAR-08 automated reviews pipeline (scope when content freshness stabilises) |

---

## Key decisions made

1. **YouTube Shorts restored** — reversed the initial "remove YouTube" decision. Local file upload with text overlays is the right UX.
2. **India check fails open** — any exception in `is_available_in_india()` returns `(False, '')` rather than blocking the pipeline. Safety over accuracy on the pipeline side.
3. **Carousel FINISHED poll** — same pattern as Reels. Poll every 5s, 90s timeout, attempt publish anyway on timeout (don't abort).
4. **Text overlays via PIL, not MoviePy TextClip** — avoids ImageMagick dependency on Ubuntu Actions runners.
