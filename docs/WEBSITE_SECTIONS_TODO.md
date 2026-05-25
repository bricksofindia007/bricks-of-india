# Website Sections — Build Queue

**Last updated:** 2026-05-25

These routes do not exist yet. All are blocked until sufficient content exists to populate them, but the routes themselves should be built before the content is written — otherwise content creation is blocked on engineering.

---

## Queue

### WEB-05: `/guides`
**Status:** 🔴 Not started  
**Priority: P1** — unblocks CE-02 (8 LEGO 101 articles) + CE-05 (History piece)  
**Fan CoLab dependency:** Yes — 8 articles at `/guides` required by August 2026

**What to build:**
- Route: `src/app/guides/page.tsx` — index page listing all guide articles
- Route: `src/app/guides/[slug]/page.tsx` — article page (can reuse blog/news layout)
- Nav: add "Guides" to main navigation (probably under a "Learn" or "Resources" dropdown or separate)
- Supabase: either reuse `blog_posts` table with `category = 'guide'` filter, or create separate `guides` table
- SEO: `<title>`, `<meta description>`, JSON-LD Article schema per guide

**Recommended approach:** Reuse `blog_posts` table with a `category` column. Add `category = 'guide'` to RADAR-03 format options. Filter on the route. Avoids new migration.

**Effort:** 1 session (~3–4h including content model decision).

---

### WEB-06: `/community`
**Status:** 🔴 Not started  
**Priority: P1** — unblocks CE-01 (Indian Builder Spotlight)  
**Fan CoLab dependency:** Yes — 2+ spotlights required at `/community` by August 2026

**What to build:**
- Route: `src/app/community/page.tsx` — index of all Builder Spotlight features
- Route: `src/app/community/[slug]/page.tsx` — individual spotlight page
- Content model: builder name, location, years building, bio, MOC photos (gallery), quote
- Supabase: new `community_spotlights` table (id, slug, builder_name, location, bio, photos jsonb, published_at, published bool)
- Nav: add "Community" to main navigation

**Effort:** 1 session (~4–5h including migration + content model).

---

### WEB-07: `/opinion`
**Status:** 🔴 Not started  
**Priority: P3** — unblocks CE-03 (Build Debate monthly opinion piece)  
**Fan CoLab dependency:** No

**What to build:**
- Option A (simple): Add `format = 'opinion'` to existing blog pipeline. Filter `blog_posts` by format. Route: `/blog?format=opinion` or `/opinion` alias.
- Option B (standalone): New `src/app/opinion/page.tsx` + `[slug]/page.tsx` routes.

**Recommended approach:** Option A — tag-based, zero new migration, reuses all existing blog infrastructure.

**Effort:** 0.5 session if tag-based.

---

## Dependency chain

```
WEB-05 /guides ──────────► CE-02 (8 LEGO 101 articles)
                       └──► CE-05 (History of LEGO in India)

WEB-06 /community ──────► CE-01 (Indian Builder Spotlight × 2)

WEB-07 /opinion ────────► CE-03 (Build Debate monthly)

LAB-06 /lab/deals ──────► CE-06 (Deals Alert IG Story)
```

---

## Build order recommendation

1. **WEB-05 + WEB-06** in one session (both are route + layout work, similar pattern, can be done together)
2. **LAB-06** in one session (backend already live — purely frontend)
3. **WEB-07** as a quick add-on when CE-03 is being planned

Target: WEB-05 + WEB-06 shipped by 2026-06-07 (2 weeks) to allow 10+ weeks of CE content production before Fan CoLab deadline. See `docs/FAN_COLAB_TIMELINE.md` for week-by-week schedule.
