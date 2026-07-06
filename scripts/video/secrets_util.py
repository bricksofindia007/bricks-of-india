"""
secrets_util.py — BOM-safe secret loading for VID-P4.

GitHub Secrets copied from BOM-encoded source files carry a leading U+FEFF
byte -- invisible in the GitHub UI, but breaks any Bearer-auth header built
from the raw value ('ascii'/'latin-1' codec can't encode character '﻿').
CLAUDE.md already documents and centralizes this fix for the Next.js/TS side
(getSecret() in src/lib/get-secret.ts, covering SUPABASE_SERVICE_ROLE_KEY,
GEMINI_API_KEY, CEREBRAS_API_KEY) -- but that helper is TypeScript-only and
this pipeline is Python, so it was never covered.

Confirmed live, 2026-07-06, during the Stage 1 feasibility test: both
GEMINI_SOCIAL_API_KEY and CEREBRAS_API_KEY (as stored in GitHub Secrets)
carry this exact BOM, causing every script-generation call to fail on a
standard runner. RESEND_API_KEY was found and fixed the same day, in both
this pipeline's notifier.py and social-automation/notifier.py.

Given the pattern has now recurred three times across four secrets in one
day, every secret this pipeline reads goes through this one function instead
of a bare os.environ.get(), so a fifth occurrence doesn't need a fifth
one-off fix.
"""

import os


def get_secret(name: str, default: str = '') -> str:
    return os.environ.get(name, default).lstrip('﻿').strip()
