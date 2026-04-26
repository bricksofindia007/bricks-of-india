# BOI Agent Instructions

**Canonical reference:** `BOI_MASTER_TRACKER.md` — read this at the start of every session.

**Dashboard sync:** see `BOI_MASTER_TRACKER.md` § Auto-update protocol — every state change updates `admin/dashboard.html` in the same commit.

**Dashboard validation:** at session start, confirm `admin/dashboard.html` JSON parses cleanly before doing anything else. If it doesn't, fix first.

**Brief files:** task briefs live in `briefs/`. Read the relevant brief before executing any scoped task.

**Data sources runbook:** `DATA_SOURCES.md` — consult before touching any ingest script or Supabase schema.
