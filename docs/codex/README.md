# Voice Codex

Canonical Voice Codex for Bricks of India.
Defines BOI editorial voice, India Paragraph spec, verdict taxonomy,
and content length system.

## Files

- `BOI_Codex_v2.docx` — source of truth, edited in Word
- `BOI_Codex_v2.md` — markdown export for diff visibility (regenerate
  after every .docx update)

## Updating the Codex

1. Edit `BOI_Codex_v2.docx` in Word
2. Regenerate the markdown export:

       # Pandoc preferred (if installed):
       #   pandoc docs/codex/BOI_Codex_v2.docx -o docs/codex/BOI_Codex_v2.md
       # Otherwise, use the bundled Node.js script:
       node scripts/export-codex-md.js

3. Commit both files in the same commit
4. Update `BOI_MASTER_TRACKER.md` "Codex version" field if making
   a major revision

## Why this exists in the repo

All downstream content workstreams read from this Codex:

- RADAR-01 (Topical Radar) — uses India Paragraph template
- WEB-01 (lint gates) — parses verdict enum from .md export
- CONTENT-02 (Claude Project workbench) — reads Codex as system prompt
- Shorts/Reels scripts — voice rules
- Instagram carousels — tone and pacing rules

Version control means one source of truth, not "wherever the founder
last edited," and drift is caught via diff.
