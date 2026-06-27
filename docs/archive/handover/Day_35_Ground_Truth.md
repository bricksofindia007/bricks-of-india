# Day 35 Ground Truth — 2026-06-03
**HEAD:** `2b68f7a`
**Health score:** 97
**Session closed:** morning IST

---

## Content counts (end of Day 34)
| Table | Count | Delta vs Day 33 close |
|---|---|---|
| news_articles | 98 | +14 (overnight scheduled pipeline) |
| blog_posts | 23 | +1 |
| guides | 9 | — |
| reviews | 3 | — |
| pending_drafts approved | 331 | — |
| pending_drafts draft | 91 | — |
| pending_drafts published | 78 | +27 |
| pending_drafts rejected | 4 | — |
| store_prices | 1,512 | ⚠️ −1,088 from Day 33 close (was 2,600) |
| posted_sets | 9 | +1 (76470-1 manual insert) |

---

## Commits this session (9 commits)
| Hash | Description |
|---|---|
| `1477c75` | fix(social): graceful YouTube token failure + BOM notifier crash + mark_as_posted protection |
| `a8b1546` | feat(health): YouTube token expiry Check 6b + secrets-manifest + health-check.yml env |
| `14fedb4` | fix: CQS spike — null hero guard, bad opener rewrite, verdict/store injection in publisher |
| `ff18be8` | fix: comprehensive CQS backfill — 13 DB fixes + verdict gate tightened |
| `9d7d19c` | fix: broaden bad opener regex + retroactive bossks-houndstooth fix |
| `43c6321` | fix: dup images, dup openers, dup title, signoffs, low wc, india para, suppress MOC missing_image |
| `79b6e63` | feat: fallback hero complete — blocklist expanded, null→fallback, linter carveout |
| `57a3113` | fix: suppress duplicate_image false positive for same-set articles |
| `2b68f7a` | feat: add LEGO fallback hero image to public assets ← CRITICAL: file existed locally but was never committed; 42 articles were serving 404 on hero slot |

---

## What shipped today

### CRITICAL fix (commit `2b68f7a` — discovered post-session)
`public/fallback-hero.png` was set as `hero_image` for 42 articles in the DB (41 news + 1 blog) but was never git-added. Live site was serving 404 on every hero image slot using the fallback. Committed and pushed at session close.

### Social automation pipeline hardening (`1477c75`, `a8b1546`)
**Root cause:** GHA run 26815624526 failed at Step 9 (YouTube Shorts). YouTube OAuth `refresh_token` expired (`invalid_grant`). IG carousel + Reels posted successfully but `posted_sets` never recorded (mark_as_posted unreachable after YouTube exception).

Fixes:
- `publisher.py`: `try/except RefreshError` on `creds.refresh()` — returns `None`, YouTube skipped gracefully
- `pipeline.py`: YouTube wrapped in own `try/except` — mark_as_posted always runs; fatal error → stdout
- `notifier.py`: BOM strip + ASCII encode before Resend HTML; emoji removed from subject
- `posted_sets`: `76470-1` manually inserted (`ig_feed=true`, `ig_reels=true`, `yt_shorts=false`)
- `health-check.mjs` Check 6b: YouTube token expiry alert (missing / malformed / ≤3 days)
- `YOUTUBE_CLIENT_SECRETS` added to `health-check.yml` env + `secrets-manifest.json`

### YouTube re-auth (unresolved — blocked)
- Refresh token confirmed expired via direct `creds.refresh()` call: `invalid_grant: Bad Request`
- Wrong `client_id` in `client_secrets.json` discovered and corrected (`505184160322-...` → `824336036645-...` from `.env`)
- `youtube_oauth_helper.py` written: correct state sharing, `redirect_uri` set before URL generation
- Google blocked auth with `access_denied` — app in Testing mode under Google verification review
- `bricksofindia007@gmail.com` added as test user in Google Cloud Console
- **Outcome:** Blocked pending Google verification (submitted 2026-06-02, 4–6 week review)
- **Impact:** YouTube Shorts skipped gracefully. IG Feed + Reels unaffected.
- **Files to delete after re-auth:** `social-automation/client_secrets.json`, `youtube_oauth_helper.py`, `oauth_helper_out.txt`, `oauth_script_out.txt`

### CQS spike resolution — 158 criticals → 0 actionable
**Root cause:** Null hero images (from CDN blocklist) triggering `image_render_broken` (null guard missing). 41 MOC/community articles triggering `missing_image` (no set → no image source). Overnight batch articles with gate gaps.

Code fixes applied:
- `visual-renderer.mjs`: null hero guard on `image_render_broken` check
- `content-linter.mjs`: `missing_image` requires set number in slug; `placeholder_image` carves out `/fallback-hero.png`; `duplicate_image` suppressed for same-set slug pairs
- `publish-drafts.mjs`: `BAD_OPENER_PATTERNS` + bad opener rewrite; store mention injection; verdict injection with `hasSetNum` gate; `EDITORIAL_CDN_BLOCKLIST` +4 domains; `resolveYouTubeHeroImage` → returns `/fallback-hero.png` not `null`

DB fixes (46 articles, 3 script runs):
- 41 news + 1 blog null hero → `/fallback-hero.png` (file now committed)
- 5 Rebrickable images resolved (sets 5986, 1999, 11380, 42228, 3500)
- 3 `VERDICT: BUY` → `VERDICT: BUY NOW`; 1 verdict injected
- 7 bad openers rewritten (retroactive); 4 `Your wallet called.` duplicate openers → unique lines
- 1 store mention injected; 2 forbidden words fixed
- 1 dup title renamed (`chaos-2` → `when-chaos-becomes-the-shot`)
- 1 word count extension (reviving-9v 248w → 337w)
- 0 signoffs missing confirmed; India paragraph: 3 slugs correct in `content` column

---

## Day 35 opening sequence
1. **Verify Netlify deploy** — confirm `public/fallback-hero.png` deployed and hero images resolving on affected articles (spot-check `/news/bionicles-tahu-celebrates-25-years-with-fan-creations`)
2. **Investigate store_prices drop** — `gh run list --workflow=scrape-prices.yml --limit 5`. Check for SCRAPE-03 zero-row Resend alert in inbox. 2,600 → 1,512 is a 42% drop overnight.
3. **Check health-check.yml run at 08:00 IST** — confirm Check 6b fires for YouTube token (should alert since token is expired/invalid)
4. **Clean up social-automation auth files** — delete `client_secrets.json`, `youtube_oauth_helper.py`, `oauth_helper_out.txt`, `oauth_script_out.txt` from working tree (not sensitive in isolation but don't leave credentials on disk)
5. **Generate + publish batch** — `node --env-file=.env.local scripts/generate-approved-drafts.js --limit 15`. 331 approved awaiting Gemini bodies.

---

## P1 open items
| Ticket | Task | Notes |
|---|---|---|
| YT-OAUTH-01 | YouTube re-auth | Blocked on Google verification (4–6 weeks). Watch email for Trust and Safety response. Once resolved: run `youtube_oauth_helper.py`, update `YOUTUBE_CLIENT_SECRETS` GitHub Secret. |
| SCRAPE-INVESTIGATE-01 | store_prices 2,600 → 1,512 | Check scrape-prices.yml last run. Could be MBH/Toycra scraper issue. |
| GEO-05b | Auto-link set mentions in articles | 98 news + 23 blog with zero set links. Prompt fix: instruct Gemini to produce `/sets/[slug]` markdown links. |

## Deadlines
| Date | Item |
|---|---|
| Jun 15 | CE-01 inbox check — escalate if zero responses |
| Jul 15 | CE-01: 2× Builder Spotlights published at /community |
| Jul 16 | IG System User Token re-exchange (hard deadline) |
| Aug 2026 | LEGO Fan CoLab application submitted |

---

## Known acceptable state
- 42 articles using `/fallback-hero.png` — file now live in repo (`2b68f7a`). Valid short-term. Future: resolve Rebrickable image from article title/body for those with identifiable sets.
- YouTube Shorts skipped gracefully — pipeline health unaffected. IG posts daily at 12:00 IST.
- Google OAuth app under verification — no action possible until review completes.
- store_prices 1,512 — investigate before declaring acceptable.
