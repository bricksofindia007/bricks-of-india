# LAB-01 — The Biryani Index

**Owner:** Abhinav
**Status:** Ready to fire
**Estimated time:** 1 day
**Priority:** First Lab tool to ship — lowest effort, highest viral surface

---

## What this is

An interactive calculator at `/lab/biryani-index` that converts any LEGO set price (in INR) into everyday Indian-life equivalents — biryanis, chai, petrol, Netflix months, autorickshaw rides, etc.

Pure frontend. No database. No API. No state to persist. The entire value of this feature is in the copy and the comparison vocabulary, not the engineering.

This is the lightest possible BOI Lab tool. It exists so the Lab homepage strip has something on it from day one.

---

## Prereqs

Before starting, run these and confirm clean state:

```
git status                      # working tree clean, on main
git pull origin main             # up to date
cat BOI_MASTER_TRACKER.md        # context refresh
```

If anything fails, STOP and report. Do not proceed.

---

## Preamble — read for context

Read these files before writing any code:

1. `BOI_MASTER_TRACKER.md` — current project state
2. The existing routing pattern under `/app/` (or wherever pages live in this Next.js setup) — match conventions, do not invent new ones
3. The existing component library — buttons, cards, layouts. Reuse, do not rebuild

If any of those are missing or unclear, STOP and report what you found instead of guessing.

---

## Phase 1 — Branch and scaffold (no-build)

```
git checkout -b feat/lab-biryani-index
```

Create the route. In Next.js App Router, this means:

```
app/lab/biryani-index/page.tsx
```

Use the same layout wrapper as other public pages (`/compare`, `/news`, etc.). Match imports, match metadata pattern, match font setup.

**No-build:** Do not run `npm run dev` until Phase 3.

---

## Phase 2 — Build the calculator (build)

### Component structure

The page is a single React component with these parts:

1. **Page header** — title, subtitle in BOI voice
2. **Input** — single number field, label "What does this set cost in India? (₹)"
3. **Output grid** — 6 comparison cards, each showing the converted value
4. **Footer note** — disclaimer in BOI voice + last-updated reference price date

### Reference prices (hardcode, refresh quarterly)

Store these in a constant at the top of the file. Comment with the date of last refresh.

```typescript
// LAST REFRESHED: 2026-04-26 — refresh quarterly
const REFERENCE_PRICES_INR = {
  biryani:        { value: 350,    label: "plates of Hyderabadi biryani",     emoji: "🍛" },
  chai:           { value: 30,     label: "cups of chai",                     emoji: "☕" },
  petrol:         { value: 110,    label: "litres of petrol",                 emoji: "⛽" },
  pvr_gold:       { value: 1200,   label: "PVR Gold Class tickets",           emoji: "🎬" },
  netflix_premium:{ value: 649,    label: "months of Netflix Premium",        emoji: "📺" },
  auto_rides:     { value: 80,     label: "autorickshaw rides (Mumbai avg)",  emoji: "🛺" },
};
```

These exact six. Don't add more, don't remove. Six is the right number for the grid.

### Calculation logic

For each reference price, compute `Math.floor(setPrice / refPrice)`. Floor not round — saying "this is 22.7 biryanis" breaks the joke. Whole biryanis only.

If the input is empty, NaN, or zero → show all six cards with "—" instead of a number, and the BOI-voice empty state.

If the input is < 100 (someone typed nonsense) → show the cards but include a single line of voice-on commentary like "₹{X}? For a LEGO set? Are you sure?"

### Voice — copy that goes on the page

Copy below is canonical. Use verbatim. Do NOT improvise — the Codex voice is the entire point of this feature, and improv that misses the register kills it.

**Page title (h1):**
> The Biryani Index

**Subtitle:**
> Because every LEGO purchase needs justification, and rupees alone don't quite do it.

**Input label:**
> Enter the set price in ₹

**Input placeholder:**
> e.g. 4999

**Empty state line (when no input yet):**
> Type in a price. We'll do the maths. You'll feel either better or worse. There is no in-between.

**Card template — show value as the headline, label below:**
```
[emoji]
[BIG NUMBER]
[label from reference table]
```

Example rendered output for ₹4,999 input:
```
🍛
14
plates of Hyderabadi biryani
```

**Footer note (always visible):**
> Reference prices last updated April 2026. Mumbai-skewed. Your local prices may vary, your wallet's reaction will not. Do not show your CA.

### Layout

- Mobile-first. Single column on phone, 2-column grid on tablet, 3-column on desktop.
- Match the existing BOI typography (Fredoka for headings, Inter for body — already in the project).
- Use BOI palette: saffron `#F7A800` for accents, dark navy `#0F2D6B` for headings.
- No external chart libraries needed. This is divs and numbers.

### What NOT to build

- ❌ No share buttons (Phase 2 follow-up if data shows demand)
- ❌ No saved calculations (no auth, see brief preamble)
- ❌ No "send me my biryani number" email capture
- ❌ No animated counters or fancy transitions on the numbers
- ❌ No "compare two sets" mode
- ❌ No backend API call — pure frontend math

If any of those tempt you, STOP and ask before adding.

---

## Phase 3 — Local verification (build, then test)

```
npm run dev
```

Open http://localhost:3000/lab/biryani-index and verify:

- [ ] Empty input → all 6 cards show "—" + BOI-voice empty state
- [ ] Enter `4999` → biryani card shows `14`, chai card shows `166`, petrol card shows `45`
- [ ] Enter `0` → cards show "—" (treats zero as empty)
- [ ] Enter `50` → shows the "are you sure?" voice line
- [ ] Enter `999999` → cards show large numbers without overflow/layout break
- [ ] Mobile viewport (375px) → single column, no horizontal scroll
- [ ] Desktop viewport (1280px) → 3-column grid, all 6 visible without scroll
- [ ] Page title in browser tab is correct
- [ ] Lighthouse a11y score ≥ 90 (no obvious accessibility regressions)

If any check fails, fix before proceeding to commit.

---

## Phase 4 — Commit and PR

```
git add app/lab/biryani-index/
git commit -m "feat(lab): biryani index calculator at /lab/biryani-index"
git push origin feat/lab-biryani-index
```

Open a PR titled: `feat(lab): The Biryani Index`

PR body should include:
- Link to the live preview URL (Netlify deploy preview)
- Screenshot of the desktop layout with a sample input
- Note that this is Lab tool 1 of 6 (LAB-01)
- Note that the homepage Lab strip (LAB-04) will link to this once it ships

**STOP HERE. Do not merge.** Wait for review.

---

## Hard rules

- No auth, no email capture, no localStorage, no cookies.
- No analytics tracking added in this PR (will be done globally later).
- No new npm dependencies. If you think you need one, STOP and ask.
- No changes to any file outside `app/lab/biryani-index/` and any shared layout files you must touch to add the route.
- Reference prices are hardcoded. Do not put them in the database. Do not put them in env vars. They live in the component file with a "last refreshed" date comment.
- Do not implement share-to-Twitter / share-to-WhatsApp in this PR.

---

## When done — print this exact summary

After the PR is open, print:

```
LAB-01 BIRYANI INDEX — DONE

Branch: feat/lab-biryani-index
PR URL: <url>
Route: /lab/biryani-index
Files changed: <list>
Lighthouse a11y: <score>
Reference prices last refreshed: 2026-04-26
Next refresh due: 2026-07-26

Sample outputs (verified):
  ₹4,999 → 14 biryanis, 166 chais, 45 litres petrol
  ₹0     → empty state shown
  ₹50    → "are you sure?" voice line shown

Outstanding follow-ups (not in this PR):
  - Lab homepage strip (LAB-04) needs to link here
  - Share buttons (deferred — wait for usage data)
  - Reference price refresh calendar reminder needs to be added to BOI_MASTER_TRACKER.md
```

Then STOP. Do not proceed to LAB-02 unless explicitly told.
