"""Order 1944 item 5 (PR 993): one owner email when a Quiet Panic row becomes publish_blocked, for any reason.

Every writer that sets quiet_panic_posts.status to 'publish_blocked' calls notify_blocked(). The email is sent once per row:
public.alert_state holds the key 'qp-blocked:<row id>' after a successful send.
- If that key cannot be read, nothing is sent (a duplicate is worse than a late notice).
- If the send fails, nothing is recorded, so the next run can retry.
- If the send works but the record fails, the next run may send once more; the failure is printed.
"""
from __future__ import annotations

import sys
from datetime import datetime, timezone

KEY_PREFIX = 'qp-blocked:'


def blocked_key(row_id) -> str:
    return f'{KEY_PREFIX}{row_id}'


def already_sent(sb, key: str) -> bool:
    res = sb.table('alert_state').select('key').eq('key', key).limit(1).execute()
    return bool(res.data)


def record_sent(sb, key: str) -> None:
    sb.table('alert_state').upsert({
        'key': key,
        'band': 'sent',
        'updated_at': datetime.now(timezone.utc).isoformat(),
    }).execute()


def notify_blocked(sb, row_id, *, reason: str, set_title=None, set_number=None, send=None) -> bool:
    """Send the owner notice for this row once. Returns True only when an email was sent now."""
    key = blocked_key(row_id)
    try:
        if already_sent(sb, key):
            return False
    except Exception as exc:
        print(f'[qp-blocked] could not read {key}; no email sent: {exc}', file=sys.stderr)
        return False
    if send is None:
        import notifier
        send = notifier.send_qp_blocked_notice
    try:
        send(row_id=row_id, reason=reason, set_title=set_title, set_number=set_number)
    except Exception as exc:
        print(f'[qp-blocked] owner email failed for {row_id}; will retry on the next run: {exc}', file=sys.stderr)
        return False
    try:
        record_sent(sb, key)
    except Exception as exc:
        print(f'[qp-blocked] sent for {row_id} but not recorded; it may send once more: {exc}', file=sys.stderr)
    return True