"""
FP6.4 quota guard wiring for the social pipeline (P4 Step 2). Puts the repo
root on sys.path, re-exports config/quota_guard.py, and binds its alerts to
this pipeline's EXISTING sender (notifier._send) -- no new provider call.
"""

from __future__ import annotations

import html
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config.quota_guard import QuotaBlockedError, check_upload  # noqa: E402,F401


def _alert(subject: str, body: str) -> None:
    import notifier
    notifier._send(subject, f'<pre style="font-family:inherit;white-space:pre-wrap">{html.escape(body)}</pre>')


def guard_upload(client, what: str) -> None:
    check_upload(client, 'SOC-AUTO', what, _alert)


def preflight_or_exit(client) -> None:
    try:
        guard_upload(client, 'this run (pre-flight)')
    except QuotaBlockedError as exc:
        print(f'[quota-guard] SOC-AUTO run skipped: {exc}')
        sys.exit(0)
