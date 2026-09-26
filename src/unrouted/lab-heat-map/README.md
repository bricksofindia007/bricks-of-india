# /lab/heat-map — unrouted (hidden pending rebuild)

Moved out of `src/app/` on 2026-09-26 (issue #213, Wave 1 PR-H). The page's figures were
hardcoded `STATE_DATA` / `WORLD_DATA` arrays (commit d5d1641, 2026-05-10) with contradictory
"Q1 2026" / "Data: Google Trends Q1 2025" labels — there was never a live Trends fetch.

`/lab/heat-map` now 307-redirects to `/lab` (`next.config.mjs`), and the tool is removed from
`LAB_TOOLS` (nav, Lab index, homepage Lab strip) and `sitemap.ts`. To restore after the rebuild:
move `page.tsx` + `layout.tsx` back to `src/app/lab/heat-map/`, re-add the `LAB_TOOLS` entry and
the sitemap line, and delete the redirect.
