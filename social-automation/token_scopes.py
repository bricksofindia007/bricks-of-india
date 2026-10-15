"""Scope decision for the read-only YouTube login check (no imports, so it can be tested alone).

Required: upload (posting) and read access to the channel. A missing required scope fails the check.
Optional: full-control (force-ssl) and analytics. A missing optional scope prints a warning and does
not fail the check, because the posting path does not use them.
"""

UPLOAD = 'https://www.googleapis.com/auth/youtube.upload'
READ = 'https://www.googleapis.com/auth/youtube.readonly'
FORCE_SSL = 'https://www.googleapis.com/auth/youtube.force-ssl'
ANALYTICS = 'https://www.googleapis.com/auth/yt-analytics.readonly'

REQUIRED = [UPLOAD, READ]
OPTIONAL = [FORCE_SSL, ANALYTICS]


def evaluate(granted, title, http_ok):
    """Returns (ok, missing_required, warnings). ok is False when the channel is not the expected
    one, the call failed, or any required scope is missing."""
    granted = set(granted or [])
    missing = [s for s in REQUIRED if s not in granted]
    warnings = [s for s in OPTIONAL if s not in granted]
    ok = bool(http_ok) and title == 'Bricks of India' and not missing
    return ok, missing, warnings
