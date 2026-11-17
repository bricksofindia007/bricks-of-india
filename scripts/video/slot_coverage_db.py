"""Database side of the planned-slot alert. Reads facts, asks slot_coverage.decide(), sends once per slot.

NOT RUN AGAINST THE DATABASE in this change. The queries follow the columns the existing
watchdog already reads (cadence.py). The draft PR must not ship until a read-only run has
checked each query against live data (see the PR checklist).
"""
from __future__ import annotations

from datetime import datetime

import slot_coverage as sc

ALERT_KIND = 'slot_no_post'


def _tables(key):
    import cadence  # imported lazily so the pure module needs no database client
    if key == 'VID-P4':
        return cadence.VIDP4
    if key == 'VID-QP':
        return cadence.VIDQP
    return None


def load_facts(sb, key: str, slot_start: datetime, now: datetime) -> sc.Facts:
    """Read what the database shows for one slot window [slot_start, now]."""
    start_iso, now_iso = slot_start.isoformat(), now.isoformat()
    if key == 'SOCIAL':
        posted = (sb.table('posted_sets').select('id, posted_at')
                  .gte('posted_at', start_iso).lte('posted_at', now_iso).limit(1).execute().data or [])
        return sc.Facts(posted=posted)

    p = _tables(key)
    posted = []
    for col in ('ig_posted_at', 'yt_posted_at'):
        posted += (sb.table(p.table).select('id').gte(col, start_iso).lte(col, now_iso)
                   .limit(1).execute().data or [])

    rows = (sb.table(p.table).select(f'id, {p.order_column}, set_title, status, approved_at')
            .in_('status', ['approved', 'publish_blocked', 'pending_approval']).execute().data or [])
    attempts = (sb.table('publish_attempts').select('row_id, outcome, detail, attempted_at')
                .eq('pipeline', p.key).gte('attempted_at', start_iso).lte('attempted_at', now_iso)
                .order('attempted_at').execute().data or [])
    last_reason = {}
    for a in attempts:
        if a.get('row_id'):
            last_reason[a['row_id']] = f"{a.get('outcome')}: {a.get('detail') or 'no detail'}"

    blocked, pending = [], []
    for r in rows:
        item = {'row_number': r.get(p.order_column), 'set_title': r.get('set_title'), 'status': r.get('status'),
                'reason': last_reason.get(r['id'])}
        if r.get('status') == 'pending_approval':
            pending.append(item)
        else:  # approved (waiting, not posted) or publish_blocked
            blocked.append(item)
    return sc.Facts(posted=posted, blocked=blocked, pending=pending)


def already_alerted(sb, key_str: str) -> bool:
    rows = (sb.table('publish_attempts').select('id').eq('kind', ALERT_KIND).eq('detail', key_str)
            .limit(1).execute().data or [])
    return bool(rows)


def check_and_send(sb, key: str, now_utc: datetime, send, dry_run: bool = False) -> dict:
    """Judge the latest due slot for `key`. Calls send(alert) at most once per slot.

    dry_run: send() is called with the alert, but nothing is recorded (no dedupe row).
    Returns a summary dict (printed by the CLI; never silent).
    """
    slot = sc.latest_due_slot(key, now_utc)
    if slot is None:
        return {'pipeline': key, 'action': 'no_due_slot'}
    dk = sc.dedupe_key(key, slot)
    if already_alerted(sb, dk):
        return {'pipeline': key, 'slot': slot.isoformat(), 'action': 'already_alerted'}
    facts = load_facts(sb, key, slot, now_utc)
    alert = sc.decide(key, slot, now_utc, facts)
    if alert is None:
        return {'pipeline': key, 'slot': slot.isoformat(), 'action': 'posted_or_not_due'}
    send(alert)
    if dry_run:
        return {'pipeline': key, 'slot': slot.isoformat(), 'action': 'would_alert (dry-run, nothing recorded)',
                'kind': alert.kind}
    sb.table('publish_attempts').insert({
        'pipeline': key, 'kind': ALERT_KIND, 'outcome': 'alerted', 'detail': dk,
        'attempted_at': now_utc.isoformat(),
    }).execute()
    return {'pipeline': key, 'slot': slot.isoformat(), 'action': 'alerted', 'kind': alert.kind}
