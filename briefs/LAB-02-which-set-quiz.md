# LAB-02 — Which Set Are You? (Personality Quiz / Set Finder)

**Owner:** Abhinav
**Status:** Ready to fire
**Estimated time:** 1 week
**Priority:** Second Lab tool to ship — high viral surface, conversion-funnel asset
**Prerequisite:** LAB-01 must be merged (so layout patterns and Lab routing are established)

---

## What this is

A short interactive quiz at `/lab/which-set-are-you` that asks 4–5 questions and recommends a LEGO set from the existing BOI catalogue. Each result includes a witty personality verdict in BOI voice, the set details, and a link to the set's page on `/compare` for price comparison.

Doubles as a gift finder via a "gifting mode" toggle that swaps the framing from "for me" to "for someone else" but uses the same engine.

Pure frontend logic. No database writes. No state to persist between sessions. The catalogue read is via the existing `/api/sets/search` endpoint or a new lightweight `/api/lab/quiz-result` endpoint — your call based on which is cleaner.

---

## Prereqs

```
git status                      # working tree clean, on main
git pull origin main             # up to date
cat BOI_MASTER_TRACKER.md        # context refresh
```

Confirm LAB-01 (Biryani Index) is merged. If not, STOP — that establishes the Lab routing pattern this brief depends on.

---

## Preamble — read for context

1. `BOI_MASTER_TRACKER.md`
2. `app/lab/biryani-index/page.tsx` — match the page-level conventions established there
3. The existing `sets` table schema in `DATA_SOURCES.md` — this brief queries it
4. The existing `/api/sets/search` route — understand its return shape before deciding whether to reuse or write a new endpoint

If any of those are missing or unclear, STOP and report.

---

## Phase 1 — Branch and design the question tree (no-build)

```
git checkout -b feat/lab-which-set-quiz
```

Before writing any code, write the question tree in a file at `app/lab/which-set-are-you/quiz-tree.ts` as a TypeScript constant. The tree IS the design — get it right before the UI.

### The five questions (locked — do not invent new ones in this PR)

```typescript
type Theme =
  | "Speed Champions" | "Technic" | "Star Wars" | "Icons"
  | "Architecture"    | "City"    | "Creator Expert" | "Friends"
  | "Harry Potter"    | "Ideas";

type BudgetBand = "under_2k" | "2k_to_5k" | "5k_to_15k" | "over_15k";
type Complexity = "casual" | "weekend" | "serious" | "obsessive";
type Purpose    = "display" | "play" | "both";
type Mode       = "for_me" | "for_someone_else";

type QuizAnswers = {
  mode: Mode;              // Q1
  budget: BudgetBand;      // Q2 — INR bands, not USD
  themes: Theme[];         // Q3 — multi-select, min 1, max 3
  complexity: Complexity;  // Q4
  purpose: Purpose;        // Q5
};
```

### Question copy (verbatim — do not improvise)

**Q1 — Mode (single select):**
> First — who's this for?
> - For me, obviously
> - For someone else (we will not judge)

**Q2 — Budget band (single select):**
> What's the budget?
> - Under ₹2,000 (small treat, no guilt)
> - ₹2,000 — ₹5,000 (justifiable)
> - ₹5,000 — ₹15,000 (the wallet is concerned)
> - Over ₹15,000 (the wallet has officially stopped speaking to you)

**Q3 — Themes (multi-select, choose up to 3):**
> Pick what you (or they) actually like. Up to three.
> - Cars and engines
> - Star Wars
> - Famous buildings and landmarks
> - City life — vehicles, streets, fire stations
> - Anything Technic — the more gears the better
> - Movies and IP (Harry Potter, Marvel, etc.)
> - Friends, Disney, fairy-tale stuff
> - Surprise me — I trust your judgment

**Q4 — Complexity (single select):**
> How serious does the build need to be?
> - Casual — under 200 pieces, done in an afternoon
> - Weekend project — 200 to 800 pieces
> - Serious — 800 to 2,500 pieces, take it slow
> - Obsessive — over 2,500 pieces, blocks out a week

**Q5 — Purpose (single select):**
> And what's it actually for?
> - Display — it goes on a shelf and stays there
> - Play — it gets handled, swooshed, occasionally dropped
> - Both — strategic ambiguity

### The matching logic

The matcher is a SQL query (or Supabase query) against the `sets` table with these filters:

```
WHERE
  theme IN (selected themes)  -- OR if "Surprise me" → no theme filter
  AND lego_mrp_inr BETWEEN <budget band lower> AND <budget band upper>
  AND piece_count BETWEEN <complexity band lower> AND <complexity band upper>
ORDER BY
  -- Prioritise sets with images (image_url IS NOT NULL)
  -- Then by image_coverage_score DESC if it exists
  -- Then random()
LIMIT 3
```

Return up to 3 matches. Display the top match prominently with the witty verdict; show the other 2 as "or maybe..." alternatives below.

**Edge case:** if zero matches → relax constraints in this order: piece count first, then budget, then theme. Always return at least 1 result. Never show "no match found" — that's a UX dead end.

**NULL price handling:** sets with `lego_mrp_inr IS NULL` are EXCLUDED from results. The Biryani Index works on price; the Quiz must not recommend a set whose price BOI doesn't know.

### The personality verdicts

Hardcode 12 verdict templates. The matcher picks one based on the answer combination, not random. Copy below is canonical — do NOT rewrite. These ARE the feature.

```typescript
const VERDICTS: Record<string, string> = {
  // Format: "{theme}_{complexity}_{purpose/mode}" → verdict prose
  "Technic_obsessive_display":
    "You are a Technic purist with an engineering degree and something to prove. Here is a set with more gears than your last three relationships had functional moments. Display it. Make a speech. We will not stop you.",
  "Speed Champions_casual_play":
    "You want a tiny, fast, badly-behaved car. We respect this. The Speed Champions range exists for exactly this kind of decision-making. Eight hundred rupees, twenty minutes, one bad influence on your shelf.",
  "Star Wars_serious_display":
    "You have selected Star Wars and 'serious.' This is a person who has opinions about which Star Destroyer is the correct Star Destroyer. We have one for you. Clear a shelf. Possibly clear a wall.",
  "Architecture_weekend_display":
    "Famous buildings, weekend timeline, display intent. You are organised. You are restrained. You are going to disappoint us by actually finishing this on schedule.",
  "Icons_obsessive_both":
    "Icons, obsessive, and 'both display and play.' You are lying about the play part. We know. You know. The set is going on a shelf and it is going to stay there. Here it is.",
  "City_casual_play":
    "City, casual, play. This is the most reasonable answer set we have seen all day. There is a small fire station with your name on it. It will be loved.",
  "Harry Potter_weekend_play":
    "Harry Potter, weekend, play. You have made peace with the fact that the wand will go missing in 48 hours. We honour this acceptance. Here is your set.",
  "Friends_casual_play":
    "Friends or Disney, casual, play. The audience for this is happier than the rest of us. Here is something colourful. Try not to be jealous.",
  "Creator Expert_serious_display":
    "Creator Expert, serious, display. You know exactly what you're doing. You don't need a verdict. Here is the set. Use a coaster.",
  "default_for_someone_else":
    "Gift mode engaged. We have selected something appropriate, age-flexible, and unlikely to cause a divorce. The recipient will smile politely. They might even mean it.",
  "default_under_2k":
    "Under two thousand rupees. Disciplined. Almost suspiciously disciplined. Here is something small that will lead, inevitably, to something larger. We are sorry in advance.",
  "default_over_15k":
    "Over fifteen thousand rupees. Your wallet has officially stopped speaking to you. Your shelf, however, will speak volumes. Here is the set. Tell your CA we said hello.",
};
```

The matching function tries specific keys first (theme + complexity + purpose), falls back to mode-based defaults, then budget-based defaults. If absolutely nothing matches → use a generic fallback verdict (write one in the same register).

---

## Phase 2 — Build the UI (build)

### Routing structure

```
app/lab/which-set-are-you/
  page.tsx            # main quiz container
  quiz-tree.ts        # the constants from Phase 1
  matcher.ts          # the matching logic (server-side)
  components/
    QuizQuestion.tsx
    QuizResult.tsx
    AlternativeSetCard.tsx
```

### Page flow

Single page, no separate routes for each question. State machine in React state:

```
state: { step: 1 | 2 | 3 | 4 | 5 | "result", answers: Partial<QuizAnswers> }
```

Question screen → "Next" button advances step. After Q5, hit `/api/lab/quiz-result` with the answers, get back `{ primary: Set, alternatives: Set[], verdict: string }`, render the result screen.

### API route

Create `app/api/lab/quiz-result/route.ts`:

- POST endpoint
- Accepts `QuizAnswers` shape
- Returns `{ primary, alternatives, verdict }`
- Server-side query against `sets` table (Supabase)
- Includes the matcher logic from Phase 1
- Validates input — reject malformed payloads with 400, do not crash

### Result screen layout

```
┌────────────────────────────────────────┐
│  [verdict prose in BOI voice — large]  │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ [set image]                      │  │
│  │ [set name + #set_num]            │  │
│  │ [theme · pieces · ₹price]        │  │
│  │ [See on BOI →] (links /compare)  │  │
│  └──────────────────────────────────┘  │
│                                        │
│  Or maybe:                             │
│  ┌──────────┐ ┌──────────┐             │
│  │ alt 1    │ │ alt 2    │             │
│  └──────────┘ └──────────┘             │
│                                        │
│  [Take it again →]                     │
└────────────────────────────────────────┘
```

### "Take it again" behaviour

Resets state to `{ step: 1, answers: {} }`. No persistence between attempts. No "your previous result was..." — every quiz attempt is fresh.

### What NOT to build

- ❌ No share buttons (deferred)
- ❌ No "email me the result" — no email capture, see preamble
- ❌ No saved quiz history — no auth
- ❌ No animated transitions between questions (use simple fade if you must)
- ❌ No new themes or budget bands beyond the locked five questions
- ❌ No "compare two sets" feature on the result screen
- ❌ No A/B testing framework

---

## Phase 3 — Local verification

```
npm run dev
```

Open http://localhost:3000/lab/which-set-are-you and run through these scenarios:

- [ ] Mobile viewport (375px) — single question per screen, no horizontal scroll, button reachable with thumb
- [ ] Desktop viewport — same flow, comfortable reading width
- [ ] Q1 → Q5 → result, all paths work
- [ ] "Surprise me" theme selection → returns valid sets across themes
- [ ] Multi-select on Q3 (pick 3 themes) → result reflects the choice
- [ ] Edge case: budget = under_2k + complexity = obsessive → matcher relaxes, returns a result anyway, no "no match" dead end
- [ ] Sets with NULL price never appear in results
- [ ] Verdict prose matches the answer combo (manually verify 5 different paths)
- [ ] "Take it again" fully resets state
- [ ] Browser back button doesn't break state
- [ ] API route handles malformed POST → returns 400, doesn't crash

Run these, report which pass and fail. Fix failures before committing.

---

## Phase 4 — Commit and PR

```
git add app/lab/which-set-are-you/ app/api/lab/quiz-result/
git commit -m "feat(lab): which-set-are-you quiz at /lab/which-set-are-you"
git push origin feat/lab-which-set-quiz
```

PR title: `feat(lab): Which Set Are You? — personality quiz`

PR body:
- Live preview URL
- Screenshot of result screen with a sample answer set
- Note: LAB-02 of Lab series, depends on LAB-01 being merged
- Note: Lab homepage strip (LAB-04) will link here once it ships

**STOP. Do not merge.** Wait for review.

---

## Hard rules

- No auth, no email capture, no localStorage, no cookies.
- No new npm dependencies — use what's already in the project.
- Verdict prose is canonical. Do not rewrite. Do not "improve" the copy.
- Sets with `lego_mrp_inr IS NULL` must be excluded from quiz results. No exceptions.
- "Surprise me" must always return a result. The matcher's relaxation chain (piece count → budget → theme) must never bottom out at "no match found."
- Never make a database write. This feature is read-only from sets table.
- Do not log quiz answers anywhere — no analytics on individual responses in this PR.

---

## When done — print this exact summary

```
LAB-02 WHICH-SET-ARE-YOU — DONE

Branch: feat/lab-which-set-quiz
PR URL: <url>
Route: /lab/which-set-are-you
API route: /api/lab/quiz-result (POST)
Files changed: <list>

Verdict templates: 12 hardcoded
Question count: 5
Theme options: 8 (incl. "Surprise me")
Budget bands: 4
Complexity bands: 4

Verified scenarios:
  - Mobile + desktop layouts: PASS
  - All 5 questions complete → result: PASS
  - Edge case (under_2k + obsessive) → matcher relaxes, returns result: PASS
  - NULL-price sets excluded: PASS
  - "Take it again" full reset: PASS
  - API 400 on malformed input: PASS

Outstanding follow-ups (not in this PR):
  - Lab homepage strip (LAB-04) needs to link here
  - Share buttons (deferred)
  - Quiz answer analytics (deferred — privacy review needed first)
```

Then STOP.
