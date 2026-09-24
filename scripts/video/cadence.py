"""
cadence.py -- posting-cadence rules shared by both video pipelines (issue #178).

Rule (Abhinav, 2026-09-24): max 1 post per day per pipeline, per platform.
  - VID-P4 (video_posts): every day, slot opens 19:30 IST.
  - VID-QP (quiet_panic_posts): Mon/Wed/Fri only.
Approved rows queue and drain one per slot. A missing-platform retry counts
toward that platform's daily cap -- if the platform already posted today,
the retry is deferred to the next slot. Nothing is skipped silently: every
publish/retry outcome is written to public.publish_attempts, and
check_missed_slot() emails an alert the morning after any slot where an
approved row was waiting and nothing went out.

Pure date/slot logic takes now_utc explicitly (never reads the clock) so it
is directly testable -- see scripts/video/test_cadence.py. DB helpers take a
supabase client and never raise out of the recording path: a failure to
record an attempt must not stop a publish.

Deliberately a neutral module (no engine.py / publish.py imports), so
publish_quiet_panic.py's standing isolation from VID-P4 code still holds --
both pipelines import this, neither imports the other.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone

IST_OFFSET = timedelta(hours=5, minutes=30)
POSTED_STATUSES = ('posted_ig', 'posted_yt', 'posted_both')
PLATFORMS = ('ig', 'yt')


@dataclass(frozen=True)
class Pipeline:
    key: str                     # 'vidp4' | 'vidqp' -- publish_attempts.pipeline
    label: str                   # human label for alerts
    table: str
    order_column: str            # queue order -- story_number / sequence_number
    slot_weekdays: frozenset     # IST weekdays (Mon=0) that have a slot
    slot_start_ist: tuple        # (hour, minute) IST the slot opens


VIDP4 = Pipeline(
    key='vidp4', label='VID-P4', table='video_posts', order_column='story_number',
    slot_weekdays=frozenset(range(7)), slot_start_ist=(19, 30),
)

# VID-QP slot days are Mon/Wed/Fri (Abhinav, 2026-09-24). No time-of-day was
# specified for QP -- (0, 0) keeps the pre-existing behaviour of publishing
# on the first poller tick of the slot day (historically ~00:30 IST). That
# time is a real open question, not a decision made here: change
# slot_start_ist if a specific evening time is wanted.
VIDQP = Pipeline(
    key='vidqp', label='VID-QP', table='quiet_panic_posts', order_column='sequence_number',
    slot_weekdays=frozenset({0, 2, 4}), slot_start_ist=(0, 0),
)


# ── Pure date/slot logic ────────────────────────────────────────────────────

def ist_date(now_utc: datetime) -> date:
    return (now_utc + IST_OFFSET).date()


def ist_day_bounds_utc(day: date) -> tuple[datetime, datetime]:
    """UTC [start, end) of an IST calendar day."""
    start = datetime.combine(day, time(0, 0), tzinfo=timezone.utc) - IST_OFFSET
    return start, start + timedelta(days=1)


def slot_start_utc(p: Pipeline, day: date) -> datetime:
    h, m = p.slot_start_ist
    return datetime.combine(day, time(h, m), tzinfo=timezone.utc) - IST_OFFSET


def is_slot_day(p: Pipeline, day: date) -> bool:
    return day.weekday() in p.slot_weekdays


def slot_status(p: Pipeline, now_utc: datetime) -> tuple[bool, str]:
    """(open, reason). Open = today (IST) is a slot day and the slot has started."""
    day = ist_date(now_utc)
    if not is_slot_day(p, day):
        return False, f'{p.label}: {day:%a %Y-%m-%d} is not a slot day (slot days: {_weekday_names(p)})'
    if now_utc < slot_start_utc(p, day):
        now_ist = now_utc + IST_OFFSET
        h, m = p.slot_start_ist
        return False, f'{p.label}: before slot ({h:02d}:{m:02d} IST) -- current IST {now_ist:%H:%M}'
    return True, f'{p.label}: slot open for {day:%a %Y-%m-%d}'


def _weekday_names(p: Pipeline) -> str:
    names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    return '/'.join(names[d] for d in sorted(p.slot_weekdays))


def watchdog_slot_day(now_utc: datetime) -> date:
    """The slot day the watchdog should judge. The watchdog is scheduled the
    morning after (00:15 UTC = 05:45 IST, see video-missed-slot-watchdog.yml),
    so the day it checks is always *yesterday* in IST -- computed as the IST
    date 12h earlier, which stays on the right day even with several hours
    of GitHub Actions schedule lag (up to ~6h15m late still lands correctly;
    observed lag on this repo's crons is up to ~4.5h),
    and never judges a day that could still receive a post."""
    return ist_date(now_utc - timedelta(hours=12))


def row_was_waiting_before(row: dict, cutoff_utc: datetime) -> bool:
    """An approved row counts as 'waiting before the slot' if it was approved
    before the slot opened. approved_at is NULL for rows approved before the
    column existed (never back-filled -- not guessed); those were by
    definition approved before any slot this watchdog judges, so NULL counts
    as waiting."""
    raw = row.get('approved_at')
    if not raw:
        return True
    return _parse_ts(raw) < cutoff_utc


def _parse_ts(raw: str) -> datetime:
    return datetime.fromisoformat(raw.replace('Z', '+00:00'))


# ── DB helpers ──────────────────────────────────────────────────────────────

def _posted_in(sb, p: Pipeline, column: str, start: datetime, end: datetime) -> str | None:
    res = (
        sb.table(p.table).select('id')
        .gte(column, start.isoformat()).lt(column, end.isoformat())
        .limit(1).execute()
    )
    return res.data[0]['id'] if res.data else None


def platform_posted_on(sb, p: Pipeline, platform: str, day: date) -> str | None:
    """Row id that went live on `platform` during IST `day`, or None.
    Checks the per-platform timestamp (ig_posted_at / yt_posted_at, set from
    2026-09-24 on) and, for rows published before those columns existed,
    the row-level posted_at of any posted_* row."""
    if platform not in PLATFORMS:
        raise ValueError(f'platform must be ig|yt, got {platform!r}')
    start, end = ist_day_bounds_utc(day)
    hit = _posted_in(sb, p, f'{platform}_posted_at', start, end)
    if hit:
        return hit
    res = (
        sb.table(p.table).select('id, status, ig_posted_at, yt_posted_at')
        .in_('status', list(POSTED_STATUSES))
        .gte('posted_at', start.isoformat()).lt('posted_at', end.isoformat())
        .execute()
    )
    for r in res.data or []:
        # Legacy row (no per-platform timestamps at all): posted_at covers
        # whichever platform(s) its status says went live.
        if r.get('ig_posted_at') is None and r.get('yt_posted_at') is None:
            if r['status'] == 'posted_both' or r['status'] == f'posted_{platform}':
                return r['id']
    return None


def anything_posted_on(sb, p: Pipeline, day: date) -> str | None:
    for platform in PLATFORMS:
        hit = platform_posted_on(sb, p, platform, day)
        if hit:
            return hit
    return None


def record_attempt(sb, p: Pipeline, row: dict | None, kind: str, outcome: str,
                   platform: str | None = None, detail: str | None = None) -> None:
    """Append one publish_attempts row. Never raises -- recording is an audit
    trail for the watchdog, it must not be able to break a publish."""
    try:
        sb.table('publish_attempts').insert({
            'pipeline': p.key,
            'row_id': (row or {}).get('id'),
            'row_number': (row or {}).get(p.order_column),
            'kind': kind,
            'platform': platform,
            'outcome': outcome,
            'detail': (detail or '')[:2000] or None,
        }).execute()
    except Exception as exc:  # noqa: BLE001 -- deliberate: see docstring
        print(f'[cadence] WARN: could not record publish attempt ({kind}/{outcome}): {exc}', file=sys.stderr)


def alerted_today(sb, p: Pipeline, kind: str, row_id: str | None, day: date) -> bool:
    """True if an alert of this kind for this row was already recorded during
    IST `day` -- keeps a persistently failing row to one email per day
    instead of one per poller tick."""
    start, end = ist_day_bounds_utc(day)
    q = (
        sb.table('publish_attempts').select('id')
        .eq('pipeline', p.key).eq('kind', kind).eq('outcome', 'alerted')
        .gte('attempted_at', start.isoformat()).lt('attempted_at', end.isoformat())
    )
    q = q.eq('row_id', row_id) if row_id else q.is_('row_id', 'null')
    try:
        return bool(q.limit(1).execute().data)
    except Exception as exc:  # noqa: BLE001
        print(f'[cadence] WARN: alert-dedupe lookup failed, sending anyway: {exc}', file=sys.stderr)
        return False


def check_missed_slot(sb, p: Pipeline, now_utc: datetime, send_alert) -> dict:
    """
    Missed-slot watchdog. Judges watchdog_slot_day(now_utc): if it was a slot
    day, an approved row was waiting before the slot opened (or a publish was
    attempted that day), and nothing went live on either platform, calls
    send_alert(pipeline, day, blocked_rows) exactly once for that day.

    blocked_rows: [{'row_id', 'row_number', 'set_title', 'status', 'reason'}],
    reason taken from that day's publish_attempts (latest per row), or an
    explicit 'no publish attempt recorded' when the poller never reached it.

    Returns a summary dict (printed by the CLI) -- never silent.
    """
    day = watchdog_slot_day(now_utc)
    summary = {'pipeline': p.key, 'day': day.isoformat(), 'action': None, 'blocked': []}

    if not is_slot_day(p, day):
        summary['action'] = 'not_a_slot_day'
        return summary

    posted = anything_posted_on(sb, p, day)
    if posted:
        summary['action'] = 'posted'
        summary['posted_row'] = posted
        return summary

    slot_utc = slot_start_utc(p, day)
    day_start, day_end = ist_day_bounds_utc(day)

    approved = (
        sb.table(p.table).select(f'id, {p.order_column}, set_title, status, approved_at')
        .eq('status', 'approved').order(p.order_column).execute().data or []
    )
    waiting = [r for r in approved if row_was_waiting_before(r, slot_utc)]

    attempts = (
        sb.table('publish_attempts').select('row_id, row_number, kind, platform, outcome, detail, attempted_at')
        .eq('pipeline', p.key).in_('kind', ['publish', 'retry'])
        .gte('attempted_at', day_start.isoformat()).lt('attempted_at', day_end.isoformat())
        .order('attempted_at').execute().data or []
    )
    latest_by_row: dict = {}
    for a in attempts:
        if a.get('row_id'):
            latest_by_row[a['row_id']] = a

    rows_by_id = {r['id']: r for r in waiting}
    # Rows attempted that day but no longer 'approved' (e.g. moved to
    # publish_blocked by a guard) still explain the miss -- include them.
    missing_ids = [rid for rid in latest_by_row if rid not in rows_by_id]
    if missing_ids:
        extra = (
            sb.table(p.table).select(f'id, {p.order_column}, set_title, status, approved_at')
            .in_('id', missing_ids).execute().data or []
        )
        for r in extra:
            rows_by_id[r['id']] = r

    if not rows_by_id:
        summary['action'] = 'queue_empty'
        return summary

    blocked = []
    for rid, r in sorted(rows_by_id.items(), key=lambda kv: (kv[1].get(p.order_column) or 0)):
        a = latest_by_row.get(rid)
        if a:
            reason = f"{a['kind']}/{a['outcome']}" + (f" ({a['platform']})" if a.get('platform') else '') + f": {a.get('detail') or 'no detail'}"
        else:
            reason = 'no publish attempt recorded for this row on the slot day -- the poller never reached it (check that day\'s poller runs: crash, outage, or schedule not firing)'
        blocked.append({
            'row_id': rid, 'row_number': r.get(p.order_column), 'set_title': r.get('set_title'),
            'status': r.get('status'), 'reason': reason,
        })
    summary['blocked'] = blocked

    if alerted_today_for_day(sb, p, day):
        summary['action'] = 'already_alerted'
        return summary

    send_alert(p, day, blocked)
    record_attempt(sb, p, None, 'missed_slot_alert', 'alerted', detail=f'slot_day={day.isoformat()}; {len(blocked)} row(s)')
    summary['action'] = 'alerted'
    return summary


def alerted_today_for_day(sb, p: Pipeline, day: date) -> bool:
    """Missed-slot alerts are deduped per slot day via detail='slot_day=…',
    since the watchdog itself runs on the following IST day."""
    res = (
        sb.table('publish_attempts').select('id')
        .eq('pipeline', p.key).eq('kind', 'missed_slot_alert').eq('outcome', 'alerted')
        .like('detail', f'slot_day={day.isoformat()};%')
        .limit(1).execute()
    )
    return bool(res.data)
