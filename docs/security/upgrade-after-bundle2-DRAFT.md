# DRAFT: Tailwind 4 and eslint-plugin upgrade after Bundle 2

Status: draft only. Not scheduled. Owner decision pending. Nothing here is applied.

## Why

The build-time advisory GHSA-vfj7-8cjw-p6xm (braces) has no patched 3.x release. It is accepted until 18 Jan 2027 (`docs/security/npm-audit-exception-2026-10-20.md`). The fix path runs through tailwindcss 4 and a patched eslint plugin, both of which are major changes.

## Scope

- tailwindcss 3.4.19 to 4.x (removes the chokidar, micromatch and fast-glob path)
- @tailwindcss/typography to a 4.x-compatible release
- @next/eslint-plugin-next and eslint-config-next: move to a patched release on the current Next line (not npm's suggested downgrade to 14.2.35)

## Risk list

1. **Visual regressions across the site.** Tailwind 4 changes defaults (border colours, ring width, preflight, `@layer` handling). Every page needs a visual diff before merge.
2. **Config format.** Tailwind 4 moves most configuration into CSS. `tailwind.config.*` and any plugin config must be ported by hand.
3. **Plugin compatibility.** @tailwindcss/typography and any custom utilities must be checked against 4.x.
4. **Class name changes.** Renamed or removed utilities (the default-scale and opacity changes) can fail silently in templates. A grep of `className` usage is needed before the upgrade.
5. **Lint rule changes.** The eslint plugin upgrade can add or change rules, so the lint step may report new warnings or errors on existing code.
6. **Build time.** Tailwind 4's engine changes the build profile; the staging build must be timed before and after.
7. **Rollback.** The change must ship as one PR with the lockfile, so reverting it restores the working build.

## Gate before merge

- Full build and tests green on a staging deploy.
- Visual diff reviewed for the top templates (home, a set page, a review, a guide, the admin pages).
- Owner sign-off on the visual diff.
- Exception file updated: either the entry is removed (fix shipped) or renewed with the reason.

## Not in this note

The Python requirements files (55 open alerts, not read by `npm audit`) are a separate item and are not covered here.
