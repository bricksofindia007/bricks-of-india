# BOI Session Start Protocol

Every session — before any code is written — terminal must run this checklist and paste the output as the first message to the strategic layer (Claude chat).

## Step 1: Read ground truth
- Read docs/handover/[most recent Ground Truth].md
- Read docs/BRIEF_DEFECTS.md
- Read docs/BOI_PROJECT_STATUS_[latest].md
- Note: deprecated Ground Truth files (Day_9_Ground_Truth.md, Day_9_Ground_Truth_FINAL.md, Day_9_Ground_Truth_FINAL_v2.md) — skip these

## Step 2: Verify live state (read-only)
- Run: git log --oneline -5
- Run: git status
- Check: cat docs/handover/[most recent Ground Truth].md | grep -E "OPEN|DEFERRED|P1|P2"

## Step 3: Report to strategic layer
Paste a 10-line summary: last commit, top 3 open P1 items, any expiry deadlines in next 30 days, current health score if known.

## Step 4: Await instruction
Do not begin execution until strategic layer confirms the session goal.
