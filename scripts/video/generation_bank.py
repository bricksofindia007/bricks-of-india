"""
generation_bank.py -- VID-P4 generation skip when the bank is full (P23b).

If the count of approved, unposted VID-P4 videos is BANK_LIMIT or more,
generation is skipped and one plain line is logged. The quiet-panic
generator does not use this module.
"""

from __future__ import annotations

from datetime import datetime

import cadence

BANK_LIMIT = 4


def decide(approved_unposted: int, now_utc: datetime) -> tuple[bool, str]:
    """Pure decision. Returns (generate, one plain log line)."""
    day = cadence.ist_date(now_utc)
    if approved_unposted >= BANK_LIMIT:
        return False, (
            f'VID-P4 generation skipped on {day:%a %Y-%m-%d} (IST): '
            f'{approved_unposted} approved, unposted video(s) in the bank (limit {BANK_LIMIT}).'
        )
    return True, (
        f'VID-P4 generation: {approved_unposted} approved, unposted video(s) in the bank '
        f'(limit {BANK_LIMIT}); generating.'
    )


def count_approved(sb) -> int:
    """Number of video_posts rows with status 'approved' (approved and not yet posted)."""
    res = sb.table('video_posts').select('id', count='exact').eq('status', 'approved').execute()
    count = getattr(res, 'count', None)
    if count is not None:
        return int(count)
    return len(res.data or [])


def bank_decision(sb, now_utc: datetime) -> tuple[bool, str]:
    return decide(count_approved(sb), now_utc)
