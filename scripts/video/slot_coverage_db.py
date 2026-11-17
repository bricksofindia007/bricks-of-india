"""Database side of the planned-slot alert. Reads facts, asks slot_coverage for the alerts, sends once per slot.

NOT RUN AGAINST THE DATABASE in this change. The queries follow the columns the existing
watchdog already reads (cadence.py). The draft PR must not ship until a read-only run has
checked each query against live data (see the PR checklist).

Reads, per pipeline:
  * posted rows: [slot start, next slot start or now] (video: ig_posted_at / yt_posted_at; social: posted_sets.posted_at);
  * waiting rows: status approved, publish_blocked or pending_approval (no time window, as before);
  * publish attempts: the whole lookback, for the reason of each waiting row;
  * alerts already sent: the whole lookback, for the dedupe keys.
"""
from __future__ import annotations

from datetime import datetime, timedelta

import slot_coverage as sc

ALERT_KIND = 'slot_no_post'


def _tables(key):
    import cadence  # imported lazily so the pure module needs no database client
    if key == 'VID-P4':
        return cadence.VIDP4
    if key == 'VID-QP':
        return cadence.VIDQP
    return None


def load_facts(sb, key: str, slot_start: datetime, end: datetime, lookback_start: datetime,
               now: datetime) -> sc.Facts:
    """Read what the database shows for one slot: posts in [slot_start, end], reasons from the lookback."""
    start_iso, end_iso = slot_start.isoformat(), end.isoformat()
    if key == 'SOCIAL':
        posted = (sb.table('posted_sets').select('id, posted_at')
                  .gte('posted_at', start_iso).lte('posted_at', end_iso).limit(1).execute().data or [])
        return sc.Facts(posted=posted)

    p = _tables(key)
    posted = []
    for col in ('ig_posted_at', 'yt_posted_at'):
        posted += (sb.table(p.table).select('id').gte(col, start_iso).lte(col, end_iso)
                   .limit(1).execute().data or [])

    rows = (sb.table(p.table).select(f'id, {p.order_column}, set_title, status, approved_at')
            .in_('status', ['approved', 'publish_blocked', 'pending_approval']).limit(200).execute().data or [])
    attempts = (sb.table('publish_attempts').select('row_id, outcome, detail, attempted_at')
                .eq('pipeline', p.key).gte('attempted_at', lookback_start.isoformat())
                .lte('attempted_at', now.isoformat())
                .order('attempted_at').limit(500).execute().data or [])
    last_reason = {}
    for a in attempts:
        if a.get('row_id'):
            last_reason[a['row_id']] = f"{a.get('outcome')}: {a.get('detail') or 'no detail'}"

    blocked, pending = [], []
    for r in rows:
        item = {'row_number': r.get(p.order_column), 'set_title': r.get('set_title'), 'status': r.get('status'),
                'reason': last_reason.get(r['id']), 'approved_at': r.get('approved_at')}
        if r.get('status') == 'pending_approval':
            pending.append(item)
        else:  # approved (waiting, not posted) or publish_blocked
            blocked.append(item)
    return sc.Facts(posted=posted, blocked=blocked, pending=pending)


def already_alerted_keys(sb, lookback_start: datetime) -> set:
    """Dedupe keys of every slot alert sent inside the lookback."""
    rows = (sb.table('publish_attempts').select('detail').eq('kind', ALERT_KIND)
            .gte('attempted_at', lookback_start.isoformat()).limit(500).execute().data or [])
    return {r['detail'] for r in rows if r.get('detail')}


def check_and_send(sb, key: str, now_utc: datetime, send, dry_run: bool = False) -> list:
    """Judge every missed slot in the lookback for `key`. Calls send(alert) once per slot not yet alerted.

    dry_run: send() is called with each alert, but nothing is recorded (no dedupe row).
    Returns one summary dict per alert (printed by the CLI; never silent).
    """
    lookback_start = now_utc - timedelta(days=sc.LOOKBACK_DAYS)
    already = already_alerted_keys(sb, lookback_start)

    def facts_for(slot, end):
        return load_facts(sb, key, slot, end, lookback_start, now_utc)

    results = []
    for alert in sc.pending_alerts(key, now_utc, facts_for, already):
        send(alert)
        if dry_run:
            results.append({'pipeline': key, 'key': alert.key,
                            'action': 'would_alert (dry-run, nothing recorded)', 'kind': alert.kind})
            continue
        sb.table('publish_attempts').insert({
            'pipeline': key, 'kind': ALERT_KIND, 'outcome': 'alerted', 'detail': alert.key,
            'attempted_at': now_utc.isoformat(),
        }).execute()
        results.append({'pipeline': key, 'key': alert.key, 'action': 'alerted', 'kind': alert.kind})
    if not results:
        results.append({'pipeline': key, 'action': 'nothing_to_send'})
    return results
