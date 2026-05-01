# BOI Agent Instructions

**Canonical reference:** `BOI_MASTER_TRACKER.md` — read this at the start of every session.

**Dashboard sync:** see `BOI_MASTER_TRACKER.md` § Auto-update protocol — every state change updates `admin/dashboard.html` in the same commit.

**Dashboard validation:** at session start, confirm `admin/dashboard.html` JSON parses cleanly before doing anything else. If it doesn't, fix first.

**Brief files:** task briefs live in `briefs/`. Read the relevant brief before executing any scoped task.

**Data sources runbook:** `DATA_SOURCES.md` — consult before touching any ingest script or Supabase schema.

**Next.js middleware:** to expose request data to Server Components via `headers()`, use `NextResponse.next({ request: { headers } })`. `response.headers.set()` is browser-only and invisible to `headers()` — silent failure, no error thrown.

**Git staging:** never `git add -A` or `git add .`. Always name files explicitly. Diagnostic files in the working tree have drifted into commits twice.
