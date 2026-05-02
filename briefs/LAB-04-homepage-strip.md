# LAB-04 — The Lab Homepage Strip + Nav Dropdown

**Owner:** Abhinav
**Status:** Ready to fire AFTER LAB-01 and LAB-02 are merged
**Estimated time:** 2–3 days
**Priority:** Ships once at least one Lab tool is live, ideally two
**Prerequisite:** LAB-01 (Biryani Index) merged. LAB-02 (Quiz) ideally merged.

---

## What this is

Adds:

1. A new section on the homepage — **"The Lab"** — directly below the hero, containing 3 tile cards for the live Lab tools.
2. A new top nav item — **"The Lab"** — as a dropdown showing all 6 planned tools (live + coming soon states).
3. A landing page at `/lab` that lists every Lab tool (live + coming soon), serving as both a directory and the "See all Lab tools →" destination from the homepage strip.

This is the discovery layer for the Lab. Without it, the Lab tools exist but nobody finds them. With it, the homepage has a daily "what's new" hook and the nav has a clear home for the entire feature category.

---

## Prereqs

```
git status                        # clean working tree, on main
git pull origin main               # up to date
cat BOI_MASTER_TRACKER.md          # context refresh
```

Confirm:
- LAB-01 (`/lab/biryani-index`) is live in production
- LAB-02 (`/lab/which-set-are-you`) is live in production OR explicitly approved to ship as "coming soon" in this PR

If LAB-01 is not live, STOP. The strip needs at least one functioning tool.

---

## Preamble — read for context

1. `BOI_MASTER_TRACKER.md`
2. The current homepage source (`app/page.tsx` or wherever the homepage component lives)
3. The current global nav component
4. Existing `/lab/biryani-index/page.tsx` for layout/voice conventions
5. Brand palette in the BOI tracker: saffron `#F7A800`, blue `#006CB7`, green `#16A34A`, dark navy `#0F2D6B`, fonts Fredoka + Inter

---

## Phase 1 — The Lab landing page (build first)

Before touching the homepage, build the Lab directory at `/lab/page.tsx`. The strip on the homepage will link to it via "See all Lab tools →".

### Page structure

```
app/lab/page.tsx
```

Contents:

1. **Page header**
   - h1: `The Lab`
   - Subtitle (verbatim — Codex voice): `Where we overthink LEGO so you don't have to.`
2. **Intro paragraph** (verbatim):
   > A growing collection of small tools that help you justify, postpone, or accelerate your next LEGO purchase. None of them are price comparison. We have a whole site for that. These are the side experiments.
3. **Tool grid** — 6 tiles, 3 per row on desktop, 2 per row on tablet, 1 per row on mobile.

### The 6 tiles (canonical)

```typescript
type LabTool = {
  id: string;
  name: string;
  emoji: string;
  tagline: string;          // 1-line in BOI voice
  href: string | null;       // null = coming soon
  status: "live" | "coming_soon";
};

const LAB_TOOLS: LabTool[] = [
  {
    id: "biryani-index",
    name: "The Biryani Index",
    emoji: "🍛",
    tagline: "How many biryanis is this set? Find out and weep.",
    href: "/lab/biryani-index",
    status: "live",
  },
  {
    id: "which-set-are-you",
    name: "Which Set Are You?",
    emoji: "🎯",
    tagline: "A short quiz that judges your taste and recommends a set.",
    href: "/lab/which-set-are-you",
    status: "live", // change to "coming_soon" if LAB-02 not merged yet
  },
  {
    id: "price-drops",
    name: "Price Drop Board",
    emoji: "📉",
    tagline: "Today's steepest falls. Updated daily. Suspicious by nature.",
    href: null,
    status: "coming_soon",
  },
  {
    id: "retirement-radar",
    name: "Retirement Radar",
    emoji: "⏳",
    tagline: "Sets nearing end-of-life. The fear is the feature.",
    href: null,
    status: "coming_soon",
  },
  {
    id: "heat-map",
    name: "LEGO Heat Map",
    emoji: "🗺️",
    tagline: "Which Indian city searches for LEGO most. We have opinions.",
    href: null,
    status: "coming_soon",
  },
  {
    id: "portfolio",
    name: "The Brick Portfolio",
    emoji: "📊",
    tagline: "Track your collection's value. Show your CA. Or don't.",
    href: null,
    status: "coming_soon",
  },
];
```

### Tile design

**Live tile:**
```
┌──────────────────────────┐
│ 🍛                        │
│                          │
│ The Biryani Index        │
│                          │
│ How many biryanis is     │
│ this set? Find out and   │
│ weep.                    │
│                          │
│ [Try it →]               │
└──────────────────────────┘
```

**Coming-soon tile:**
```
┌──────────────────────────┐
│ 📉                        │
│                          │
│ Price Drop Board         │
│                          │
│ Today's steepest falls.  │
│ Updated daily.           │
│ Suspicious by nature.    │
│                          │
│ Coming soon              │ ← muted, no link
└──────────────────────────┘
```

Coming-soon tiles are visibly de-emphasised — slightly lower opacity (0.7), no hover state, no link. Still informative — visitor sees what's planned. NOT crossed out, NOT greyed to invisibility. "Coming soon" is part of the feature; it tells the visitor BOI is building.

### Voice on the page

- Page title and subtitle: verbatim above
- Tile taglines: verbatim above
- Do not improvise. The Codex voice applies; these have been written to that voice already.

---

## Phase 2 — The homepage strip (build second)

### Where it goes

Directly below the hero, above whatever currently sits in that position (latest news, latest reviews, etc.). New section, not a replacement.

### Section structure

```
src/components/ui/LabStrip.tsx
```

Imported into `src/app/page.tsx` and rendered in the homepage layout.

### Visual layout

```
┌─────────────────────────────────────────────────────────────┐
│  THE LAB ──── where we overthink LEGO so you don't have to  │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ tile 1      │  │ tile 2      │  │ tile 3      │          │
│  │ (live)      │  │ (live)      │  │ (live or    │          │
│  │             │  │             │  │  coming)    │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│                                                             │
│              [See all Lab tools →]                          │
└─────────────────────────────────────────────────────────────┘
```

### Which tiles show on the homepage

The homepage strip shows the **3 most recently shipped** Lab tools (by ship date, newest first). The remaining 3 live in `/lab` only.

For the initial launch:
- Tile 1: Biryani Index (live)
- Tile 2: Which Set Are You? (live, if LAB-02 merged)
- Tile 3: Price Drop Board (coming soon)

If LAB-02 is NOT yet merged at the time this PR ships, the third tile becomes another "coming soon" — Retirement Radar, for instance. Always 3 tiles, never 2, never 4.

### Strip-specific rules

- Section header: `THE LAB` in uppercase, Fredoka, saffron color, with the tagline subordinate next to it.
- Tile design: same as `/lab` page tiles but slightly more compact (less padding).
- "See all Lab tools →" CTA centred below the tiles, links to `/lab`.
- On mobile: tiles become a horizontally scrollable row (snap-scroll), not a vertical stack. Reason: the strip is supposed to feel like a discovery moment, and a vertical stack on mobile makes it feel like a long page.
- Background: subtle saffron tint (e.g. `#F7A800` at 5% opacity) to visually distinguish the strip from the rest of the homepage.

---

## Phase 3 — The nav dropdown (build third)

### Where it goes

In the existing top nav component, add a new item between (probably) "Reviews" and "About" — match the existing nav order convention.

### Behaviour

- Desktop: hover or click on "The Lab" → dropdown opens showing all 6 tools (live and coming-soon, with status indicators)
- Mobile: tap "The Lab" → dropdown expands inline, same 6 tools
- Live tools: clickable, full color
- Coming-soon tools: visible but greyed, with "(soon)" label, NOT clickable

### Dropdown markup

Each item shows: emoji, tool name, "(soon)" suffix if applicable. No taglines in the dropdown — the dropdown is for navigation, not discovery. Discovery happens on `/lab`.

```
The Lab ▾
├─ 🍛 The Biryani Index
├─ 🎯 Which Set Are You?
├─ 📉 Price Drop Board (soon)
├─ ⏳ Retirement Radar (soon)
├─ 🗺️ LEGO Heat Map (soon)
├─ 📊 The Brick Portfolio (soon)
└─────────────────────
   See all Lab tools →
```

The "See all Lab tools →" footer link in the dropdown goes to `/lab`.

### Mobile nav

If the existing mobile nav uses a hamburger menu, "The Lab" becomes an expandable section within it. Match the pattern of any existing dropdown in the mobile nav. Do not invent a new pattern.

---

## Phase 4 — Local verification

```
npm run dev
```

Run through these checks:

### Homepage (`/`)
- [ ] The Lab strip appears directly below the hero
- [ ] Strip shows 3 tiles, with correct content per `LAB_TOOLS` constant
- [ ] "See all Lab tools →" link navigates to `/lab`
- [ ] Mobile (375px): tiles scroll horizontally, not vertically, with snap behaviour
- [ ] Desktop: tiles laid out in a row, comfortable spacing
- [ ] Strip background tint visible but subtle, not garish

### Lab landing (`/lab`)
- [ ] All 6 tiles render
- [ ] Live tiles are clickable and navigate to their pages
- [ ] Coming-soon tiles render at lower opacity, no link, no hover
- [ ] Mobile: tiles stack 1-per-row, no horizontal overflow
- [ ] Tablet (768px): 2-per-row
- [ ] Desktop: 3-per-row

### Nav dropdown
- [ ] Desktop: "The Lab" hover/click opens dropdown
- [ ] All 6 tools listed with correct status
- [ ] Live tools navigate; coming-soon tools do not
- [ ] Mobile: "The Lab" in hamburger menu expands inline
- [ ] "See all Lab tools →" inside dropdown navigates to `/lab`

### Cross-cutting
- [ ] Voice copy matches verbatim — title, subtitle, taglines
- [ ] Lighthouse a11y on `/` ≥ 90, on `/lab` ≥ 90
- [ ] No layout shift (CLS) on homepage from the new strip — should be in the initial render, not lazy-loaded

Report each check.

---

## Phase 5 — Commit and PR

```
git add src/app/lab/page.tsx src/components/ui/LabStrip.tsx src/lib/lab-tools.ts src/app/page.tsx src/components/layout/Navbar.tsx
git commit -m "feat(lab): homepage strip + /lab directory + nav dropdown"
git push origin feat/lab-04-homepage-strip
```
<!-- DEFECT-002 patch: branch renamed feat/lab-homepage-strip → feat/lab-04-homepage-strip -->
<!-- DEFECT-003 patch: paths corrected to src/ layout; LabStrip moved to src/components/ui/; LAB_TOOLS extracted to src/lib/lab-tools.ts -->

PR title: `feat(lab): The Lab — homepage strip, directory, nav`

PR body:
- Screenshots: homepage with strip, /lab directory, nav dropdown (open state)
- Note which Lab tools are "live" vs "coming soon" in this PR
- Note that adding new Lab tools later requires only updating the `LAB_TOOLS` constant in one place

**STOP. Do not merge.** Wait for review.

---

## Hard rules

- All voice copy is verbatim. Title, subtitle, taglines — do not rewrite.
- The `LAB_TOOLS` constant is the single source of truth. Both the `/lab` page and the homepage strip read from it. Do not duplicate the list in two places.
- Coming-soon tiles are visible but de-emphasised. Do NOT hide them. The point is to show what's coming.
- The homepage strip shows exactly 3 tiles. Not 2, not 4. If you only have 1 live tool, fill with coming-soon tiles to reach 3.
- No analytics, no email capture, no auth — same as all Lab features.
- Do not change the homepage hero in this PR. Only add the strip below it.
- Do not change the existing nav items. Only add "The Lab" as a new one.
- No new npm dependencies.

---

## When done — print this exact summary

```
LAB-04 LAB STRIP + DIRECTORY + NAV — DONE

Branch: feat/lab-04-homepage-strip
PR URL: <url>
Routes added:
  - /lab (directory)
Components added:
  - src/components/ui/LabStrip.tsx (homepage strip)
  - src/lib/lab-tools.ts (LAB_TOOLS single source of truth)
Nav dropdown: added "The Lab" between <X> and <Y>

Tools rendered:
  Live: <list — should match what's in production>
  Coming soon: <list>

Verified scenarios:
  Homepage strip on mobile/tablet/desktop: PASS
  /lab directory on mobile/tablet/desktop: PASS
  Nav dropdown on desktop hover: PASS
  Nav dropdown on mobile expand: PASS
  Lighthouse a11y home: <score>
  Lighthouse a11y /lab: <score>
  No CLS regression on homepage: PASS

Outstanding follow-ups:
  - When LAB-05 ships, change "price-drops" status from "coming_soon" to "live", set href
  - Same pattern for LAB-06, LAB-07 etc.
  - LAB_TOOLS constant is the only thing that needs changing
```

Then STOP.
